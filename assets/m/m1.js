(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human } = LLM.util;

  // Tiny network: x(2) -> W1 (2x2) -> ReLU -> w2 (2) -> y ; loss = ½(y - t)²
  const x = [1.0, 0.5], t = 1.0;
  const W1 = [[0.6, -0.4], [0.3, 0.8]], w2 = [0.7, -0.5];
  const z = W1.map((r) => r[0] * x[0] + r[1] * x[1]), a = z.map((v) => Math.max(0, v));
  const y = w2[0] * a[0] + w2[1] * a[1], L = 0.5 * (y - t) ** 2;
  const dy = y - t, dw2 = a.map((v) => dy * v), da = w2.map((w) => dy * w), dz = da.map((g, i) => (z[i] > 0 ? g : 0));
  const dW1 = dz.map((g) => x.map((xi) => g * xi));
  const eta = 0.5;

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'Forward and backward pass through a two-layer network' }); box.appendChild(g);
    const P = { x0: [60, 110], x1: [60, 230], h0: [250, 110], h1: [250, 230], y: [420, 170], L: [520, 170] };
    function node(p, label, val, c, sub) {
      g.appendChild(s('circle', { cx: p[0], cy: p[1], r: 26, fill: 'var(--surface)', stroke: c || 'var(--ink)', 'stroke-width': 2 }));
      g.appendChild(s('text', { x: p[0], y: p[1] - 2, 'text-anchor': 'middle', 'font-size': 12, text: label, style: 'font-weight:600' }));
      if (val != null) g.appendChild(s('text', { x: p[0], y: p[1] + 13, 'text-anchor': 'middle', 'font-size': 10.5, text: val }));
      if (sub) g.appendChild(s('text', { x: p[0], y: p[1] + 44, 'text-anchor': 'middle', 'font-size': 10.5, text: sub, style: 'fill:var(--grad)' }));
    }
    function edge(p, q, w, on, back, gl) {
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      g.appendChild(s('line', { x1: p[0] + 26, y1: p[1], x2: q[0] - 26, y2: q[1], stroke: back ? 'var(--grad)' : on ? 'var(--fwd)' : 'var(--rule)', 'stroke-width': on || back ? 2.5 : 1.5, 'stroke-dasharray': back ? '6 4' : null }));
      g.appendChild(s('text', { x: mx, y: my - 6, 'text-anchor': 'middle', 'font-size': 10.5, text: 'w=' + fmt(w), style: 'fill:var(--muted)' }));
      if (gl != null) g.appendChild(s('text', { x: mx, y: my + 14, 'text-anchor': 'middle', 'font-size': 10.5, text: '∂L/∂w=' + fmt(gl, 3), style: 'fill:var(--grad)' }));
    }
    function draw(step) {
      clear(g);
      const f = step >= 1, b2 = step >= 3, b1 = step >= 4, upd = step >= 5;
      const W1u = upd ? W1.map((r, i) => r.map((w, j) => w - eta * dW1[i][j])) : W1, w2u = upd ? w2.map((w, i) => w - eta * dw2[i]) : w2;
      if (step === 6) { epochs(); return; }
      [[P.x0, P.h0, W1u[0][0], dW1[0][0]], [P.x1, P.h0, W1u[0][1], dW1[0][1]], [P.x0, P.h1, W1u[1][0], dW1[1][0]], [P.x1, P.h1, W1u[1][1], dW1[1][1]]].forEach(([p, q, w, gg]) => edge(p, q, w, f, b1 && !upd, b1 && !upd ? gg : null));
      edge(P.h0, P.y, w2u[0], f, b2 && !upd, b2 && !upd ? dw2[0] : null); edge(P.h1, P.y, w2u[1], f, b2 && !upd, b2 && !upd ? dw2[1] : null);
      g.appendChild(s('line', { x1: P.y[0] + 26, y1: P.y[1], x2: P.L[0] - 26, y2: P.L[1], stroke: step >= 2 ? 'var(--fwd)' : 'var(--rule)', 'stroke-width': 2 }));
      node(P.x0, 'x₁', fmt(x[0]), 'var(--fwd)'); node(P.x1, 'x₂', fmt(x[1]), 'var(--fwd)');
      node(P.h0, 'ReLU', f ? fmt(a[0]) : '?', null, b1 && !upd ? '∂L/∂z=' + fmt(dz[0], 3) : null); node(P.h1, 'ReLU', f ? fmt(a[1]) : '?', null, b1 && !upd ? '∂L/∂z=' + fmt(dz[1], 3) : null);
      node(P.y, 'y', f ? fmt(y, 3) : '?', null, b2 && !upd ? '∂L/∂y=' + fmt(dy, 3) : null);
      node(P.L, 'loss', step >= 2 ? fmt(L, 3) : '?', step >= 2 ? 'var(--fail)' : null);
      g.appendChild(s('text', { x: P.L[0], y: P.L[1] + 44, 'text-anchor': 'middle', class: 'lbl', text: 'target t = 1' }));
      const msg = ['Weights start as small numbers. Inputs x = [1.0, 0.5].', 'Forward (blue): each hidden unit sums weighted inputs, ReLU zeroes negatives.', `Loss ½(y − t)² = ${fmt(L, 3)}. The second hidden unit is ${a[1] ? 'on' : 'off'}.`, 'Backward (amber, dashed): start at the loss, chain rule to the output weights.', 'Keep going: through w₂ into the hidden units, then the first-layer weights.', `Update: w ← w − ${eta}·∂L/∂w. New loss = ${fmt(newLoss(W1u, w2u), 3)} (was ${fmt(L, 3)}).`];
      g.appendChild(s('text', { x: 20, y: 335, 'font-size': 12, text: msg[step] }));
    }
    function newLoss(Wa, wb) { const zz = Wa.map((r) => r[0] * x[0] + r[1] * x[1]).map((v) => Math.max(0, v)); return 0.5 * (wb[0] * zz[0] + wb[1] * zz[1] - t) ** 2; }
    function epochs() {
      g.appendChild(s('text', { x: 20, y: 30, 'font-size': 13, text: 'Dataset of 24 examples, batch size 4 → 6 steps per epoch', style: 'font-weight:600' }));
      for (let e = 0; e < 3; e++) for (let i = 0; i < 24; i++) {
        const b = Math.floor(i / 4);
        g.appendChild(s('rect', { x: 20 + i * 21, y: 60 + e * 80, width: 19, height: 34, rx: 3, fill: `var(--t${b})`, style: 'opacity:.75' }));
        if (i % 4 === 0) g.appendChild(s('text', { x: 20 + i * 21, y: 110 + e * 80, class: 'lbl', text: 'step ' + (e * 6 + b + 1) }));
      }
      [0, 1, 2].forEach((e) => g.appendChild(s('text', { x: 20, y: 54 + e * 80, class: 'lbl', text: 'epoch ' + (e + 1) + ' (shuffled)' })));
      g.appendChild(s('text', { x: 20, y: 320, 'font-size': 12, text: 'One step = one mini-batch. One epoch = one pass over all data. LLM pretraining often sees each token about once.' }));
    }
    return { go: draw };
  }

  /* micro-autograd */
  class Val {
    constructor(v, op = '', kids = [], label = '') { this.v = v; this.g = 0; this.op = op; this.kids = kids; this.label = label; this._back = () => {}; }
    add(o) { const r = new Val(this.v + o.v, '+', [this, o]); r._back = () => { this.g += r.g; o.g += r.g; }; return r; }
    mul(o) { const r = new Val(this.v * o.v, '×', [this, o]); r._back = () => { this.g += o.v * r.g; o.g += this.v * r.g; }; return r; }
    tanh() { const tt = Math.tanh(this.v); const r = new Val(tt, 'tanh', [this]); r._back = () => { this.g += (1 - tt * tt) * r.g; }; return r; }
    relu() { const r = new Val(Math.max(0, this.v), 'ReLU', [this]); r._back = () => { this.g += (this.v > 0 ? 1 : 0) * r.g; }; return r; }
    sq() { const r = new Val(this.v * this.v, 'x²', [this]); r._back = () => { this.g += 2 * this.v * r.g; }; return r; }
    backward() { const topo = [], seen = new Set(); const b = (n) => { if (seen.has(n)) return; seen.add(n); n.kids.forEach(b); topo.push(n); }; b(this); this.g = 1; topo.reverse().forEach((n) => n._back()); return topo; }
  }
  function autograd() {
    const w = widget('Micro-autograd playground', 'Try it');
    const ex = {
      'neuron: tanh(w·x + b)': (v) => { const X = new Val(v.a, '', [], 'x'), W = new Val(v.b, '', [], 'w'), B = new Val(v.c, '', [], 'b'); return W.mul(X).add(B).tanh(); },
      '(a·b + c)²': (v) => { const A = new Val(v.a, '', [], 'a'), B = new Val(v.b, '', [], 'b'), C = new Val(v.c, '', [], 'c'); return A.mul(B).add(C).sq(); },
      'ReLU(a + b) × c': (v) => { const A = new Val(v.a, '', [], 'a'), B = new Val(v.b, '', [], 'b'), C = new Val(v.c, '', [], 'c'); return A.add(B).relu().mul(C); },
    };
    const names = { 'neuron: tanh(w·x + b)': ['x', 'w', 'b'], '(a·b + c)²': ['a', 'b', 'c'], 'ReLU(a + b) × c': ['a', 'b', 'c'] };
    let cur = Object.keys(ex)[0]; const v = { a: 1.5, b: -0.8, c: 0.6 };
    const g = svg(560, 250);
    const sl = ['a', 'b', 'c'].map((k) => slider({ label: k, min: -3, max: 3, step: 0.1, value: v[k], fmt: (x) => x.toFixed(1), oninput: (x) => { v[k] = x; draw(); } }));
    function draw() {
      names[cur].forEach((n, i) => (sl[i].el.querySelector('label span').textContent = n));
      const out = ex[cur](v); const topo = out.backward();
      // depth layout
      const depth = new Map(); const d = (n) => { if (depth.has(n)) return depth.get(n); const r = n.kids.length ? 1 + Math.max(...n.kids.map(d)) : 0; depth.set(n, r); return r; }; topo.forEach(d);
      const maxD = Math.max(...depth.values()); const cols = {}; topo.slice().reverse().forEach((n) => { const k = depth.get(n); (cols[k] = cols[k] || []).push(n); });
      const pos = new Map();
      Object.entries(cols).forEach(([k, arr]) => arr.forEach((n, i) => pos.set(n, [50 + (k / maxD) * 440, 125 + (i - (arr.length - 1) / 2) * 78])));
      clear(g);
      topo.forEach((n) => n.kids.forEach((c) => { const p = pos.get(c), q = pos.get(n); g.appendChild(s('line', { x1: p[0] + 34, y1: p[1], x2: q[0] - 34, y2: q[1], stroke: 'var(--fwd)', 'stroke-width': 1.8 })); g.appendChild(s('line', { x1: p[0] + 34, y1: p[1] + 6, x2: q[0] - 34, y2: q[1] + 6, stroke: 'var(--grad)', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 })); }));
      topo.forEach((n) => { const [px, py] = pos.get(n); g.appendChild(s('rect', { x: px - 34, y: py - 24, width: 68, height: 48, rx: 9, fill: 'var(--surface)', stroke: n === out ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 1.5 })); g.appendChild(s('text', { x: px, y: py - 8, 'text-anchor': 'middle', 'font-size': 11, text: n.label || n.op, style: 'font-weight:600' })); g.appendChild(s('text', { x: px, y: py + 6, 'text-anchor': 'middle', 'font-size': 10, text: fmt(n.v, 3), style: 'fill:var(--fwd)' })); g.appendChild(s('text', { x: px, y: py + 19, 'text-anchor': 'middle', 'font-size': 10, text: 'g ' + fmt(n.g, 3), style: 'fill:var(--grad)' })); });
    }
    const sg = seg(Object.keys(ex), cur, (k) => { cur = k; draw(); }, 'Expression');
    w.body.append(sg.el, h('div', { class: 'ctl-row' }, sl.map((x) => x.el)), g, h('p', { class: 'note-sim' }, 'Blue: value from the forward pass. Amber g: d(output)/d(node) from the backward pass. Every gradient is the local derivative times the gradient flowing in from the right.'));
    draw();
    return w.el;
  }

  function landscape() {
    const w = widget('Learning rate on a loss landscape', 'Try it');
    const f = (p) => 0.5 * (p[0] * p[0] * 1 + p[1] * p[1] * 12), gr = (p) => [p[0], 12 * p[1]];
    const g = svg(560, 300); const ro = readout();
    let opt = 'SGD';
    const lr = slider({ label: 'learning rate η', min: 0.005, max: 0.2, step: 0.005, value: 0.05, fmt: (v) => v.toFixed(3), oninput: draw });
    function run() {
      let p = [-4.5, 1.6], m = [0, 0], v2 = [0, 0]; const pts = [p];
      for (let i = 1; i <= 40; i++) {
        const gg = gr(p);
        if (opt === 'SGD') p = [p[0] - lr.value * gg[0], p[1] - lr.value * gg[1]];
        if (opt === 'Momentum') { m = [0.9 * m[0] + gg[0], 0.9 * m[1] + gg[1]]; p = [p[0] - lr.value * m[0], p[1] - lr.value * m[1]]; }
        if (opt === 'Adam') { m = m.map((x, k) => 0.9 * x + 0.1 * gg[k]); v2 = v2.map((x, k) => 0.999 * x + 0.001 * gg[k] ** 2); const mh = m.map((x) => x / (1 - 0.9 ** i)), vh = v2.map((x) => x / (1 - 0.999 ** i)); p = p.map((x, k) => x - lr.value * 10 * mh[k] / (Math.sqrt(vh[k]) + 1e-8)); }
        pts.push(p); if (Math.abs(p[1]) > 100) break;
      }
      return pts;
    }
    function draw() {
      clear(g);
      const fx = (x) => 280 + x * 52, fy = (y) => 150 - y * 52;
      [0.5, 1.5, 3, 5, 8, 12, 17].forEach((c) => g.appendChild(s('ellipse', { cx: 280, cy: 150, rx: Math.sqrt(2 * c) * 52, ry: Math.sqrt(2 * c / 12) * 52, fill: 'none', stroke: 'var(--rule)' })));
      g.appendChild(s('circle', { cx: 280, cy: 150, r: 4, fill: 'var(--pass)' }));
      const pts = run(); const vis = pts.filter((p) => Math.abs(p[1]) < 3 && Math.abs(p[0]) < 5.3);
      g.appendChild(s('path', { d: vis.map((p, i) => (i ? 'L' : 'M') + fx(p[0]) + ',' + fy(p[1])).join(''), fill: 'none', stroke: 'var(--grad)', 'stroke-width': 2 }));
      vis.forEach((p) => g.appendChild(s('circle', { cx: fx(p[0]), cy: fy(p[1]), r: 2.6, fill: 'var(--grad)' })));
      const last = pts[pts.length - 1], fl = f(last);
      const verdict = !isFinite(fl) || fl > 50 ? ['diverged', 'var(--fail)'] : fl < 0.05 ? ['converged', 'var(--pass)'] : ['still crawling', 'var(--warn)'];
      ro.set([['after 40 steps, loss', isFinite(fl) && fl < 1e6 ? fmt(fl, 4) : '∞'], ['status', verdict[0], verdict[1]]]);
    }
    const sg = seg(['SGD', 'Momentum', 'Adam'], opt, (v) => { opt = v; draw(); }, 'Optimiser');
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'optimiser'), sg.el), lr.el), g, ro.el,
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'A valley 12× steeper across than along. Plain SGD diverges above η ≈ 0.167 (2 ÷ 12) and crawls below it; momentum builds speed along the floor; Adam rescales each direction by its own gradient size.'));
    draw();
    return w.el;
  }

  function stepsCalc() {
    const w = widget('Steps calculator', 'Mechanics');
    const ro = readout();
    const N = slider({ label: 'examples N (log₁₀)', min: 3, max: 9, step: 0.1, value: 6, fmt: (v) => human(10 ** v), oninput: draw });
    const B = slider({ label: 'batch size B', min: 1, max: 4096, step: 1, value: 256, oninput: draw });
    const E = slider({ label: 'epochs', min: 1, max: 20, value: 3, oninput: draw });
    const A = slider({ label: 'gradient accumulation', min: 1, max: 16, value: 1, oninput: draw });
    function draw() { const n = Math.round(10 ** N.value), spe = Math.ceil(n / B.value); ro.set([['steps per epoch', human(spe)], ['forward/backward passes', human(spe * E.value)], ['optimiser steps', human(Math.ceil((spe * E.value) / A.value))], ['effective batch', B.value * A.value]]); }
    w.body.append(h('div', { class: 'ctl-row' }, N.el, B.el, E.el, A.el), ro.el, h('p', { class: 'note-sim' }, 'Gradient accumulation adds up gradients over several mini-batches before one optimiser step: a bigger effective batch without more memory.'));
    draw();
    return w.el;
  }

  LLM.mod('1', {
    hook: 'A model starts as random numbers. How do the numbers learn?',
    intro: ['A model is a function with millions of adjustable numbers called parameters. Training shows it examples, measures how wrong it is with a loss, and nudges every parameter in the direction that reduces the loss. Backpropagation is how it finds that direction for all of them at once.'],
    hero: {
      steps: [
        { title: 'A network with six weights', text: 'Two inputs, two hidden units, one output. Every line is a weight: one learnable number.' },
        { title: 'Forward pass', text: 'Values flow left to right in <b style="color:var(--fwd)">blue</b>. Each hidden unit multiplies inputs by weights, adds them, and applies ReLU (negative → 0).', mech: 'z = W₁x, a = ReLU(z), y = w₂·a. Shapes: x [2], W₁ [2×2], w₂ [2].' },
        { title: 'Measure the error', text: 'The output is compared with the target 1.0. Squared error turns “how wrong” into one number to reduce.', maths: '\\mathcal{L}=\\tfrac12(y-t)^2' },
        { title: 'Backward pass, last layer', text: 'Now gradients flow right to left in <b style="color:var(--grad)">amber</b>. ∂L/∂y = y − t. A weight’s gradient is that times the value that flowed into it.', maths: '\\G{\\frac{\\partial\\mathcal{L}}{\\partial w_{2,i}}}=\\G{\\frac{\\partial\\mathcal{L}}{\\partial y}}\\cdot a_i=(y-t)\\,a_i' },
        { title: 'Chain rule all the way back', text: 'Each node multiplies the incoming gradient by its own local derivative. ReLU passes gradient where it was on and blocks it where it was off. That is backpropagation.', maths: '\\G{\\frac{\\partial\\mathcal{L}}{\\partial W_{1,ij}}}=\\G{\\frac{\\partial\\mathcal{L}}{\\partial y}}\\,w_{2,i}\\,\\mathbb{1}[z_i>0]\\,x_j' },
        { title: 'Take a step', text: 'Every weight moves a little against its gradient. Run the forward pass again and the loss is lower. Repeat millions of times.', maths: '\\theta\\leftarrow\\theta-\\eta\\,\\G{\\nabla_\\theta\\mathcal{L}}' },
        { title: 'Steps, batches, epochs', text: 'Real training averages gradients over a mini-batch of examples per step. One pass over the whole dataset is an epoch.', maths: '\\text{steps}=\\text{epochs}\\times\\left\\lceil N/B\\right\\rceil' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'The training vocabulary', body: [
        '<b>Learning rate, warm-up and cosine decay.</b> η sets step size. Large models start with a tiny η that warms up over a few thousand steps, then decays along a cosine curve to near zero.',
        '<b>Optimisers.</b> SGD steps along the raw gradient. <b>Momentum</b> keeps a running average so steps build speed. <b>Adam</b> also tracks the average squared gradient and divides by its root, giving each parameter its own step size. <b>AdamW</b> applies weight decay (shrinking weights toward zero) separately from the gradient step; it is the default for LLMs.',
        '<b>Overfitting.</b> A model can memorise training data and fail on new data. Hold out validation and test splits; use dropout and early stopping. LLM pretraining rarely overfits because it sees most data once.',
        '<b>Stability and memory tricks.</b> Gradient clipping caps the gradient norm so one bad batch cannot blow up training. Gradient accumulation sums several mini-batches before a step. Activation checkpointing recomputes activations in the backward pass instead of storing them.',
        '<b>Mixed precision.</b> Compute in 16-bit (FP16 or BF16), keep a 32-bit master copy of the weights. BF16 has FP32’s exponent range, so it rarely overflows.',
        '<b>RLHF</b> (reinforcement learning from human feedback) is a later training stage that uses preferences instead of a fixed target. Module 8 covers it.',
      ], widget: stepsCalc },
    ],
    maths: [
      { note: 'The update rule, the chain rule on one edge, and the step count:', tex: '\\theta_{t+1}=\\theta_t-\\eta\\,\\G{\\nabla_\\theta\\mathcal{L}(\\theta_t)},\\qquad \\G{\\frac{\\partial\\mathcal{L}}{\\partial w}}=\\G{\\frac{\\partial\\mathcal{L}}{\\partial y}}\\cdot\\frac{\\partial y}{\\partial w},\\qquad \\text{steps}=\\text{epochs}\\times\\left\\lceil\\frac{N}{B}\\right\\rceil' },
      { note: '<b>AdamW</b>, with gradient g, decay rates β₁, β₂, and weight decay λ:', tex: 'm_t=\\beta_1 m_{t-1}+(1-\\beta_1)\\G{g_t},\\quad v_t=\\beta_2 v_{t-1}+(1-\\beta_2)\\G{g_t}^2,\\quad \\theta_t=\\theta_{t-1}-\\eta\\Big(\\frac{\\hat m_t}{\\sqrt{\\hat v_t}+\\epsilon}+\\lambda\\theta_{t-1}\\Big)', after: 'Here m̂ and v̂ divide by (1 − βᵗ) to correct the bias from starting at zero.' },
      { note: '<b>Why SGD diverges</b> on a quadratic with curvature c: one step multiplies the distance to the minimum by (1 − ηc). It shrinks only if |1 − ηc| < 1, so η < 2/c.', tex: 'x_{t+1}=(1-\\eta c)\\,x_t\\;\\Rightarrow\\;\\text{stable iff } 0<\\eta<\\frac{2}{c}' },
    ],
    mathsLegend: 'amber is a gradient; blue is the forward pass.',
    tryit: [autograd, landscape],
    leaves: ['Real networks have billions of weights and use matrix-wide versions of the same chain rule.', 'The loss here is squared error on one example; LLMs use cross-entropy over a whole batch of tokens.', 'The landscape widget is a 2-D quadratic. Real loss surfaces are non-convex, though often surprisingly well behaved along the path training takes.'],
    quiz: [
      { q: 'A hidden ReLU unit had z = −0.3 in the forward pass. What gradient reaches its input weights?', opts: ['The same as the unit above it', 'Zero', 'Negative of the incoming gradient', 'It depends on the learning rate'], a: 1, why: 'ReLU’s derivative is 0 for z < 0, so it blocks the gradient. That weight does not change on this example.' },
      { q: '1.2M examples, batch size 512, 2 epochs. How many optimiser steps (no accumulation)?', opts: ['≈ 2,344', '≈ 4,688', '≈ 600', '≈ 2.4M'], a: 1, why: '⌈1,200,000 / 512⌉ = 2,344 per epoch, × 2 = 4,688.' },
      { q: 'What does AdamW do differently from Adam with L2 regularisation?', opts: ['Uses a bigger learning rate', 'Applies weight decay directly to the weights, outside the adaptive gradient scaling', 'Removes momentum', 'Clips gradients'], a: 1, why: 'Decoupled weight decay shrinks weights by ηλθ each step, so the decay is not rescaled by Adam’s per-parameter denominator.' },
    ],
  });
})();
