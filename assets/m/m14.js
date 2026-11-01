(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, softmax, probBars, mix, tween } = LLM.util;
  const LAB = ['cat', 'kitten', 'dog', 'tiger', 'car', 'spoon'];
  const ZT = [6.0, 4.6, 2.4, 2.9, -1.0, -2.5]; // teacher logits for an image of a cat
  const KL = (p, q) => p.reduce((a, x, i) => a + (x > 0 ? x * Math.log(x / Math.max(q[i], 1e-12)) : 0), 0);

  function trainStudent(T, steps, alpha = 0) {
    let z = [0, 0, 0, 0, 0, 0]; const pt = softmax(ZT, T); const hist = [z.slice()];
    for (let s2 = 0; s2 < steps; s2++) {
      const ps = softmax(z, T), ph = softmax(z, 1);
      // grad of T^2 KL(pt||ps) wrt z = T (ps - pt); hard-label CE grad = ph - onehot
      z = z.map((v, i) => v - 0.25 * ((1 - alpha) * T * (ps[i] - pt[i]) + alpha * (ph[i] - (i === 0 ? 1 : 0))));
      hist.push(z.slice());
    }
    return hist;
  }

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'Teacher probabilities softened by temperature, and a student converging to them' }); box.appendChild(g);
    let stop = () => {};
    const col = (i) => (i === 0 ? 'var(--accent)' : 'var(--q)');
    function bars(x, y, p, title, w = 220) {
      g.appendChild(s('text', { x, y: y - 8, 'font-size': 12, text: title, style: 'font-weight:600' }));
      p.forEach((v, i) => { const yy = y + i * 24; g.appendChild(s('text', { x: x + 52, y: yy + 14, 'text-anchor': 'end', 'font-size': 11, text: LAB[i] })); g.appendChild(s('rect', { x: x + 58, y: yy + 3, width: w - 100, height: 15, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: x + 58, y: yy + 3, width: v * (w - 100), height: 15, rx: 3, fill: col(i) })); g.appendChild(s('text', { x: x + w - 36, y: yy + 14, 'font-size': 10.5, text: (v * 100).toFixed(1) + '%' })); });
    }
    function draw(step, t = 1) {
      clear(g);
      if (step === 0) { bars(10, 40, [1, 0, 0, 0, 0, 0], 'Hard label: one-hot'); bars(290, 40, softmax(ZT, 1), 'Teacher, T = 1'); g.appendChild(s('text', { x: 10, y: 220, 'font-size': 12, text: 'The label says only “cat”. The teacher also says kitten and tiger are close, car is not.' })); }
      if (step === 1) { const T = 1 + 3 * t; bars(10, 40, softmax(ZT, 1), 'Teacher, T = 1'); bars(290, 40, softmax(ZT, T), `Teacher, T = ${T.toFixed(1)}`); g.appendChild(s('text', { x: 10, y: 220, 'font-size': 12, text: 'Raising the temperature softens the teacher and exposes the “dark knowledge” in its small probabilities.' })); }
      if (step >= 2) {
        const hist = trainStudent(4, 200), k = step === 2 ? 0 : step === 3 ? Math.round(30 * t) : Math.round(30 + 170 * t);
        bars(10, 40, softmax(ZT, 4), 'Teacher soft targets (T = 4)'); bars(290, 40, softmax(hist[k], 4), `Student after ${k} steps`);
        g.appendChild(s('text', { x: 290, y: 200, class: 'lbl', text: `KL(teacher ‖ student) = ${fmt(KL(softmax(ZT, 4), softmax(hist[k], 4)), 4)}` }));
        g.appendChild(s('text', { x: 10, y: 230, 'font-size': 12, text: ['A small student starts knowing nothing: uniform.', 'It learns from the teacher’s whole distribution, not just the top answer.', 'Its bars converge to the teacher’s shape, including the near-misses.'][step - 2] }));
      }
      g.appendChild(s('text', { x: 10, y: 330, class: 'lbl', text: 'Teacher logits are illustrative; the student update is real gradient descent on T²·KL.' }));
    }
    return { go(i) { stop(); stop = tween(i === 0 || i === 2 ? 0 : 1500, (t) => draw(i, t)); } };
  }

  function tempSlider() {
    const w = widget('Soften the teacher', 'Try it');
    const bars = probBars({ labelW: 70 }); const ro = readout();
    const st = slider({ label: 'temperature T', min: 0.5, max: 10, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), oninput: draw });
    const sa = slider({ label: 'α (weight on hard label)', min: 0, max: 1, step: 0.05, value: 0.3, fmt: (v) => v.toFixed(2), oninput: draw });
    function draw() {
      const p = softmax(ZT, st.value);
      bars.draw(p.map((v, i) => ({ label: LAB[i], p: v, color: i === 0 ? 'var(--accent)' : 'var(--q)' })), { scaleMax: 1 });
      const ent = -p.reduce((a, x) => a + x * Math.log2(x), 0);
      const zs = trainStudent(st.value, 300, sa.value).pop(), ps = softmax(zs, 1);
      ro.set([['teacher entropy', fmt(ent, 2) + ' bits'], ['rank kitten vs tiger', p[1] > p[3] ? 'kitten closer' : 'tiger closer'], ['student P(cat) at T=1 after 300 steps', (ps[0] * 100).toFixed(1) + '%'], ['student P(kitten)', (ps[1] * 100).toFixed(1) + '%']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, st.el, sa.el), bars.el, ro.el, h('p', { class: 'note-sim' }, 'The student is trained with α·CE(hard label) + (1 − α)·T²·KL(teacher ‖ student) at the chosen T, then read at T = 1.'));
    draw();
    return w.el;
  }

  function onPolicy() {
    const w = widget('Off-policy vs on-policy distillation', 'Mechanics', 'Teacher over 9 possible answers has two good modes. The student can only express one bump (a softmax over −(i − μ)²/σ²). Grid search over μ and σ.');
    const teacher = softmax([0, 2.5, 3.2, 2.5, 0, 0.3, 2.4, 3.0, 2.0]);
    const student = (mu, sg) => softmax(teacher.map((_, i) => -((i - mu) ** 2) / (2 * sg * sg)));
    const fit = (f) => { let b = [0, 1, Infinity]; for (let mu = 0; mu <= 8; mu += 0.05) for (let sg = 0.3; sg <= 6; sg += 0.05) { const v = f(student(mu, sg)); if (v < b[2]) b = [mu, sg, v]; } return b; };
    const fwd = fit((q) => KL(teacher, q)), rev = fit((q) => KL(q, teacher));
    let mode = 'fwd';
    const g = svg(560, 220); const ro = readout();
    function draw() {
      clear(g);
      const b = mode === 'fwd' ? fwd : rev, q = student(b[0], b[1]);
      teacher.forEach((p, i) => { g.appendChild(s('rect', { x: 30 + i * 56, y: 180 - p * 400, width: 22, height: p * 400, rx: 2, fill: 'none', stroke: 'var(--pdist)', 'stroke-width': 2 })); g.appendChild(s('rect', { x: 54 + i * 56, y: 180 - q[i] * 400, width: 22, height: q[i] * 400, rx: 2, fill: 'var(--qdist)', style: 'opacity:.7' })); g.appendChild(s('text', { x: 52 + i * 56, y: 196, 'text-anchor': 'middle', class: 'lbl', text: 'a' + (i + 1) })); });
      g.appendChild(s('text', { x: 30, y: 16, class: 'lbl', text: 'outline = teacher, violet = best student' }));
      ro.set([['minimising', mode === 'fwd' ? 'forward KL(teacher ‖ student)' : 'reverse KL(student ‖ teacher)'], ['student behaviour', mode === 'fwd' ? 'spreads over both modes, puts mass on bad answers between' : 'locks onto one good mode']]);
    }
    const sg2 = seg([['fwd', 'Off-policy: train on teacher outputs'], ['rev', 'On-policy: score the student’s own samples']], mode, (v) => { mode = v; draw(); }, 'Method');
    w.body.append(sg2.el, g, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('14', {
    hook: 'Can a small model learn what a big model knows without seeing all its data?',
    intro: ['Distillation trains a small student to imitate a large teacher. The trick is to imitate the teacher’s full probability distribution, not just its top answer: those small probabilities on near-misses carry information the hard label throws away.'],
    hero: {
      steps: [
        { title: 'Hard labels hide information', text: 'A labelled dataset says this image is “cat”. A trained teacher also says it looks a bit like a kitten or a tiger and nothing like a spoon.' },
        { title: 'Temperature reveals dark knowledge', text: 'At T = 1 the teacher is nearly certain. Dividing its logits by a temperature above 1 lifts the small probabilities so the student can learn from them.', maths: 'p_i^{(T)}=\\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}}' },
        { title: 'Start the student', text: 'The student is smaller, so it cannot copy the teacher’s weights. It only sees inputs and the teacher’s soft outputs.' },
        { title: 'Match the distribution', text: 'Each step lowers KL(teacher ‖ student) at the same temperature.', maths: '\\mathcal{L}=T^{2}\\,\\mathrm{KL}\\big(p_t^{(T)}\\,\\|\\,p_s^{(T)}\\big)' },
        { title: 'Converged', text: 'The student now ranks the near-misses like the teacher. On real tasks this generalises better than training on hard labels alone.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'The knobs', widget: tempSlider },
      { title: 'Kinds of distillation', depth: 'mechanics', body: [
        '<b>Logit distillation</b> matches output distributions (Hinton et al. 2015). <b>Feature distillation</b> also matches hidden states, through a learned projection when sizes differ (DistilBERT, MiniLM). <b>Sequence-level distillation</b> fine-tunes the student on text the teacher generated; most open “distilled” models, including reasoning-trace distillation into small models, work this way.',
        '<b>On-policy distillation</b> samples from the student and has the teacher score those samples. That minimises reverse KL, which is mode-seeking: the student commits to answers the teacher likes instead of smearing across everything the teacher might say. It also trains on the student’s own mistakes, which off-policy data never shows it.',
        '<b>Distillation with pruning</b> removes layers, heads or width from a trained model and then distils to recover quality, which is cheaper than training a small model from scratch.',
      ], widget: onPolicy },
    ],
    maths: [
      { note: 'Combined loss with hard-label weight α and temperature T. The T² keeps gradient sizes comparable as T changes:', tex: '\\mathcal{L}=\\alpha\\,\\mathrm{CE}\\big(y,\\,p_s\\big)+(1-\\alpha)\\,T^{2}\\,\\mathrm{KL}\\big(p_t^{(T)}\\,\\|\\,p_s^{(T)}\\big),\\qquad p^{(T)}=\\mathrm{softmax}(z/T)' },
      { note: 'Gradient of the soft term with respect to student logits:', tex: '\\frac{\\partial}{\\partial z_{s,i}}\\,T^2\\,\\mathrm{KL}\\big(p_t^{(T)}\\|p_s^{(T)}\\big)=T\\big(p_{s,i}^{(T)}-p_{t,i}^{(T)}\\big)' },
      { note: 'On-policy distillation minimises the reverse direction over the student’s own samples:', tex: '\\min_{\\theta}\\ \\mathbb{E}_{y\\sim p_s}\\big[\\log p_s(y)-\\log p_t(y)\\big]=\\min_\\theta \\mathrm{KL}(p_s\\,\\|\\,p_t)' },
    ],
    leaves: ['A six-class toy stands in for a vocabulary of 100k+ tokens and whole sequences.', 'Distilling from a model’s outputs may be restricted by its licence or terms of use.', 'A student can inherit the teacher’s mistakes and biases along with its knowledge.'],
    quiz: [
      { q: 'Why raise the temperature during distillation?', opts: ['To speed up training', 'To make small teacher probabilities large enough to carry useful signal', 'To make the student more confident', 'To reduce memory'], a: 1, why: 'Softening spreads probability onto near-misses, exposing how the teacher relates classes.' },
      { q: 'Why multiply the KL term by T²?', opts: ['To normalise probabilities', 'Soft-target gradients scale as 1/T², so T² keeps their size comparable to the hard-label term', 'It is required for KL to be positive', 'To match the student’s size'], a: 1, why: 'The gradient of the softened KL shrinks with T; T² compensates.' },
      { q: 'On-policy distillation tends to make the student…', opts: ['cover all teacher modes', 'commit to modes the teacher rates highly (mode-seeking)', 'ignore the teacher', 'copy the teacher’s weights'], a: 1, why: 'It minimises reverse KL, which is zero-forcing: avoid putting mass where the teacher puts little.' },
    ],
  });
})();
