(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, mix, tokColor, rng, randn, softmax, barRows, table } = LLM.util;

  // simulate routing: tokens have a skewed preference; balance loss adds learned bias that evens load
  function route(nTok, E, k, balance, seed = 1, capFactor = 1.25) {
    const r = rng(seed);
    const skew = Array.from({ length: E }, (_, e) => (e < 2 ? 1.6 : 0) + randn(r) * 0.3);
    let bias = new Array(E).fill(0);
    const toks = Array.from({ length: nTok }, () => Array.from({ length: E }, (_, e) => skew[e] + randn(r)));
    const run = () => { const load = new Array(E).fill(0); toks.forEach((lg) => { const sc = lg.map((x, e) => x + bias[e]); const idx = sc.map((x, e) => [x, e]).sort((a, b) => b[0] - a[0]).slice(0, k); idx.forEach(([, e]) => load[e]++); }); return load; };
    if (balance) for (let it = 0; it < 60; it++) { const load = run(); const mean = (nTok * k) / E; bias = bias.map((b, e) => b - 0.02 * (load[e] - mean) / mean * 5); }
    const load = run(); const cap = Math.ceil(((nTok * k) / E) * capFactor);
    return { load, cap, dropped: load.reduce((a, l) => a + Math.max(0, l - cap), 0) };
  }

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'Tokens routed to 2 of 8 experts, with load per expert' }); box.appendChild(g);
    const toks = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
    const r = rng(9);
    const choice = toks.map((_, i) => { const lg = Array.from({ length: 8 }, () => randn(r)); const p = softmax(lg); const idx = p.map((x, e) => [x, e]).sort((a, b) => b[0] - a[0]).slice(0, 2); return { p, idx }; });
    function draw(step) {
      clear(g);
      const ex = (e) => 40 + e * 62;
      for (let e = 0; e < 8; e++) { g.appendChild(s('rect', { x: ex(e), y: 230, width: 52, height: 40, rx: 8, fill: mix('var(--t4)', 18), stroke: 'var(--t4)' })); g.appendChild(s('text', { x: ex(e) + 26, y: 255, 'text-anchor': 'middle', 'font-size': 11, text: 'E' + (e + 1) })); }
      g.appendChild(s('rect', { x: 200, y: 130, width: 160, height: 34, rx: 17, fill: mix('var(--t4)', 35), stroke: 'var(--t4)' }));
      g.appendChild(s('text', { x: 280, y: 152, 'text-anchor': 'middle', 'font-size': 12, text: 'router  g(x) = softmax(W_r x)', style: 'font-weight:600' }));
      const nShow = step === 0 ? 0 : step === 1 ? 1 : 6;
      toks.forEach((t, i) => { g.appendChild(s('rect', { x: 40 + i * 82, y: 40, width: 64, height: 26, rx: 5, fill: mix(tokColor(i), 30), stroke: tokColor(i) })); g.appendChild(s('text', { x: 72 + i * 82, y: 57, 'text-anchor': 'middle', 'font-size': 11.5, text: t })); if (i < nShow) g.appendChild(s('line', { x1: 72 + i * 82, y1: 66, x2: 280, y2: 130, stroke: tokColor(i), 'stroke-width': 1.2 })); });
      const load = new Array(8).fill(0);
      choice.slice(0, nShow).forEach((c, i) => c.idx.forEach(([p, e]) => { load[e]++; g.appendChild(s('line', { x1: 280, y1: 164, x2: ex(e) + 26, y2: 230, stroke: tokColor(i), 'stroke-width': 1 + p * 6, style: 'opacity:.8' })); }));
      if (step >= 1) { const c = choice[0]; g.appendChild(s('text', { x: 380, y: 120, 'font-size': 11, text: `“The” → E${c.idx[0][1] + 1} (${(c.idx[0][0] * 100).toFixed(0)}%), E${c.idx[1][1] + 1} (${(c.idx[1][0] * 100).toFixed(0)}%)` })); }
      if (step >= 2) load.forEach((l, e) => { g.appendChild(s('rect', { x: ex(e) + 6, y: 280, width: 40, height: l * 12, rx: 2, fill: 'var(--t4)' })); g.appendChild(s('text', { x: ex(e) + 26, y: 296 + l * 12, 'text-anchor': 'middle', class: 'lbl', text: l })); });
      if (step === 3) { g.appendChild(s('rect', { x: ex(1) + 2, y: 226, width: 48, height: 48, rx: 9, fill: 'none', stroke: 'var(--fail)', 'stroke-width': 2.5 })); g.appendChild(s('text', { x: 14, y: 346, 'font-size': 12, text: 'Unbalanced: E2 gets most tokens, overflows its capacity and drops the rest. Others sit idle.', style: 'fill:var(--fail)' })); }
      const msg = ['Eight expert feed-forward networks replace one. A router decides which experts see each token.', 'The router scores all 8 experts and keeps the top 2. Their outputs are mixed by the gate weights.', 'Each token uses only 2 of 8 experts: 25% of the expert parameters do work per token.', ''];
      if (msg[step]) g.appendChild(s('text', { x: 14, y: 346, 'font-size': 12, text: msg[step] }));
      if (step === 4) g.appendChild(s('text', { x: 14, y: 346, 'font-size': 12, text: 'A balance loss (or a learned per-expert bias) pushes the router to spread tokens evenly.' }));
    }
    return { go: draw };
  }

  function router() {
    const w = widget('Router playground', 'Try it', 'Simulation of 2,048 tokens with a router that starts biased toward two experts. “Balancing on” adjusts a per-expert bias until loads even out, as in auxiliary-loss-free balancing.');
    const st = { E: 8, k: 2, bal: false, cap: 1.25 };
    const out = h('div'); const ro = readout();
    function draw() {
      const { load, cap, dropped } = route(2048, st.E, st.k, st.bal, 1, st.cap);
      clear(out).appendChild(barRows(560, load.map((l, e) => ({ label: 'expert ' + (e + 1), v: l, text: l + (l > cap ? `  (drops ${l - cap})` : ''), color: l > cap ? 'var(--fail)' : 'var(--t4)' })), { max: Math.max(...load, cap), labelW: 80, rowH: 20 }));
      const mean = (2048 * st.k) / st.E;
      ro.set([['capacity per expert', cap], ['tokens dropped', dropped, dropped ? 'var(--fail)' : 'var(--pass)'], ['max / mean load', fmt(Math.max(...load) / mean, 2)]]);
    }
    const se = slider({ label: 'experts', min: 4, max: 32, value: st.E, oninput: (v) => { st.E = v; draw(); } });
    const sk = slider({ label: 'top-k', min: 1, max: 4, value: st.k, oninput: (v) => { st.k = v; draw(); } });
    const sc = slider({ label: 'capacity factor', min: 1, max: 2, step: 0.05, value: st.cap, fmt: (v) => v.toFixed(2), oninput: (v) => { st.cap = v; draw(); } });
    const sb = seg([[false, 'balancing off'], [true, 'balancing on']], false, (v) => { st.bal = v; draw(); }, 'Balancing');
    w.body.append(h('div', { class: 'ctl-row' }, se.el, sk.el, sc.el, h('div', { class: 'ctl' }, h('label', null, 'balance'), sb.el)), out, ro.el);
    draw();
    return w.el;
  }

  function activeCalc() {
    const w = widget('Total vs active parameters', 'Mechanics', 'Published headline figures; the build plan’s Module 16 script will regenerate these from each model’s config.json.');
    const models = [['Mixtral 8x7B', 46.7, 12.9, '8 experts, top-2'], ['DeepSeek-V3', 671, 37, '256 routed + 1 shared, top-8'], ['Qwen3-235B-A22B', 235, 22, '128 experts, top-8'], ['Kimi Linear (48B-A3B)', 48, 3, 'MoE, from the AttnRes report']];
    const ro = readout();
    const sel = seg(models.map((m, i) => [i, m[0]]), 0, (i) => draw(i), 'Model');
    const out = h('div');
    function draw(i) {
      const [, T, A, lay] = models[i];
      clear(out).appendChild(barRows(560, [{ label: 'total (memory)', v: T, text: T + 'B', color: 'var(--res)' }, { label: 'active (compute)', v: A, text: A + 'B', color: 'var(--t4)' }], { max: T, labelW: 120 }));
      ro.set([['layout', lay], ['active share', ((A / T) * 100).toFixed(1) + '%'], ['BF16 weights to hold', human(T * 2e9) + 'B'], ['FLOPs per token ≈ 2·active', human(2 * A * 1e9)]]);
    }
    w.body.append(sel.el, out, ro.el);
    draw(0);
    return w.el;
  }

  LLM.mod('12', {
    hook: 'How can a model have 600 billion parameters but only use 37 billion per word?',
    intro: ['A mixture-of-experts layer replaces one big feed-forward network with many smaller ones, the experts, and a router that sends each token to a few of them. Total parameters grow, but the compute per token only grows with the experts actually used.'],
    hero: {
      steps: [
        { title: 'Many experts, one router', text: 'Eight expert MLPs sit where one MLP used to. Attention layers stay shared.' },
        { title: 'Top-k routing', text: 'The router is a small linear layer. Softmax over its scores, keep the top 2, and mix those experts’ outputs by their gate weights.', maths: 'y=\\sum_{i\\in\\mathrm{TopK}(g(x),k)} g_i(x)\\,E_i(x)' },
        { title: 'Sparse compute', text: 'Six tokens, two experts each: only a quarter of expert parameters work per token. That is the difference between total and active parameters.' },
        { title: 'The balance problem', text: 'Left alone, the router favours a few experts. They overflow their capacity, extra tokens are dropped (skip the layer), and the other experts barely train.' },
        { title: 'Balancing', text: 'An auxiliary loss penalises uneven load; DeepSeek-V3 instead adds a per-expert bias that is nudged up or down to even out load without an extra loss term.', maths: '\\mathcal{L}_{bal}=\\alpha\\,N\\sum_{i=1}^{N} f_i\\,P_i' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Routing under load', widget: router },
      { title: 'Design choices', depth: 'mechanics', body: [
        '<b>Capacity factor.</b> Each expert accepts at most (tokens × k / experts) × capacity factor tokens per batch; overflow is dropped or rerouted.',
        '<b>Shared and fine-grained experts.</b> DeepSeekMoE splits experts into many small ones (more combinations) and adds always-on shared experts that hold common knowledge.',
        '<b>Expert parallelism.</b> Experts live on different GPUs; each layer needs an all-to-all exchange to send tokens to their experts and back, which is often the bottleneck.',
        '<b>Memory vs compute.</b> Every expert must be in memory even though few run per token, so MoE saves FLOPs, not VRAM.',
      ], widget: activeCalc },
    ],
    maths: [
      { note: 'Gate and output for top-k routing:', tex: 'g(x)=\\mathrm{softmax}(W_r\\,x),\\qquad y=\\sum_{i\\in\\mathrm{TopK}(g(x),\\,k)} g_i(x)\\,E_i(x)' },
      { note: '<b>Switch-style balance loss</b> with N experts, fᵢ the fraction of tokens sent to expert i and Pᵢ its mean router probability. It is minimised when both are uniform at 1/N:', tex: '\\mathcal{L}_{bal}=\\alpha\\,N\\sum_{i=1}^{N} f_i\\,P_i' },
    ],
    leaves: ['The routing simulation uses random logits, not a trained router.', 'Real MoE quality depends on expert count, granularity and training stability tricks (router z-loss, precision).', 'Inference batching interacts with routing: small batches leave many experts idle.'],
    quiz: [
      { q: 'An MoE has 8 experts of 5B each, top-2, plus 6B shared. Active parameters per token?', opts: ['46B', '16B', '11B', '6B'], a: 1, why: '6B shared + 2 × 5B = 16B; total is 46B.' },
      { q: 'Why does MoE not reduce GPU memory needs at inference?', opts: ['Routers are large', 'All experts must be loaded, since any token may need any expert', 'Experts are stored in FP32', 'It does reduce memory'], a: 1, why: 'Compute is sparse, but the weights still have to be resident.' },
      { q: 'What happens to tokens beyond an expert’s capacity?', opts: ['They wait for the next batch', 'They are dropped for that layer (pass through on the residual) or rerouted', 'They go to every expert', 'Training stops'], a: 1, why: 'Dropped tokens skip the expert computation; the residual connection carries them forward.' },
    ],
  });
})();
