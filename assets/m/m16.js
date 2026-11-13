(function () {
  const { h, s, svg, clear, seg, widget, readout, human, mix, table, diagram } = LLM.util;
  // Model data, the parameter counter and the diagrams live in assets/arch.js, shared with the architecture atlas.
  const { MODELS, count, kvCache, attnLabel } = LLM.arch;
  const { bytes } = LLM.util;

  const STAGES = [
    { y: '2017', name: 'Original transformer', norm: 'LayerNorm (post)', attn: 'Multi-head', ffn: 'ReLU MLP', pos: 'Sinusoidal', who: 'Vaswani et al.' },
    { y: '2019', name: 'Pre-norm', norm: 'LayerNorm (pre)', attn: 'Multi-head', ffn: 'GELU MLP', pos: 'Learned absolute', who: 'GPT-2' },
    { y: '2023', name: 'The Llama recipe', norm: 'RMSNorm (pre)', attn: 'Multi-head', ffn: 'SwiGLU', pos: 'RoPE', who: 'Llama 1' },
    { y: '2023', name: 'Grouped-query attention', norm: 'RMSNorm (pre)', attn: 'GQA', ffn: 'SwiGLU', pos: 'RoPE', who: 'Llama 2 70B, Mistral 7B' },
    { y: '2023–24', name: 'Mixture of experts', norm: 'RMSNorm (pre)', attn: 'GQA', ffn: 'MoE of SwiGLU experts', pos: 'RoPE', who: 'Mixtral, Qwen3 MoE, gpt-oss' },
    { y: '2024–25', name: 'Latent attention + fine-grained MoE', norm: 'RMSNorm (pre)', attn: 'MLA', ffn: '1 shared + 256 routed experts', pos: 'Decoupled RoPE', who: 'DeepSeek-V2, V3, Kimi K2' },
  ];
  function heroInit(box) {
    const nodes = [
      { id: 'in', x: 210, y: 300, w: 140, h: 30, label: 'token + position', color: 'var(--res)' },
      { id: 'n1', x: 210, y: 245, w: 140, h: 30, label: '', color: 'var(--res)' },
      { id: 'at', x: 190, y: 185, w: 180, h: 40, label: '', color: 'var(--q)' },
      { id: 'n2', x: 210, y: 135, w: 140, h: 30, label: '', color: 'var(--res)' },
      { id: 'ff', x: 190, y: 75, w: 180, h: 40, label: '', color: 'var(--t4)' },
      { id: 'out', x: 210, y: 20, w: 140, h: 30, label: 'to next block', color: 'var(--res)' },
    ];
    const d = diagram(560, 360, nodes, [['in', 'n1'], ['n1', 'at'], ['at', 'n2'], ['n2', 'ff'], ['ff', 'out']], 'Evolution of the transformer block');
    box.appendChild(d.el);
    return { go(i) {
      const st = STAGES[i], prev = STAGES[Math.max(0, i - 1)];
      nodes[0].label = st.pos === 'Sinusoidal' || st.pos === 'Learned absolute' ? 'token + ' + st.pos.toLowerCase() : 'token embedding';
      nodes[1].label = st.norm; nodes[2].label = st.attn + ' attention'; nodes[2].sub = st.pos.includes('RoPE') ? st.pos + ' on Q, K' : ''; nodes[3].label = st.norm; nodes[4].label = st.ffn;
      const changed = []; if (i) { if (st.norm !== prev.norm) changed.push('n1', 'n2'); if (st.attn !== prev.attn || st.pos !== prev.pos) changed.push('at', 'in'); if (st.ffn !== prev.ffn) changed.push('ff'); }
      d.draw({ hot: changed, notes: [[392, 60, st.y, 'font-family:var(--f-display);font-size:26px;font-weight:700'], [392, 84, st.name, 'font-weight:600'], [392, 104, st.who, 'fill:var(--muted)'], [14, 352, i ? 'highlighted = changed in this step' : 'post-norm: normalise after adding the residual', 'fill:var(--muted);font-size:11px']] });
    } };
  }

  function picker(init, set) {
    return h('select', { 'aria-label': 'Model', onchange: (e) => set(e.target.value) }, LLM.arch.FAMILIES.map((f) => h('optgroup', { label: f }, Object.keys(MODELS).filter((k) => MODELS[k].fam === f).map((k) => h('option', { value: k, selected: k === init }, k)))));
  }
  const moeText = (m) => (m.moe ? `${m.moe.E} experts, top-${m.moe.k}` + (m.moe.shared ? `, ${m.moe.shared} shared` : '') + (m.moe.dense ? `; first ${m.moe.dense} layer${m.moe.dense > 1 ? 's' : ''} dense` : '') : 'dense');
  const attnText = (m) => attnLabel(m) + (m.win ? (m.win.pat === 'L' ? `, ${m.win.size.toLocaleString()}-token sliding window` : `, local (${m.win.size.toLocaleString()}) and global layers`) : '') + (m.attnNote ? ', ' + m.attnNote : '');
  function specCards() {
    const w = widget('Spec cards and parameter counter', 'Try it', 'The count uses: embeddings (+ untied output head) + layers × (attention + MLP × experts + router + norms). “Active” counts the output head but not the embedding table, since a lookup touches one row. Check fields against the model card before relying on them.');
    let cur = 'Llama 3.1 8B'; const out = h('div', { style: { display: 'grid', gap: '12px' } }); const ro = readout();
    function draw() {
      const m = MODELS[cur], c = count(m), kv = kvCache(m);
      clear(out).append(table(['Field', 'Value'], [['Released by', `${m.org}, ${m.year}`], ['Layers × d_model', `${m.L} × ${m.d.toLocaleString()}`], ['Query / KV heads × d_head', m.kind === 'MLA' ? `${m.H} heads; latent ${m.mla.kvr} + ${m.mla.rope}` : `${m.H} / ${m.KV} × ${m.dh}`], ['Attention', attnText(m)], ['Position', m.pos], ['Norm', m.norm], ['Activation, MLP width', `${m.act}, ${(m.moe ? m.moe.ff : m.ff).toLocaleString()}` + (m.moe ? ' per expert' : '')], ['MoE', moeText(m)], ['Vocabulary', m.V.toLocaleString() + (m.tied ? ' (tied embeddings)' : '') + ', ' + m.tok], ['Context', m.ctx], ['Licence', m.lic]]),
        table(['Piece', 'Parameters'], [['Embeddings' + (m.tied ? '' : ' + output head'), human(c.emb)], ['Attention per layer', human(c.attn)], ['MLP per layer' + (m.moe ? ' (all experts)' : ''), human(c.mlp)]].concat(c.extra ? [[m.extra[0], human(c.extra)]] : [], [['Total', human(c.total)], ['Active per token', m.moe ? human(c.active) : 'all'], ['KV cache per token (16-bit)', bytes(kv.bytesPerTok)]]), { num: [1] }),
        h('p', { class: 'note-sim' }, m.ver === 'config' ? 'Fields checked against the vendor’s config, November 2026. ' : 'Dimensions confirmed by reproducing the published size, November 2026. ', h('a', { href: m.src, target: '_blank', rel: 'noopener' }, 'Model card')));
      const diff = (c.total / 1e9 - m.pub) / m.pub;
      ro.set([['computed', human(c.total)], ['published', m.pub >= 1000 ? '≈1T (rounded)' : m.pub + 'B'], ['difference', (diff * 100).toFixed(1) + '%', Math.abs(diff) < 0.03 ? 'var(--pass)' : 'var(--warn)']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'model'), picker(cur, (v) => { cur = v; draw(); }))), ro.el, out);
    draw();
    return w.el;
  }

  function archDiff() {
    const w = widget('Architecture diff', 'Try it');
    let a = 'Llama 3.1 8B', b = 'DeepSeek-V3'; const out = h('div');
    const fields = [['d_model', (m) => m.d], ['layers', (m) => m.L], ['query heads', (m) => m.H], ['KV heads', (m) => (m.kind === 'MLA' ? 'latent ' + m.mla.kvr : m.KV)], ['d_head', (m) => m.dh], ['MLP width', (m) => (m.moe ? m.moe.ff : m.ff)], ['experts', (m) => moeText(m)], ['vocabulary', (m) => m.V], ['tied embeddings', (m) => (m.tied ? 'yes' : 'no')], ['attention', attnText], ['position', (m) => m.pos], ['norm', (m) => m.norm], ['activation', (m) => m.act], ['context', (m) => m.ctx], ['total parameters', (m) => human(count(m).total)], ['KV cache per token', (m) => bytes(kvCache(m).bytesPerTok)]];
    function draw() {
      const A = MODELS[a], B = MODELS[b];
      clear(out).appendChild(table(['Field', a, b], fields.map(([l, get]) => { const va = get(A), vb = get(B), diff = String(va) !== String(vb); const f = (v) => h('span', { style: diff ? { color: 'var(--accent)', fontWeight: 600 } : null }, (diff ? '≠ ' : '') + (typeof v === 'number' ? v.toLocaleString() : String(v))); return [l, f(va), f(vb)]; })));
    }
    const mk = (init, set) => picker(init, (v) => { set(v); draw(); });
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'model A'), mk(a, (v) => (a = v))), h('div', { class: 'ctl' }, h('label', null, 'model B'), mk(b, (v) => (b = v)))), out, h('p', { class: 'note-sim' }, 'Rows marked ≠ differ.'));
    draw();
    return w.el;
  }

  LLM.mod('16', {
    hook: 'Under the brand names, how different are today’s open models really?',
    intro: ['Most open LLMs share one recipe that settled around 2023: a decoder-only stack of pre-norm blocks with RMSNorm, SwiGLU, RoPE and grouped-query attention. Families differ in a handful of choices: sizes, vocabulary, attention variant, MoE layout, context length and licence. Learn the recipe once and every spec card reads like a diff.'],
    hero: {
      steps: STAGES.map((st, i) => ({ title: `${st.y}: ${st.name}`, text: [
        'The 2017 block: multi-head attention and a ReLU MLP, each followed by add-and-LayerNorm (post-norm). Position is added as fixed sinusoids.',
        'Move the norm before each sub-layer (pre-norm). Gradients flow cleanly down the residual stream, so deep stacks train without warm-up tricks.',
        'Llama 1 combined three upgrades: RMSNorm (cheaper), SwiGLU (a gated MLP that trains better) and rotary position embeddings.',
        'Share key/value heads across groups of query heads: a 4–8× smaller KV cache at almost no quality cost.',
        'Swap the dense MLP for routed experts: more parameters at the same compute per token (Module 12).',
        'DeepSeek compresses keys and values into a latent (Module 10) and splits experts into many small routed ones plus an always-on shared expert. Kimi K2 follows the same design with 384 experts.',
      ][i] })),
      init: heroInit,
    },
    sections: [
      { title: 'One diagram per model', sub: 'Pick a family. The block diagram, the attention and feed-forward insets and the layer strip are all drawn from that model’s configuration. Click a block for what the model does there and which module teaches it. The <a href="#arch">architecture atlas</a> puts this next to the 2017 original.', widget: () => LLM.arch.modelDiagram() },
      { title: 'Which model uses which idea', widget: () => LLM.arch.conceptMatrix() },
      { title: 'Spec cards', widget: specCards }, { title: 'Spot the difference', widget: archDiff }],
    maths: [
      { note: 'Parameter count for a decoder with vocabulary V, width d, L layers, H query heads, H_kv KV heads, head size d_h, gated MLP width f, and E experts:', tex: 'N\\approx \\underbrace{Vd\\,(2-\\text{tied})}_{\\text{embeddings}}+L\\Big[\\underbrace{2d\\,Hd_h+2d\\,H_{kv}d_h}_{\\text{attention}}+\\underbrace{3d f\\,E}_{\\text{SwiGLU experts}}\\Big]' },
      { note: 'SwiGLU MLP (three matrices instead of two, so f is usually about 8d/3 to keep the parameter count of a 4d ReLU MLP):', tex: '\\mathrm{SwiGLU}(x)=W_2\\big(\\mathrm{SiLU}(W_1x)\\odot W_3x\\big)' },
    ],
    leaves: ['Fourteen cards cannot represent a fast-moving field. Each card carries the date it was checked; releases after November 2026 need cards from their own configs.', 'The count ignores biases, norm gains and other small vectors, and DeepSeek-V3’s extra multi-token-prediction module used in training.', 'Configs describe shape, not training data or quality.', 'Licences differ in commercial and usage terms; read the actual licence.'],
    quiz: [
      { q: 'Llama 3.1 8B has a 128,256-token vocabulary, d = 4,096 and untied embeddings. Embedding + output parameters?', opts: ['≈ 0.5B', '≈ 1.05B', '≈ 4B', '≈ 128M'], a: 1, why: '128,256 × 4,096 × 2 ≈ 1.05B: about 13% of the model.' },
      { q: 'Which change made the biggest difference to KV-cache size?', opts: ['RMSNorm', 'SwiGLU', 'Grouped-query attention', 'Pre-norm'], a: 2, why: 'GQA cuts cached K/V heads, for example from 32 to 8.' },
      { q: 'Mixtral 8x7B is “8x7B” but has 46.7B parameters, not 56B. Why?', opts: ['Rounding', 'Only the MLPs are replicated per expert; attention and embeddings are shared', 'It is quantised', 'Two experts are removed'], a: 1, why: 'Each layer shares one attention block; only the eight SwiGLU MLPs are separate.' },
    ],
  });
})();
