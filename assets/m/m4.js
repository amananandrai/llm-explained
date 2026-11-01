(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, tokColor, rng, randn, lineChart, tween } = LLM.util;
  // Hand-built 4-D toy embeddings: dims = [royal, female, finance, nature]
  const DIMS = ['royal', 'female', 'finance', 'nature'];
  const E = {
    king: [0.9, -0.8, 0.1, 0], queen: [0.9, 0.8, 0.1, 0], man: [0.1, -0.8, 0, 0.1], woman: [0.1, 0.8, 0, 0.1],
    prince: [0.7, -0.75, 0.05, 0], princess: [0.7, 0.75, 0.05, 0], boy: [0, -0.7, 0, 0.1], girl: [0, 0.7, 0, 0.1],
    money: [0, 0, 0.9, -0.1], loan: [0, 0, 0.8, -0.2], river: [0, 0, -0.1, 0.9], tree: [0, 0, 0, 0.8], crown: [0.8, 0, 0.3, 0],
  };
  const BANK = { static: [0, 0, 0.5, 0.45], river: [0, 0, 0.08, 0.82], money: [0, 0, 0.85, 0.02] };
  const cos = (a, b) => { const d = a.reduce((s2, x, i) => s2 + x * b[i], 0); return d / (Math.hypot(...a) * Math.hypot(...b) || 1); };
  const nearest = (v, excl) => Object.entries(E).filter(([w]) => !excl.includes(w)).map(([w, e]) => [w, cos(v, e)]).sort((a, b) => b[1] - a[1]);

  function scatter(g, ax, ay, opts = {}) {
    const W = 560, H = 360, cx = 280, cy = 190, sc = 150;
    const fx = (v) => cx + v[ax] * sc, fy = (v) => cy - v[ay] * sc;
    g.appendChild(s('line', { x1: 40, x2: W - 30, y1: cy, y2: cy, stroke: 'var(--rule)' })); g.appendChild(s('line', { x1: cx, x2: cx, y1: 30, y2: H - 20, stroke: 'var(--rule)' }));
    g.appendChild(s('text', { x: W - 30, y: cy - 6, 'text-anchor': 'end', class: 'lbl', text: DIMS[ax] + ' →' })); g.appendChild(s('text', { x: cx + 6, y: 40, class: 'lbl', text: '↑ ' + DIMS[ay] }));
    Object.entries(E).forEach(([w, v], i) => { if (opts.only && !opts.only.includes(w)) return; const hl = opts.hl && opts.hl.includes(w); g.appendChild(s('circle', { cx: fx(v), cy: fy(v), r: hl ? 6 : 4, fill: hl ? 'var(--accent)' : 'var(--muted)', style: opts.dim && !hl ? 'opacity:.35' : '' })); g.appendChild(s('text', { x: fx(v) + 8, y: fy(v) + 4, 'font-size': 11.5, text: w, style: (opts.dim && !hl ? 'opacity:.4;' : '') + (hl ? 'font-weight:600' : '') })); });
    return { fx, fy };
  }
  function arrow(g, p, q, color, label) {
    g.appendChild(s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, 'stroke-width': 2.5, 'marker-end': 'url(#ah)' }));
    if (label) g.appendChild(s('text', { x: (p[0] + q[0]) / 2 + 6, y: (p[1] + q[1]) / 2 - 6, 'font-size': 11, text: label, style: `fill:${color}` }));
  }
  function defs(g) { g.appendChild(s('defs', null, s('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--ink)' })))); }

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'Toy embedding space: king minus man plus woman lands near queen, then bank splits by context' }); box.appendChild(g);
    let stop = () => {};
    const res = E.king.map((x, i) => x - E.man[i] + E.woman[i]);
    function draw(step, t = 1) {
      clear(g); defs(g);
      if (step <= 3) {
        const { fx, fy } = scatter(g, 1, 0, { hl: step === 0 ? null : ['king', 'man', 'woman', 'queen'], dim: step > 0 });
        if (step >= 1) { arrow(g, [fx(E.man), fy(E.man)], [fx(E.king), fy(E.king)], 'var(--q)', 'king − man'); }
        if (step >= 2) { const st = E.woman, en = st.map((x, i) => x + (E.king[i] - E.man[i]) * t); arrow(g, [fx(st), fy(st)], [fx(en), fy(en)], 'var(--v)', '+ same offset'); if (t === 1) { g.appendChild(s('circle', { cx: fx(res), cy: fy(res), r: 12, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '3 3' })); const nn = nearest(res, ['king', 'man', 'woman'])[0]; g.appendChild(s('text', { x: 40, y: 340, 'font-size': 12, text: `nearest word to king − man + woman: “${nn[0]}” (cosine ${fmt(nn[1], 3)})` })); } }
        if (step === 3) g.appendChild(s('text', { x: 40, y: 320, class: 'lbl', text: 'Toy vectors are built to make this work. In real embeddings it often fails without excluding inputs.' }));
        g.appendChild(s('text', { x: 40, y: 22, 'font-size': 13, text: step === 0 ? 'Words as points: similar meaning sits close together' : 'Directions carry meaning: the “female” offset is shared', style: 'font-weight:600' }));
      } else {
        const ax = 2, ay = 3; const { fx, fy } = scatter(g, ax, ay, { only: ['money', 'loan', 'river', 'tree'], hl: [] });
        const sp = BANK.static, tgtR = BANK.river, tgtM = BANK.money;
        const p = (v) => [fx(v), fy(v)];
        if (step === 4) { g.appendChild(s('circle', { cx: fx(sp), cy: fy(sp), r: 7, fill: 'var(--accent)' })); g.appendChild(s('text', { x: fx(sp) + 10, y: fy(sp) + 4, 'font-size': 12, text: 'bank (static: one vector)', style: 'font-weight:600' })); g.appendChild(s('text', { x: 40, y: 22, 'font-size': 13, text: 'word2vec gives “bank” a single vector, stuck between meanings', style: 'font-weight:600' })); }
        if (step === 5) {
          const a = sp.map((x, i) => x + (tgtR[i] - x) * t), b = sp.map((x, i) => x + (tgtM[i] - x) * t);
          [[a, '“sat on the river bank”'], [b, '“paid into the bank”']].forEach(([v, lab]) => { g.appendChild(s('circle', { cx: fx(v), cy: fy(v), r: 7, fill: 'var(--accent)' })); g.appendChild(s('text', { x: fx(v) + 10, y: fy(v) - 8, 'font-size': 11.5, text: 'bank in ' + lab })); });
          g.appendChild(s('circle', { cx: fx(sp), cy: fy(sp), r: 5, fill: 'none', stroke: 'var(--muted)', 'stroke-dasharray': '2 2' }));
          g.appendChild(s('text', { x: 40, y: 22, 'font-size': 13, text: 'Inside a transformer, context moves the vector', style: 'font-weight:600' }));
        }
      }
    }
    return { go(i) { stop(); if (i === 2 || i === 5) stop = tween(1100, (t) => draw(i, t)); else draw(i); } };
  }

  function ropeDial() {
    const w = widget('RoPE dial', 'Try it');
    const g = svg(560, 280); const ro = readout();
    const st = { m: 3, n: 1, shift: 0, theta: 0.5 };
    const q0 = [1, 0.25], k0 = [0.8, 0.5];
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    function draw() {
      clear(g); defs(g);
      const cx = 150, cy = 140, R = 110;
      g.appendChild(s('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--rule)' }));
      const qa = (st.m + st.shift) * st.theta, ka = (st.n + st.shift) * st.theta;
      const q = rot(q0, qa), k = rot(k0, ka);
      arrow(g, [cx, cy], [cx + q[0] * 100, cy - q[1] * 100], 'var(--q)', 'q at ' + (st.m + st.shift));
      arrow(g, [cx, cy], [cx + k[0] * 100, cy - k[1] * 100], 'var(--k)', 'k at ' + (st.n + st.shift));
      const d = q[0] * k[0] + q[1] * k[1];
      const gap = ((qa - ka) * 180 / Math.PI) % 360;
      g.appendChild(s('text', { x: 300, y: 70, 'font-size': 13, text: `q rotated by ${(st.m + st.shift)}·θ`, style: 'fill:var(--q)' }));
      g.appendChild(s('text', { x: 300, y: 92, 'font-size': 13, text: `k rotated by ${(st.n + st.shift)}·θ`, style: 'fill:var(--k)' }));
      g.appendChild(s('text', { x: 300, y: 128, 'font-size': 13, text: `angle between them: ${gap.toFixed(1)}°` }));
      g.appendChild(s('text', { x: 300, y: 150, 'font-size': 13, text: `q · k = ${fmt(d, 4)}`, style: 'font-weight:600' }));
      g.appendChild(s('text', { x: 300, y: 186, class: 'lbl', text: 'Slide “shift both”: the score never changes.' }));
      g.appendChild(s('text', { x: 300, y: 202, class: 'lbl', text: 'It depends only on m − n, the relative position.' }));
      ro.set([['m − n', st.m - st.n], ['q·k', fmt(d, 4)]]);
    }
    const sm = slider({ label: 'query position m', min: 0, max: 12, value: st.m, oninput: (v) => { st.m = v; draw(); } });
    const sn = slider({ label: 'key position n', min: 0, max: 12, value: st.n, oninput: (v) => { st.n = v; draw(); } });
    const ss = slider({ label: 'shift both by', min: 0, max: 40, value: 0, oninput: (v) => { st.shift = v; draw(); } });
    const th = slider({ label: 'frequency θ', min: 0.05, max: 1.5, step: 0.05, value: st.theta, fmt: (v) => v.toFixed(2), oninput: (v) => { st.theta = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, sm.el, sn.el, ss.el, th.el), g, ro.el, h('p', { class: 'note-sim' }, 'One 2-D pair of a query and key. Real RoPE splits d_head into d/2 pairs, each rotating at its own frequency θᵢ = 10000^(−2i/d).'));
    draw();
    return w.el;
  }

  function matryoshka() {
    const w = widget('Matryoshka truncation', 'Try it', 'Simulation: 300 random 64-D “documents” whose dimensions carry decaying variance, as Matryoshka training encourages; each query is its document plus noise. Recall@1 is measured by cosine similarity on the first d dimensions.');
    const r = rng(42), D = 64, Ndoc = 300;
    const sd = Array.from({ length: D }, (_, i) => Math.exp(-i / 14));
    const docs = Array.from({ length: Ndoc }, () => sd.map((s2) => randn(r) * s2));
    const qs = docs.map((d) => d.map((x) => x + randn(r) * 0.32));
    const recall = (d) => { let hit = 0; qs.forEach((q, qi) => { let best = -1, bi = -1; docs.forEach((doc, di) => { let dd = 0, nq = 0, nd = 0; for (let i = 0; i < d; i++) { dd += q[i] * doc[i]; nq += q[i] * q[i]; nd += doc[i] * doc[i]; } const c = dd / Math.sqrt(nq * nd); if (c > best) { best = c; bi = di; } }); if (bi === qi) hit++; }); return hit / qs.length; };
    const dimsList = [2, 4, 8, 12, 16, 24, 32, 48, 64];
    const curve = dimsList.map((d) => [d, recall(d)]);
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const sl = slider({ label: 'keep first d dimensions', min: 0, max: dimsList.length - 1, value: 6, fmt: (i) => dimsList[i], oninput: draw });
    function draw() {
      const d = dimsList[sl.value], rc = curve[sl.value][1];
      ch.draw([{ pts: curve, color: 'var(--v)', area: true, dots: [[d, rc]] }], { ymin: 0, ymax: 1, xlabel: 'dimensions kept', ylabel: 'recall@1', marks: [{ x: d }] });
      ro.set([['recall@1', (rc * 100).toFixed(1) + '%'], ['storage per vector (float32)', d * 4 + ' bytes'], ['vs full', ((d / 64) * 100).toFixed(0) + '%']]);
    }
    w.body.append(sl.el, ch.el, ro.el);
    draw();
    return w.el;
  }

  function explorer() {
    const w = widget('Projection explorer', 'Try it');
    const g = svg(560, 360); let ax = 1, ay = 0;
    const tbl = h('div', { class: 'tbl-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'word'), DIMS.map((d) => h('th', { class: 'num' }, d)))), h('tbody', null, Object.entries(E).map(([wd, v]) => h('tr', null, h('td', null, wd), v.map((x) => h('td', { class: 'num' }, fmt(x, 2))))))));
    function draw() { clear(g); defs(g); scatter(g, ax, ay); }
    const pairs = [[1, 0], [2, 3], [0, 2], [1, 3]];
    const sg = seg(pairs.map((p, i) => [i, `${DIMS[p[0]]} × ${DIMS[p[1]]}`]), 0, (i) => { [ax, ay] = pairs[i]; draw(); }, 'Axes');
    w.body.append(sg.el, g, h('details', null, h('summary', { class: 'eyebrow', style: { cursor: 'pointer' } }, 'All 4-D vectors'), tbl), h('p', { class: 'note-sim' }, 'Hand-built 4-D vectors with named axes, so you can see what each number means. Learned embeddings have hundreds of unnamed axes and need PCA or UMAP to project.'));
    draw();
    return w.el;
  }

  LLM.mod('4', {
    hook: 'How can a list of numbers mean “queen”?',
    intro: ['After tokenisation, each token ID picks a row from an embedding table: a learned vector. Training arranges these vectors so that tokens used in similar ways end up close together, and some directions in the space come to carry meaning.'],
    hero: {
      steps: [
        { title: 'Words as points', text: 'Here each word is a 4-number vector with named axes (royal, female, finance, nature). We plot two of them. Related words cluster.', mech: 'The embedding table E has shape [vocab, d_model]. Looking up token id i returns row E[i]. A one-hot vector times E gives the same row.' },
        { title: 'A direction for “royal”', text: 'The arrow from man to king is the change that “royal” makes.' },
        { title: 'Analogy arithmetic', text: 'Add the same arrow to woman and you land next to queen. king − man + woman ≈ queen.', maths: '\\vec{\\text{king}}-\\vec{\\text{man}}+\\vec{\\text{woman}}\\approx\\vec{\\text{queen}}' },
        { title: 'Where it breaks', text: 'With real word2vec vectors this works for some relations and fails for many; the famous result also excludes the input words from the answer. Treat analogies as a hint about geometry, not a law.' },
        { title: 'One word, one vector?', text: 'Static embeddings (word2vec, GloVe) give “bank” one vector, a blur of river bank and money bank.' },
        { title: 'Context splits the point', text: 'Inside a transformer, every layer mixes in neighbouring tokens. By the middle layers “bank” sits near river or near money depending on the sentence. These are contextual embeddings.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Types of embeddings', body: [
        h('div', { class: 'tbl-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Type'), h('th', null, 'What it is'), h('th', null, 'Examples'))), h('tbody', null, [
          ['Static word', 'One vector per word, trained to predict neighbours', 'word2vec (skip-gram, CBOW), GloVe, fastText subwords'],
          ['Contextual token', 'Hidden states that change with the sentence', 'BERT and GPT hidden layers'],
          ['Positional', 'Information about where a token sits', 'Sinusoidal, learned absolute, relative, RoPE, ALiBi'],
          ['Sentence / document', 'One vector for a whole passage, for search', 'Pooling plus contrastive training (Module 21)'],
          ['Sparse, dense, multi-vector', 'Keyword weights vs one vector vs one per token', 'BM25, SPLADE; single dense; ColBERT'],
          ['Matryoshka and quantised', 'Truncatable or low-bit vectors for cheap storage', 'Matryoshka, int8, binary'],
          ['Multimodal', 'Text and images in one shared space', 'CLIP'],
        ].map((r) => h('tr', null, r.map((c) => h('td', null, c))))))),
      ] },
      { title: 'Adding position: RoPE', depth: 'mechanics', body: ['Attention by itself is blind to order: shuffle the tokens and every score is the same. Rotary position embedding (RoPE) fixes this by rotating each query and key by an angle proportional to its position. Because both rotate, their dot product depends only on how far apart they are.'], widget: ropeDial },
    ],
    maths: [
      { note: '<b>RoPE</b> rotates each pair of dimensions (2i, 2i+1) of a vector at position m:', tex: '\\begin{pmatrix}x\'_{2i}\\\\x\'_{2i+1}\\end{pmatrix}=\\begin{pmatrix}\\cos m\\theta_i&-\\sin m\\theta_i\\\\\\sin m\\theta_i&\\cos m\\theta_i\\end{pmatrix}\\begin{pmatrix}x_{2i}\\\\x_{2i+1}\\end{pmatrix},\\quad \\theta_i=10000^{-2i/d}' },
      { note: '<b>Relative-position property.</b> Rotations compose and are orthogonal, R(a)ᵀR(b) = R(b − a), so', tex: '\\big(R(m\\theta)\\Q{q}\\big)^{\\top}\\big(R(n\\theta)\\K{k}\\big)=\\Q{q}^{\\top}R\\big((n-m)\\theta\\big)\\K{k}', after: 'The score depends on n − m only. The dial demonstrates exactly this.' },
      { note: '<b>Skip-gram</b> (word2vec) trains vectors so a word predicts its neighbours, with negative sampling:', tex: '\\mathcal{L}=-\\log\\sigma(\\vec u_{o}\\cdot\\vec v_{c})-\\sum_{k=1}^{K}\\log\\sigma(-\\vec u_{k}\\cdot\\vec v_{c})' },
    ],
    tryit: [explorer, matryoshka],
    leaves: ['The axes here are named and hand-set. Learned axes are not interpretable one by one; meaning is spread across many directions.', 'The plot is 2-D; distances in 768-D behave differently (most random vectors are nearly orthogonal).', 'Embeddings also encode biases from their training text, which analogy demos can surface.'],
    quiz: [
      { q: 'An embedding table has vocab 32,000 and d_model 4,096. How many parameters?', opts: ['≈ 131M', '≈ 32k', '≈ 4M', '≈ 1.3B'], a: 0, why: '32,000 × 4,096 = 131,072,000.' },
      { q: 'With RoPE, a query at position 10 and key at 7 score the same as a query at position…', opts: ['10 and key at 10', '103 and key at 100', '7 and key at 10', 'Any pair'], a: 1, why: 'Only the gap matters: 103 − 100 = 10 − 7 = 3.' },
      { q: 'Why does a static embedding struggle with “bank”?', opts: ['It is too long', 'It gives the word a single vector regardless of context', 'It has no vector for it', 'It uses RoPE'], a: 1, why: 'Contextual embeddings from a transformer change with the sentence; static ones cannot.' },
    ],
  });
})();
