(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, tween } = LLM.util;
  // Grid over x; P is a two-humped mixture, Q a single Gaussian.
  const N = 241, xs = Array.from({ length: N }, (_, i) => -6 + (12 * i) / (N - 1)), dx = 12 / (N - 1);
  const gauss = (x, m, sd) => Math.exp(-0.5 * ((x - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  const P = xs.map((x) => 0.5 * gauss(x, -2.6, 0.7) + 0.5 * gauss(x, 2.4, 0.8));
  const Qd = (m, sd) => xs.map((x) => gauss(x, m, sd));
  const eps = 1e-12;
  const KL = (a, b) => a.reduce((acc, p, i) => acc + (p > 1e-10 ? p * Math.log((p + eps) / (b[i] + eps)) * dx : 0), 0);
  const fwd = (m, sd) => KL(P, Qd(m, sd)), rev = (m, sd) => KL(Qd(m, sd), P);
  function fit(f, m0 = 1.2) {
    let best = [0, 1, Infinity];
    for (let m = -4; m <= 4; m += 0.1) for (let sd = 0.3; sd <= 4; sd += 0.05) { const v = f(m, sd); if (v < best[2]) best = [m, sd, v]; }
    // reverse KL has two optima; prefer the one nearest m0 for determinism
    if (f === rev) { let b2 = [0, 1, Infinity]; for (let m = m0 > 0 ? 0.5 : -4; m <= (m0 > 0 ? 4 : -0.5); m += 0.1) for (let sd = 0.3; sd <= 4; sd += 0.05) { const v = f(m, sd); if (v < b2[2]) b2 = [m, sd, v]; } return b2; }
    return best;
  }
  const FWD = fit(fwd), REV = fit(rev, 1);

  function plot(g, m, sd, opts = {}) {
    clear(g);
    const W = 560, H = 250, fx = (x) => 20 + ((x + 6) / 12) * (W - 40), fy = (y) => H - 30 - y * 600;
    const q = Qd(m, sd);
    const path = (arr) => arr.map((y, i) => (i ? 'L' : 'M') + fx(xs[i]).toFixed(1) + ',' + fy(Math.min(y, 0.34)).toFixed(1)).join('');
    g.appendChild(s('line', { x1: 20, x2: W - 20, y1: fy(0), y2: fy(0), stroke: 'var(--muted)' }));
    g.appendChild(s('path', { d: path(q) + `L${fx(6)},${fy(0)}L${fx(-6)},${fy(0)}Z`, fill: 'var(--qdist)', style: 'opacity:.35' }));
    g.appendChild(s('path', { d: path(q), fill: 'none', stroke: 'var(--qdist)', 'stroke-width': 2 }));
    g.appendChild(s('path', { d: path(P), fill: 'none', stroke: 'var(--pdist)', 'stroke-width': 2.5 }));
    g.appendChild(s('text', { x: fx(-2.6) - 8, y: fy(0.3) - 6, 'font-size': 13, text: 'P', style: 'font-weight:700' }));
    g.appendChild(s('text', { x: fx(m) + 6, y: fy(Math.min(gauss(m, m, sd), 0.33)) - 8, 'font-size': 13, text: 'Q', style: 'fill:var(--qdist);font-weight:700' }));
    if (opts.caption) g.appendChild(s('text', { x: 20, y: 18, 'font-size': 13, text: opts.caption, style: 'font-weight:600' }));
    g.appendChild(s('text', { x: 20, y: H - 8, class: 'lbl', text: `Q: mean ${fmt(m)}, width ${fmt(sd)}   ·   KL(P‖Q) = ${fmt(fwd(m, sd))}   ·   KL(Q‖P) = ${fmt(rev(m, sd))}` }));
  }

  function heroInit(box) {
    const g = svg(560, 250, { 'aria-label': 'Fitting one Gaussian to a two-humped distribution under forward and reverse KL' }); box.appendChild(g);
    let stop = () => {}; let cur = [0.1, 0.7];
    const anim = (to, cap) => { const from = cur.slice(); stop(); stop = tween(1400, (t) => { cur = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]; plot(g, cur[0], cur[1], { caption: cap }); }); };
    return {
      go(i) {
        if (i === 0) anim([0.1, 0.7], 'Target P has two humps. Q can only make one.');
        if (i === 1) anim([0.1, 0.7], 'A narrow Q in the gap: both KLs are bad');
        if (i === 2) anim([FWD[0], FWD[1]], 'Minimise forward KL(P‖Q): Q stretches to cover both');
        if (i === 3) anim([REV[0], REV[1]], 'Minimise reverse KL(Q‖P): Q snaps onto one hump');
        if (i === 4) anim([REV[0], REV[1]], 'Mode-seeking: where this shows up in LLMs');
      },
    };
  }

  function playground() {
    const w = widget('Fit Q yourself', 'Try it', 'Numerical KL on a 241-point grid over [−6, 6]. The optimum buttons run a grid search over mean and width.');
    const g = svg(560, 250); const ro = readout();
    let m = 0.5, sd = 1.5;
    const sm = slider({ label: 'Q mean', min: -4, max: 4, step: 0.05, value: m, fmt: (v) => v.toFixed(2), oninput: (v) => { m = v; draw(); } });
    const ss = slider({ label: 'Q width', min: 0.3, max: 4, step: 0.05, value: sd, fmt: (v) => v.toFixed(2), oninput: (v) => { sd = v; draw(); } });
    let dir = 'fwd';
    function draw() { plot(g, m, sd); ro.set([['minimising', dir === 'fwd' ? 'forward KL(P‖Q)' : 'reverse KL(Q‖P)'], ['current value', fmt(dir === 'fwd' ? fwd(m, sd) : rev(m, sd), 3)], ['best possible', fmt(dir === 'fwd' ? FWD[2] : REV[2], 3)]]); }
    const go = (to) => { const f = [m, sd]; tween(900, (t) => { m = f[0] + (to[0] - f[0]) * t; sd = f[1] + (to[1] - f[1]) * t; sm.set(+m.toFixed(2)); ss.set(+sd.toFixed(2)); draw(); }); };
    const tg = seg([['fwd', 'Forward KL(P‖Q)'], ['rev', 'Reverse KL(Q‖P)']], dir, (v) => { dir = v; draw(); }, 'Direction');
    w.body.append(tg.el, h('div', { class: 'ctl-row' }, sm.el, ss.el), g, ro.el, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn primary', type: 'button', onclick: () => go(dir === 'fwd' ? FWD : (m >= 0 ? REV : fit(rev, -1))) }, 'Jump to the optimum'),
      h('button', { class: 'btn', type: 'button', onclick: () => { m = -1.5; sd = 0.6; sm.set(m); ss.set(sd); draw(); } }, 'Start on the left hump')));
    draw();
    return w.el;
  }

  LLM.TITLES['0-kl'] = 'KL divergence: forward vs reverse';
  LLM.mod('0-kl', {
    hook: 'If a model can only approximate the truth, which mistakes should it prefer?',
    intro: ['KL divergence measures the extra cost of describing data from P using a model Q. It is never negative and it is zero only when Q equals P. It is not symmetric, and the two directions push a model toward very different behaviour.'],
    hero: {
      steps: [
        { title: 'One hump cannot fit two', text: 'P (ink outline) has two humps. Q (filled violet) is a single Gaussian with a mean and a width. No setting of Q matches P exactly, so we must choose which error to tolerate.' },
        { title: 'Two ways to measure the gap', text: '<b>Forward</b> KL(P‖Q) averages over places where P has mass. <b>Reverse</b> KL(Q‖P) averages over places where Q has mass.', maths: 'D_{\\mathrm{KL}}(\\P{P}\\,\\|\\,\\Qd{Q})=\\sum_x \\P{P(x)}\\log\\frac{\\P{P(x)}}{\\Qd{Q(x)}}' },
        { title: 'Forward KL is mean-seeking', text: 'Wherever P has mass and Q is near zero, log P/Q explodes. So Q stretches wide to cover <em>every</em> hump, even if that puts mass in the empty gap. This is mass-covering.', mech: 'Maximum-likelihood pretraining and standard (forward) distillation minimise this direction: the model must assign probability to everything in the data.' },
        { title: 'Reverse KL is mode-seeking', text: 'Now the average runs over Q. Q is punished for putting mass where P has none, but not for missing a hump entirely. So Q locks onto one hump and ignores the other. This is zero-forcing.', mech: 'The RLHF penalty to a reference model and on-policy distillation use this direction (Modules 8 and 14).' },
        { title: 'Why it matters for LLMs', text: 'A model trained with forward KL hedges across all plausible answers. A model trained with reverse KL commits to one good answer and drops the rest: sharper and more confident, less diverse.' },
      ],
      init: heroInit,
    },
    maths: [
      { note: 'Both directions, and the fact that KL is never negative (Gibbs’ inequality):', tex: 'D_{\\mathrm{KL}}(\\P{P}\\,\\|\\,\\Qd{Q})=\\sum_x \\P{P(x)}\\log\\frac{\\P{P(x)}}{\\Qd{Q(x)}}\\;\\ge 0,\\qquad \\text{forward: }\\min_{\\Qd{Q}} D_{\\mathrm{KL}}(\\P{P}\\|\\Qd{Q})\\;\\;\\text{vs}\\;\\;\\text{reverse: }\\min_{\\Qd{Q}} D_{\\mathrm{KL}}(\\Qd{Q}\\|\\P{P})' },
      { note: 'Forward KL is cross-entropy minus a constant, which is why maximum likelihood minimises it:', tex: 'D_{\\mathrm{KL}}(\\P{P}\\|\\Qd{Q})=\\underbrace{-\\sum_x \\P{P(x)}\\log \\Qd{Q(x)}}_{\\text{cross-entropy } H(P,Q)}-\\underbrace{\\Big(-\\sum_x \\P{P(x)}\\log \\P{P(x)}\\Big)}_{\\text{entropy } H(P),\\ \\text{fixed}}' },
    ],
    mathsLegend: 'ink is the target P, violet is the model Q.',
    tryit: [playground],
    leaves: ['Real model distributions are over tokens or sequences, not a 1-D line, and there are far more than two modes.', 'Q is restricted to one Gaussian here; a flexible model can match more of P, which shrinks the difference between the two directions.', 'Other divergences (Jensen–Shannon, total variation) sit between the two behaviours.'],
    quiz: [
      { q: 'Q puts almost no probability on a region where P has a lot. Which KL blows up?', opts: ['Forward KL(P‖Q)', 'Reverse KL(Q‖P)', 'Both equally', 'Neither'], a: 0, why: 'Forward KL weights by P(x) and contains log P/Q, which explodes where Q → 0 but P does not.' },
      { q: 'Pretraining with cross-entropy minimises which direction?', opts: ['Reverse KL', 'Forward KL', 'Neither, it maximises KL', 'Jensen–Shannon'], a: 1, why: 'Cross-entropy H(P, Q) = KL(P‖Q) + H(P), and H(P) is fixed by the data.' },
      { q: 'Is KL(P‖Q) = KL(Q‖P) in general?', opts: ['Yes, always', 'No; the two directions usually differ', 'Only for Gaussians', 'Only when both are zero'], a: 1, why: 'The averaging distribution changes, so the values (and optima) differ. Try the widget: the same Q gives two different numbers.' },
    ],
  });
})();
