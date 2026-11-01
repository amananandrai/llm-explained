(function () {
  const { h, s, svg, clear, seg, widget, readout, human, mix, table, diagram } = LLM.util;
  // Transcribed from each model's published config.json; the plan's Module 16 script should regenerate these.
  const MODELS = {
    'Llama 3 8B': { V: 128256, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, E: 1, k: 1, tied: false, attn: 'GQA', pos: 'RoPE θ=500k', norm: 'RMSNorm, pre', act: 'SwiGLU', ctx: '8k', lic: 'Llama 3 Community', pub: 8.03 },
    'Llama 3 70B': { V: 128256, d: 8192, L: 80, H: 64, KV: 8, dh: 128, ff: 28672, E: 1, k: 1, tied: false, attn: 'GQA', pos: 'RoPE θ=500k', norm: 'RMSNorm, pre', act: 'SwiGLU', ctx: '8k', lic: 'Llama 3 Community', pub: 70.6 },
    'Mistral 7B v0.1': { V: 32000, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, E: 1, k: 1, tied: false, attn: 'GQA + sliding window 4k', pos: 'RoPE θ=10k', norm: 'RMSNorm, pre', act: 'SwiGLU', ctx: '8k', lic: 'Apache 2.0', pub: 7.24 },
    'Mixtral 8x7B': { V: 32000, d: 4096, L: 32, H: 32, KV: 8, dh: 128, ff: 14336, E: 8, k: 2, tied: false, attn: 'GQA', pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', ctx: '32k', lic: 'Apache 2.0', pub: 46.7 },
    'Qwen2.5 7B': { V: 152064, d: 3584, L: 28, H: 28, KV: 4, dh: 128, ff: 18944, E: 1, k: 1, tied: false, attn: 'GQA (QKV bias)', pos: 'RoPE θ=1M', norm: 'RMSNorm, pre', act: 'SwiGLU', ctx: '32k (128k YaRN)', lic: 'Apache 2.0', pub: 7.61 },
    'Gemma 2 9B': { V: 256000, d: 3584, L: 42, H: 16, KV: 8, dh: 256, ff: 14336, E: 1, k: 1, tied: true, attn: 'GQA, local/global alternating', pos: 'RoPE θ=10k', norm: 'RMSNorm, pre + post', act: 'GeGLU', ctx: '8k', lic: 'Gemma terms', pub: 9.24 },
  };
  function count(m) {
    const emb = m.V * m.d * (m.tied ? 1 : 2);
    const attn = m.d * m.H * m.dh + 2 * m.d * m.KV * m.dh + m.H * m.dh * m.d;
    const mlp1 = 3 * m.d * m.ff, router = m.E > 1 ? m.d * m.E : 0;
    const layer = attn + mlp1 * m.E + router + 2 * m.d;
    const total = emb + m.L * layer + m.d, active = emb + m.L * (attn + mlp1 * m.k + router + 2 * m.d) + m.d;
    return { emb, attn, mlp: mlp1 * m.E, layer, total, active };
  }

  const STAGES = [
    { y: '2017', name: 'Original transformer', norm: 'LayerNorm (post)', attn: 'Multi-head', ffn: 'ReLU MLP', pos: 'Sinusoidal', who: 'Vaswani et al.' },
    { y: '2019', name: 'Pre-norm', norm: 'LayerNorm (pre)', attn: 'Multi-head', ffn: 'GELU MLP', pos: 'Learned absolute', who: 'GPT-2' },
    { y: '2023', name: 'The Llama recipe', norm: 'RMSNorm (pre)', attn: 'Multi-head', ffn: 'SwiGLU', pos: 'RoPE', who: 'Llama 1' },
    { y: '2023', name: 'Grouped-query attention', norm: 'RMSNorm (pre)', attn: 'GQA', ffn: 'SwiGLU', pos: 'RoPE', who: 'Llama 2 70B, Mistral 7B' },
    { y: '2023–24', name: 'Mixture of experts', norm: 'RMSNorm (pre)', attn: 'GQA', ffn: 'MoE of SwiGLU experts', pos: 'RoPE', who: 'Mixtral, Qwen MoE' },
    { y: '2024–25', name: 'Latent attention + fine-grained MoE', norm: 'RMSNorm (pre)', attn: 'MLA', ffn: 'Shared + 256 routed experts', pos: 'Decoupled RoPE', who: 'DeepSeek-V2, V3' },
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

  function specCards() {
    const w = widget('Spec cards and parameter counter', 'Try it', 'Fields transcribed from each model’s published config.json; check against the source before relying on them. The count uses: embeddings (+ untied output) + layers × (attention + MLP × experts + router + norms).');
    let cur = 'Llama 3 8B'; const out = h('div', { style: { display: 'grid', gap: '12px' } }); const ro = readout();
    function draw() {
      const m = MODELS[cur], c = count(m);
      clear(out).append(table(['Field', 'Value'], [['Layers × d_model', `${m.L} × ${m.d.toLocaleString()}`], ['Query / KV heads × d_head', `${m.H} / ${m.KV} × ${m.dh}`], ['Attention', m.attn], ['Position', m.pos], ['Norm', m.norm], ['Activation, MLP width', `${m.act}, ${m.ff.toLocaleString()}`], ['MoE', m.E > 1 ? `${m.E} experts, top-${m.k}` : 'dense'], ['Vocabulary', m.V.toLocaleString() + (m.tied ? ' (tied embeddings)' : '')], ['Context', m.ctx], ['Licence', m.lic]]),
        table(['Piece', 'Parameters'], [['Embeddings' + (m.tied ? '' : ' + output head'), human(c.emb)], ['Attention per layer', human(c.attn)], ['MLP per layer' + (m.E > 1 ? ' (all experts)' : ''), human(c.mlp)], [`× ${m.L} layers`, human(c.layer * m.L)], ['Total', human(c.total)], ['Active per token', human(c.active)]], { num: [1] }));
      ro.set([['computed', human(c.total)], ['published', m.pub + 'B'], ['difference', (((c.total / 1e9 - m.pub) / m.pub) * 100).toFixed(1) + '%', Math.abs(c.total / 1e9 - m.pub) / m.pub < 0.02 ? 'var(--pass)' : 'var(--warn)']]);
    }
    const sg = seg(Object.keys(MODELS), cur, (v) => { cur = v; draw(); }, 'Model');
    w.body.append(sg.el, ro.el, out);
    draw();
    return w.el;
  }

  function archDiff() {
    const w = widget('Architecture diff', 'Try it');
    let a = 'Llama 3 8B', b = 'Gemma 2 9B'; const out = h('div');
    const fields = [['d', 'd_model'], ['L', 'layers'], ['H', 'query heads'], ['KV', 'KV heads'], ['dh', 'd_head'], ['ff', 'MLP width'], ['E', 'experts'], ['V', 'vocabulary'], ['tied', 'tied embeddings'], ['attn', 'attention'], ['pos', 'position'], ['norm', 'norm'], ['act', 'activation'], ['ctx', 'context']];
    function draw() {
      const A = MODELS[a], B = MODELS[b];
      clear(out).appendChild(table(['Field', a, b], fields.map(([k, l]) => { const diff = String(A[k]) !== String(B[k]); const f = (v) => h('span', { style: diff ? { color: 'var(--accent)', fontWeight: 600 } : null }, typeof v === 'number' ? v.toLocaleString() : String(v)); return [l, f(A[k]), f(B[k])]; })));
    }
    const mk = (init, set) => h('select', { onchange: (e) => { set(e.target.value); draw(); } }, Object.keys(MODELS).map((k) => h('option', { value: k, selected: k === init }, k)));
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'model A'), mk(a, (v) => (a = v))), h('div', { class: 'ctl' }, h('label', null, 'model B'), mk(b, (v) => (b = v)))), out, h('p', { class: 'note-sim' }, 'Highlighted rows differ.'));
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
        'DeepSeek compresses keys and values into a latent (Module 10) and splits experts into many small routed ones plus always-on shared experts.',
      ][i] })),
      init: heroInit,
    },
    sections: [{ title: 'Spec cards', widget: specCards }, { title: 'Spot the difference', widget: archDiff }],
    maths: [
      { note: 'Parameter count for a decoder with vocabulary V, width d, L layers, H query heads, H_kv KV heads, head size d_h, gated MLP width f, and E experts:', tex: 'N\\approx \\underbrace{Vd\\,(2-\\text{tied})}_{\\text{embeddings}}+L\\Big[\\underbrace{2d\\,Hd_h+2d\\,H_{kv}d_h}_{\\text{attention}}+\\underbrace{3d f\\,E}_{\\text{SwiGLU experts}}\\Big]' },
      { note: 'SwiGLU MLP (three matrices instead of two, so f is usually about 8d/3 to keep the parameter count of a 4d ReLU MLP):', tex: '\\mathrm{SwiGLU}(x)=W_2\\big(\\mathrm{SiLU}(W_1x)\\odot W_3x\\big)' },
    ],
    leaves: ['Six models cannot represent a fast-moving field; newer releases (DeepSeek-V3, Qwen3, gpt-oss and others) need cards from their own configs.', 'Configs describe shape, not training data or quality.', 'Licences differ in commercial and usage terms; read the actual licence.'],
    quiz: [
      { q: 'Llama 3 8B has a 128,256-token vocabulary, d = 4,096 and untied embeddings. Embedding + output parameters?', opts: ['≈ 0.5B', '≈ 1.05B', '≈ 4B', '≈ 128M'], a: 1, why: '128,256 × 4,096 × 2 ≈ 1.05B: about 13% of the model.' },
      { q: 'Which change made the biggest difference to KV-cache size?', opts: ['RMSNorm', 'SwiGLU', 'Grouped-query attention', 'Pre-norm'], a: 2, why: 'GQA cuts cached K/V heads, for example from 32 to 8.' },
      { q: 'Mixtral 8x7B is “8x7B” but has 46.7B parameters, not 56B. Why?', opts: ['Rounding', 'Only the MLPs are replicated per expert; attention and embeddings are shared', 'It is quantised', 'Two experts are removed'], a: 1, why: 'Each layer shares one attention block; only the eight SwiGLU MLPs are separate.' },
    ],
  });
})();
