(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, mix, tokColor, rng, randn, softmax, lineChart, matrixGrid } = LLM.util;
  // toy depth-attention logits: favour the embedding, recent layers, and one mid layer
  const depthLogits = (l, i, r) => 2.0 * (i === 0) - 0.35 * (l - 1 - i) + (i === Math.floor(l / 2) ? 1 : 0) + (r ? randn(r) * 0.3 : 0);
  function alphas(L, seed = 1) { const r = rng(seed); return Array.from({ length: L }, (_, l) => (l === 0 ? [1] : softmax(Array.from({ length: l }, (_, i) => depthLogits(l, i, r))))); }

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Standard residuals pour equal cups into one bucket; attention residuals shine variable spotlights on earlier layers' }); box.appendChild(g);
    const L = 10;
    function draw(step) {
      clear(g);
      const yOf = (i) => 340 - i * 30;
      for (let i = 0; i < L; i++) { g.appendChild(s('rect', { x: 30, y: yOf(i) - 20, width: 90, height: 24, rx: 5, fill: mix(tokColor(i), 35), stroke: tokColor(i) })); g.appendChild(s('text', { x: 75, y: yOf(i) - 4, 'text-anchor': 'middle', 'font-size': 11, text: i ? 'layer ' + i : 'embedding' })); }
      if (step <= 1) {
        // bucket with equal stripes, early colours fading as total grows
        const n = step === 0 ? 4 : L;
        g.appendChild(s('path', { d: 'M300,80 L320,340 L460,340 L480,80', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }));
        for (let i = 0; i < n; i++) { const hh = 240 / L; g.appendChild(s('rect', { x: 322, y: 338 - (i + 1) * hh, width: 136, height: hh - 1, fill: tokColor(i), style: 'opacity:.75' })); g.appendChild(s('line', { x1: 120, y1: yOf(i) - 8, x2: 315, y2: 338 - (i + 0.5) * hh, stroke: tokColor(i), 'stroke-width': 1, style: 'opacity:.5' })); }
        g.appendChild(s('text', { x: 300, y: 60, 'font-size': 12, text: `h_${n} = sum of ${n} equal cups`, style: 'font-weight:600' }));
        g.appendChild(s('text', { x: 300, y: 364, 'font-size': 11.5, text: `layer 1’s share of the bucket: ${(100 / n).toFixed(0)}%` }));
      } else {
        const A = alphas(L)[L - 1];
        g.appendChild(s('rect', { x: 330, y: 40, width: 120, height: 30, rx: 6, fill: mix('var(--accent)', 25), stroke: 'var(--accent)' }));
        g.appendChild(s('text', { x: 390, y: 60, 'text-anchor': 'middle', 'font-size': 12, text: 'layer 10 query', style: 'font-weight:600' }));
        A.forEach((a, i) => { g.appendChild(s('path', { d: `M330,55 L120,${yOf(i) - 14} L120,${yOf(i) - 2} Z`, fill: 'var(--accent)', style: `opacity:${(a * 0.9).toFixed(2)}` })); g.appendChild(s('text', { x: 130, y: yOf(i) - 4, 'font-size': 10.5, text: (a * 100).toFixed(0) + '%' })); });
        g.appendChild(s('text', { x: 300, y: 364, 'font-size': 11.5, text: step === 2 ? 'softmax over depth: weights sum to 1, chosen per input' : 'Block AttnRes: attend over ~8 block summaries, not every layer' }));
      }
    }
    return { go: draw };
  }

  function depthSim() {
    const w = widget('Dilution with depth', 'Try it', 'Toy simulation: each layer adds a random unit-norm update in 64 dimensions. AttnRes weights here follow a fixed hand-set pattern (favour embedding, recent layers, one middle layer), not learned weights.');
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const sl = slider({ label: 'depth L', min: 4, max: 128, value: 48, oninput: draw });
    function draw() {
      const L = sl.value, r = rng(3), D = 64;
      const v = Array.from({ length: L }, () => { const x = Array.from({ length: D }, () => randn(r)); const n = Math.hypot(...x); return x.map((y) => y / n); });
      const A = alphas(L, 5);
      const std = [], att = [];
      let hs = new Array(D).fill(0);
      for (let l = 0; l < L; l++) {
        hs = hs.map((x, k) => x + v[l][k]); std.push([l + 1, Math.hypot(...hs)]);
        const ha = new Array(D).fill(0); A[l].forEach((a, i) => v[i].forEach((x, k) => (ha[k] += a * x))); att.push([l + 1, Math.hypot(...ha)]);
      }
      ch.draw([{ pts: std, color: 'var(--res)' }, { pts: att, color: 'var(--accent)' }], { xlabel: 'layer', ylabel: 'hidden-state norm (grey = standard, pink = AttnRes toy)', ymin: 0 });
      ro.set([['standard: layer 1 weight in h_L', (100 / L).toFixed(1) + '%'], ['AttnRes toy: embedding weight in h_L', (A[L - 1][0] * 100).toFixed(1) + '%'], ['standard norm at L', fmt(std[L - 1][1], 2) + ' (≈ √L)']]);
    }
    w.body.append(sl.el, ch.el, ro.el);
    draw();
    return w.el;
  }

  function heatmap() {
    const w = widget('Depth-attention map', 'Mechanics', 'Toy weights from the same hand-set pattern with noise. The report shows learned maps; read them there.');
    const g = svg(560, 300);
    const L = 12, A = alphas(L, 8);
    const M = A.map((row) => Array.from({ length: L }, (_, i) => (i < row.length ? row[i] : null)));
    g.appendChild(matrixGrid(M.map((r) => r.map((x) => (x == null ? 0 : x))), { x: 70, y: 30, cell: 20, color: 'var(--accent)', numbers: false, max: 1, visible: (i, j) => j < Math.max(1, i) || i === 0, label: 'row = layer l, column = earlier layer i' }));
    for (let i = 0; i < L; i++) g.appendChild(s('text', { x: 62, y: 44 + i * 20, 'text-anchor': 'end', class: 'lbl', text: i }));
    g.appendChild(s('text', { x: 330, y: 80, 'font-size': 12, text: 'Bright column 0: layers keep' })); g.appendChild(s('text', { x: 330, y: 96, 'font-size': 12, text: 'reading the embedding directly.' }));
    g.appendChild(s('text', { x: 330, y: 130, 'font-size': 12, text: 'Bright diagonal: most weight on' })); g.appendChild(s('text', { x: 330, y: 146, 'font-size': 12, text: 'the last few layers.' }));
    w.body.append(g);
    return w.el;
  }

  LLM.mod('17', {
    hook: 'If attention fixed RNNs’ memory problem across time, could it fix the same problem across depth?',
    intro: ['In a pre-norm transformer, each layer adds its output to the residual stream with weight 1. After 100 layers the stream is a sum of 100 equal contributions, so any one early layer’s signal is diluted. Attention Residuals, from a 2026 Moonshot AI (Kimi) technical report, replace that fixed sum with learned softmax attention over earlier layers. It is new and not widely replicated; numbers here are toy simulations and the report’s own claims.'],
    hero: {
      steps: [
        { title: 'Equal cups', text: 'With standard residuals every layer pours an equal cup into one bucket. After four layers, the embedding is a quarter of the mix.' },
        { title: 'Dilution', text: 'After ten layers each contribution is a tenth, and the bucket keeps growing: the hidden-state norm rises roughly with √L. Early colours fade. Related failures in deep stacks are rank collapse (tokens become alike) and entropy collapse (over-peaked attention).', maths: 'h_l=h_1+\\sum_{i<l}f_i(h_i)' },
        { title: 'A spotlight over depth', text: 'AttnRes gives each layer a query. It scores every earlier layer’s output and takes a softmax-weighted mix, chosen per input. Layer 10 can read the embedding directly at 30% weight.', maths: 'h_l=\\sum_{i<l}\\alpha_{i\\to l}\\,v_i,\\quad \\alpha_{i\\to l}=\\mathrm{softmax}_i(q_l^{\\top}k_i)' },
        { title: 'Making it scale', text: 'Attending over every layer costs O(L·d) memory per token. Block AttnRes groups layers into blocks and attends over block summaries; the report finds about 8 blocks capture most of the gain, and uses cross-stage caching to work with pipeline parallelism. It was trained inside Kimi Linear (48B total, 3B active).' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Watch the stream grow', widget: depthSim },
      { title: 'The analogy, precisely', depth: 'mechanics', body: ['The report argues that standard residuals, Highway networks and Hyper-Connections all behave like <em>linear</em> attention over depth (fixed or input-independent mixing weights), while AttnRes is <em>softmax</em> attention over depth. That mirrors how attention replaced fixed recurrence across time in RNNs.', '<b>Also changing the block:</b> linear-attention and state-space layers (Mamba-style) keep a fixed-size state instead of a growing KV cache. Many 2025–26 models mix a few full-attention layers with many linear or SSM layers to make long context cheap.'], widget: heatmap },
    ],
    maths: [
      { note: 'Standard (pre-norm) residual vs Attention Residuals:', tex: '\\text{standard: } h_l=h_1+\\sum_{i<l}f_i(h_i),\\qquad \\text{AttnRes: } h_l=\\sum_{i<l}\\alpha_{i\\to l}\\,v_i,\\quad \\alpha_{i\\to l}=\\mathrm{softmax}_i\\!\\big(q_l^{\\top}k_i\\big)' },
      { note: 'Why the norm grows: with roughly independent updates of size 1,', tex: '\\mathbb{E}\\,\\|h_L\\|^2\\approx\\sum_{i=1}^{L}\\|f_i\\|^2=L\\quad\\Rightarrow\\quad\\|h_L\\|\\approx\\sqrt{L}' },
      { note: 'Block AttnRes memory, with N blocks instead of L layers:', tex: 'O(L\\cdot d)\\;\\to\\;O(N\\cdot d)' },
    ],
    leaves: ['The simulations use random updates and hand-set weights; trained models behave differently.', 'The report measures information dilution directly; whether AttnRes also helps rank or entropy collapse should be checked in the paper.', 'Results come from one lab’s report on its own models.'],
    quiz: [
      { q: 'With standard residuals and roughly independent unit updates, the hidden norm after 64 layers is about…', opts: ['1', '8', '64', '4,096'], a: 1, why: '√64 = 8.' },
      { q: 'What does AttnRes change?', opts: ['Attention over tokens', 'The fixed equal-weight residual sum, replaced by softmax attention over earlier layers', 'The tokenizer', 'The MLP activation'], a: 1, why: 'Each layer gets an input-dependent mix of earlier layers’ outputs.' },
      { q: 'Why group layers into blocks?', opts: ['To reduce the vocabulary', 'To cut memory from O(L·d) to O(N·d) and work with pipeline parallelism', 'To remove normalisation', 'Blocks are required by MoE'], a: 1, why: 'Attending over N block summaries is cheaper than over every layer.' },
    ],
  });
})();
