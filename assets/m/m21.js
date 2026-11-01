(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, tokColor, rng, randn, softmax, matrixGrid } = LLM.util;
  const PAIRS = [['how to reset my password', 'Account › Forgot password sends a reset link'], ['refund for a double charge', 'Duplicate payments are refunded in 5 days'], ['is the app available offline', 'Offline mode keeps your last 30 days'], ['change delivery address', 'Edit the shipping address before dispatch'], ['cancel my subscription', 'Subscriptions can be cancelled in Settings'], ['export data to csv', 'Download your data as a CSV file']];

  // 2-D contrastive training on the unit circle (angles), InfoNCE with in-batch negatives
  function train(steps, tau = 0.2, seed = 4) {
    const r = rng(seed); let q = PAIRS.map(() => r() * 2 * Math.PI), p = PAIRS.map(() => r() * 2 * Math.PI);
    const hist = [[q.slice(), p.slice()]];
    for (let t = 0; t < steps; t++) {
      const gq = q.map(() => 0), gp = p.map(() => 0);
      q.forEach((qa, i) => { const sims = p.map((pa) => Math.cos(qa - pa) / tau); const pr = softmax(sims); p.forEach((pa, j) => { const coef = (pr[j] - (i === j ? 1 : 0)) / tau; const d = -Math.sin(qa - pa); gq[i] += coef * d; gp[j] -= coef * d; }); });
      q = q.map((a, i) => a - 0.02 * gq[i]); p = p.map((a, i) => a - 0.02 * gp[i]);
      hist.push([q.slice(), p.slice()]);
    }
    return hist;
  }
  const HIST = train(300);
  const loss = (q, p, tau = 0.2) => q.reduce((a, qa, i) => { const sims = p.map((pa) => Math.cos(qa - pa) / tau); return a - Math.log(softmax(sims)[i]); }, 0) / q.length;

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Queries and their passages pulled together on a circle while other passages are pushed apart' }); box.appendChild(g);
    let timer;
    function draw(k, focus) {
      clear(g);
      const [q, p] = HIST[k], cx = 190, cy = 190, R = 150;
      g.appendChild(s('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--rule)' }));
      const pt = (a) => [cx + R * Math.cos(a), cy - R * Math.sin(a)];
      if (focus != null) p.forEach((pa, j) => { const [x1, y1] = pt(q[focus]), [x2, y2] = pt(pa); g.appendChild(s('line', { x1, y1, x2, y2, stroke: j === focus ? 'var(--pass)' : 'var(--fail)', 'stroke-width': j === focus ? 2.5 : 1, 'stroke-dasharray': j === focus ? null : '3 3' })); });
      q.forEach((a, i) => { const [x, y] = pt(a); g.appendChild(s('circle', { cx: x, cy: y, r: 7, fill: tokColor(i) })); });
      p.forEach((a, i) => { const [x, y] = pt(a); g.appendChild(s('rect', { x: x - 6, y: y - 6, width: 12, height: 12, fill: 'var(--surface)', stroke: tokColor(i), 'stroke-width': 2.5 })); });
      const px = 370; g.appendChild(s('text', { x: px, y: 40, class: 'lbl', text: '● query   □ its passage' }));
      PAIRS.forEach(([qq], i) => g.appendChild(s('text', { x: px, y: 64 + i * 18, 'font-size': 10.5, text: qq.length > 26 ? qq.slice(0, 25) + '…' : qq, style: `fill:${tokColor(i)}` })));
      g.appendChild(s('text', { x: px, y: 200, 'font-size': 12, text: `step ${k}`, style: 'font-weight:600' }));
      g.appendChild(s('text', { x: px, y: 220, 'font-size': 12, text: `InfoNCE loss ${fmt(loss(q, p), 3)}` }));
      const acc = q.filter((qa, i) => p.map((pa) => Math.cos(qa - pa)).reduce((b, v, j, arr) => (v > arr[b] ? j : b), 0) === i).length;
      g.appendChild(s('text', { x: px, y: 240, 'font-size': 12, text: `queries whose nearest passage is theirs: ${acc}/6` }));
      g.appendChild(s('text', { x: 14, y: 370, class: 'lbl', text: '2-D toy: real models learn 384–4096-D vectors, but the forces are the same.' }));
    }
    return { go(i) { clearInterval(timer); if (i === 0) draw(0); if (i === 1) draw(0, 0); if (i === 2) { let k = 0; timer = setInterval(() => { k = Math.min(300, k + 6); draw(k, 0); if (k >= 300) clearInterval(timer); }, LLM.util.reduced() ? 0 : 40); } if (i === 3) draw(300); } };
  }

  function infoNCE() {
    const w = widget('In-batch similarity and the loss', 'Try it', 'Cosine similarities between the trained 2-D toy vectors (rows: queries, columns: passages). The diagonal holds the positives; every other cell is an in-batch negative.');
    const [q, p] = HIST[300];
    const S = q.map((qa) => p.map((pa) => Math.cos(qa - pa)));
    const g = svg(560, 250); const ro = readout();
    const st = slider({ label: 'temperature τ', min: 0.02, max: 1, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), oninput: draw });
    function draw() {
      clear(g);
      g.appendChild(matrixGrid(S, { x: 30, y: 30, cell: 34, color: (v) => (v > 0 ? 'var(--pass)' : 'var(--fail)'), max: 1, fs: 9, hl: (i, j) => i === j }));
      const row = softmax(S[0].map((x) => x / st.value));
      g.appendChild(s('text', { x: 270, y: 40, 'font-size': 12, text: 'query 1 after softmax(sim / τ):', style: 'font-weight:600' }));
      row.forEach((v, j) => { g.appendChild(s('rect', { x: 270, y: 52 + j * 26, width: 200, height: 18, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: 270, y: 52 + j * 26, width: v * 200, height: 18, rx: 3, fill: j === 0 ? 'var(--pass)' : 'var(--fail)' })); g.appendChild(s('text', { x: 476, y: 65 + j * 26, 'font-size': 10.5, text: (v * 100).toFixed(1) + '%' })); });
      ro.set([['loss for query 1', fmt(-Math.log(row[0]), 3)], ['batch loss', fmt(loss(q, p, st.value), 3)]]);
    }
    w.body.append(st.el, g, ro.el, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Small τ sharpens the softmax so hard negatives dominate the gradient; large τ treats all negatives alike. Typical values: 0.01–0.1.'));
    draw();
    return w.el;
  }

  function storage() {
    const w = widget('Storage and truncation', 'Try it');
    const st = { N: 10, d: 1024, fmt: 4 };
    const ro = readout();
    const sn = slider({ label: 'documents (millions of chunks)', min: 0.1, max: 1000, step: 0.1, value: st.N, oninput: (v) => { st.N = v; draw(); } });
    const sd = slider({ label: 'dimensions kept (Matryoshka)', min: 64, max: 4096, step: 64, value: st.d, oninput: (v) => { st.d = v; draw(); } });
    const sf = seg([[4, 'float32'], [2, 'float16'], [1, 'int8'], [0.125, 'binary']], 4, (v) => { st.fmt = v; draw(); }, 'Format');
    function draw() { const b = st.N * 1e6 * st.d * st.fmt; ro.set([['index size', bytes(b)], ['per vector', bytes(st.d * st.fmt)], ['vs float32 at 1024-D', ((st.d * st.fmt) / 4096 * 100).toFixed(1) + '%']]); }
    w.body.append(h('div', { class: 'ctl-row' }, sn.el, sd.el), sf.el, ro.el, h('p', { class: 'note-sim' }, 'Binary vectors are typically used for a fast first pass, then re-scored with full-precision vectors. Module 4 shows recall vs truncation.'));
    draw();
    return w.el;
  }

  LLM.mod('21', {
    hook: 'How does a search engine know “refund for a double charge” matches “duplicate payments are refunded”?',
    intro: ['An embedding model maps any text to one vector so that texts with similar meaning land close together. Unlike a chat model it generates nothing: it reads the input once and pools the hidden states into a single vector. It is trained by contrast: pull matching pairs together and push everything else apart.'],
    hero: {
      steps: [
        { title: 'Random start', text: 'Six support questions (dots) and their answer passages (squares), placed randomly on a circle of unit vectors.' },
        { title: 'One positive, many negatives', text: 'For query 1 the green line is its true passage; the red lines are the other passages in the same batch. They act as free negatives.' },
        { title: 'Contrastive training', text: 'Each step lowers InfoNCE loss: raise the similarity of the positive relative to all negatives. Pairs drift together; unrelated items spread apart.', maths: '\\mathcal{L}=-\\log\\frac{e^{\\mathrm{sim}(q,p^+)/\\tau}}{\\sum_j e^{\\mathrm{sim}(q,p_j)/\\tau}}' },
        { title: 'A usable space', text: 'Every query’s nearest passage is now its own. New text gets embedded into this space and compared by cosine similarity.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Anatomy of an embedding model', depth: 'mechanics', body: [
        '<b>Bi-encoder.</b> One encoder, applied separately to the query and to each passage; compare vectors with cosine or dot product. Passages can be embedded once, offline.',
        '<b>Pooling.</b> CLS token (BERT-style), mean of all token vectors, or last token (decoder-based embedders).',
        '<b>Hard negatives.</b> In-batch negatives are easy; mining near-misses (passages a weaker model ranked high but are wrong) teaches finer distinctions.',
        '<b>Instruction prefixes.</b> Many models expect “query: …” and “passage: …” or a task instruction, because questions and answers are not the same kind of text. Using the wrong prefix measurably hurts ranking.',
        '<b>Practicalities.</b> Max sequence length (often 512–8k tokens), L2 normalisation (so dot product equals cosine), multilingual and code-specific models, and domain fine-tuning on your own pairs.',
        '<b>Choosing.</b> MTEB ranks models on many tasks, but your own eval set of real queries and relevant passages is what decides.',
      ], widget: infoNCE },
      { title: 'What it costs to store', widget: storage },
    ],
    maths: [
      { note: '<b>InfoNCE</b> with temperature τ over a batch of passages:', tex: '\\mathcal{L}_{\\text{InfoNCE}}=-\\log\\frac{\\exp(\\mathrm{sim}(q,p^{+})/\\tau)}{\\sum_{j}\\exp(\\mathrm{sim}(q,p_j)/\\tau)}' },
      { note: 'Cosine similarity on L2-normalised vectors is just a dot product; storage scales linearly:', tex: '\\cos(a,b)=\\frac{a\\cdot b}{\\|a\\|\\,\\|b\\|}=\\hat a\\cdot\\hat b,\\qquad \\text{bytes}=N\\times d\\times \\text{bytes per value}' },
    ],
    leaves: ['A 2-D circle cannot hold many distinct meanings; real spaces have hundreds of dimensions.', 'The six pairs are written for this page; no real embedding model runs here.', 'Embeddings capture topical similarity better than negation or exact constraints (“not red”), which is one reason re-ranking (Module 24) helps.'],
    quiz: [
      { q: 'Why can passage embeddings be computed offline?', opts: ['They are random', 'A bi-encoder embeds each passage independently of the query', 'Queries never change', 'They are binary'], a: 1, why: 'Query and passage never meet inside the model; only their vectors are compared.' },
      { q: 'A batch has 256 pairs. How many negatives does each query get for free?', opts: ['1', '255', '256', '65,536'], a: 1, why: 'Every other pair’s passage in the batch is a negative.' },
      { q: '50M chunks, 768-D, float32. Index size?', opts: ['≈ 15 GB', '≈ 154 GB', '≈ 38 GB', '≈ 1.5 TB'], a: 1, why: '50e6 × 768 × 4 bytes ≈ 153.6e9 bytes.' },
    ],
  });
})();
