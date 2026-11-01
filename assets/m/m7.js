(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, softmax, tokColor, mix, probBars, lineChart, human, bytes, rng } = LLM.util;
  const prompt = ['The', ' cat', ' sat', ' on', ' the'];
  const D = [
    { ' mat': .46, ' floor': .18, ' sofa': .14, ' roof': .08, ' table': .07, ' dog': .04, ' moon': .03 },
    { '.': .41, ' and': .22, ',': .15, ' while': .1, ' for': .07, ' in': .05 },
    { ' It': .38, ' The': .27, ' Then': .15, ' She': .1, ' A': .1 },
    { ' purred': .35, ' was': .3, ' looked': .15, ' slept': .12, ' yawned': .08 },
  ];
  const greedy = D.map((d) => Object.entries(d)[0][0]);

  function heroInit(box) {
    const g = svg(560, 400, { 'aria-label': 'Autoregressive generation with a growing KV cache' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const gen = Math.max(0, Math.min(step - 1, 4));
      const seq = prompt.concat(greedy.slice(0, gen));
      let x = 14;
      seq.forEach((t, i) => { const wd = 12 + t.length * 8; const isNew = i === seq.length - 1 && gen > 0; g.appendChild(s('rect', { x, y: 20, width: wd, height: 26, rx: 5, fill: mix(tokColor(i), i >= 5 ? 45 : 22), stroke: isNew ? 'var(--ink)' : tokColor(i), 'stroke-width': isNew ? 2 : 1 })); g.appendChild(s('text', { x: x + wd / 2, y: 37, 'text-anchor': 'middle', 'font-size': 11.5, text: t.trim() || '·' })); x += wd + 4; });
      g.appendChild(s('text', { x: 14, y: 64, class: 'lbl', text: step === 0 ? 'The prompt: 5 tokens' : `context: ${seq.length} tokens` }));
      if (step >= 1 && step <= 4) {
        const d = D[gen === 4 ? 3 : gen] && D[Math.min(step - 1, 3)];
        const entries = Object.entries(d);
        g.appendChild(s('text', { x: 14, y: 92, 'font-size': 12.5, text: 'P(next token | context)', style: 'font-weight:600' }));
        entries.forEach(([t, p], i) => { const y = 104 + i * 20; g.appendChild(s('text', { x: 84, y: y + 12, 'text-anchor': 'end', 'font-size': 11, text: t.trim() })); g.appendChild(s('rect', { x: 90, y, width: 200, height: 14, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: 90, y, width: p * 200 / .5, height: 14, rx: 3, fill: i === 0 ? 'var(--accent)' : 'var(--q)', style: i === 0 ? '' : 'opacity:.55' })); g.appendChild(s('text', { x: 296, y: y + 12, 'font-size': 10.5, text: (p * 100).toFixed(0) + '%' })); });
        g.appendChild(s('text', { x: 14, y: 260, class: 'lbl', text: 'greedy picks the top bar, appends it, and runs again' }));
      }
      // KV cache
      const L = 3, kx = step === 5 ? 14 : 340, ky = step === 5 ? 110 : 96;
      const ncache = step === 0 ? 0 : seq.length - (step >= 1 && step <= 4 ? 0 : 0);
      g.appendChild(s('text', { x: kx, y: ky - 8, 'font-size': 12.5, text: 'KV cache (3 layers shown)', style: 'font-weight:600' }));
      for (let l = 0; l < L; l++) {
        g.appendChild(s('text', { x: kx, y: ky + 16 + l * 40, class: 'lbl', text: 'L' + (l + 1) }));
        for (let i = 0; i < ncache; i++) { const isNew = i === ncache - 1 && step >= 2; g.appendChild(s('rect', { x: kx + 22 + i * 21, y: ky + l * 40, width: 18, height: 12, rx: 2, fill: 'var(--k)', style: 'opacity:.85' })); g.appendChild(s('rect', { x: kx + 22 + i * 21, y: ky + 14 + l * 40, width: 18, height: 12, rx: 2, fill: 'var(--v)', stroke: isNew ? 'var(--ink)' : 'none', style: 'opacity:.85' })); }
      }
      g.appendChild(s('text', { x: kx, y: ky + 132, class: 'lbl', text: 'orange = keys, green = values, one pair per token per layer' }));
      if (step === 5) {
        g.appendChild(s('text', { x: 14, y: 92, 'font-size': 12.5, text: 'Without a cache, every new token recomputes K and V for the whole context:' }));
        const n = 9; let tot = 0, cached = 0;
        for (let t = 1; t <= n; t++) { tot += t; cached += 1; }
        g.appendChild(s('text', { x: 14, y: 270, 'font-size': 12, text: `For 9 tokens: ${tot} K/V computations without a cache, ${cached} with one.` }));
        g.appendChild(s('text', { x: 14, y: 290, 'font-size': 12, text: 'The cache trades compute for memory, and that memory becomes the bottleneck at long context.' }));
        g.appendChild(s('text', { x: 14, y: 310, class: 'lbl', text: 'Modules 10 and 11 are about shrinking it.' }));
      }
      if (step === 0) { g.appendChild(s('text', { x: 14, y: 110, 'font-size': 12, text: 'Prefill: the whole prompt runs in one parallel pass' })); g.appendChild(s('text', { x: 14, y: 128, 'font-size': 12, text: 'and its keys and values are stored.' })); }
      g.appendChild(s('text', { x: 14, y: 388, class: 'lbl', text: 'Probabilities are illustrative, written for this page, not sampled from a model.' }));
    }
    return { go: draw };
  }

  function samplingLab() {
    const w = widget('Sampling lab', 'Try it', 'Illustrative logits for the prompt “The capital of France is”. Draws use a seeded random generator so you can compare settings.');
    const cand = [[' Paris', 6.2], [' a', 3.9], [' the', 3.5], [' located', 3.1], [' Lyon', 2.0], [' known', 2.3], [' one', 1.8], [' not', 1.2], [' beautiful', 1.4], [' Marseille', 0.9], [' called', 1.0], [' banana', -1.5]];
    const st = { T: 1, k: 12, p: 1 };
    const bars = probBars({ labelW: 86 }); const ro = readout(); const sampleOut = h('div', { class: 'tokbox' });
    function dist() {
      const pr = softmax(cand.map((c) => c[1]), st.T);
      let idx = pr.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
      const keep = new Set(); let cum = 0;
      for (let r = 0; r < idx.length; r++) { if (r >= st.k) break; if (cum >= st.p && r > 0) break; keep.add(idx[r][1]); cum += idx[r][0]; }
      const Z = [...keep].reduce((a, i) => a + pr[i], 0);
      return { pr, keep, fin: pr.map((p, i) => (keep.has(i) ? p / Z : 0)) };
    }
    function draw() {
      const { pr, keep, fin } = dist();
      bars.draw(cand.map((c, i) => ({ label: c[0].trim(), p: fin[i], dim: !keep.has(i), ghost: pr[i], color: i === 0 ? 'var(--accent)' : 'var(--q)' })), { scaleMax: 1, caption: `kept ${keep.size} of ${cand.length} · tick = before filtering` });
      const ent = -fin.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);
      ro.set([['P(Paris)', (fin[0] * 100).toFixed(1) + '%'], ['entropy', fmt(ent, 2) + ' bits'], ['candidates', keep.size]]);
    }
    function sample(n) {
      const { fin } = dist(); const r = rng(Math.floor(st.T * 1000 + st.k * 7 + st.p * 131)); const counts = new Map();
      for (let i = 0; i < n; i++) { let u = r(), j = 0; while (u > fin[j] && j < fin.length - 1) { u -= fin[j]; j++; } counts.set(j, (counts.get(j) || 0) + 1); }
      clear(sampleOut).append(h('span', { class: 'eyebrow' }, `${n} draws: `), ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([j, c]) => h('span', { class: 'tok', style: { borderColor: tokColor(j), background: mix(tokColor(j), 15, 'var(--paper)') } }, `${cand[j][0].trim()} ×${c}`)));
    }
    const sT = slider({ label: 'temperature', min: 0.1, max: 2.5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), oninput: (v) => { st.T = v; draw(); sample(200); } });
    const sk = slider({ label: 'top-k', min: 1, max: 12, value: 12, oninput: (v) => { st.k = v; draw(); sample(200); } });
    const sp = slider({ label: 'top-p (nucleus)', min: 0.05, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), oninput: (v) => { st.p = v; draw(); sample(200); } });
    w.body.append(h('div', { class: 'ctl-row' }, sT.el, sk.el, sp.el), bars.el, ro.el, sampleOut);
    draw(); sample(200);
    return w.el;
  }

  function scaling() {
    const w = widget('Scaling-law calculator', 'Mechanics', 'Uses the Chinchilla parametric fit L(N, D) = E + A/N^α + B/D^β with E = 1.69, A = 406.4, B = 410.7, α = 0.34, β = 0.28 (Hoffmann et al. 2022). Loss is in nats per token on their data, so compare shapes, not absolute values.');
    const Lf = (N, Dd) => 1.69 + 406.4 / N ** 0.34 + 410.7 / Dd ** 0.28;
    const ch = lineChart({ w: 560, h: 240 }); const ro = readout();
    const sN = slider({ label: 'parameters N', min: 7, max: 12.3, step: 0.05, value: 9.85, fmt: (v) => human(10 ** v), oninput: draw });
    const sD = slider({ label: 'training tokens D', min: 9, max: 13.5, step: 0.05, value: 12.2, fmt: (v) => human(10 ** v), oninput: draw });
    function draw() {
      const N = 10 ** sN.value, Dd = 10 ** sD.value, C = 6 * N * Dd;
      const pts = []; for (let e = 9; e <= 13.5; e += 0.1) pts.push([10 ** e, Lf(N, 10 ** e)]);
      // compute-optimal frontier at the same budget
      let best = [0, Infinity]; for (let e = 7; e <= 12.5; e += 0.02) { const n = 10 ** e, dd = C / (6 * n); const l = Lf(n, dd); if (l < best[1]) best = [n, l]; }
      ch.draw([{ pts, color: 'var(--q)', dots: [[Dd, Lf(N, Dd)]] }], { logx: true, xlabel: 'training tokens (log)', ylabel: 'predicted loss', xfmt: (v) => human(v), ymin: 1.8, ymax: 4, marks: [{ x: 20 * N, label: '20 tokens/param' }] });
      ro.set([['training compute 6ND', human(C) + 'FLOPs'], ['tokens per parameter', fmt(Dd / N, 1)], ['loss', fmt(Lf(N, Dd), 3)], ['best N for this budget (this fit)', human(best[0])], ['its loss', fmt(best[1], 3)]]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, sN.el, sD.el), ch.el, ro.el);
    draw();
    return w.el;
  }

  function kvCalc() {
    const w = widget('KV-cache memory calculator', 'Mechanics');
    const st = { L: 32, kvh: 8, dh: 128, ctx: 8192, b: 1, bp: 2 };
    const ro = readout();
    const presets = { 'Llama 3 8B': [32, 8, 128], 'Llama 3 70B': [80, 8, 128], 'GPT-2 XL (MHA)': [48, 25, 64] };
    const sl = {};
    const mk = (k, label, min, max, step, f) => (sl[k] = slider({ label, min, max, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('L', 'layers', 1, 128, 1); mk('kvh', 'KV heads', 1, 64, 1); mk('dh', 'd_head', 32, 256, 32); mk('ctx', 'context length', 512, 131072, 512, (v) => human(v)); mk('b', 'batch (users)', 1, 64, 1);
    const bp = seg([[4, 'FP32'], [2, 'FP16/BF16'], [1, 'FP8'], [0.5, 'INT4']], 2, (v) => { st.bp = v; draw(); }, 'Bytes per value');
    function draw() {
      const per = 2 * st.L * st.kvh * st.dh * st.bp, total = per * st.ctx * st.b;
      ro.set([['per token', bytes(per)], ['per sequence', bytes(per * st.ctx)], ['total', bytes(total), total > 80 * 2 ** 30 ? 'var(--fail)' : 'var(--ink)'], ['fits an 80 GB GPU (cache alone)?', total < 80 * 2 ** 30 ? 'yes' : 'no', total < 80 * 2 ** 30 ? 'var(--pass)' : 'var(--fail)']]);
    }
    const pr = seg(Object.keys(presets), null, (k) => { [st.L, st.kvh, st.dh] = presets[k]; sl.L.set(st.L); sl.kvh.set(st.kvh); sl.dh.set(st.dh); draw(); }, 'Presets');
    w.body.append(pr.el, h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), h('div', { class: 'ctl' }, h('label', null, 'precision'), bp.el), ro.el, h('p', { class: 'note-sim' }, 'Llama 3 8B: 32 layers, 8 KV heads (grouped-query attention), d_head 128 → 128 KB per token in BF16, 1 GB for an 8k context.'));
    draw();
    return w.el;
  }

  LLM.mod('7', {
    hook: 'How does predicting one word at a time produce an essay?',
    intro: ['A GPT is a decoder-only transformer trained on one task: given the text so far, output a probability for every possible next token. Generation repeats that step: pick a token, append it, run again. Everything else on this page is about doing that well and cheaply.'],
    hero: {
      steps: [
        { title: 'Prefill the prompt', text: 'The prompt runs through the model in one parallel pass. Each layer stores every token’s keys and values in the KV cache.' },
        { title: 'Logits become probabilities', text: 'The last position’s output vector is multiplied by the embedding matrix to give one score (logit) per vocabulary token. Softmax turns them into probabilities.', mech: 'h_last [d_model] × Eᵀ [d_model, vocab] → logits [vocab].' },
        { title: 'Pick, append, repeat', text: 'Greedy decoding takes the top token, “mat”, appends it, and runs again. Only the new token goes through the model; its K and V are added to the cache.' },
        { title: 'The loop continues', text: 'Each step costs one token’s worth of compute plus attention over the cache. The distribution changes with context: after “mat”, punctuation is likely.' },
        { title: 'One token at a time', text: 'Generation is sequential, the one place transformers are still like RNNs. That is why output tokens cost more time than input tokens.' },
        { title: 'Why cache at all', text: 'Without the cache each step would recompute keys and values for the whole context. With it, step t does one token of new work, but memory grows with every token, layer and user.', maths: '\\text{KV bytes}=2\\times L\\times H_{kv}\\times d_{head}\\times n\\times \\text{bytes}' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Choosing the next token', body: [
        '<b>Greedy</b> always takes the top token: deterministic, often repetitive. <b>Temperature</b> divides logits before softmax: below 1 sharpens, above 1 flattens. <b>Top-k</b> keeps only the k most likely tokens. <b>Top-p</b> (nucleus) keeps the smallest set whose probabilities sum to at least p, so the set adapts to how confident the model is. <b>Beam search</b> keeps the b best partial sequences; good for translation, bland for open writing.',
      ], widget: samplingLab },
      { title: 'Pretraining: data, compute and scaling laws', depth: 'mechanics', body: [
        '<b>Data.</b> Web crawls (Common Crawl), books, code and papers, then heavy cleaning: deduplication, language and quality filters, removal of toxic and personal data, and increasingly synthetic data written by other models. The mixture weights matter as much as the total.',
        '<b>Compute.</b> Training costs about 6 FLOPs per parameter per token: 2 for the forward pass, 4 for the backward.',
        '<b>Scaling laws.</b> Kaplan et al. (2020) found loss falls as a smooth power law in parameters, data and compute. Chinchilla (2022) refit this and found earlier models were undertrained: for a fixed budget, use about 20 tokens per parameter. Many current models train far past that point because a smaller, longer-trained model is cheaper to serve.',
        '<b>Post-training.</b> A pretrained model completes text; it does not yet follow instructions. Module 8 turns it into an assistant.',
      ], widget: scaling },
      { title: 'The KV cache in numbers', depth: 'mechanics', sub: 'The bridge to Modules 10 and 11.', widget: kvCalc },
    ],
    maths: [
      { note: 'The chain rule of probability, and perplexity, the exponentiated average negative log-likelihood:', tex: 'P(x_{1:T})=\\prod_{t=1}^{T}P(x_t\\mid x_{<t}),\\qquad \\mathrm{PPL}=\\exp\\!\\Big(-\\tfrac{1}{T}\\sum_{t=1}^{T}\\log P(x_t\\mid x_{<t})\\Big)', after: 'Perplexity 10 means the model is, on average, as uncertain as a fair choice among 10 tokens.' },
      { note: 'Temperature-scaled softmax over logits z:', tex: 'p_i=\\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}}' },
      { note: 'Training compute, and the Chinchilla rule of thumb:', tex: 'C\\approx 6ND\\ \\text{FLOPs},\\qquad D_{\\text{opt}}\\approx 20N' },
      { note: 'KV-cache size (the 2 is one K plus one V):', tex: '\\text{bytes}=2\\times\\text{layers}\\times\\text{KV heads}\\times d_{\\text{head}}\\times\\text{seq len}\\times\\text{batch}\\times\\text{bytes per value}' },
    ],
    tryit: [],
    leaves: ['The next-token probabilities in the hero animation are written for illustration.', 'Real decoding stacks add repetition penalties, stop sequences, min-p and constrained grammars.', 'Scaling-law constants depend on data and architecture; the fit here is one paper’s, not a universal law.', 'The KV cache also stores nothing for MLP layers; only attention needs past tokens.'],
    quiz: [
      { q: 'A 7B-parameter model is trained on 2T tokens. Roughly how much training compute?', opts: ['≈ 8 × 10²² FLOPs', '≈ 1.4 × 10¹³ FLOPs', '≈ 8 × 10²⁵ FLOPs', '≈ 4 × 10¹⁸ FLOPs'], a: 0, why: '6 × 7×10⁹ × 2×10¹² = 8.4 × 10²² FLOPs.' },
      { q: 'Top-p = 0.9 on a very confident distribution (top token 0.95). How many tokens are kept?', opts: ['1', '9', '90% of the vocabulary', 'It depends on top-k only'], a: 0, why: 'The first token alone already covers 0.95 ≥ 0.9, so the nucleus is a single token.' },
      { q: 'Llama 3 8B (32 layers, 8 KV heads, d_head 128, BF16). KV cache for one 32k-token sequence?', opts: ['≈ 4 GB', '≈ 400 MB', '≈ 40 GB', '≈ 16 GB'], a: 0, why: '2 × 32 × 8 × 128 × 2 bytes = 128 KB per token; × 32,768 = 4 GB.' },
    ],
  });
})();
