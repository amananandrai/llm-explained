/* LLM Explained — architecture diagrams.
   One stack renderer draws (a) the transformer itself in three eras and (b) each open-weight model from its config.
   Used by the Architecture atlas (#arch), Module 6 and Module 16. */
(function () {
  'use strict';
  const { h, s, svg, clear, seg, widget, readout, human, bytes, mix, tokColor, table, rng } = LLM.util;

  /* ------------------------------------------------------------------ model data
     ver 'config': fields checked against the vendor's published config or model card (November 2026).
     ver 'count' : fields transcribed, then confirmed by reproducing the published parameter count.
     pub / pubActive are the vendor's published sizes in billions. */
  const HF = 'https://huggingface.co/';
  const MODELS = {
    'Llama 3.1 8B': { fam: 'Llama', org: 'Meta', year: 2024, V: 128256, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, tied: false, kind: 'GQA', pos: 'RoPE θ=500k', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'BPE (tiktoken-style)', ctx: '128k', lic: 'Llama 3.1 Community', pub: 8.03, ver: 'config', src: HF + 'meta-llama/Llama-3.1-8B-Instruct',
      say: 'The reference recipe. Almost every other card on this page is a diff against this one.' },
    'Llama 3 70B': { fam: 'Llama', org: 'Meta', year: 2024, V: 128256, d: 8192, L: 80, H: 64, KV: 8, dh: 128, ff: 28672, tied: false, kind: 'GQA', pos: 'RoPE θ=500k', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'BPE (tiktoken-style)', ctx: '8k', lic: 'Llama 3 Community', pub: 70.6, ver: 'config', src: HF + 'meta-llama/Meta-Llama-3-70B-Instruct',
      say: 'The same block as the 8B, made wider and deeper. Eight query heads share each K/V head.' },
    'Mistral 7B v0.1': { fam: 'Mistral', org: 'Mistral AI', year: 2023, V: 32000, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, tied: false, kind: 'GQA', win: { size: 4096, pat: 'L' }, pos: 'RoPE θ=10k', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'SentencePiece BPE', ctx: '8k', lic: 'Apache 2.0', pub: 7.24, ver: 'count', src: HF + 'mistralai/Mistral-7B-v0.1',
      say: 'The Llama recipe plus sliding-window attention: every layer looks back 4,096 tokens, and stacking layers extends the reach. Versions from v0.2 dropped the window for a plain 32k context.' },
    'Mixtral 8x7B': { fam: 'Mistral', org: 'Mistral AI', year: 2023, V: 32000, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, tied: false, kind: 'GQA', moe: { E: 8, k: 2, shared: 0, ff: 14336, dense: 0 }, pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'SentencePiece BPE', ctx: '32k', lic: 'Apache 2.0', pub: 46.7, pubActive: 12.9, ver: 'count', src: HF + 'mistralai/Mixtral-8x7B-v0.1',
      say: 'Mistral 7B with each MLP replaced by eight full-size experts; a router picks two per token. Attention is shared, which is why it is 46.7B and not 56B.' },
    'Mistral Small 3 (24B)': { fam: 'Mistral', org: 'Mistral AI', year: 2025, V: 131072, d: 5120, L: 40, H: 32, KV: 8, dh: 128, ff: 32768, tied: false, kind: 'GQA', pos: 'RoPE', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'Tekken (tiktoken-style BPE)', ctx: '32k', lic: 'Apache 2.0', pub: 23.6, ver: 'count', src: HF + 'mistralai/Mistral-Small-24B-Instruct-2501',
      say: 'A dense model with a very wide MLP (6.4 × d) and the larger Tekken vocabulary. No sliding window and no experts: the plain recipe, scaled.' },
    'Qwen2.5 7B': { fam: 'Qwen', org: 'Alibaba', year: 2024, V: 152064, d: 3584, L: 28, H: 28, KV: 4, dh: 128, ff: 18944, tied: false, kind: 'GQA', attnNote: 'bias on Q, K, V', pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'Byte-level BPE', ctx: '32k (128k with YaRN)', lic: 'Apache 2.0', pub: 7.61, ver: 'count', src: HF + 'Qwen/Qwen2.5-7B-Instruct',
      say: 'Narrower than Llama (d = 3,584) with a wider MLP and only four K/V heads, so its KV cache is small. Keeps a bias term on the Q, K and V projections.' },
    'Qwen3 8B': { fam: 'Qwen', org: 'Alibaba', year: 2025, V: 151936, d: 4096, L: 36, H: 32, KV: 8, dh: 128, ff: 12288, tied: false, kind: 'GQA', pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'Byte-level BPE', ctx: '32k (128k with YaRN)', lic: 'Apache 2.0', pub: 8.19, think: 'switchable thinking mode', ver: 'count', src: HF + 'Qwen/Qwen3-8B',
      say: 'Deeper and slimmer than Qwen2.5 (36 layers, MLP 3 × d) and the Q/K/V bias is gone. One set of weights serves both a thinking and a non-thinking mode, switched in the chat template.' },
    'Qwen3 235B-A22B': { fam: 'Qwen', org: 'Alibaba', year: 2025, V: 151936, d: 4096, L: 94, H: 64, KV: 4, dh: 128, ff: 1536, tied: false, kind: 'GQA', moe: { E: 128, k: 8, shared: 0, ff: 1536, dense: 0 }, pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'Byte-level BPE', ctx: '32k (128k with YaRN; 256k in the 2507 release)', lic: 'Apache 2.0', pub: 235, pubActive: 22, think: 'switchable thinking mode', ver: 'count', src: HF + 'Qwen/Qwen3-235B-A22B',
      say: 'A 94-layer stack where every MLP is 128 small experts (width 1,536) with 8 chosen per token and no shared expert. Attention is unusually wide: 64 query heads of 128 dims, twice d.' },
    'DeepSeek-V3': { fam: 'DeepSeek', org: 'DeepSeek', year: 2024, V: 129280, d: 7168, L: 61, H: 128, KV: 128, dh: 128, ff: 18432, tied: false, kind: 'MLA', mla: { qr: 1536, kvr: 512, nope: 128, rope: 64, v: 128 }, moe: { E: 256, k: 8, shared: 1, ff: 2048, dense: 3, denseFf: 18432 }, pos: 'Decoupled RoPE (64 of 192 dims per head)', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'Byte-level BPE', ctx: '128k', lic: 'MIT code; model licence (MIT from V3-0324)', pub: 671, pubActive: 37, think: 'DeepSeek-R1 is this architecture trained to reason', ver: 'config', src: 'https://github.com/deepseek-ai/DeepSeek-V3',
      say: 'Two ideas stacked: multi-head latent attention caches one 576-number latent per token instead of 128 heads of K and V, and every MLP after the first three layers is 256 small routed experts plus one always-on shared expert. DeepSeek-R1 uses the same architecture.' },
    'Kimi K2': { fam: 'Kimi', org: 'Moonshot AI', year: 2025, V: 163840, d: 7168, L: 61, H: 64, KV: 64, dh: 128, ff: 18432, tied: false, kind: 'MLA', mla: { qr: 1536, kvr: 512, nope: 128, rope: 64, v: 128 }, moe: { E: 384, k: 8, shared: 1, ff: 2048, dense: 1, denseFf: 18432 }, pos: 'Decoupled RoPE', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'BPE', ctx: '128k (256k in the 0905 release)', lic: 'Modified MIT', pub: 1000, pubActive: 32, ver: 'config', src: 'https://github.com/MoonshotAI/Kimi-K2',
      say: 'The DeepSeek-V3 design pushed sparser: 384 experts instead of 256 (still 8 per token), half the attention heads, one dense layer instead of three. About a trillion parameters, of which 3% run per token.' },
    'Gemma 3 12B': { fam: 'Gemma', org: 'Google', year: 2025, V: 262144, d: 3840, L: 48, H: 16, KV: 8, dh: 256, ff: 15360, tied: true, kind: 'GQA', attnNote: 'QK-norm', win: { size: 1024, pat: 'LLLLLG' }, pos: 'RoPE θ=10k local, 1M global', norm: 'RMSNorm, pre + post', act: 'GeGLU', tok: 'SentencePiece', ctx: '128k', lic: 'Gemma terms', pub: 12.2, extra: ['SigLIP vision encoder', 0.417e9], multi: 'images via a SigLIP encoder', ver: 'config', src: HF + 'google/gemma-3-12b-it',
      say: 'Five local layers (1,024-token window) for every global layer keeps the KV cache small at 128k context. RMSNorm sits before and after each sub-layer, queries and keys are normalised (QK-norm), and embeddings are tied. Images enter as 256 soft tokens from a SigLIP encoder.' },
    'Gemma 2 9B': { fam: 'Gemma', org: 'Google', year: 2024, V: 256000, d: 3584, L: 42, H: 16, KV: 8, dh: 256, ff: 14336, tied: true, kind: 'GQA', attnNote: 'logit soft-capping', win: { size: 4096, pat: 'LG' }, pos: 'RoPE θ=10k', norm: 'RMSNorm, pre + post', act: 'GeGLU', tok: 'SentencePiece', ctx: '8k', lic: 'Gemma terms', pub: 9.24, ver: 'config', src: HF + 'google/gemma-2-9b',
      say: 'Alternates local (4,096-token window) and global attention layers, and soft-caps attention logits with tanh. Gemma 3 replaced the soft-cap with QK-norm.' },
    'Phi-4 (14B)': { fam: 'Phi', org: 'Microsoft', year: 2024, V: 100352, d: 5120, L: 40, H: 40, KV: 10, dh: 128, ff: 17920, tied: false, kind: 'GQA', pos: 'RoPE', norm: 'RMSNorm, pre', act: 'SwiGLU', tok: 'BPE (tiktoken-style)', ctx: '16k', lic: 'MIT', pub: 14.7, ver: 'count', src: HF + 'microsoft/phi-4',
      say: 'A plain dense recipe: the architecture is ordinary and the work went into curated and synthetic training data.' },
    'gpt-oss-20b': { fam: 'gpt-oss', org: 'OpenAI', year: 2025, V: 201088, d: 2880, L: 24, H: 64, KV: 8, dh: 64, ff: 2880, tied: false, kind: 'GQA', attnNote: 'learned attention sink per head', win: { size: 128, pat: 'LG' }, moe: { E: 32, k: 4, shared: 0, ff: 2880, dense: 0 }, pos: 'RoPE θ=150k, YaRN-scaled', norm: 'RMSNorm, pre', act: 'SwiGLU (clamped)', tok: 'BPE (o200k_harmony)', ctx: '131k', lic: 'Apache 2.0', pub: 20.9, pubActive: 3.6, think: 'reasoning effort set in the prompt', ver: 'config', src: 'https://github.com/openai/gpt-oss',
      say: 'Small and sparse: 32 experts with 4 per token, so about 3.6B of 21B parameters run. Layers alternate a 128-token sliding window with full attention, and each head has a learned “sink” it can attend to instead of any token. The 120b version is the same block with 36 layers and 128 experts.' },
  };
  const FAMILIES = ['Llama', 'Mistral', 'Qwen', 'DeepSeek', 'Kimi', 'Gemma', 'Phi', 'gpt-oss'];
  const namesOf = (fam) => Object.keys(MODELS).filter((k) => MODELS[k].fam === fam);

  /* parameter count from the config fields (biases and small vectors ignored) */
  function count(m) {
    const emb = m.V * m.d * (m.tied ? 1 : 2), head = m.V * m.d;
    const a = m.mla;
    const attn = a ? m.d * a.qr + a.qr * m.H * (a.nope + a.rope) + m.d * (a.kvr + a.rope) + a.kvr * m.H * (a.nope + a.v) + m.H * a.v * m.d
      : m.d * m.H * m.dh + 2 * m.d * m.KV * m.dh + m.H * m.dh * m.d;
    const mlp = (f) => 3 * m.d * f, norms = 2 * m.d;
    let total, active, mlpLayer, mlpActive;
    if (m.moe) {
      const e = m.moe, Ld = e.dense || 0, Lm = m.L - Ld, one = mlp(e.ff), router = m.d * e.E;
      mlpLayer = (e.E + e.shared) * one + router; mlpActive = (e.k + e.shared) * one + router;
      const dense = Ld * (attn + mlp(e.denseFf || m.ff) + norms);
      total = emb + dense + Lm * (attn + mlpLayer + norms) + m.d;
      active = head + dense + Lm * (attn + mlpActive + norms) + m.d;
    } else { mlpLayer = mlpActive = mlp(m.ff); total = emb + m.L * (attn + mlpLayer + norms) + m.d; active = head + m.L * (attn + mlpLayer + norms) + m.d; }
    const extra = m.extra ? m.extra[1] : 0;
    return { emb, attn, mlp: mlpLayer, mlpActive, total: total + extra, active, extra };
  }
  /* numbers cached per token, per layer, and bytes per token at 16-bit */
  function kvCache(m) {
    const perLayer = m.mla ? m.mla.kvr + m.mla.rope : 2 * m.KV * m.dh;
    const full = 2 * m.H * m.dh; // if every query head kept its own K and V
    return { perLayer, bytesPerTok: perLayer * m.L * 2, full, saving: full / perLayer };
  }
  const attnLabel = (m) => (m.kind === 'MLA' ? 'Multi-head latent attention' : m.KV === m.H ? 'Multi-head attention' : 'Grouped-query attention');
  const layerKinds = (m) => Array.from({ length: m.L }, (_, i) => ({ local: m.win ? m.win.pat[i % m.win.pat.length] === 'L' : false, moe: m.moe ? i >= (m.moe.dense || 0) : false }));

  /* ------------------------------------------------------------------ stack renderer
     items run bottom → top. Types:
       {t:'label', text}                         plain text at the ends of the flow
       {t:'box', id, label, sub, color, h}       a component (clickable when it has an id)
       {t:'plus', id, side}                      ⊕ with a side note (adding position to the embedding)
       {t:'fs'} / {t:'fe', label}                start / end of the repeated block frame
       {t:'rs'}                                  residual branch point (before the next item)
       {t:'radd'}                                ⊕ where the latest residual branch rejoins (pre-norm)
       {t:'an', id, label}                       Add & Norm box where the latest branch rejoins (post-norm) */
  function column(g, o) {
    const { cx, w, items, sel, onpick, side = -1 } = o;
    let y = o.bottom, prevTop = null, pendRS = false, branch = null, frameBottom = null;
    const pos = {};
    const arrow = (x1, y1, x2, y2, c) => g.appendChild(s('line', { x1, y1, x2, y2, stroke: c || 'var(--muted)', 'stroke-width': 1.5, 'marker-end': 'url(#arA)' }));
    const place = (hgt) => { const bot = y - 14, top = bot - hgt; if (prevTop != null) arrow(cx, prevTop, cx, bot); if (pendRS) { branch = bot + 7; pendRS = false; } y = top; prevTop = top; return top; };
    const resid = (ty, tx) => {
      const sx = cx + side * (w / 2 + 20);
      g.appendChild(s('path', { d: `M${cx},${branch} H${sx} V${ty} H${tx}`, fill: 'none', stroke: 'var(--res)', 'stroke-width': 1.6, 'marker-end': 'url(#arR)' }));
      g.appendChild(s('circle', { cx, cy: branch, r: 2.6, fill: 'var(--res)' }));
    };
    items.forEach((it) => {
      if (it.t === 'label') { const top = place(14); g.appendChild(s('text', { x: cx, y: top + 11, 'text-anchor': 'middle', 'font-size': 11.5, text: it.text, style: 'fill:var(--muted)' })); }
      else if (it.t === 'fs') { frameBottom = y - 12; y = frameBottom - 2; }
      else if (it.t === 'fe') {
        const top = y - 12;
        g.insertBefore(s('rect', { x: cx - w / 2 - 34, y: top, width: w + 68, height: frameBottom - top, rx: 14, fill: 'var(--sunk)', stroke: 'var(--rule)', 'stroke-dasharray': '5 4', style: 'opacity:.75' }), g.firstChild.nextSibling);
        if (it.label) g.appendChild(s('text', { x: cx - side * (w / 2 + 28), y: top + 16, 'text-anchor': side < 0 ? 'end' : 'start', 'font-size': 12, text: it.label, style: 'font-weight:600' }));
        pos._frame = { top, bottom: frameBottom }; y = top - 2;
      }
      else if (it.t === 'rs') pendRS = true;
      else if (it.t === 'plus' || it.t === 'radd') {
        const top = place(18), cy = top + 9;
        g.appendChild(s('circle', { cx, cy, r: 9, fill: 'var(--surface)', stroke: it.t === 'radd' ? 'var(--res)' : 'var(--muted)', 'stroke-width': 1.5 }));
        g.appendChild(s('path', { d: `M${cx - 5},${cy}H${cx + 5}M${cx},${cy - 5}V${cy + 5}`, stroke: 'var(--ink)', 'stroke-width': 1.4 }));
        pos._plus = cy;
        if (it.t === 'radd') resid(cy, cx + side * 9);
        else if (it.side) {
          const on = sel === it.id, tx = cx - side * 22, tw = it.side.length * 6.6 + 16;
          const grp = pick(s('g'), it.id, it.side);
          grp.appendChild(s('rect', { x: side < 0 ? tx : tx - tw, y: cy - 11, width: tw, height: 22, rx: 11, fill: mix('var(--t5)', on ? 30 : 12), stroke: on ? 'var(--accent)' : 'var(--t5)', 'stroke-width': on ? 2.4 : 1.2 }));
          grp.appendChild(s('text', { x: side < 0 ? tx + tw / 2 : tx - tw / 2, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11, text: it.side }));
          g.appendChild(s('line', { x1: side < 0 ? tx : tx - tw + tw, y1: cy, x2: cx - side * 9, y2: cy, stroke: 'var(--muted)', 'stroke-width': 1.3, 'marker-end': 'url(#arA)' }));
          g.appendChild(grp); pos[it.id] = { x: tx, y: cy - 11, w: tw, h: 22 };
        }
      } else {
        const hgt = it.h || (it.sub ? 40 : 30), top = place(hgt), on = it.id && sel === it.id, col = it.color || 'var(--res)';
        const grp = it.id ? pick(s('g'), it.id, it.label) : s('g');
        grp.appendChild(s('rect', { x: cx - w / 2, y: top, width: w, height: hgt, rx: 8, fill: mix(col, on ? 32 : 14), stroke: on ? 'var(--accent)' : col, 'stroke-width': on ? 2.6 : 1.4 }));
        grp.appendChild(s('text', { x: cx, y: top + hgt / 2 + (it.sub ? -3 : 4), 'text-anchor': 'middle', 'font-size': it.fs || 12, text: it.label, style: 'font-weight:600' }));
        if (it.sub) grp.appendChild(s('text', { x: cx, y: top + hgt / 2 + 12, 'text-anchor': 'middle', 'font-size': 9.8, class: 'lbl', text: it.sub }));
        g.appendChild(grp);
        if (it.t === 'an') resid(top + hgt / 2, cx + side * (w / 2));
        if (it.id) pos[it.id] = { x: cx - w / 2, y: top, w, h: hgt };
      }
    });
    function pick(grp, id, label) {
      grp.setAttribute('role', 'button'); grp.setAttribute('tabindex', '0'); grp.setAttribute('aria-label', label + ': show details');
      grp.style.cursor = 'pointer';
      grp.addEventListener('click', () => onpick(id));
      grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onpick(id); } });
      return grp;
    }
    pos._top = y;
    return pos;
  }
  const defs = () => s('defs', null,
    s('marker', { id: 'arA', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--muted)' })),
    s('marker', { id: 'arR', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--res)' })),
    s('marker', { id: 'arV', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--v)' })));

  const modLink = (id) => h('a', { href: '#m' + id, class: 'xref' }, `Module ${id} · ${LLM.title(String(id))}`);
  function infoPanel() {
    const el = h('div', { class: 'arch-info', 'aria-live': 'polite' });
    return { el, set(d) {
      clear(el);
      if (!d) return;
      el.append(h('h4', null, d.name), ...[].concat(d.text).map((t) => h('p', { html: t })));
      if (d.mech) el.append(h('p', { class: 'd-mech arch-mech' }, h('span', { class: 'depth-tag' }, 'Mechanics'), ' ', h('span', { html: d.mech })));
      if (d.mods && d.mods.length) el.append(h('p', { class: 'arch-mods' }, 'Taught in: ', d.mods.map((id, i) => [i ? ' · ' : '', modLink(id)])));
    } };
  }

  /* ------------------------------------------------------------------ 1. the transformer in three eras */
  const C = { emb: 'var(--t5)', attn: 'var(--q)', cross: 'var(--v)', ffn: 'var(--t4)', norm: 'var(--res)', out: 'var(--k)' };
  const ERAS = {
    orig: { name: '2017 · Original (encoder–decoder)', facts: 'Base model: 6 + 6 layers · d = 512 · 8 heads · MLP 2,048 · about 65M parameters',
      note: 'The figure from “Attention Is All You Need”. The left tower reads the source sentence; the right tower writes the translation one token at a time, looking across at the left tower.' },
    gpt: { name: '2019 · GPT-style decoder', facts: 'GPT-2 small: 12 layers · d = 768 · 12 heads · MLP 3,072 · 124M parameters',
      note: 'Delete the encoder and the cross-attention. What is left is one tower with a causal mask. The norm moves in front of each sub-layer (pre-norm), so the grey residual line runs straight from bottom to top.' },
    modern: { name: '2023 → · Modern open-model block', facts: 'Llama 3.1 8B: 32 layers · d = 4,096 · 32 query / 8 KV heads · MLP 14,336 · 8.0B parameters',
      note: 'Same skeleton, four part swaps: RMSNorm for LayerNorm, rotary positions inside attention instead of added at the bottom, grouped-query attention, and a gated SwiGLU MLP (or a mixture of experts).' },
  };
  const INFO = {
    in_emb: { name: 'Input embedding', text: 'A lookup table. Each token id selects one row, a vector of d numbers that the rest of the model reads and rewrites.', mech: '[seq] ids → [seq, d]. The table has vocabulary × d parameters.', mods: [3, 4] },
    out_emb: { name: 'Output embedding', text: 'The same kind of lookup, for the tokens generated so far. During training the target sentence is shifted right by one position so that position t can only be asked to predict token t.', mods: [4, 6] },
    pe: { name: 'Positional encoding', text: 'Attention has no sense of order: shuffle the tokens and it computes the same thing. The 2017 model adds a fixed pattern of sines and cosines to each embedding so that position is written into the vector itself.', mech: '$PE_{(pos,2i)}=\\sin(pos/10000^{2i/d})$, added to the embedding before the first block.', mods: [4, 5] },
    pe_l: { name: 'Learned position embedding', text: 'GPT-2 replaces the sinusoids with a second lookup table: one learned vector per position, added to the token embedding. Simple, but the model cannot go past the longest position it was trained on (1,024 for GPT-2).', mods: [4, 5] },
    enc_attn: { name: 'Multi-head self-attention (encoder)', text: 'Every source token looks at every other source token, in both directions, and pulls in a weighted mix of their values. Several heads do this in parallel, each with its own idea of what is relevant.', mech: '$\\mathrm{softmax}(QK^\\top/\\sqrt{d_k})V$ with no mask: a full square.', mods: [5, 6] },
    dec_attn: { name: 'Masked multi-head self-attention', text: 'The same operation with a causal mask: each position may look only at earlier positions. This is what lets the model train on every next-token prediction in a sequence at once without seeing the answers.', mech: 'Adds a mask M with −∞ above the diagonal before the softmax: a lower triangle.', mods: [5, 6] },
    cross: { name: 'Cross-attention (encoder–decoder attention)', text: 'The bridge between the towers. Queries come from the decoder; keys and values come from the encoder’s final output. It is how the word being written looks back at the sentence being translated. Decoder-only models have no such layer: the prompt and the output share one sequence instead.', mods: [6] },
    an: { name: 'Add & Norm (post-norm)', text: 'Two steps. <b>Add</b>: the sub-layer’s output is added to its input (the grey residual line), so each layer edits the running vector instead of replacing it. <b>Norm</b>: LayerNorm rescales the result. In 2017 the norm came after the addition; later models move it before the sub-layer.', mech: '$x \\leftarrow \\mathrm{LayerNorm}(x + \\mathrm{Sublayer}(x))$', mods: [5] },
    ff: { name: 'Feed-forward network', text: 'A two-layer MLP applied to each position on its own. Attention moves information between tokens; the MLP transforms what each token now holds. About two thirds of a block’s parameters live here.', mech: '$W_2\\,\\mathrm{ReLU}(W_1x)$ with hidden width 4d (512 → 2,048 → 512).', mods: [5] },
    linear: { name: 'Linear (unembedding)', text: 'Projects the final d-dimensional vector to one score per vocabulary token (a logit). Many models reuse the embedding table here (weight tying).', mech: '[seq, d] → [seq, vocabulary]', mods: [7] },
    softmax: { name: 'Softmax', text: 'Turns the logits into probabilities that sum to 1. Sampling picks the next token from this distribution, appends it to the input and runs the stack again.', mods: [0, 7] },
    ln: { name: 'LayerNorm (pre-norm)', text: 'Normalises the vector <em>before</em> each sub-layer rather than after the addition. The residual line is then never normalised on its way up, gradients pass down it unchanged, and deep stacks train stably.', mech: '$x \\leftarrow x + \\mathrm{Sublayer}(\\mathrm{LayerNorm}(x))$', mods: [5] },
    radd: { name: 'Residual addition', text: 'The sub-layer’s output is added back onto the residual stream.', mods: [5] },
    gpt_attn: { name: 'Masked multi-head self-attention', text: 'The only attention in a GPT. Prompt and answer are one sequence, and every token looks back over all of it under a causal mask. During generation the keys and values of earlier tokens are kept in the KV cache instead of being recomputed.', mods: [5, 7] },
    gpt_ff: { name: 'MLP (GELU)', text: 'The same two-layer MLP with a smoother activation, GELU, in place of ReLU.', mech: '$W_2\\,\\mathrm{GELU}(W_1x)$, hidden width 4d (768 → 3,072 → 768).', mods: [5] },
    lnf: { name: 'Final LayerNorm', text: 'With pre-norm, the residual stream itself is never normalised inside the stack, so one last norm is applied before the output head.', mods: [5] },
    head: { name: 'LM head', text: 'One linear layer from d to vocabulary size. GPT-2 ties it to the token embedding table, so the same matrix is used to read tokens in and to score tokens out.', mods: [7] },
    m_emb: { name: 'Token embedding', text: 'Still a lookup table, but nothing is added to it. Position is no longer written into the vector at the bottom of the stack.', mods: [3, 4] },
    rms: { name: 'RMSNorm (pre-norm)', text: 'LayerNorm without the mean subtraction: divide by the root-mean-square and multiply by a learned gain. It is cheaper and works as well.', mech: '$\\mathrm{RMSNorm}(x)=g\\odot x/\\sqrt{\\tfrac1d\\sum_i x_i^2+\\epsilon}$', mods: [5] },
    m_attn: { name: 'Grouped-query attention with RoPE', text: ['<b>RoPE</b>: instead of adding a position vector at the bottom, each layer rotates the queries and keys by an angle proportional to position, so the dot product depends on how far apart two tokens are.', '<b>GQA</b>: several query heads share one key/value head. Llama 3.1 8B has 32 query heads and 8 K/V heads, which makes the KV cache 4× smaller.'], mech: 'K and V: [seq, 8 heads, 128]; Q: [seq, 32 heads, 128]. Each K/V head is repeated for its 4 query heads.', mods: [5, 10, 11] },
    m_ff: { name: 'SwiGLU MLP, or a mixture of experts', text: ['<b>SwiGLU</b> is a gated MLP with three matrices: one branch passes through SiLU and gates the other. Width drops to about 8d/3 so the parameter count stays near a 4d ReLU MLP.', '<b>MoE</b> models replace this single MLP with many expert MLPs and a router that picks a few per token.'], mech: '$W_2\\big(\\mathrm{SiLU}(W_1x)\\odot W_3x\\big)$', mods: [5, 12] },
    m_head: { name: 'LM head and sampling', text: 'A final RMSNorm, a linear layer to vocabulary size, softmax, then sampling (temperature, top-k, top-p). The chosen token is appended and the loop runs again, reusing the KV cache.', mods: [7] },
  };

  function transformerDiagram(opts = {}) {
    const w = widget('The transformer, piece by piece', 'Click any block', 'Diagram after Figure 1 of Vaswani et al. 2017, redrawn. Data flows from bottom to top. Grey lines are the residual stream.');
    let era = opts.era || 'orig', sel = null;
    const W = 600, H = 600, g = svg(W, H, { 'aria-label': 'Transformer architecture diagram' });
    const info = infoPanel(), facts = h('p', { class: 'arch-facts' }), note = h('p', { class: 'arch-note' });
    const pickFirst = { orig: 'cross', gpt: 'ln', modern: 'm_attn' };
    const crop = (top) => g.setAttribute('viewBox', `0 ${Math.floor(top)} ${W} ${H - Math.floor(top)}`);
    function draw() {
      clear(g); g.appendChild(defs()); g.appendChild(s('g'));
      const onpick = (id) => { sel = id; draw(); };
      if (era === 'orig') {
        const enc = column(g, { cx: 150, w: 184, bottom: 590, side: -1, sel, onpick, items: [
          { t: 'label', text: 'Inputs: “I love cats”' }, { t: 'box', id: 'in_emb', label: 'Input embedding', color: C.emb }, { t: 'plus', id: 'pe' },
          { t: 'fs' }, { t: 'rs' }, { t: 'box', id: 'enc_attn', label: 'Multi-head attention', sub: 'self · sees everything', color: C.attn }, { t: 'an', id: 'an', label: 'Add & Norm', h: 24 },
          { t: 'rs' }, { t: 'box', id: 'ff', label: 'Feed forward', color: C.ffn }, { t: 'an', id: 'an', label: 'Add & Norm', h: 24 }, { t: 'fe', label: 'N×' }] });
        const dec = column(g, { cx: 440, w: 184, bottom: 590, side: 1, sel, onpick, items: [
          { t: 'label', text: 'Outputs (shifted right)' }, { t: 'box', id: 'out_emb', label: 'Output embedding', color: C.emb }, { t: 'plus', id: 'pe' },
          { t: 'fs' }, { t: 'rs' }, { t: 'box', id: 'dec_attn', label: 'Masked multi-head attention', sub: 'self · sees the past only', color: C.attn, fs: 10.5 }, { t: 'an', id: 'an', label: 'Add & Norm', h: 24 },
          { t: 'rs' }, { t: 'box', id: 'cross', label: 'Multi-head attention', sub: 'cross · K, V from encoder', color: C.cross }, { t: 'an', id: 'an', label: 'Add & Norm', h: 24 },
          { t: 'rs' }, { t: 'box', id: 'ff', label: 'Feed forward', color: C.ffn }, { t: 'an', id: 'an', label: 'Add & Norm', h: 24 }, { t: 'fe', label: 'N×' },
          { t: 'box', id: 'linear', label: 'Linear', color: C.out, h: 26 }, { t: 'box', id: 'softmax', label: 'Softmax', color: C.out, h: 26 }, { t: 'label', text: 'Output probabilities: “J’ aime les chats”' }] });
        // encoder output → cross-attention (keys and values)
        const cr = dec.cross, ey = enc._frame.top, mx = 296;
        g.appendChild(s('path', { d: `M150,${ey + 2} V${ey - 22} H${mx} V${cr.y + cr.h / 2} H${cr.x}`, fill: 'none', stroke: 'var(--v)', 'stroke-width': 2, 'marker-end': 'url(#arV)' }));
        g.appendChild(s('text', { x: 150, y: ey - 30, 'text-anchor': 'middle', 'font-size': 11, text: 'encoder output → K, V', style: 'fill:var(--v)' }));
        // one positional-encoding source feeds both towers
        const py = enc._plus, on = sel === 'pe', pg = s('g', { role: 'button', tabindex: 0, 'aria-label': 'Positional encoding: show details', style: 'cursor:pointer' });
        pg.addEventListener('click', () => onpick('pe')); pg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onpick('pe'); } });
        pg.appendChild(s('rect', { x: 222, y: py - 12, width: 146, height: 24, rx: 12, fill: mix('var(--t5)', on ? 30 : 12), stroke: on ? 'var(--accent)' : 'var(--t5)', 'stroke-width': on ? 2.4 : 1.2 }));
        pg.appendChild(s('text', { x: 295, y: py + 4, 'text-anchor': 'middle', 'font-size': 11, text: 'Positional encoding' }));
        g.appendChild(pg);
        g.appendChild(s('line', { x1: 222, y1: py, x2: 161, y2: py, stroke: 'var(--muted)', 'stroke-width': 1.3, 'marker-end': 'url(#arA)' }));
        g.appendChild(s('line', { x1: 368, y1: py, x2: 429, y2: py, stroke: 'var(--muted)', 'stroke-width': 1.3, 'marker-end': 'url(#arA)' }));
        const head = (x, y, a2, b2) => { g.appendChild(s('text', { x, y, 'text-anchor': 'middle', 'font-size': 13, text: a2, style: 'font-weight:700;letter-spacing:.08em' })); g.appendChild(s('text', { x, y: y + 15, 'text-anchor': 'middle', class: 'lbl', text: b2 })); };
        head(150, ey - 62, 'ENCODER', 'reads the source'); head(440, dec._top - 28, 'DECODER', 'writes the output');
        crop(dec._top - 50);
      } else {
        const gpt = era === 'gpt';
        const items = gpt ? [
          { t: 'label', text: 'Tokens: “The cat sat”' }, { t: 'box', id: 'in_emb', label: 'Token embedding', color: C.emb }, { t: 'plus', id: 'pe_l', side: 'Learned positions' },
          { t: 'fs' }, { t: 'rs' }, { t: 'box', id: 'ln', label: 'LayerNorm', h: 24 }, { t: 'box', id: 'gpt_attn', label: 'Masked multi-head attention', sub: 'causal mask · 12 heads', color: C.attn }, { t: 'radd' },
          { t: 'rs' }, { t: 'box', id: 'ln', label: 'LayerNorm', h: 24 }, { t: 'box', id: 'gpt_ff', label: 'MLP', sub: 'GELU · 4d wide', color: C.ffn }, { t: 'radd' }, { t: 'fe', label: '12×' },
          { t: 'box', id: 'lnf', label: 'LayerNorm', h: 24 }, { t: 'box', id: 'head', label: 'Linear', sub: 'tied to the embedding', color: C.out }, { t: 'box', id: 'softmax', label: 'Softmax', color: C.out, h: 26 }, { t: 'label', text: 'Next-token probabilities' }]
          : [
          { t: 'label', text: 'Tokens: “The cat sat”' }, { t: 'box', id: 'm_emb', label: 'Token embedding', sub: 'no position added here', color: C.emb },
          { t: 'fs' }, { t: 'rs' }, { t: 'box', id: 'rms', label: 'RMSNorm', h: 24 }, { t: 'box', id: 'm_attn', label: 'Grouped-query attention', sub: 'causal · RoPE rotates Q and K', color: C.attn, h: 44 }, { t: 'radd' },
          { t: 'rs' }, { t: 'box', id: 'rms', label: 'RMSNorm', h: 24 }, { t: 'box', id: 'm_ff', label: 'SwiGLU MLP', sub: 'or a mixture of experts', color: C.ffn, h: 44 }, { t: 'radd' }, { t: 'fe', label: '32×' },
          { t: 'box', id: 'rms', label: 'RMSNorm', h: 24 }, { t: 'box', id: 'm_head', label: 'LM head → softmax → sample', color: C.out }, { t: 'label', text: 'Next token' }];
        const p = column(g, { cx: 250, w: 230, bottom: 590, side: -1, sel, onpick, items });
        // the autoregressive loop
        const top = p._top + 8, rx = 470;
        g.appendChild(s('path', { d: `M${250 + 120},${top} H${rx} V572 H${250 + 96}`, fill: 'none', stroke: 'var(--k)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', 'marker-end': 'url(#arA)' }));
        g.appendChild(s('text', { x: rx + 10, y: 300, 'font-size': 11.5, text: 'append the', style: 'fill:var(--k)' }));
        g.appendChild(s('text', { x: rx + 10, y: 315, 'font-size': 11.5, text: 'new token,', style: 'fill:var(--k)' }));
        g.appendChild(s('text', { x: rx + 10, y: 330, 'font-size': 11.5, text: 'run again', style: 'fill:var(--k)' }));
        crop(p._top - 14);
        if (!gpt) { const a = p.m_attn; g.appendChild(s('rect', { x: a.x + a.w + 14, y: a.y + 6, width: 74, height: 30, rx: 6, fill: mix('var(--kv)', 16), stroke: 'var(--kv)' })); g.appendChild(s('text', { x: a.x + a.w + 51, y: a.y + 25, 'text-anchor': 'middle', 'font-size': 11, text: 'KV cache' })); g.appendChild(s('line', { x1: a.x + a.w, y1: a.y + 21, x2: a.x + a.w + 14, y2: a.y + 21, stroke: 'var(--kv)', 'stroke-width': 1.5 })); }
      }
      facts.textContent = ERAS[era].facts; note.textContent = ERAS[era].note;
      info.set(INFO[sel]);
    }
    const sg = seg(Object.keys(ERAS).map((k) => [k, ERAS[k].name]), era, (v) => { era = v; sel = pickFirst[v]; draw(); }, 'Which transformer');
    sel = pickFirst[era];
    w.body.append(sg.el, note, h('div', { class: 'arch-split' }, h('div', { class: 'arch-fig' }, g, facts), info.el));
    draw();
    return w.el;
  }

  /* ------------------------------------------------------------------ 2. one model's architecture, from its config */
  function modelInfo(m, name) {
    const c = count(m), kv = kvCache(m), e = m.moe, a = m.mla;
    const gqaTxt = m.kind === 'MLA'
      ? [`<b>Multi-head latent attention.</b> Each token’s keys and values are squeezed into one latent of ${a.kvr} numbers, plus a ${a.rope}-dim key that carries the rotary position. All ${m.H} heads are rebuilt from that latent when needed.`, `The cache holds ${kv.perLayer} numbers per token per layer. Storing ${m.H} separate K and V heads would take ${kv.full.toLocaleString()}: ${kv.saving.toFixed(0)}× more.`]
      : m.KV === m.H ? [`<b>Standard multi-head attention</b>: ${m.H} heads, each with its own keys and values.`]
        : [`<b>Grouped-query attention.</b> ${m.H} query heads share ${m.KV} key/value heads, ${m.H / m.KV} queries per K/V head.`, `The cache holds ${kv.perLayer.toLocaleString()} numbers per token per layer, ${kv.saving.toFixed(0)}× less than ${m.H} separate K and V heads.`];
    const winTxt = m.win ? (m.win.pat === 'L' ? `<b>Sliding window.</b> Every layer attends only to the previous ${m.win.size.toLocaleString()} tokens.`
      : `<b>Local and global layers.</b> ${m.win.pat.split('').filter((x) => x === 'L').length} of every ${m.win.pat.length} layers ${m.win.pat.split('').filter((x) => x === 'L').length === 1 ? 'sees' : 'see'} only the previous ${m.win.size.toLocaleString()} tokens; the others see the whole context. Local layers need only a ${m.win.size.toLocaleString()}-token KV cache.`) : null;
    const ffTxt = e
      ? [`<b>Mixture of experts.</b> ${e.E} expert MLPs (each ${m.d.toLocaleString()} → ${e.ff.toLocaleString()} → ${m.d.toLocaleString()}). A router scores them and runs the top ${e.k} for each token${e.shared ? `, plus ${e.shared} shared expert that always runs` : ''}.`,
        `All experts: ${human(c.mlp)} parameters per layer. Used per token: ${human(c.mlpActive)}, or ${(100 * c.mlpActive / c.mlp).toFixed(1)}%.` + (e.dense ? ` The first ${e.dense === 1 ? 'layer keeps' : e.dense + ' layers keep'} an ordinary dense MLP of width ${(e.denseFf).toLocaleString()}.` : '')]
      : [`<b>${m.act} MLP</b>, a gated MLP with three matrices: ${m.d.toLocaleString()} → ${m.ff.toLocaleString()} → ${m.d.toLocaleString()} (${(m.ff / m.d).toFixed(2)} × d).`, `${human(c.mlp)} parameters per layer, ${(100 * c.mlp / (c.mlp + c.attn)).toFixed(0)}% of the block.`];
    return {
      emb: { name: 'Token embedding', text: [`${m.tok} tokeniser with ${m.V.toLocaleString()} tokens, each mapped to a vector of ${m.d.toLocaleString()} numbers.`, m.tied ? `The table is tied to the output head: one matrix of ${human(m.V * m.d)} parameters does both jobs.` : `Input table and output head are separate matrices: ${human(c.emb)} parameters together.`, m.multi ? `Multimodal: ${m.multi}.` : ''].filter(Boolean), mech: `[seq] → [seq, ${m.d}]`, mods: m.multi ? [3, 4, 19] : [3, 4] },
      norm: { name: m.norm.includes('post') ? 'RMSNorm before and after each sub-layer' : 'RMSNorm (pre-norm)', text: m.norm.includes('post') ? 'Gemma normalises the input of each sub-layer and its output again before the residual addition. The extra norm keeps the residual stream’s scale steady.' : 'Normalise before each sub-layer, leave the residual stream untouched. Every model on this page does this.', mods: [5] },
      attn: { name: attnLabel(m), text: gqaTxt.concat(winTxt || [], [`<b>Position</b>: ${m.pos}. Queries and keys are rotated by position inside every layer.`], m.attnNote ? [`<b>Also</b>: ${m.attnNote}.`] : []), mech: m.kind === 'MLA' ? `d ${m.d} → latent ${a.kvr} (+${a.rope} RoPE) → ${m.H} heads × (${a.nope} + ${a.rope}) for Q·K, ${a.v} for V. ${human(c.attn)} parameters per layer.` : `Q: ${m.H} × ${m.dh} · K, V: ${m.KV} × ${m.dh} · ${human(c.attn)} parameters per layer.`, mods: m.win ? [5, 6, 10, 11] : [5, 10, 11] },
      ffn: { name: e ? 'Mixture-of-experts feed-forward' : m.act + ' feed-forward', text: ffTxt, mech: '$W_2\\big(\\sigma(W_1x)\\odot W_3x\\big)$ per expert', mods: e ? [5, 12] : [5] },
      head: { name: 'Output head', text: [`Final RMSNorm, then a linear layer to ${m.V.toLocaleString()} logits${m.tied ? ' (the embedding table, reused)' : ''}, softmax and sampling.`, m.think ? `<b>Reasoning</b>: ${m.think}. This is a training and prompt-format choice; the block is unchanged.` : ''].filter(Boolean), mods: m.think ? [7, 8] : [7] },
    };
  }

  function modelDiagram(opts = {}) {
    const w = widget('Architecture, model by model', 'Click any block', 'Drawn from each model’s published configuration. Sizes are computed from those fields; biases and other small vectors are left out.');
    let fam = opts.family || 'DeepSeek', name = namesOf(fam)[0], sel = 'attn';
    const W = 620, H = 560, g = svg(W, H), info = infoPanel(), ro = readout(), say = h('p', { class: 'arch-note' }), chips = h('div', { class: 'arch-chips' });
    const variants = h('div');
    function draw() {
      const m = MODELS[name], c = count(m), kv = kvCache(m), e = m.moe, kinds = layerKinds(m);
      g.setAttribute('aria-label', name + ' architecture diagram');
      clear(g); g.appendChild(defs()); g.appendChild(s('g'));
      const onpick = (id) => { sel = id; draw(); };
      const nl = m.norm.includes('post') ? 'RMSNorm (pre; post after)' : 'RMSNorm';
      const cx = 212, bw = 240;
      const p = column(g, { cx, w: bw, bottom: 552, side: -1, sel, onpick, items: [
        { t: 'label', text: 'Tokens' }, { t: 'box', id: 'emb', label: 'Token embedding', sub: `${m.V.toLocaleString()} × ${m.d.toLocaleString()}${m.tied ? ' · tied' : ''}`, color: C.emb },
        { t: 'fs' }, { t: 'rs' }, { t: 'box', id: 'norm', label: nl, h: 24, fs: 11.5 },
        { t: 'box', id: 'attn', label: attnLabel(m), sub: (m.kind === 'MLA' ? `${m.H} heads · latent ${m.mla.kvr}` : `${m.H} query / ${m.KV} KV heads × ${m.dh}`) + ' · RoPE', color: C.attn, h: 46, fs: 11.5 }, { t: 'radd' },
        { t: 'rs' }, { t: 'box', id: 'norm', label: nl, h: 24, fs: 11.5 },
        { t: 'box', id: 'ffn', label: e ? `MoE: top ${e.k} of ${e.E}${e.shared ? ' + ' + e.shared + ' shared' : ''}` : `${m.act} MLP`, sub: e ? `experts ${m.d.toLocaleString()} → ${e.ff.toLocaleString()} → ${m.d.toLocaleString()}` : `${m.d.toLocaleString()} → ${m.ff.toLocaleString()} → ${m.d.toLocaleString()}`, color: C.ffn, h: 46 }, { t: 'radd' },
        { t: 'fe', label: `${m.L}×` },
        { t: 'box', id: 'head', label: 'RMSNorm → LM head → softmax', sub: `${m.V.toLocaleString()} logits`, color: C.out, fs: 11.5 }, { t: 'label', text: 'Next token' }] });
      const top0 = Math.floor(p._top - 52);
      g.setAttribute('viewBox', `0 ${top0} ${W} ${H - top0}`);
      g.appendChild(s('text', { x: cx, y: top0 + 18, 'text-anchor': 'middle', 'font-size': 15, text: name, style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: cx, y: top0 + 34, 'text-anchor': 'middle', class: 'lbl', text: `${m.org} · ${m.year} · ${m.lic.split(';')[0]}` }));

      // ---- inset: attention heads
      const ix = 372, iw = W - ix - 8, A = p.attn, F = p.ffn;
      const lead = (bx, by, ty) => g.appendChild(s('path', { d: `M${bx},${by} H${ix - 10} V${ty} H${ix}`, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.2 }));
      let ay = Math.min(A.y - 4, 300);
      lead(A.x + A.w, A.y + A.h / 2, ay + 30);
      g.appendChild(s('rect', { x: ix, y: ay, width: iw, height: 104, rx: 10, fill: 'var(--surface)', stroke: 'var(--rule)' }));
      if (m.kind === 'MLA') {
        const a = m.mla, bx = ix + 12;
        g.appendChild(s('text', { x: bx, y: ay + 18, 'font-size': 11, text: 'one token’s hidden state', class: 'lbl' }));
        g.appendChild(s('rect', { x: bx, y: ay + 24, width: iw - 24, height: 10, rx: 3, fill: mix('var(--res)', 45) }));
        g.appendChild(s('text', { x: bx + iw - 24, y: ay + 18, 'text-anchor': 'end', 'font-size': 11, text: m.d.toLocaleString() }));
        const lw = Math.max(18, (iw - 24) * a.kvr / m.d), rw = Math.max(6, (iw - 24) * a.rope / m.d);
        g.appendChild(s('path', { d: `M${bx},${ay + 36} L${bx},${ay + 52} M${bx + iw - 24},${ay + 36} L${bx + lw + rw + 3},${ay + 52}`, stroke: 'var(--muted)', 'stroke-width': 1 }));
        g.appendChild(s('rect', { x: bx, y: ay + 54, width: lw, height: 12, rx: 3, fill: 'var(--kv)' }));
        g.appendChild(s('rect', { x: bx + lw + 3, y: ay + 54, width: rw, height: 12, rx: 3, fill: 'var(--k)' }));
        g.appendChild(s('text', { x: bx + lw + rw + 10, y: ay + 64, 'font-size': 11, text: `cached: ${a.kvr} + ${a.rope}` }));
        g.appendChild(s('text', { x: bx, y: ay + 84, 'font-size': 11, text: `→ rebuilt into ${m.H} heads of K, V`, class: 'lbl' }));
        g.appendChild(s('text', { x: bx, y: ay + 98, 'font-size': 11, text: `${kv.saving.toFixed(0)}× smaller than caching them`, style: 'fill:var(--kv);font-weight:600' }));
      } else {
        const per = m.H / m.KV, cols = Math.min(m.H, 32), rows = Math.ceil(m.H / cols), cs = Math.min(12, (iw - 24) / cols), bx = ix + 12;
        g.appendChild(s('text', { x: bx, y: ay + 17, class: 'lbl', text: `${m.H} query heads` }));
        for (let i = 0; i < m.H; i++) g.appendChild(s('rect', { x: bx + (i % cols) * cs, y: ay + 23 + Math.floor(i / cols) * (cs + 1), width: cs - 1.5, height: cs - 1.5, rx: 1.5, fill: tokColor(Math.floor(i / per)) }));
        const ky = ay + 23 + rows * (cs + 1) + 18, kw = (cols * cs) / Math.min(m.KV, cols * rows);
        g.appendChild(s('text', { x: bx, y: ky - 5, class: 'lbl', text: m.KV === m.H ? 'each with its own K, V' : `share ${m.KV} K/V heads (cached)` }));
        if (m.KV !== m.H) for (let i = 0; i < m.KV; i++) g.appendChild(s('rect', { x: bx + i * (cols * cs / m.KV), y: ky, width: cols * cs / m.KV - 2, height: 10, rx: 2, fill: tokColor(i) }));
        g.appendChild(s('text', { x: bx, y: ay + 98, 'font-size': 11, text: m.KV === m.H ? 'KV cache: full size' : `KV cache ${kv.saving.toFixed(0)}× smaller`, style: 'fill:var(--kv);font-weight:600' }));
      }
      // ---- inset: feed-forward
      const fy = Math.max(top0 + 6, ay - 152), fh = 140;
      lead(F.x + F.w, F.y + F.h / 2, fy + fh - 30);
      g.appendChild(s('rect', { x: ix, y: fy, width: iw, height: fh, rx: 10, fill: 'var(--surface)', stroke: 'var(--rule)' }));
      if (e) {
        const cols = e.E > 64 ? 32 : e.E > 8 ? 16 : 8, rows = Math.ceil(e.E / cols), cs = Math.min((iw - 24) / cols, 74 / rows, 22), bx = ix + 12, r = rng(7 + e.E);
        const on = new Set(); while (on.size < e.k) on.add(Math.floor(r() * e.E));
        g.appendChild(s('text', { x: bx, y: fy + 17, class: 'lbl', text: `${e.E} experts, ${e.k} run per token` }));
        for (let i = 0; i < e.E; i++) g.appendChild(s('rect', { x: bx + (i % cols) * cs, y: fy + 24 + Math.floor(i / cols) * cs, width: cs - 1.2, height: cs - 1.2, rx: 1.5, fill: on.has(i) ? 'var(--t4)' : mix('var(--t4)', 18) }));
        const by = fy + 24 + rows * cs + 6;
        if (e.shared) { g.appendChild(s('rect', { x: bx, y: by, width: 12, height: 12, rx: 2, fill: 'var(--v)' })); g.appendChild(s('text', { x: bx + 18, y: by + 10, 'font-size': 11, text: `+ ${e.shared} shared expert, always on` })); }
        g.appendChild(s('text', { x: bx, y: fy + fh - 8, 'font-size': 11, text: `${(100 * c.mlpActive / c.mlp).toFixed(1)}% of MLP weights per token`, style: 'fill:var(--t4);font-weight:600' }));
      } else {
        const bx = ix + 12, fw = iw - 24, dw = fw * 0.34;
        g.appendChild(s('text', { x: bx, y: fy + 17, class: 'lbl', text: 'one dense gated MLP' }));
        g.appendChild(s('rect', { x: bx + (fw - dw) / 2, y: fy + 100, width: dw, height: 12, rx: 3, fill: mix('var(--res)', 45) }));
        g.appendChild(s('rect', { x: bx, y: fy + 62, width: fw, height: 14, rx: 3, fill: mix('var(--t4)', 60) }));
        g.appendChild(s('rect', { x: bx + (fw - dw) / 2, y: fy + 28, width: dw, height: 12, rx: 3, fill: mix('var(--res)', 45) }));
        g.appendChild(s('path', { d: `M${bx + (fw - dw) / 2},${fy + 100} L${bx},${fy + 76} M${bx + (fw + dw) / 2},${fy + 100} L${bx + fw},${fy + 76} M${bx},${fy + 62} L${bx + (fw - dw) / 2},${fy + 40} M${bx + fw},${fy + 62} L${bx + (fw + dw) / 2},${fy + 40}`, stroke: 'var(--muted)', 'stroke-width': 1 }));
        g.appendChild(s('text', { x: bx + fw / 2, y: fy + 73, 'text-anchor': 'middle', 'font-size': 10.5, text: `${m.ff.toLocaleString()}  (${(m.ff / m.d).toFixed(2)} × d)` }));
        g.appendChild(s('text', { x: bx + fw / 2, y: fy + 126, 'text-anchor': 'middle', 'font-size': 10.5, text: `d = ${m.d.toLocaleString()}`, class: 'lbl' }));
      }
      // ---- layer strip: one cell per layer
      const fr = p._frame, sx = 14, sh = fr.bottom - fr.top - 30, ch = sh / m.L, strips = [];
      if (m.win && m.win.pat !== 'L') strips.push(['attn', (k) => (k.local ? mix('var(--q)', 30) : 'var(--q)')]);
      if (e && e.dense) strips.push(['ffn', (k) => (k.moe ? 'var(--t4)' : mix('var(--t4)', 30))]);
      if (!strips.length) strips.push(['', () => mix('var(--res)', 55)]);
      strips.forEach(([lab, col], si) => {
        const x = sx + si * 16;
        kinds.forEach((k, i) => g.appendChild(s('rect', { x, y: fr.bottom - 6 - (i + 1) * ch, width: 12, height: Math.max(ch - 0.8, 0.8), fill: col(k) })));
        if (lab) g.appendChild(s('text', { x: x + 6, y: fr.top + 20, 'text-anchor': 'middle', 'font-size': 8.5, text: lab, class: 'lbl' }));
      });
      const leg = [];
      if (m.win && m.win.pat !== 'L') leg.push([mix('var(--q)', 30), 'local'], ['var(--q)', 'global']);
      if (e && e.dense) leg.push([mix('var(--t4)', 30), 'dense'], ['var(--t4)', 'MoE']);
      g.appendChild(s('text', { x: sx, y: fr.bottom + 12, 'font-size': 10, class: 'lbl', text: `${m.L} layers` }));
      leg.forEach(([col, t], i) => { const ly = fr.bottom + 24 + i * 13; g.appendChild(s('rect', { x: sx, y: ly - 8, width: 9, height: 9, fill: col })); g.appendChild(s('text', { x: sx + 13, y: ly, 'font-size': 9.5, class: 'lbl', text: t })); });

      say.textContent = m.say;
      const diff = (c.total / 1e9 - m.pub) / m.pub;
      ro.set([['total', human(c.total)], ['published', m.pub >= 1000 ? '≈1T' : m.pub + 'B', Math.abs(diff) < 0.03 ? 'var(--pass)' : 'var(--warn)'], ['active per token', e ? human(c.active) + (m.pubActive ? ` (published ${m.pubActive}B)` : '') : 'all'], ['KV cache per token', bytes(kv.bytesPerTok)]]);
      // concept chips
      clear(chips);
      const chip = (label, mod) => chips.appendChild(h('a', { class: 'arch-chip', href: '#m' + mod, title: `Module ${mod} · ${LLM.title(String(mod))}` }, label, h('span', null, 'M' + mod)));
      chip(m.tok.replace(/ \(.*/, '') + ' tokeniser', 3); chip('RoPE', 5); chip(m.norm.includes('post') ? 'RMSNorm pre + post' : 'Pre-norm RMSNorm', 5); chip(m.act.replace(/ \(.*/, ''), 5);
      chip(m.kind === 'MLA' ? 'MLA' : m.KV === m.H ? 'Multi-head attention' : 'GQA', 10); chip('KV cache', 11);
      if (m.win) chip(m.win.pat === 'L' ? 'Sliding window' : 'Local + global layers', 6);
      if (e) chip(`MoE ${e.k}/${e.E}`, 12);
      if (m.think) chip('Reasoning', 8); if (m.multi) chip('Vision input', 19); if (name === 'DeepSeek-V3') chip('FP8 weights', 15); if (m.fam === 'gpt-oss') chip('4-bit MoE weights', 15);
      info.set(modelInfo(m, name)[sel]);
      src.replaceChildren(h('span', null, m.ver === 'config' ? 'Checked against the vendor’s config, November 2026. ' : 'Dimensions confirmed by reproducing the published parameter count, November 2026. '), h('a', { href: m.src, target: '_blank', rel: 'noopener' }, 'Model card'));
    }
    const src = h('p', { class: 'note-sim' });
    function setFam(f) {
      fam = f; const ns = namesOf(f); name = ns[0];
      clear(variants);
      if (ns.length > 1) variants.appendChild(seg(ns, name, (v) => { name = v; draw(); }, 'Variant').el);
      draw();
    }
    const fs = seg(FAMILIES, fam, setFam, 'Model family');
    w.body.append(fs.el, variants, say, ro.el, h('div', { class: 'arch-split' }, h('div', { class: 'arch-fig' }, g), info.el), h('div', null, h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Concepts inside this model · tap to learn each'), chips), src);
    setFam(fam);
    return w.el;
  }

  /* ------------------------------------------------------------------ 3. which model uses which concept */
  const MATRIX_MODELS = ['Llama 3.1 8B', 'Mistral 7B v0.1', 'Mixtral 8x7B', 'Qwen3 8B', 'Qwen3 235B-A22B', 'DeepSeek-V3', 'Kimi K2', 'Gemma 3 12B', 'Phi-4 (14B)', 'gpt-oss-20b'];
  function conceptMatrix() {
    const w = widget('Which model uses which idea', 'Reference', 'A filled cell means the idea is in the released architecture. Read down a column for one model’s recipe, across a row for how far an idea has spread.');
    const yes = (t) => h('span', { class: 'arch-yes' }, '●', t ? ' ' + t : ''), no = () => h('span', { class: 'arch-no', 'aria-label': 'no' }, '·');
    const rows = [
      ['Decoder-only, pre-norm RMSNorm', 5, () => yes()],
      ['Rotary positions (RoPE)', 5, () => yes()],
      ['Gated MLP (SwiGLU / GeGLU)', 5, (m) => yes(m.act.startsWith('GeGLU') ? 'GeGLU' : '')],
      ['Grouped-query attention', 10, (m) => (m.kind === 'GQA' && m.KV !== m.H ? yes(`${m.H}:${m.KV}`) : no())],
      ['Latent attention (MLA)', 10, (m) => (m.kind === 'MLA' ? yes(`latent ${m.mla.kvr}`) : no())],
      ['Windowed / local layers', 6, (m) => (m.win ? yes(m.win.pat === 'L' ? `all, ${m.win.size / 1024}k` : `${m.win.pat.split('').filter((x) => x === 'L').length} in ${m.win.pat.length}`) : no())],
      ['Mixture of experts', 12, (m) => (m.moe ? yes(`${m.moe.k}/${m.moe.E}`) : no())],
      ['Shared (always-on) expert', 12, (m) => (m.moe && m.moe.shared ? yes() : no())],
      ['Tied embeddings', 7, (m) => (m.tied ? yes() : no())],
      ['Reasoning / thinking mode', 8, (m) => (m.think ? yes(m.fam === 'DeepSeek' ? 'as R1' : '') : no())],
      ['Image input', 19, (m) => (m.multi ? yes() : no())],
    ];
    const head = ['Idea'].concat(MATRIX_MODELS.map((n) => n.replace(' (14B)', '').replace(' v0.1', '')));
    const body = rows.map(([label, mod, f]) => [h('span', null, label, ' ', h('a', { href: '#m' + mod, class: 'xref', title: LLM.title(String(mod)) }, 'M' + mod))].concat(MATRIX_MODELS.map((n) => f(MODELS[n]))));
    const t = table(head, body); t.classList.add('arch-matrix');
    const sizes = table(['Model', 'Total', 'Active per token', 'Layers × d', 'KV cache per token'], MATRIX_MODELS.map((n) => { const m = MODELS[n], c = count(m); return [n, human(c.total), m.moe ? human(c.active) : 'all', `${m.L} × ${m.d.toLocaleString()}`, bytes(kvCache(m).bytesPerTok)]; }), { num: [1, 2, 3, 4] });
    w.body.append(t, h('div', { class: 'eyebrow' }, 'Sizes computed from the same configs (16-bit cache values)'), sizes);
    return w.el;
  }

  /* ------------------------------------------------------------------ atlas page (#arch) */
  function page() {
    const P = (t) => h('p', { html: t });
    const sec = (title, sub, kids) => h('section', { class: 'block' }, h('h2', null, title), sub ? h('p', { class: 'sub', html: sub }) : null, kids);
    const root = h('article', { class: 'wrap' },
      h('header', { class: 'mod-head' }, h('div', { class: 'crumbs' }, h('a', { href: '#map' }, 'Curriculum'), '/', h('span', null, 'Reference')), h('div', { class: 'eyebrow' }, 'Architecture atlas'), h('h1', null, 'The transformer and the open models built on it'),
        h('p', { class: 'hook' }, 'One diagram, drawn three times as the design evolved, then redrawn for each open-weight model so you can see exactly which ideas each one uses.')),
      h('div', { class: 'prose' }, P('Every large language model you can download today is the same machine: a stack of identical blocks, each with an attention layer and a feed-forward layer joined by a residual stream. The models differ in a short list of part choices. This page shows the machine first, then each model as a set of choices, with a link from every part to the module that teaches it.')),
      h('section', { class: 'block', style: { borderTop: '0' } }, h('h2', null, '1 · The transformer'), h('p', { class: 'sub' }, 'Switch between the 2017 original, the GPT-style decoder and the block used by today’s open models. Click a block to see what it does.'), transformerDiagram()),
      sec('2 · Open-weight models', 'Pick a family. The diagram, the insets and every number are generated from that model’s configuration.', modelDiagram()),
      sec('3 · Concept by model', 'The same information as a table.', conceptMatrix()),
      h('section', { class: 'block' }, h('div', { class: 'leaves' }, h('h3', null, 'What these pictures leave out'), h('ul', null,
        [
          'Training data, training method and post-training. Two models with the same diagram can behave very differently.',
          'Small parameters: biases, norm gains, attention sinks and router details are not drawn and not counted.',
          'Releases after November 2026, and closed models, whose architectures are not published.',
          'Licence terms. The label is a pointer; read the licence itself before you ship.'].map((t) => h('li', null, t))))),
      sec('Go deeper', null, h('ul', { class: 'reading' }, [[5, 'the block itself'], [6, 'the three shapes and their masks'], [10, 'MHA, GQA and MLA'], [11, 'the KV cache'], [12, 'mixture of experts'], [16, 'spec cards, parameter counter and architecture diff']].map(([id, t]) => h('li', null, '· ', modLink(id), ': ' + t)))),
      h('div', { style: { height: '30px' } }));
    const op = LLM.util.onPage(root); if (op) root.querySelector('.mod-head').appendChild(op);
    return root;
  }

  LLM.arch = { MODELS, FAMILIES, count, kvCache, attnLabel, transformerDiagram, modelDiagram, conceptMatrix, page };

  document.head.appendChild(h('style', null, `
  .arch-split { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .arch-fig { min-width: 0; }
  .arch-fig svg { max-width: none; }
  .arch-fig [role="button"]:focus-visible rect { stroke: var(--accent); stroke-width: 3; }
  .arch-fig [role="button"]:hover rect { filter: brightness(.96); }
  .arch-info { position: sticky; top: 76px; border: 1px solid var(--rule); border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; padding: 14px 16px; background: var(--paper); display: grid; gap: 9px; font-size: .95rem; min-width: 0; }
  .arch-info h4 { margin: 0; font-family: var(--f-display); font-size: 1.05rem; }
  .arch-info p { margin: 0; overflow-wrap: anywhere; }
  .arch-mech { font-size: .86rem; color: var(--muted); }
  .arch-mods { font-size: .86rem; font-family: var(--f-mono); }
  .arch-note { margin: 0; max-width: 46em; }
  .arch-facts { margin: 8px 0 0; font-family: var(--f-mono); font-size: .78rem; color: var(--muted); }
  .arch-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .arch-chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--rule); background: var(--paper); border-radius: 99px; padding: 4px 6px 4px 11px; font-family: var(--f-display); font-size: .86rem; color: var(--ink); text-decoration: none; }
  .arch-chip span { font-family: var(--f-mono); font-size: .68rem; background: var(--sunk); color: var(--muted); border-radius: 99px; padding: 2px 7px; }
  .arch-chip:hover { border-color: var(--accent); }
  .arch-matrix td, .arch-matrix th { white-space: nowrap; font-size: .82rem; }
  .arch-matrix td:first-child, .arch-matrix th:first-child { position: sticky; left: 0; background: var(--surface); white-space: normal; min-width: 150px; }
  .arch-yes { color: var(--v); font-family: var(--f-mono); font-size: .78rem; }
  .arch-no { color: var(--rule); }
  @media (max-width: 760px) { .arch-split { grid-template-columns: 1fr; } .arch-info { position: static; } .arch-fig { overflow-x: auto; } .arch-fig svg { min-width: 520px; } }
  `));
})();
