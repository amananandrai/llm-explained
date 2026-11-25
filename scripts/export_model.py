#!/usr/bin/env python3
"""Export a small GPT-2-family model to ONNX for the site's "real model" widgets.

Off-the-shelf ONNX exports return only logits. Modules 5, 7 and 41 also need the attention weights,
so this script wraps the model to return both:

    input   input_ids  int64   [1, seq]
    output  logits     float32 [vocab]                      next-token logits at the last position
    output  attn       float32 [layers, heads, seq, seq]    attention after softmax

It writes a folder that assets/real.js can read straight from a Hugging Face model repo:

    model_q8.onnx (or model.onnx)   tokenizer.json   tokenizer_config.json   meta.json

Usage
    pip install torch transformers onnx onnxscript onnxruntime huggingface_hub
    python3 scripts/export_model.py                                   # distilgpt2 -> build/real-model/
    python3 scripts/export_model.py --push your-name/llm-explained-distilgpt2
    python3 scripts/export_model.py --model gpt2 --no-quantize

Then set `modelRepo` at the top of assets/real.js to the repo you pushed to.
"""
import argparse
import json
import os
import sys

PROMPTS = [
    "The capital of France is",
    "Once upon a time there was a",
    "The animal didn't cross the street because it was too",
    "def add(a, b):\n    return a +",
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="distilgpt2", help="Hub id or local folder of a causal LM (default: distilgpt2)")
    ap.add_argument("--out", default="build/real-model", help="output folder")
    ap.add_argument("--max-tokens", type=int, default=48, help="longest prompt the widgets will send")
    ap.add_argument("--no-quantize", action="store_true", help="keep 32-bit weights (about 4x larger)")
    ap.add_argument("--push", metavar="USER/REPO", help="upload the folder to this Hugging Face model repo")
    args = ap.parse_args()

    import numpy as np
    import onnxruntime as ort
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    os.makedirs(args.out, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(args.model)
    # "eager" attention is the implementation that can return its weights.
    model = AutoModelForCausalLM.from_pretrained(args.model, attn_implementation="eager").eval()
    cfg = model.config

    class WithAttention(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, input_ids):
            o = self.m(input_ids=input_ids, output_attentions=True, use_cache=False)
            return o.logits[0, -1], torch.stack(o.attentions, 0)[:, 0]

    wrapped = WithAttention(model).eval()
    fp32 = os.path.join(args.out, "model.onnx")
    example = torch.tensor([tok(PROMPTS[0])["input_ids"]], dtype=torch.long)
    with torch.no_grad():
        torch.onnx.export(
            wrapped, (example,), fp32,
            input_names=["input_ids"], output_names=["logits", "attn"],
            dynamic_shapes={"input_ids": {1: torch.export.Dim("seq", min=2, max=1024)}},
            dynamo=True, external_data=False,
        )

    final = fp32
    if not args.no_quantize:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        final = os.path.join(args.out, "model_q8.onnx")
        quantize_dynamic(fp32, final, weight_type=QuantType.QUInt8)
        os.remove(fp32)

    # Check the exported file against PyTorch on a few prompts of different lengths.
    sess = ort.InferenceSession(final, providers=["CPUExecutionProvider"])
    agree, worst_attn, worst_row = 0, 0.0, 0.0
    for p in PROMPTS:
        ids = torch.tensor([tok(p)["input_ids"]], dtype=torch.long)
        with torch.no_grad():
            ref_logits, ref_attn = wrapped(ids)
        logits, attn = sess.run(None, {"input_ids": ids.numpy()})
        assert attn.shape == tuple(ref_attn.shape), (attn.shape, ref_attn.shape)
        agree += int(logits.argmax() == int(ref_logits.argmax()))
        worst_attn = max(worst_attn, float(np.abs(attn - ref_attn.numpy()).max()))
        worst_row = max(worst_row, float(np.abs(attn.sum(-1) - 1).max()))
        print(f"  {p!r:60.60} -> {tok.decode([int(logits.argmax())])!r}")
    print(f"top-1 agreement with PyTorch: {agree}/{len(PROMPTS)}; "
          f"largest attention difference: {worst_attn:.4f}; rows sum to 1 within {worst_row:.1e}")
    if worst_row > 1e-3:
        sys.exit("attention rows do not sum to 1; the export is wrong")
    if args.no_quantize and (agree < len(PROMPTS) or worst_attn > 1e-3):
        sys.exit("the 32-bit export does not match PyTorch")

    tok.save_pretrained(args.out)
    for extra in ("vocab.json", "merges.txt", "special_tokens_map.json", "added_tokens.json", "chat_template.jinja"):
        path = os.path.join(args.out, extra)  # the site only needs tokenizer.json and tokenizer_config.json
        if os.path.exists(path):
            os.remove(path)
    if not os.path.exists(os.path.join(args.out, "tokenizer.json")):
        sys.exit("this model has no fast tokenizer (tokenizer.json); pick another model")

    limit = getattr(cfg, "n_positions", None) or getattr(cfg, "max_position_embeddings", 1024)
    meta = {
        "name": os.path.basename(os.path.normpath(args.model)),
        "source": args.model,
        "file": os.path.basename(final),
        "bytes": os.path.getsize(final),
        "quantized": not args.no_quantize,
        "layers": int(ref_attn.shape[0]),
        "heads": int(ref_attn.shape[1]),
        "d_model": int(getattr(cfg, "n_embd", None) or getattr(cfg, "hidden_size", 0)),
        "vocab": int(cfg.vocab_size),
        "params": int(sum(p.numel() for p in model.parameters())),
        "maxTokens": int(min(args.max_tokens, limit)),
        "top1_agreement": f"{agree}/{len(PROMPTS)}",
    }
    with open(os.path.join(args.out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"wrote {args.out}/ ({meta['bytes'] / 1e6:.1f} MB model, {meta['layers']} layers x {meta['heads']} heads)")

    if args.push:
        from huggingface_hub import HfApi
        api = HfApi()
        api.create_repo(args.push, repo_type="model", exist_ok=True)
        api.upload_folder(folder_path=args.out, repo_id=args.push, repo_type="model")
        print(f"uploaded to https://huggingface.co/{args.push}\nnow set modelRepo: '{args.push}' in assets/real.js")
    else:
        print("next: rerun with --push USER/REPO (after `hf auth login`), then set modelRepo in assets/real.js")


if __name__ == "__main__":
    main()
