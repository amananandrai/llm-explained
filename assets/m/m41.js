(function () {
  const { h, s, svg, clear, seg, widget, readout, fmt, mix, tokColor, matrixGrid, softmax, matmul, T, rng, randn, diagram } = LLM.util;

  /* ---------- a tiny real decoder: 1 block, d=8, 2 heads (GQA with 1 KV head), RoPE, RMSNorm, SwiGLU ---------- */
  const VOCAB = ['<s>', 'the', 'cat', 'dog', 'sat', 'ran', 'on', 'mat', 'park', 'a', 'big', 'small', 'and', '.', 'is', 'happy'];
  const D = 8, H = 2, DH = 4, FF = 16;
  const r = rng(41);
  const M = (a, b, sc = 1) => Array.from({ length: a }, () => Array.from({ length: b }, () => +(randn(r) * sc / Math.sqrt(a)).toFixed(3)));
  const W = { E: M(VOCAB.length, D, 3), Wq: M(D, H * DH), Wk: M(D, DH), Wv: M(D, DH), Wo: M(H * DH, D), W1: M(D, FF), W3: M(D, FF), W2: M(FF, D) };
  const rms = (x) => { const s2 = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length + 1e-6); return x.map((v) => v / s2); };
  const rope = (v, pos) => { const o = v.slice(); for (let i = 0; i < v.length; i += 2) { const th = pos * Math.pow(10000, -i / v.length); o[i] = v[i] * Math.cos(th) - v[i + 1] * Math.sin(th); o[i + 1] = v[i] * Math.sin(th) + v[i + 1] * Math.cos(th); } return o; };
  const silu = (x) => x / (1 + Math.exp(-x));
  function forward(ids) {
    const n = ids.length, X = ids.map((i) => W.E[i].slice());
    const Xn = X.map(rms);
    const Q = matmul(Xn, W.Wq).map((q, p) => [0, 1].flatMap((hh) => rope(q.slice(hh * DH, hh * DH + DH), p)));
    const K = matmul(Xn, W.Wk).map((k, p) => rope(k, p)), V = matmul(Xn, W.Wv);
    const S = [0, 1].map((hh) => Q.map((q, i) => K.map((k, j) => (j <= i ? q.slice(hh * DH, hh * DH + DH).reduce((a, x, t) => a + x * k[t], 0) / Math.sqrt(DH) : -Infinity))));
    const A = S.map((Sh) => Sh.map((row) => softmax(row.map((x) => (x === -Infinity ? -1e9 : x)))));
    const heads = A.map((Ah) => matmul(Ah, V));
    const cat = heads[0].map((r0, i) => r0.concat(heads[1][i]));
    const attnOut = matmul(cat, W.Wo);
    const X2 = X.map((x, i) => x.map((v, k) => v + attnOut[i][k]));
    const X2n = X2.map(rms);
    const g1 = matmul(X2n, W.W1), g3 = matmul(X2n, W.W3), gate = g1.map((row, i) => row.map((v, k) => silu(v) * g3[i][k]));
    const mlp = matmul(gate, W.W2);
    const X3 = X2.map((x, i) => x.map((v, k) => v + mlp[i][k]));
    const last = rms(X3[n - 1]); const lg = W.E.map((e) => e.reduce((a, x, k) => a + x * last[k], 0)); // tied unembedding
    return { X, Q, K, V, S, A, cat, attnOut, X2, gate, mlp, X3, logits: lg, probs: softmax(lg) };
  }

  function inspector() {
    const w = widget('A tiny real transformer, fully open', 'Try it', 'One decoder block with RMSNorm, RoPE, grouped-query attention (2 query heads sharing 1 KV head), SwiGLU and tied embeddings: d_model 8, 16-word vocabulary. Weights are random (seeded), so predictions are meaningless; every tensor is computed live from them.');
    let ids = [0, 1, 2, 4];
    const words = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } });
    const pal = h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } });
    VOCAB.slice(1).forEach((t, i) => pal.appendChild(h('button', { type: 'button', class: 'btn', style: { fontFamily: 'var(--f-mono)', fontSize: '.8rem', padding: '3px 8px' }, onclick: () => { if (ids.length < 8) { ids.push(i + 1); draw(); } } }, t)));
    let view = 'X'; const out = h('div', { style: { overflowX: 'auto' } }); const ro = readout();
    const VIEWS = [['X', 'embeddings [n, 8]'], ['Q', 'Q after RoPE [n, 2×4]'], ['K', 'K after RoPE [n, 4]'], ['V', 'V [n, 4]'], ['A0', 'attention head 1 [n, n]'], ['A1', 'attention head 2 [n, n]'], ['attnOut', 'attention output [n, 8]'], ['gate', 'SwiGLU hidden [n, 16]'], ['X3', 'block output [n, 8]'], ['probs', 'next-token probabilities [16]']];
    function draw() {
      const R = forward(ids);
      clear(words).append(...ids.map((id, i) => h('span', { class: 'tok', style: { borderColor: tokColor(i), background: mix(tokColor(i), 18, 'var(--paper)') } }, VOCAB[id])), h('button', { class: 'btn', type: 'button', onclick: () => { if (ids.length > 1) { ids.pop(); draw(); } } }, '⌫'), h('button', { class: 'btn primary', type: 'button', onclick: () => { if (ids.length < 8) { ids.push(R.probs.indexOf(Math.max(...R.probs))); draw(); } } }, 'Append greedy token'));
      const g = svg(560, 40 + Math.max(ids.length, 2) * 30 + 20);
      let mat, lab = VIEWS.find((v) => v[0] === view)[1];
      if (view === 'A0' || view === 'A1') mat = R.A[+view[1]];
      else if (view === 'probs') mat = null; else mat = R[view];
      if (mat) { const cell = Math.min(34, 520 / mat[0].length); g.appendChild(matrixGrid(mat, { x: 50, y: 30, cell, color: (v) => (v >= 0 ? 'var(--q)' : 'var(--k)'), fs: cell > 26 ? 8.5 : 7, numbers: cell > 20, label: lab })); ids.forEach((id, i) => g.appendChild(s('text', { x: 44, y: 30 + i * cell + cell / 2 + 3, 'text-anchor': 'end', 'font-size': 10, text: VOCAB[id], style: `fill:${tokColor(i)}` }))); g.setAttribute('viewBox', `0 0 560 ${40 + mat.length * cell + 10}`); }
      else { const top = R.probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]); g.setAttribute('viewBox', `0 0 560 ${30 + 16 * 18}`); g.appendChild(s('text', { x: 4, y: 14, class: 'lbl', text: lab })); top.forEach(([p, i], k) => { g.appendChild(s('text', { x: 64, y: 34 + k * 18, 'text-anchor': 'end', 'font-size': 10.5, text: VOCAB[i] })); g.appendChild(s('rect', { x: 70, y: 24 + k * 18, width: p * 1200, height: 13, rx: 2, fill: k ? 'var(--q)' : 'var(--accent)' })); g.appendChild(s('text', { x: 76 + p * 1200, y: 34 + k * 18, 'font-size': 10, text: (p * 100).toFixed(1) + '%' })); }); }
      clear(out).appendChild(g);
      const params = Object.values(W).reduce((a, m) => a + m.length * m[0].length, 0);
      ro.set([['tokens', ids.length], ['parameters', params.toLocaleString()], ['KV cache values', (ids.length * 2 * DH).toLocaleString() + ' (1 KV head)'], ['top next token', VOCAB[R.probs.indexOf(Math.max(...R.probs))]]]);
    }
    const sg = seg(VIEWS.map(([k, l]) => [k, l.split(' [')[0]]), view, (v) => { view = v; draw(); }, 'Tensor');
    w.body.append(words, h('div', { class: 'eyebrow' }, 'add a word'), pal, sg.el, out, ro.el);
    draw();
    return w.el;
  }

  /* ---------- hero: one request, end to end ---------- */
  const STAGES = [
    ['Text', '“What is the return window for opened items?”', 'string, 46 characters'],
    ['Agent harness', 'The request enters the harness: system prompt, tools and memory are assembled (Modules 28–30).', 'context ≈ 3,200 tokens'],
    ['Retrieve', 'Hybrid search over chunked policy docs, fused with RRF, re-ranked by a cross-encoder (Modules 21–25).', 'top 5 of 80 candidates'],
    ['Tokens', 'Byte-level BPE turns the assembled prompt into IDs (Module 3).', '[seq = 3,412]'],
    ['Embeddings + RoPE', 'Each ID looks up a row of the embedding table; RoPE will rotate queries and keys by position (Module 4).', '[3,412, d_model = 4,096]'],
    ['N blocks', 'Each block: RMSNorm → grouped-query attention, reading and filling the KV cache → RMSNorm → MoE feed-forward (Modules 5, 10–12).', '[3,412, 4,096] in and out, × 32 layers'],
    ['Quantised weights', 'The weights are stored in 4-bit with per-group scales and dequantised on the fly (Module 15).', '≈ 4.3 GB of weights'],
    ['Logits → sample', 'The last position’s vector is projected to the vocabulary, softened by temperature and sampled with top-p (Module 7).', '[vocab = 128,256] → 1 token'],
    ['Decode loop', 'One token at a time, each step reading the KV cache instead of recomputing the prompt (Modules 7, 11).', '≈ 25 ms per token'],
    ['Tool call', 'Mid-answer the model calls <code>get_policy_version()</code> to cite the current date (Module 27).', 'ReAct lap 2'],
    ['Memory + trace', 'The answer is returned with citations; a fact is written to memory; the trace, cost and an online faithfulness score are logged (Modules 29, 37–38).', 'TTFT 420 ms · $0.006'],
  ];
  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'One request travelling through tokenisation, the transformer and the agent harness' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      STAGES.forEach(([n], i) => { const y = 14 + i * 30, on = i === step, done = i < step; g.appendChild(s('rect', { x: 10, y, width: 170, height: 24, rx: 12, fill: on ? 'var(--accent)' : done ? mix('var(--accent)', 22) : 'var(--sunk)' })); g.appendChild(s('text', { x: 22, y: y + 16, 'font-size': 11, text: `${i + 1}. ${n}`, style: on ? 'fill:var(--accent-ink);font-weight:700' : '' })); });
      const [n, , shape] = STAGES[step];
      g.appendChild(s('text', { x: 200, y: 34, 'font-size': 15, text: n, style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: 200, y: 56, 'font-size': 12, text: shape, style: 'fill:var(--accent)' }));
      // per-stage picture
      const px = 200, py = 80;
      if (step === 0) ['What', ' is', ' the', ' return', ' window', '…'].forEach((t, i) => { g.appendChild(s('text', { x: px + i * 56, y: py + 40, 'font-size': 13, text: t })); });
      if (step === 1 || step === 2 || step === 9 || step === 10) { const ns = [['h', 'harness'], ['r', 'retrieve'], ['m', 'model'], ['t', 'tool'], ['o', 'memory + trace']]; const d = diagram(340, 220, ns.map(([id, l], i) => ({ id, x: 10 + (i % 2) * 170, y: 10 + Math.floor(i / 2) * 75, w: 140, h: 40, label: l, color: 'var(--accent)' })), [['h', 'r'], ['r', 'm'], ['m', 't'], ['t', 'm'], ['m', 'o']]); const hot = { 1: ['h'], 2: ['r'], 9: ['t'], 10: ['o'] }[step]; d.draw({ hot, dim: ['h', 'r', 'm', 't', 'o'].filter((x) => !hot.includes(x) && x !== 'm') }); d.el.setAttribute('width', 340); d.el.setAttribute('height', 220); const wrap = s('g', { transform: `translate(${px},${py})` }); wrap.appendChild(d.el); g.appendChild(wrap); }
      if (step === 3) ['3923', '374', '279', '471', '3321', '369', '9107', '3673', '30'].forEach((t, i) => { g.appendChild(s('rect', { x: px + (i % 5) * 68, y: py + Math.floor(i / 5) * 40, width: 62, height: 28, rx: 5, fill: mix(tokColor(i), 30), stroke: tokColor(i) })); g.appendChild(s('text', { x: px + (i % 5) * 68 + 31, y: py + Math.floor(i / 5) * 40 + 18, 'text-anchor': 'middle', 'font-size': 11, text: t })); });
      if (step === 4 || step === 5) { const rr = rng(step); const Mx = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => randn(rr))); g.appendChild(matrixGrid(Mx, { x: px, y: py, cell: 26, color: (v) => (v > 0 ? 'var(--res)' : 'var(--k)'), numbers: false, label: 'first 6 tokens × first 8 dims' })); if (step === 5) { for (let l = 0; l < 4; l++) g.appendChild(s('rect', { x: px + 230 + l * 6, y: py + l * 6, width: 90, height: 150, rx: 6, fill: 'var(--surface)', stroke: 'var(--q)' })); g.appendChild(s('text', { x: px + 290, y: py + 90, 'text-anchor': 'middle', 'font-size': 11, text: '× 32 blocks' })); } }
      if (step === 6) for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) g.appendChild(s('rect', { x: px + j * 24, y: py + i * 24, width: 22, height: 22, rx: 2, fill: mix('var(--res)', 15 + ((i * 7 + j * 3) % 16) * 5) }));
      if (step === 7) [['14', 0.62], [' 30', 0.21], [' fourteen', 0.08], [' two', 0.05], [' 7', 0.04]].forEach(([t, p], i) => { g.appendChild(s('text', { x: px + 60, y: py + 16 + i * 26, 'text-anchor': 'end', 'font-size': 11, text: t })); g.appendChild(s('rect', { x: px + 66, y: py + 5 + i * 26, width: p * 400, height: 16, rx: 3, fill: i ? 'var(--q)' : 'var(--accent)' })); g.appendChild(s('text', { x: px + 72 + p * 400, y: py + 17 + i * 26, 'font-size': 10.5, text: (p * 100).toFixed(0) + '%' })); });
      if (step === 8) { 'Opened items can be returned within 14 days'.split(' ').forEach((t, i) => { g.appendChild(s('rect', { x: px + (i % 4) * 84, y: py + Math.floor(i / 4) * 34, width: 78, height: 26, rx: 5, fill: mix(tokColor(i), 30) })); g.appendChild(s('text', { x: px + (i % 4) * 84 + 39, y: py + Math.floor(i / 4) * 34 + 17, 'text-anchor': 'middle', 'font-size': 11, text: t })); }); for (let i = 0; i < 12; i++) g.appendChild(s('rect', { x: px + i * 26, y: py + 90, width: 22, height: 12, rx: 2, fill: 'var(--kv)' })); g.appendChild(s('text', { x: px, y: py + 120, class: 'lbl', text: 'KV cache grows one block per token' })); }
      g.appendChild(s('text', { x: 10, y: 352, class: 'lbl', text: 'Shapes follow a Llama-3-8B-sized model; token IDs and probabilities are illustrative.' }));
    }
    return { go: draw };
  }

  LLM.mod('41', {
    hook: 'What actually happens between pressing Enter and reading the answer?',
    intro: ['This capstone follows one question through everything in the course: the harness that assembles the context, retrieval that finds the policy, tokenisation, embeddings, the transformer blocks with their caches and experts, quantised weights, sampling, a tool call, memory and the production trace. Each step links back to the module that explains it.'],
    hero: { steps: STAGES.map(([n, t]) => ({ title: n, text: t })), init: heroInit },
    sections: [
      { title: 'Open the box', body: ['Below is a real, tiny transformer block running in your browser. Add words, then inspect every intermediate tensor: the same shapes as the hero, at toy scale. It has random weights, so it predicts nonsense, but every number on screen is genuinely computed by the architecture you have learned.'], widget: inspector },
      { title: 'Where to go next', body: ['Pick the part you want to build or understand more deeply: the attention family (Modules 5, 10), serving at scale (11, 13, 38), adapting models (14, 15, 20), retrieval (21–26), agents (27–36), or evaluation and safety (37–40). The Maths appendix collects the derivations.'] },
    ],
    maths: [
      { note: 'The whole forward pass for one block, in the notation of the course:', tex: '\\begin{aligned}x_0&=E[\\text{ids}]\\\\ x\'&=x+W_O\\,\\mathrm{GQA}\\big(\\mathrm{RoPE}(\\mathrm{RMSNorm}(x)W_Q),\\ \\mathrm{RoPE}(\\mathrm{RMSNorm}(x)W_K),\\ \\mathrm{RMSNorm}(x)W_V\\big)\\\\ x\'\'&=x\'+\\sum_{i\\in\\mathrm{TopK}}g_i\\,\\mathrm{SwiGLU}_i\\big(\\mathrm{RMSNorm}(x\')\\big)\\\\ p&=\\mathrm{softmax}\\big(E\\,\\mathrm{RMSNorm}(x_L)/T\\big)\\end{aligned}' },
    ],
    leaves: ['The tiny model has one block, no MoE and random weights; it shows mechanics, not behaviour.', 'Hero numbers are representative, not a recorded run.', 'A production request also passes through safety filters, rate limiting and billing that are only sketched here.'],
    quiz: [
      { q: 'Which step turns the final hidden vector into a probability for every token?', opts: ['RoPE', 'The unembedding (logits) and softmax', 'The KV cache', 'RRF'], a: 1, why: 'h_last × Eᵀ gives logits; softmax with temperature gives probabilities.' },
      { q: 'During the decode loop, what avoids recomputing the whole prompt every token?', opts: ['Quantisation', 'The KV cache', 'Re-ranking', 'Memory store'], a: 1, why: 'Past keys and values are reused; only the new token is computed.' },
      { q: 'In the tiny model, 2 query heads share 1 KV head. That is…', opts: ['MHA', 'GQA (here equivalent to MQA)', 'MLA', 'MoE'], a: 1, why: 'Query heads share key/value heads; with one KV head it is the MQA extreme.' },
    ],
  });
})();
