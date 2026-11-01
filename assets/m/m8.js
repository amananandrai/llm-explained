(function () {
  const { h, s, svg, clear, slider, widget, readout, fmt, mix, lineChart, tween } = LLM.util;
  const TYPES = ['Helpful, correct answer', 'Correct but curt', 'Rambling, padded', 'Continues the question as text', 'Confident but wrong', 'Flatters the user, agrees'];
  const PRE = [0.12, 0.1, 0.15, 0.35, 0.13, 0.15];
  const SFT = [0.38, 0.18, 0.14, 0.05, 0.12, 0.13];
  const RM = [2.0, 1.0, 0.7, -2.0, -0.4, 1.7];      // learned (proxy) reward
  const TRUE = [2.0, 1.0, 0.2, -2.0, -1.8, -0.6];   // what we actually wanted
  const rl = (beta) => { const u = SFT.map((p, i) => p * Math.exp(RM[i] / beta)); const Z = u.reduce((a, b) => a + b, 0); return u.map((x) => x / Z); };
  const KL = (p, q) => p.reduce((a, x, i) => a + (x > 0 ? x * Math.log(x / q[i]) : 0), 0);
  const E = (p, r) => p.reduce((a, x, i) => a + x * r[i], 0);

  function bars(g, y0, dist, opts = {}) {
    TYPES.forEach((t, i) => {
      const y = y0 + i * 30;
      g.appendChild(s('text', { x: 210, y: y + 15, 'text-anchor': 'end', 'font-size': 11, text: t }));
      g.appendChild(s('rect', { x: 218, y: y + 3, width: 250, height: 17, rx: 3, fill: 'var(--sunk)' }));
      g.appendChild(s('rect', { x: 218, y: y + 3, width: dist[i] * 250, height: 17, rx: 3, fill: opts.color || 'var(--qdist)' }));
      if (opts.ref) g.appendChild(s('rect', { x: 218 + opts.ref[i] * 250 - 1, y: y + 1, width: 2, height: 21, fill: 'var(--ink)' }));
      g.appendChild(s('text', { x: 474, y: y + 15, 'font-size': 10.5, text: (dist[i] * 100).toFixed(0) + '%' }));
      if (opts.reward) g.appendChild(s('text', { x: 514, y: y + 15, 'font-size': 10.5, text: (RM[i] > 0 ? '+' : '') + RM[i].toFixed(1), style: `fill:${RM[i] > 0 ? 'var(--pass)' : 'var(--fail)'};font-weight:600` }));
    });
  }

  function heroInit(box) {
    const g = svg(560, 300, { 'aria-label': 'How post-training reshapes the distribution of answers' }); box.appendChild(g);
    let stop = () => {};
    function draw(step, t = 1) {
      clear(g);
      const titles = ['Pretrained: P(answer type | “How do I reverse a list in Python?”)', 'After SFT on instruction data', 'A reward model scores each answer type', 'RL pushes mass toward high reward (β = 0.3)', 'RL with a strong KL leash (β = 2)', 'Too little leash: reward hacking (β = 0.1)'];
      g.appendChild(s('text', { x: 10, y: 20, 'font-size': 12.5, text: titles[step], style: 'font-weight:600' }));
      const lerp = (a, b) => a.map((x, i) => x + (b[i] - x) * t);
      let d = PRE, ref = null;
      if (step === 1) d = lerp(PRE, SFT);
      if (step === 2) d = SFT;
      if (step === 3) { d = lerp(SFT, rl(0.3)); ref = SFT; }
      if (step === 4) { d = lerp(rl(0.3), rl(2)); ref = SFT; }
      if (step === 5) { d = lerp(rl(2), rl(0.1)); ref = SFT; }
      bars(g, 36, d, { ref, reward: step >= 2 });
      if (step >= 2) g.appendChild(s('text', { x: 514, y: 30, class: 'lbl', text: 'reward' }));
      if (step >= 3) g.appendChild(s('text', { x: 10, y: 236, class: 'lbl', text: `black tick = reference (SFT) model · KL from reference = ${fmt(KL(d, SFT), 2)} nats · true quality = ${fmt(E(d, TRUE), 2)}` }));
      if (step === 5) g.appendChild(s('text', { x: 10, y: 256, 'font-size': 12, text: 'The reward model over-rates flattery, and RL finds it. Proxy reward up, true quality down.', style: 'fill:var(--fail)' }));
      g.appendChild(s('text', { x: 10, y: 290, class: 'lbl', text: 'Illustrative numbers. The RL policy is the exact optimum π ∝ π_ref · exp(r/β).' }));
    }
    return { go(i) { stop(); stop = tween(900, (t) => draw(i, t)); } };
  }

  function betaSlider() {
    const w = widget('The KL leash', 'Try it', 'Closed-form optimum of the KL-regularised objective on six answer types. “True quality” uses a separate hidden score that disagrees with the reward model on flattery and confident errors.');
    const ch = lineChart({ w: 560, h: 230 }); const ro = readout();
    const g = svg(560, 200);
    const sb = slider({ label: 'β (leash strength)', min: -1.3, max: 1, step: 0.01, value: -0.5, fmt: (v) => (10 ** v).toFixed(2), oninput: draw });
    const curve = []; for (let e = -1.3; e <= 1; e += 0.02) { const p = rl(10 ** e); curve.push([10 ** e, E(p, RM), E(p, TRUE), KL(p, SFT)]); }
    function draw() {
      const b = 10 ** sb.value, p = rl(b);
      ch.draw([{ pts: curve.map((c) => [c[0], c[1]]), color: 'var(--qdist)' }, { pts: curve.map((c) => [c[0], c[2]]), color: 'var(--pass)', dash: '5 4' }], { logx: true, xlabel: 'β (log)', ylabel: 'proxy reward (violet) · true quality (green dashed)', marks: [{ x: b }], ymin: 0.4, ymax: 2.1 });
      clear(g); bars(g, 10, p, { ref: SFT, color: 'var(--qdist)' });
      ro.set([['β', b.toFixed(2)], ['proxy reward', fmt(E(p, RM), 2), 'var(--qdist)'], ['true quality', fmt(E(p, TRUE), 2), 'var(--pass)'], ['KL to reference', fmt(KL(p, SFT), 2) + ' nats']]);
    }
    w.body.append(sb.el, ch.el, ro.el, g);
    draw();
    return w.el;
  }

  function prefGame() {
    const w = widget('Train a reward model by labelling', 'Try it', 'Each answer is described by four features. A Bradley–Terry model (logistic regression on feature differences) is fit to your choices by gradient ascent.');
    const F = ['correct', 'polite', 'long', 'cites docs'];
    const R = [
      ['Use my_list.reverse() to reverse in place, or my_list[::-1] for a reversed copy.', [1, 0, 0.3, 0]],
      ['Great question! I’d be absolutely delighted to help you with that wonderful question. Lists can be reversed.', [0.3, 1, 0.5, 0]],
      ['Lists cannot be reversed in Python.', [0, 0, 0, 0]],
      ['Call my_list.sort(reverse=True).', [0, 0, 0.1, 0]],
      ['my_list[::-1]', [1, 0, 0, 0]],
      ['Sure! my_list.reverse() changes the list itself; my_list[::-1] returns a new reversed list. The Python docs on sequence types cover both.', [1, 1, 0.6, 1]],
      ['You must loop backwards and append each item to a new list; this is the only way, as the official docs explain at length in several sections with many examples.', [0.3, 0, 1, 1]],
      ['Happy to help! Use reversed(my_list), which gives an iterator; wrap it in list() if you need a list.', [1, 1, 0.4, 0]],
    ];
    const pairs = [[0, 1], [2, 4], [5, 6], [3, 7], [1, 5], [0, 6], [4, 7], [2, 3], [0, 5], [1, 6]];
    const labels = []; let at = 0;
    const card = h('div', { style: { display: 'grid', gap: '10px' } });
    const wout = h('div'); const rank = h('ol', { style: { margin: 0, paddingLeft: '1.3em', display: 'grid', gap: '4px', fontSize: '.92rem' } });
    let wts = [0, 0, 0, 0];
    function fit() {
      wts = [0, 0, 0, 0];
      for (let it = 0; it < 400; it++) {
        const gr = [0, 0, 0, 0];
        labels.forEach(([win, lose]) => { const d = R[win][1].map((x, i) => x - R[lose][1][i]); const z = d.reduce((a, x, i) => a + x * wts[i], 0); const p = 1 / (1 + Math.exp(-z)); d.forEach((x, i) => (gr[i] += (1 - p) * x)); });
        wts = wts.map((x, i) => x + 0.3 * (gr[i] - 0.05 * x));
      }
    }
    function drawWeights() {
      const g = svg(560, 130);
      F.forEach((f, i) => { const y = 8 + i * 30; g.appendChild(s('text', { x: 100, y: y + 15, 'text-anchor': 'end', 'font-size': 11.5, text: f })); g.appendChild(s('line', { x1: 300, x2: 300, y1: y, y2: y + 22, stroke: 'var(--muted)' })); const v = Math.max(-3, Math.min(3, wts[i])); g.appendChild(s('rect', { x: v >= 0 ? 300 : 300 + v * 60, y: y + 3, width: Math.abs(v) * 60, height: 16, rx: 3, fill: v >= 0 ? 'var(--pass)' : 'var(--fail)' })); g.appendChild(s('text', { x: 500, y: y + 15, 'font-size': 11, text: fmt(wts[i], 2) })); });
      clear(wout).append(h('div', { class: 'eyebrow' }, `learned reward weights after ${labels.length} labels`), g);
      const sc = R.map((r, i) => [i, r[1].reduce((a, x, k) => a + x * wts[k], 0)]).sort((a, b) => b[1] - a[1]);
      clear(rank); sc.forEach(([i, v]) => rank.appendChild(h('li', null, h('b', { class: 'mono' }, fmt(v, 2) + '  '), R[i][0])));
    }
    function drawCard() {
      clear(card);
      if (at >= pairs.length) { card.append(h('p', null, h('b', null, 'All pairs labelled. '), 'The ranking below is what your reward model now believes. An RL step would push the policy toward its top answers.'), h('button', { class: 'btn', type: 'button', onclick: () => { labels.length = 0; at = 0; fit(); drawWeights(); drawCard(); } }, 'Start over')); return; }
      const [a, b] = pairs[at];
      card.append(h('p', { class: 'eyebrow' }, `Pair ${at + 1} of ${pairs.length} · “How do I reverse a list in Python?” Which answer is better?`),
        h('div', { class: 'w-split' }, [a, b].map((i, k) => h('button', { type: 'button', class: 'btn', style: { textAlign: 'left', fontFamily: 'var(--f-body)', padding: '12px', display: 'block', lineHeight: 1.5, whiteSpace: 'normal' }, onclick: () => { labels.push(k === 0 ? [a, b] : [b, a]); at++; fit(); drawWeights(); drawCard(); } }, R[i][0]))),
        h('button', { class: 'btn', type: 'button', onclick: () => { at++; drawCard(); } }, 'Skip (no preference)'));
    }
    w.body.append(card, wout, h('details', null, h('summary', { class: 'eyebrow', style: { cursor: 'pointer' } }, 'Reward ranking of all 8 answers'), rank));
    fit(); drawWeights(); drawCard();
    return w.el;
  }

  LLM.mod('8', {
    hook: 'A pretrained model can write anything. How do you make it answer?',
    intro: ['Pretraining produces a model that continues text. Ask it a question and it may continue with more questions. Post-training reshapes its output distribution: first by imitation (SFT), then by preference (reward models and RL, or DPO), and for reasoning models, by reward on checkable answers.'],
    hero: {
      steps: [
        { title: 'Pretrained: a document continuer', text: 'Six kinds of reply to a coding question. The most likely is to treat the question as the start of a forum page and keep writing it.' },
        { title: 'Supervised fine-tuning', text: 'Train on thousands of (instruction, good answer) pairs formatted with a chat template. The model learns the assistant format; probability shifts to real answers.', mech: 'Same next-token loss as pretraining, computed only on the assistant’s tokens.' },
        { title: 'A reward model', text: 'People compare two answers and pick the better one. A model trained on those pairs learns to score any answer. It is a proxy: here it over-rates flattery.', maths: 'P(y_w\\succ y_l)=\\sigma\\big(r_\\phi(x,y_w)-r_\\phi(x,y_l)\\big)' },
        { title: 'RL with a KL leash', text: 'RL (classically PPO) raises the probability of high-reward answers. A KL penalty measures drift from the SFT model (the black ticks) and pulls back.', maths: '\\max_{\\pi}\\ \\mathbb{E}[r]-\\beta\\,D_{\\mathrm{KL}}(\\Qd{\\pi}\\,\\|\\,\\pi_{\\mathrm{ref}})' },
        { title: 'A stronger leash', text: 'Large β keeps the policy close to the reference: safer, but it gains less.' },
        { title: 'Reward hacking', text: 'Small β lets the policy chase the proxy. It discovers the reward model likes flattery. Reward goes up while what we actually wanted goes down: over-optimisation.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'The post-training toolbox', depth: 'mechanics', body: [
        '<b>RLHF with PPO.</b> Sample answers, score them with the reward model, subtract β·KL to the reference, and update with PPO’s clipped policy gradient. Needs four models in memory: policy, reference, reward and value.',
        '<b>RLAIF and constitutions.</b> Replace some human labels with AI feedback guided by written principles, which scales labelling and makes the criteria explicit.',
        '<b>DPO</b> (direct preference optimisation) shows the KL-regularised optimum can be written in terms of the policy itself, so preference pairs train the policy directly with a classification-style loss. No reward model, no sampling loop.',
        '<b>GRPO and verifiable rewards.</b> For maths, code and unit tests, the reward is a checker, not a learned model, so it is much harder to hack. GRPO samples a group of answers per prompt and uses each answer’s reward relative to the group mean as its advantage, dropping the value model.',
        '<b>Test-time compute.</b> Reasoning models trained this way learn to write long chains of thought before answering, and accuracy keeps rising with the number of thinking tokens.',
      ] },
      { title: 'The β knob in detail', widget: betaSlider },
    ],
    maths: [
      { note: '<b>Bradley–Terry</b> preference probability, and the reward-model loss on preferred y_w and rejected y_l:', tex: 'P(y_w\\succ y_l\\mid x)=\\sigma\\big(r_\\phi(x,y_w)-r_\\phi(x,y_l)\\big),\\qquad \\mathcal{L}_{RM}=-\\log\\sigma\\big(r_\\phi(x,y_w)-r_\\phi(x,y_l)\\big)' },
      { note: '<b>RLHF objective</b>, a reverse-KL penalty (Module 0 sub-page):', tex: '\\max_{\\pi_\\theta}\\;\\mathbb{E}_{x,\\,y\\sim\\pi_\\theta}\\big[r_\\phi(x,y)\\big]-\\beta\\,D_{\\mathrm{KL}}\\big(\\pi_\\theta(\\cdot\\mid x)\\,\\|\\,\\pi_{\\mathrm{ref}}(\\cdot\\mid x)\\big)' },
      { note: 'Its exact solution, used in the animation:', tex: '\\pi^*(y\\mid x)=\\frac{1}{Z(x)}\\,\\pi_{\\mathrm{ref}}(y\\mid x)\\,\\exp\\!\\big(r(x,y)/\\beta\\big)', after: 'Solve for r and substitute into Bradley–Terry; Z cancels in the difference. That gives DPO:' },
      { tex: '\\mathcal{L}_{\\mathrm{DPO}}=-\\log\\sigma\\!\\Big(\\beta\\log\\tfrac{\\pi_\\theta(y_w|x)}{\\pi_{\\mathrm{ref}}(y_w|x)}-\\beta\\log\\tfrac{\\pi_\\theta(y_l|x)}{\\pi_{\\mathrm{ref}}(y_l|x)}\\Big)' },
      { note: '<b>GRPO</b> advantage for answer i in a group of G sampled answers:', tex: 'A_i=\\frac{r_i-\\mathrm{mean}(r_1,\\dots,r_G)}{\\mathrm{std}(r_1,\\dots,r_G)}' },
    ],
    tryit: [prefGame],
    leaves: ['Six answer “types” stand in for an astronomically large space of possible responses.', 'Real RL takes noisy gradient steps toward the optimum; it never computes π* exactly.', 'Reward models fail in more ways than flattery: length bias, format bias, and exploiting labeller blind spots.', 'Safety training, refusals and system-prompt adherence are also part of post-training (Module 39).'],
    quiz: [
      { q: 'In the RLHF objective, what happens as β → 0?', opts: ['The policy stays equal to the reference', 'The policy maximises the proxy reward with no restraint, risking reward hacking', 'Training stops', 'The reward model is retrained'], a: 1, why: 'The KL term vanishes, so nothing stops the policy from collapsing onto whatever the reward model over-rates.' },
      { q: 'What does DPO remove compared with PPO-based RLHF?', opts: ['The preference data', 'The reference model', 'The separate reward model and the RL sampling loop', 'The KL constraint'], a: 2, why: 'DPO optimises the policy directly on preference pairs; the KL constraint is still there implicitly through π_ref and β.' },
      { q: 'Why are verifiable rewards attractive for reasoning models?', opts: ['They are cheaper to label by hand', 'A checker (unit tests, exact answer) is hard to fool, unlike a learned reward model', 'They make the model smaller', 'They remove the need for pretraining'], a: 1, why: 'A correct-answer check cannot be flattered; the main risk shifts to gaming the checker itself.' },
    ],
  });
})();
