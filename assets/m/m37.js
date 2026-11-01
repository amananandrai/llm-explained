(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, mix, table, lineChart } = LLM.util;
  const ci = (p, n) => 1.96 * Math.sqrt((p * (1 - p)) / n);
  const MODELS = [['Model A', 0.842], ['Model B', 0.835], ['Model C', 0.81], ['Model D', 0.776], ['Model E', 0.771]];

  function heroInit(box) {
    const g = svg(560, 300, { 'aria-label': 'A leaderboard whose bars grow error bars until close models tie' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const n = [500, 500, 500, 200, 5000][step], x0 = 110, W = 400, lo = 0.7, hi = 0.9, fx = (v) => x0 + ((v - lo) / (hi - lo)) * W;
      g.appendChild(s('text', { x: 14, y: 20, 'font-size': 12.5, text: ['A leaderboard: Model A beats Model B by 0.7 points', 'Add 95% confidence intervals (500 questions)', 'A and B overlap: statistically a tie. So do D and E.', 'With only 200 questions, almost everything ties', 'With 5,000 questions, intervals shrink by √10'][step], style: 'font-weight:600' }));
      MODELS.forEach(([m, p], i) => { const y = 44 + i * 44; g.appendChild(s('text', { x: x0 - 8, y: y + 18, 'text-anchor': 'end', 'font-size': 12, text: m })); g.appendChild(s('rect', { x: x0, y: y + 4, width: fx(p) - x0, height: 22, rx: 3, fill: 'var(--q)', style: 'opacity:.7' })); g.appendChild(s('text', { x: fx(p) + 6, y: y + 19, 'font-size': 11, text: (p * 100).toFixed(1) + '%' }));
        if (step >= 1) { const e = ci(p, n); g.appendChild(s('line', { x1: fx(p - e), x2: fx(p + e), y1: y + 15, y2: y + 15, stroke: 'var(--ink)', 'stroke-width': 2 })); [p - e, p + e].forEach((v) => g.appendChild(s('line', { x1: fx(v), x2: fx(v), y1: y + 8, y2: y + 22, stroke: 'var(--ink)', 'stroke-width': 2 }))); if (step === 1 || step === 4) g.appendChild(s('text', { x: 520, y: y + 19, 'text-anchor': 'end', class: 'lbl', text: '±' + (e * 100).toFixed(1) })); } });
      if (step === 2) [[0, 1], [3, 4]].forEach(([a, b]) => g.appendChild(s('rect', { x: x0 - 100, y: 44 + a * 44, width: 520, height: 88, rx: 8, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '5 4' })));
      [0.7, 0.75, 0.8, 0.85, 0.9].forEach((v) => g.appendChild(s('text', { x: fx(v), y: 278, 'text-anchor': 'middle', class: 'lbl', text: v * 100 + '%' })));
      g.appendChild(s('text', { x: 14, y: 296, class: 'lbl', text: 'Accuracies are illustrative; intervals are the normal approximation, ±1.96·√(p(1−p)/n).' }));
    }
    return { go: draw };
  }

  function passK() {
    const w = widget('pass@k calculator', 'Try it', 'Unbiased estimator from Chen et al. 2021: generate n samples per problem, count c correct, estimate the chance that at least one of k samples passes.');
    const ch = lineChart({ w: 560, h: 200 }); const ro = readout();
    const sn = slider({ label: 'samples n', min: 1, max: 200, value: 100, oninput: draw });
    const sc = slider({ label: 'correct c', min: 0, max: 200, value: 15, oninput: draw });
    const sk = slider({ label: 'k', min: 1, max: 100, value: 10, oninput: draw });
    const pk = (n, c, k) => { if (n - c < k) return 1; let p = 1; for (let i = n - c + 1; i <= n; i++) p *= 1 - k / i; return 1 - p; };
    function draw() { const n = sn.value, c = Math.min(sc.value, n), k = Math.min(sk.value, n); const pts = Array.from({ length: Math.min(n, 100) }, (_, i) => [i + 1, pk(n, c, i + 1)]); ch.draw([{ pts, color: 'var(--q)', dots: [[k, pk(n, c, k)]] }], { ymin: 0, ymax: 1, xlabel: 'k', ylabel: 'pass@k' }); ro.set([['pass@1', (pk(n, c, 1) * 100).toFixed(1) + '%'], [`pass@${k}`, (pk(n, c, k) * 100).toFixed(1) + '%'], ['naive 1 − (1 − c/n)^k', ((1 - (1 - c / n) ** k) * 100).toFixed(1) + '%']]); }
    w.body.append(h('div', { class: 'ctl-row' }, sn.el, sc.el, sk.el), ch.el, ro.el);
    draw();
    return w.el;
  }

  function diffCI() {
    const w = widget('Is the gap real?', 'Try it', 'Two-proportion test on independent question sets (normal approximation). Paired tests on the same questions are tighter; use them when you can.');
    const ro = readout();
    const pa = slider({ label: 'model A accuracy', min: 0.5, max: 0.99, step: 0.001, value: 0.842, fmt: (v) => (v * 100).toFixed(1) + '%', oninput: draw });
    const pb = slider({ label: 'model B accuracy', min: 0.5, max: 0.99, step: 0.001, value: 0.835, fmt: (v) => (v * 100).toFixed(1) + '%', oninput: draw });
    const sn = slider({ label: 'questions per model', min: 50, max: 20000, step: 50, value: 500, oninput: draw });
    function draw() { const a = pa.value, b = pb.value, n = sn.value; const se = Math.sqrt((a * (1 - a) + b * (1 - b)) / n), z = (a - b) / se; const need = Math.ceil(((1.96 + 0.84) ** 2 * (a * (1 - a) + b * (1 - b))) / ((a - b) ** 2 || 1e-9)); ro.set([['difference', ((a - b) * 100).toFixed(1) + ' points ± ' + (1.96 * se * 100).toFixed(1)], ['z', fmt(z, 2)], ['verdict', Math.abs(z) > 1.96 ? 'significant at 95%' : 'not distinguishable', Math.abs(z) > 1.96 ? 'var(--pass)' : 'var(--warn)'], ['questions needed (80% power)', need > 1e7 ? '> 10M' : need.toLocaleString()]]); }
    w.body.append(h('div', { class: 'ctl-row' }, pa.el, pb.el, sn.el), ro.el);
    draw();
    return w.el;
  }

  function judge() {
    const w = widget('LLM-judge position bias', 'Try it', 'A written example of a well-documented failure, not a live judge.');
    let order = 'AB'; const out = h('div');
    const A = 'Use my_list[::-1] for a reversed copy or my_list.reverse() to reverse in place.', B = 'You can reverse a list with reversed(), slicing, or reverse(); each has trade-offs worth knowing about, which this answer explains at length…';
    function draw() { const first = order === 'AB' ? ['Answer 1', A] : ['Answer 1', B], second = order === 'AB' ? ['Answer 2', B] : ['Answer 2', A]; clear(out).append(h('div', { class: 'w-split' }, [first, second].map(([l, t]) => h('div', null, h('div', { class: 'eyebrow' }, l), h('p', null, t)))), h('p', null, h('b', null, 'Judge verdict: '), 'Answer 1 is better.'), h('p', { class: 'muted' }, order === 'AB' ? 'The judge prefers the concise answer…' : '…and after swapping, still prefers “Answer 1”, now the long one. The verdict followed position, not quality.')); }
    const sg = seg([['AB', 'Concise first'], ['BA', 'Swapped']], order, (v) => { order = v; draw(); }, 'Order');
    w.body.append(sg.el, out, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Mitigations: judge both orders and count only consistent verdicts; control for length; avoid judging with the same model family being tested; spot-check against human labels.'));
    draw();
    return w.el;
  }

  function elo() {
    const w = widget('Elo and Bradley–Terry', 'Mechanics');
    const ro = readout();
    const sa = slider({ label: 'rating A', min: 800, max: 1600, value: 1250, oninput: draw }), sb = slider({ label: 'rating B', min: 800, max: 1600, value: 1200, oninput: draw });
    function draw() { const p = 1 / (1 + 10 ** ((sb.value - sa.value) / 400)); ro.set([['P(A beats B)', (p * 100).toFixed(1) + '%'], ['rating gap', sa.value - sb.value]]); }
    w.body.append(h('div', { class: 'ctl-row' }, sa.el, sb.el), ro.el, h('p', { class: 'note-sim' }, 'Arena-style leaderboards fit Bradley–Terry ratings to many pairwise human votes; a 50-point gap is only a 57% win rate.'));
    draw();
    return w.el;
  }

  LLM.mod('37', {
    hook: 'Model A scores 84.2 and Model B scores 83.5. Is A better?',
    intro: ['Benchmarks turn “which model is better?” into numbers, but every number comes with noise, choices and blind spots. This module teaches evaluation technique first (how scores are computed and how much they can be trusted) and then the benchmark landscape, which changes every few months.'],
    hero: { steps: [
      { title: 'A leaderboard', text: 'Sorted bars invite a ranking.' },
      { title: 'Uncertainty', text: 'On 500 questions, an 84% score has a 95% interval of about ±3 points.' },
      { title: 'Ties', text: 'When intervals overlap heavily, the order is noise. A 1-point gap on a few hundred questions usually means nothing.' },
      { title: 'Small sets', text: 'Fewer questions, wider intervals.' },
      { title: 'Large sets', text: 'Ten times the questions shrinks intervals by about √10 ≈ 3.2×, but contamination and saturation remain.' },
    ], init: heroInit },
    sections: [
      { title: 'Scoring techniques', body: ['<b>Multiple choice by log-likelihood</b>: compare the model’s probability of each option; cheap but sensitive to formatting. <b>Free generation</b> scored by exact match or F1. <b>pass@k</b> for code: run unit tests on k samples. <b>LLM-as-judge</b>: a model grades answers, with known biases. <b>Pairwise comparison</b> with Elo or Bradley–Terry ratings. <b>Human evaluation</b> for what matters most. Zero-shot vs few-shot and prompt wording can move scores by several points.'], widget: passK },
      { title: 'Uncertainty', widget: diffCI },
      { title: 'Judges and arenas', widget: judge },
      { title: 'Ratings', depth: 'mechanics', widget: elo },
      { title: 'Popular benchmarks', body: [table(['Measures', 'Benchmarks'], window.PLAN.modules['37'].tables[0].rows), 'Check which are current and which are saturated before relying on any of them. <b>Contamination</b>: test questions leaked into training data inflate scores. <b>Saturation</b>: when every model scores 95%+, the benchmark stops separating them. Build your own task-specific eval set from real inputs, and pair offline evals with online A/B tests.'] },
    ],
    maths: [
      { note: '<b>pass@k</b> (unbiased, n samples with c correct) and the Elo win probability:', tex: '\\mathrm{pass@}k=\\mathbb{E}\\left[1-\\frac{\\binom{n-c}{k}}{\\binom{n}{k}}\\right],\\qquad P(A\\succ B)=\\frac{1}{1+10^{(R_B-R_A)/400}}' },
      { note: '95% interval for accuracy p on n questions, and for a difference of two models:', tex: 'p\\pm1.96\\sqrt{\\frac{p(1-p)}{n}},\\qquad (p_A-p_B)\\pm1.96\\sqrt{\\frac{p_A(1-p_A)+p_B(1-p_B)}{n}}' },
    ],
    leaves: ['Intervals here assume independent questions; benchmark items often cluster by topic, which widens real uncertainty.', 'A benchmark score is not your use case; your own eval set is.', 'The plan’s mini eval harness scoring two small models needs models running in the page; it is not included.'],
    quiz: [
      { q: '1,000 questions, 80% accuracy. Roughly the 95% interval?', opts: ['±0.5 points', '±2.5 points', '±8 points', '±25 points'], a: 1, why: '1.96 × √(0.8 × 0.2 / 1000) ≈ 0.0248.' },
      { q: 'n = 10 samples, c = 1 correct. pass@1?', opts: ['10%', '1%', '65%', '100%'], a: 0, why: 'pass@1 = c/n = 0.1.' },
      { q: 'A judge always prefers whichever answer comes first. Best fix?', opts: ['Use a bigger judge only', 'Score both orders and keep only consistent verdicts', 'Shorten answers', 'Ignore it'], a: 1, why: 'Position swapping cancels position bias and flags unreliable comparisons.' },
    ],
  });
})();
