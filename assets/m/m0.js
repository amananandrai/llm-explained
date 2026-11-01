(function () {
  const { h, s, svg, clear, slider, widget, readout, softmax, fmt, probBars, matrixGrid, matmul, mix, tween } = LLM.util;

  /* hero: two arrows, dot product, cosine; then row × column matrix multiply */
  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Two vectors, their dot product, then a matrix multiply' });
    box.appendChild(g);
    let stop = () => {};
    const A = [[1, 2], [0, 1], [3, -1]], B = [[2, 0, 1], [1, 3, -1]], C = matmul(A, B);
    function arrows(angB) {
      clear(g);
      const ox = 170, oy = 220, sc = 60;
      for (let i = -2; i <= 3; i++) g.appendChild(s('line', { x1: ox + i * sc, x2: ox + i * sc, y1: oy - 3 * sc, y2: oy + 2 * sc, stroke: 'var(--rule)' }));
      for (let i = -2; i <= 3; i++) g.appendChild(s('line', { x1: ox - 2 * sc, x2: ox + 3 * sc, y1: oy - i * sc, y2: oy - i * sc, stroke: 'var(--rule)' }));
      const a = [2, 1], b = [2.2 * Math.cos(angB), 2.2 * Math.sin(angB)];
      const d = a[0] * b[0] + a[1] * b[1], cos = d / (Math.hypot(...a) * Math.hypot(...b));
      const arr = (v, c, lab) => { g.appendChild(s('line', { x1: ox, y1: oy, x2: ox + v[0] * sc, y2: oy - v[1] * sc, stroke: c, 'stroke-width': 3.5, 'stroke-linecap': 'round' })); g.appendChild(s('circle', { cx: ox + v[0] * sc, cy: oy - v[1] * sc, r: 6, fill: c })); g.appendChild(s('text', { x: ox + v[0] * sc + 10, y: oy - v[1] * sc - 6, 'font-size': 14, text: lab, style: `fill:${c};font-weight:600` })); };
      // projection of b on a
      const t = d / (a[0] * a[0] + a[1] * a[1]);
      g.appendChild(s('line', { x1: ox + b[0] * sc, y1: oy - b[1] * sc, x2: ox + a[0] * t * sc, y2: oy - a[1] * t * sc, stroke: 'var(--muted)', 'stroke-dasharray': '4 3' }));
      g.appendChild(s('line', { x1: ox, y1: oy, x2: ox + a[0] * t * sc, y2: oy - a[1] * t * sc, stroke: 'var(--accent)', 'stroke-width': 6, style: 'opacity:.35' }));
      arr(a, 'var(--q)', 'a'); arr(b, 'var(--k)', 'b');
      const px = 380;
      g.appendChild(s('text', { x: px, y: 60, class: 'lbl', text: 'a = [2.00, 1.00]' }));
      g.appendChild(s('text', { x: px, y: 78, class: 'lbl', text: `b = [${fmt(b[0])}, ${fmt(b[1])}]` }));
      g.appendChild(s('text', { x: px, y: 112, 'font-size': 13, text: 'a · b = ' + fmt(d) }));
      g.appendChild(s('text', { x: px, y: 134, 'font-size': 13, text: 'cos θ = ' + fmt(cos) }));
      g.appendChild(s('rect', { x: px, y: 150, width: 150, height: 12, rx: 3, fill: 'var(--sunk)' }));
      g.appendChild(s('rect', { x: cos >= 0 ? px + 75 : px + 75 + cos * 75, y: 150, width: Math.abs(cos) * 75, height: 12, rx: 3, fill: cos >= 0 ? 'var(--pass)' : 'var(--fail)' }));
      g.appendChild(s('text', { x: px, y: 180, class: 'lbl', text: '−1      0      +1' }));
      g.appendChild(s('text', { x: px, y: 214, class: 'lbl', text: 'Same direction → big positive.' }));
      g.appendChild(s('text', { x: px, y: 230, class: 'lbl', text: 'Right angle → zero.' }));
      g.appendChild(s('text', { x: px, y: 246, class: 'lbl', text: 'Opposite → negative.' }));
    }
    function mm(k) {
      clear(g);
      const cs = 40, i = Math.floor(k / 3), j = k % 3;
      g.appendChild(matrixGrid(A, { x: 30, y: 120, cell: cs, color: 'var(--q)', fmt: (v) => v, hl: (r) => r === i, max: 3, label: 'A  [3×2]' }));
      g.appendChild(matrixGrid(B, { x: 140, y: 30, cell: cs, color: 'var(--k)', fmt: (v) => v, hl: (_, c) => c === j, max: 3, label: 'B  [2×3]' }));
      g.appendChild(matrixGrid(C, { x: 140, y: 120, cell: cs, color: 'var(--v)', fmt: (v) => v, visible: (r, c) => r * 3 + c <= k, hl: (r, c) => r === i && c === j, max: 7, label: '' }));
      g.appendChild(s('text', { x: 140, y: 112, class: 'lbl', text: 'C = A·B  [3×3]' }));
      g.appendChild(s('text', { x: 300, y: 150, 'font-size': 13, text: `C[${i + 1},${j + 1}] = row ${i + 1} of A · column ${j + 1} of B` }));
      g.appendChild(s('text', { x: 300, y: 176, 'font-size': 13, text: `= ${A[i][0]}×${B[0][j]} + ${A[i][1]}×${B[1][j]} = ${C[i][j]}`, style: 'fill:var(--v)' }));
      g.appendChild(s('text', { x: 300, y: 216, class: 'lbl', text: 'A matrix multiply is just many dot products,' }));
      g.appendChild(s('text', { x: 300, y: 232, class: 'lbl', text: 'one per output cell.' }));
    }
    return {
      go(step) {
        stop();
        if (step === 0) arrows(0.35);
        if (step === 1) { let a0 = 0.35; stop = tween(1600, (t) => arrows(a0 + t * (Math.PI / 2 + 0.46 - a0))); }
        if (step === 2) { stop = tween(1600, (t) => arrows(Math.PI / 2 + 0.46 + t * 1.6)); }
        if (step === 3) { let k = 0; mm(0); const id = setInterval(() => { k++; if (k > 8) return clearInterval(id); mm(k); }, LLM.util.reduced() ? 0 : 500); if (LLM.util.reduced()) mm(8); stop = () => clearInterval(id); }
      },
    };
  }

  function dotPlayground() {
    const w = widget('Drag the vectors', 'Try it');
    const g = svg(560, 320); const ro = readout();
    const ox = 280, oy = 170, sc = 50;
    const v = { a: [2, 1], b: [-1, 2] };
    let drag = null;
    function draw() {
      clear(g);
      for (let i = -5; i <= 5; i++) { g.appendChild(s('line', { x1: ox + i * sc, x2: ox + i * sc, y1: 10, y2: 310, stroke: i ? 'var(--rule)' : 'var(--muted)' })); }
      for (let i = -3; i <= 3; i++) { g.appendChild(s('line', { x1: 30, x2: 530, y1: oy - i * sc, y2: oy - i * sc, stroke: i ? 'var(--rule)' : 'var(--muted)' })); }
      [['a', 'var(--q)'], ['b', 'var(--k)']].forEach(([k, c]) => {
        const [x, y] = v[k];
        g.appendChild(s('line', { x1: ox, y1: oy, x2: ox + x * sc, y2: oy - y * sc, stroke: c, 'stroke-width': 3.5 }));
        const hnd = s('circle', { cx: ox + x * sc, cy: oy - y * sc, r: 11, fill: c, style: 'cursor:grab', tabindex: 0, 'aria-label': `vector ${k}, arrow keys move it` });
        hnd.addEventListener('pointerdown', (e) => { drag = k; g.setPointerCapture(e.pointerId); });
        hnd.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key]; if (d) { v[k] = [v[k][0] + d[0], v[k][1] + d[1]]; draw(); e.preventDefault(); g.querySelector(`[aria-label^="vector ${k}"]`).focus(); } });
        g.appendChild(hnd);
        g.appendChild(s('text', { x: ox + x * sc + 14, y: oy - y * sc - 10, 'font-size': 14, text: k, style: `fill:${c};font-weight:700` }));
      });
      const d = v.a[0] * v.b[0] + v.a[1] * v.b[1], na = Math.hypot(...v.a), nb = Math.hypot(...v.b);
      const cos = d / (na * nb || 1);
      ro.set([['a', `[${fmt(v.a[0])}, ${fmt(v.a[1])}]`, 'var(--q)'], ['b', `[${fmt(v.b[0])}, ${fmt(v.b[1])}]`, 'var(--k)'], ['a·b', fmt(d)], ['|a||b|', fmt(na * nb)], ['cos θ', fmt(cos)], ['θ', (Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(0) + '°']]);
    }
    g.addEventListener('pointermove', (e) => { if (!drag) return; const r = g.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * 560, y = ((e.clientY - r.top) / r.height) * 320; v[drag] = [Math.round(((x - ox) / sc) * 4) / 4, Math.round(((oy - y) / sc) * 4) / 4]; draw(); });
    g.addEventListener('pointerup', () => { drag = null; });
    g.style.touchAction = 'none';
    w.body.append(g, ro.el, h('p', { class: 'note-sim' }, 'Drag the dots, or focus one and use the arrow keys. Snaps to quarter units.'));
    draw();
    return w.el;
  }

  function softmaxTemp() {
    const w = widget('Softmax with a temperature knob', 'Try it');
    const z = [2.0, 1.0, 0.5, 0.1, -1.0], labels = ['Paris', 'Lyon', 'France', 'the', 'banana'];
    const bars = probBars({ labelW: 70 }); const ro = readout();
    const sl = slider({ label: 'temperature T', min: 0.05, max: 5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), oninput: draw });
    function draw() {
      const p = softmax(z, sl.value);
      bars.draw(p.map((pp, i) => ({ label: labels[i], p: pp, color: 'var(--t' + i + ')' })), { scaleMax: 1 });
      ro.set([['logits', '[' + z.join(', ') + ']'], ['top', (p[0] * 100).toFixed(1) + '%']]);
    }
    w.body.append(sl.el, bars.el, ro.el, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Low T sharpens toward the largest logit; high T flattens toward uniform. Module 7 uses this exact knob for sampling.'));
    draw();
    return w.el;
  }

  function ballDescent() {
    const w = widget('A ball rolling down a loss curve', 'Try it');
    const L = (x) => 0.15 * x ** 4 - 0.9 * x ** 2 + 0.35 * x + 2, dL = (x) => 0.6 * x ** 3 - 1.8 * x + 0.35;
    const g = svg(560, 260); const ro = readout();
    let x = 2.6, path = [x], it = 0;
    const lr = slider({ label: 'learning rate η', min: 0.01, max: 1.2, step: 0.01, value: 0.1, fmt: (v) => v.toFixed(2) });
    const fx = (v) => 40 + ((v + 3.2) / 6.4) * 480, fy = (v) => 230 - (v / 6) * 210;
    function draw() {
      clear(g);
      let d = ''; for (let v = -3.2; v <= 3.2; v += 0.05) d += (d ? 'L' : 'M') + fx(v) + ',' + fy(L(v));
      g.appendChild(s('path', { d, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2 }));
      path.forEach((p, i) => { if (i) g.appendChild(s('line', { x1: fx(path[i - 1]), y1: fy(L(path[i - 1])), x2: fx(p), y2: fy(L(p)), stroke: 'var(--grad)', 'stroke-dasharray': '4 3', 'stroke-width': 1.5 })); });
      const inb = Math.abs(x) < 3.3;
      if (inb) g.appendChild(s('circle', { cx: fx(x), cy: fy(L(x)) - 9, r: 9, fill: 'var(--accent)' }));
      g.appendChild(s('text', { x: 40, y: 252, class: 'lbl', text: 'parameter x →' }));
      ro.set([['step', it], ['x', inb ? fmt(x) : 'off the chart'], ['loss', inb ? fmt(L(x)) : '∞'], ['gradient', inb ? fmt(dL(x)) : '—', 'var(--grad)']]);
    }
    const step = () => { if (Math.abs(x) > 50) return; x = x - lr.value * dL(x); path.push(x); it++; draw(); };
    w.body.append(lr.el, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn primary', type: 'button', onclick: step }, 'Take one step'),
      h('button', { class: 'btn', type: 'button', onclick: () => { for (let i = 0; i < 10; i++) step(); } }, '10 steps'),
      h('button', { class: 'btn', type: 'button', onclick: () => { x = 2.6; path = [x]; it = 0; draw(); } }, 'Reset')), g, ro.el,
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Each step moves against the slope by η × gradient. Try η = 0.05 (crawls into the nearer valley), 0.4 (bounces) and 1.0 (flies off). This curve has two valleys; where you start decides which one you find.'));
    draw();
    return w.el;
  }

  LLM.mod('0', {
    hook: 'What do you need to know to follow everything else? Five ideas, each one a picture.',
    intro: ['Optional. If dot products, softmax and gradient descent are familiar, skip to Module 1. Every later module leans on these ideas, so each one appears here as something you can drag.'],
    hero: {
      steps: [
        { title: 'A vector is an arrow', text: 'A list of numbers like [2, 1] is an arrow: 2 across, 1 up. Language models represent every token as an arrow, just with hundreds or thousands of numbers instead of two.' },
        { title: 'The dot product measures agreement', text: 'Multiply matching entries and add: a · b. Watch b swing round. When the arrows point the same way the dot product is large; at a right angle it is zero. The highlighted segment is how far b reaches along a.', maths: '\\Q{a}\\cdot\\K{b}=\\sum_i \\Q{a_i}\\K{b_i}=|\\Q{a}|\\,|\\K{b}|\\cos\\theta' },
        { title: 'Cosine removes length', text: 'Dividing by both lengths leaves only direction: cosine similarity runs from −1 (opposite) to +1 (same direction). Search engines over embeddings rank by this number.', maths: '\\cos\\theta=\\frac{\\Q{a}\\cdot\\K{b}}{|\\Q{a}|\\,|\\K{b}|}' },
        { title: 'Matrix multiply = many dot products', text: 'Each cell of A·B is one row of A dotted with one column of B. Watch the nine cells light up one by one. Every layer in a transformer is mostly this operation.', mech: '[3×2] · [2×3] → [3×3]: the inner sizes must match, the outer sizes give the result.', maths: 'C_{ij}=\\sum_k \\Q{A_{ik}}\\K{B_{kj}}' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Probability, likelihood and cross-entropy', body: [
        'A model outputs a probability for every possible next token, and those probabilities sum to 1. Training wants the probability of the token that actually came next to be high.',
        '<b>Likelihood</b> is that probability. Multiplying many small numbers underflows, so we take logs and add instead: the <b>log-likelihood</b>. Flip the sign to get a loss that should go down: the <b>negative log-likelihood</b>, which for one correct answer is exactly <b>cross-entropy</b>.',
        'If the model gives the right token 0.9, the loss is −log 0.9 ≈ 0.11. If it gives 0.01, the loss is −log 0.01 ≈ 4.6. Confident mistakes cost the most.',
      ] },
      { title: 'Softmax turns scores into probabilities', body: ['Scores (logits) can be any real number. Softmax exponentiates each one, which makes them positive, then divides by the total, which makes them sum to 1.'], widget: softmaxTemp },
    ],
    maths: [
      { note: 'Softmax with temperature T, and cross-entropy against a one-hot target y:', tex: '\\mathrm{softmax}(z)_i=\\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}},\\qquad \\mathcal{L}_{CE}=-\\sum_i y_i\\log p_i=-\\log p_{\\text{correct}}' },
      { note: 'Gradient descent steps against the gradient with learning rate η:', tex: '\\theta_{t+1}=\\theta_t-\\eta\\,\\G{\\nabla_\\theta\\mathcal{L}(\\theta_t)}' },
      { note: 'The softmax-plus-cross-entropy gradient is unusually clean, which is one reason the pair is everywhere:', tex: '\\frac{\\partial \\mathcal{L}_{CE}}{\\partial z_i}=p_i-y_i' },
    ],
    mathsLegend: 'blue and orange are the two inputs, amber is a gradient.',
    tryit: [dotPlayground, ballDescent],
    reading: ['<a href="#m0-kl">Sub-page: KL divergence, forward vs reverse →</a>'],
    leaves: ['Real embeddings have hundreds of dimensions; two are enough to see the geometry, but intuitions about distance in 2-D do not all carry over.', 'Real loss surfaces have billions of dimensions, and plain gradient descent is replaced by Adam (Module 1).', 'Probability here is only what the model outputs; calibration (whether 0.9 really means right 90% of the time) is a separate question (Module 39).'],
    quiz: [
      { q: 'a = [1, 0] and b = [0, 3]. What is a · b?', opts: ['3', '0', '1', '−3'], a: 1, why: '1×0 + 0×3 = 0. The arrows are at a right angle.' },
      { q: 'Logits [2, 2, 2]. What does softmax give?', opts: ['[2/6, 2/6, 2/6]', '[1/3, 1/3, 1/3]', '[1, 0, 0]', 'It depends on the temperature only when T > 1'], a: 1, why: 'Equal logits give equal probabilities at any temperature.' },
      { q: 'The model gives the correct token probability 0.01. What is the cross-entropy loss (natural log)?', opts: ['0.01', '≈ 0.99', '≈ 4.6', '≈ 100'], a: 2, why: '−ln 0.01 = ln 100 ≈ 4.61.' },
    ],
  });
})();
