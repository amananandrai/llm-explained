---
title: "Every Open LLM Is the Same Machine: An Interactive Atlas of 130+ Transformer Architectures"
published: false
description: "LLM Explained now has an Architecture Atlas: the transformer drawn in three eras, config-generated diagrams for Llama, DeepSeek, Qwen, Gemma and more, a concept-by-model comparison matrix, and a searchable gallery of 120 open-weight architectures."
tags: ai, machinelearning, llm, webdev
cover_image: https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/05-model-deepseek.png
canonical_url:
---

A few weeks ago I wrote about [LLM Explained](https://dev.to/amananandrai/i-built-llm-explained-43-interactive-pages-that-take-you-from-tokens-to-ai-agents-2n37), a free, open-source course of **43 interactive pages** that takes you from tokens to AI agents. Each page has a scroll-driven animation, an Intuition / Mechanics / Maths depth switch, runnable Python and a short quiz.

The most common question I got afterwards was some version of:

> "OK, I understand attention. But what is actually *different* between Llama, DeepSeek, Qwen and Gemma?"

So I built the answer into the site: an **Architecture Atlas**.

👉 **Live:** https://llm-explained-lovat.vercel.app/#arch
⭐ **Repo:** https://github.com/amananandrai/llm-explained

---

## The one idea behind the atlas

Every large language model you can download today is **the same machine**: a stack of identical blocks, each with an attention layer and a feed-forward layer, joined by a residual stream.

The models differ in a **short list of part choices**:

- Which normalisation (LayerNorm, RMSNorm, pre- or post-norm)?
- How is position encoded (sinusoids, learned, RoPE, none)?
- How many key/value heads (MHA, GQA, MLA)?
- Is attention full, windowed, sparse or linear?
- Is the MLP dense, gated (SwiGLU / GeGLU) or a mixture of experts?

Once you see the machine, every new model release becomes a diff instead of a mystery. The atlas is built around that idea, in four sections.

---

## 1. The transformer, drawn in three eras

The first widget redraws the classic transformer three times, so you can watch the design evolve:

**2017: the original encoder–decoder** from *Attention Is All You Need*. Two towers, post-norm, sinusoidal positions, and cross-attention as the bridge between them.

![The 2017 encoder-decoder transformer, with the cross-attention block selected and explained](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/03-transformer-2017.png)

**2019: the GPT-style decoder.** The encoder and cross-attention disappear. The prompt and the answer become one sequence, and the norm moves before each sub-layer.

![The GPT-2 style decoder-only transformer](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/03b-transformer-gpt.png)

**2023 onwards: the modern open-model block.** It's the same skeleton with four part swaps: RMSNorm, rotary positions inside attention, grouped-query attention with a KV cache, and a SwiGLU MLP (or a mixture of experts).

![The modern open-model block, with grouped-query attention and RoPE selected](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/04-transformer-modern.png)

You can **click any block** to see what it does, its tensor shapes in the *Mechanics* view, and links to the modules that teach it. The diagram is a doorway into the course, not a dead end.

---

## 2. Open-weight models, generated from their configs

The second widget is my favourite. Pick a family (**Llama, Mistral, Qwen, DeepSeek, Kimi, Gemma, Phi, gpt-oss**) and the whole diagram is **generated from that model's configuration**. The block labels, the expert grid, the KV-cache inset, the layer strip and every number are computed, not drawn by hand.

Here's DeepSeek-V3. You can see multi-head latent attention caching one 576-number latent per token instead of 128 heads of K and V (57× smaller), and 256 routed experts with 8 active per token plus one shared expert:

![DeepSeek-V3 architecture diagram generated from its config, showing MLA and MoE insets](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/05-model-deepseek.png)

Switch to Gemma 3 and the picture changes: interleaved local/global attention, norms before *and* after each sub-layer, tied embeddings and image input:

![Gemma 3 architecture diagram with sliding-window layers](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/06-model-gemma.png)

**Can you trust the numbers?** Each model is marked either as checked against the vendor's config or model card, or as confirmed by reproducing the published parameter count. All 14 configs reproduce their published size to within 0.3% (except Kimi K2, which is published as a rounded "1T"). Adding a new model takes one config entry, and the diagram, spec card, diff and matrix all pick it up.

Under every diagram, a row of **concept chips** (RoPE · M5, MLA · M10, KV cache · M11, MoE · M12…) links each idea inside the model to the module that teaches it.

---

## 3. The comparison: concept by model

Diagrams are great for one model at a time. For comparisons you want a table, so the third section is a **concept-by-model matrix**:

![Concept-by-model comparison matrix and computed sizes table](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/07-concept-matrix.png)

Read **down a column** for one model's recipe, or **across a row** to see how far an idea has spread. A few things jump out straight away:

| Observation | What the matrix shows |
|---|---|
| Everyone agrees on the basics | Decoder-only, pre-norm RMSNorm, RoPE and a gated MLP appear in every column |
| GQA is the default for KV heads | 32:8 for Llama/Mistral/Qwen, 64:4 for Qwen3-235B, 40:10 for Phi-4 |
| MLA is the alternative | DeepSeek-V3 and Kimi K2 use a 512-dim latent instead |
| MoE is how models scale cheaply | Mixtral 2/8, Qwen3 8/128, DeepSeek 8/256, Kimi K2 8/384, gpt-oss 4/32 |
| KV cache size varies 8× | From 48 KB/token (gpt-oss-20b) to 384 KB/token (Gemma 3 12B) |

The sizes table underneath (total params, active per token, layers × width, KV cache per token) is computed from the same configs. It shows why "671B parameters" (DeepSeek-V3) can still mean only ~37B active per token.

---

## 4. The gallery: 120 more architectures

Fourteen hand-checked models are not enough to keep up with how fast new models are released. So the atlas ends with a **searchable gallery of 120 open-weight architectures**, from GPT-2 to this month's releases:

![Architecture gallery grid with search, filters and per-model layer strips](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/08-gallery-grid.png)

Each card has a **layer strip**: one cell per layer, coloured by what that layer is (full attention, sliding-window, latent/sparse, linear attention, state-space/convolution…). You can tell a hybrid model from a pure-attention one at a glance, without reading a paper.

You can:

- 🔎 **Search** by model, company or attention type
- 🧩 **Filter** by Dense / MoE / Hybrid or by sequence mixer
- ↕️ **Sort** newest or oldest first
- 📂 **Open a card** for a block schematic, the full layer-by-layer strip, a facts table (size, context, vocab, KV cache, licence) and "ideas used" chips that link back to the course

![Gallery detail for a hybrid model: schematic, layer strip, facts table and concept chips](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/09-gallery-detail.png)

Some numbers from the snapshot: **57 sparse MoE**, **29 dense** and **29 hybrid** models (plus a few omnimodal, encoder–decoder and recurrent ones). RoPE appears in 104 of them, GQA in 73 and MLA in 30. Sliding-window attention, gated attention and Gated DeltaNet are the ideas spreading fastest.

**Credit where it's due:** the gallery data comes from the public snapshot of Sebastian Raschka's excellent [LLM Architecture Gallery](https://sebastianraschka.com/llm-architecture-gallery/) ([repo](https://github.com/rasbt/llm-architecture-gallery), Apache 2.0). A script (`scripts/build_gallery.py`) turns it into a small data file. Only descriptive fields are kept (no images or benchmark scores), and the strips and schematics are drawn by the site.

---

## How it's built

No frameworks and no build step, just like the rest of the course:

```
assets/arch.js      model configs (MODELS), parameter + KV-cache counters,
                    SVG stack renderer, transformerDiagram / modelDiagram /
                    conceptMatrix, and the atlas page
assets/gallery.js   generated by scripts/build_gallery.py, lazy-loaded
                    only when you open the atlas
```

- **One source of truth per model.** A config object (layers, d_model, heads, KV heads, experts, window pattern, vocab…) drives the diagram, the counters, the matrix row and the spec card.
- **Counters as validation.** Parameter and KV-cache counts are computed from the config and compared with the published number. If they don't match, the config is wrong.
- **Lazy loading.** The 86 KB gallery file only downloads when you open the atlas.
- **The same widgets are reused** inside Module 6 (encoder vs decoder) and Module 16 (spec cards, parameter counter, architecture diff).

---

## Why this helps you actually *understand* LLMs

I've read a lot of architecture explainers. The ones that stuck had three things in common, and I tried to build all three in:

1. **One mental model, many instances.** Seeing Llama, DeepSeek and Gemma drawn on the *same* skeleton turns ten "new" architectures into a handful of choices. You stop memorising models and start recognising patterns.
2. **Every part links to its explanation.** If you don't know what MLA is, it's one click away, in a module with an animation, a widget and runnable Python:

   ![A scroll-driven animation in Module 5, computing attention scores step by step](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/11-module-scrolly.png)

3. **Numbers you can trace.** "57× smaller KV cache" or "3.5% of MLP weights active per token" aren't marketing claims here. They're computed from the config in front of you, so you can check them yourself.

It also works as a **quick reference**. When a new model drops, open the gallery, look at its layer strip, and you'll know within ten seconds whether it's a standard GQA + MoE stack or something new.

And if you're starting from zero, the [curriculum](https://llm-explained-lovat.vercel.app/#map) takes you there in order:

![The LLM Explained curriculum map: 42 modules in seven parts](https://raw.githubusercontent.com/amananandrai/llm-explained/claude/cool-ramanujan-xqgm0f/docs/blog/img/01-home.png)

---

## ⭐ If this helped, please star the repo

LLM Explained is free, open source and has no sign-up. Stars are how other learners find it, so if the atlas helped you understand even one architecture, a star would mean a lot:

### 👉 [github.com/amananandrai/llm-explained](https://github.com/amananandrai/llm-explained) ⭐

## 💬 I'd love your suggestions

I'm planning the next round of updates and would like to hear from you in the comments:

- **Which model should get a full config-generated diagram next?** (Currently Llama, Mistral, Mixtral, Qwen3, DeepSeek-V3, Kimi K2, Gemma 3, Phi-4 and gpt-oss.)
- **Which architecture idea is still confusing** after reading the atlas? MLA, sliding windows, linear attention, hybrids?
- **What would make the comparison more useful?** A side-by-side diff of any two models? Memory estimates for your GPU?
- Found a wrong number? Please [open an issue](https://github.com/amananandrai/llm-explained/issues). Every config is meant to be checkable.

Pull requests are welcome too: adding a model is a single config entry.

Thanks for reading, and happy learning! 🚀

*Explore the atlas → https://llm-explained-lovat.vercel.app/#arch*
