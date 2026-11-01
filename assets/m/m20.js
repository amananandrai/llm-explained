(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, rng, randn, lineChart, barRows, checklist } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'A frozen weight matrix with two thin trainable adapter strips whose product adds onto it' }); box.appendChild(g);
    let r = rng(20);
    const cell = (x, y, w, hh, fill, op = 1) => g.appendChild(s('rect', { x, y, width: w, height: hh, rx: 1.5, fill, style: `opacity:${op}` }));
    function draw(step) {
      clear(g); r = rng(20);
      const n = 12, cs = 15, ox = 40, oy = 50;
      g.appendChild(s('text', { x: 14, y: 24, 'font-size': 12.5, text: ['Full fine-tuning: every weight trains', 'LoRA: freeze W, add two thin matrices', 'Their product BA is a low-rank update', 'h = W₀x + (α/r)·BAx', 'QLoRA: W₀ in 4-bit blocks, adapters in 16-bit'][step], style: 'font-weight:600' }));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = randn(r);
        const fill = step === 0 ? mix('var(--t3)', 30 + Math.abs(v) * 30) : step === 4 ? mix('var(--res)', 15 + Math.round(Math.abs(v) * 2) * 20) : mix('var(--res)', 20 + Math.abs(v) * 25);
        cell(ox + j * cs, oy + i * cs, cs - 1.5, cs - 1.5, fill);
      }
      g.appendChild(s('text', { x: ox, y: oy + n * cs + 16, class: 'lbl', text: step === 0 ? 'W: d × k, all trainable (pink)' : step === 4 ? 'W₀ frozen, NF4: 16 levels per block' : 'W₀ frozen (grey)' }));
      if (step >= 1) {
        const bx = 260; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) cell(bx + j * cs, oy + i * cs, cs - 1.5, cs - 1.5, mix('var(--t3)', 55 + randn(r) * 15));
        g.appendChild(s('text', { x: bx, y: oy - 8, 'font-size': 11, text: 'B (d × r)', style: 'fill:var(--t3)' }));
        const ax = 310; for (let i = 0; i < 2; i++) for (let j = 0; j < n; j++) cell(ax + j * cs, oy + i * cs, cs - 1.5, cs - 1.5, mix('var(--t3)', 55 + randn(r) * 15));
        g.appendChild(s('text', { x: ax, y: oy - 8, 'font-size': 11, text: 'A (r × k), r = 2', style: 'fill:var(--t3)' }));
      }
      if (step >= 2) { const gx = 310, gy = 100; for (let i = 0; i < 8; i++) for (let j = 0; j < n; j++) cell(gx + j * cs, gy + i * cs, cs - 1.5, cs - 1.5, 'var(--t3)', 0.12 + 0.18 * Math.abs(Math.sin(i + j * 0.7))); g.appendChild(s('text', { x: gx, y: gy + 8 * cs + 14, class: 'lbl', text: 'ΔW = BA (never stored during training)' })); }
      const d = 4096, k = 4096, rr = 16;
      g.appendChild(s('text', { x: 14, y: 300, 'font-size': 12, text: `For one 4096 × 4096 matrix: full = ${human(d * k)} trainable; LoRA r = 16: ${human(rr * (d + k))} (${((rr * (d + k)) / (d * k) * 100).toFixed(2)}%)` }));
      if (step === 3) g.appendChild(s('text', { x: 14, y: 322, 'font-size': 12, text: 'After training, BA can be merged into W₀: zero extra latency at inference.' }));
      if (step === 4) g.appendChild(s('text', { x: 14, y: 322, 'font-size': 12, text: 'Gradients flow through the dequantised W₀ into A and B only. A 65B model fine-tunes on one 48 GB GPU.' }));
    }
    return { go: draw };
  }

  function rankSlider() {
    const w = widget('LoRA rank and target modules', 'Try it', 'Dimensions of Llama 3 8B (d = 4096, KV width 1024, MLP width 14336, 32 layers).');
    const mods = { q_proj: [4096, 4096], k_proj: [4096, 1024], v_proj: [4096, 1024], o_proj: [4096, 4096], gate_proj: [4096, 14336], up_proj: [4096, 14336], down_proj: [14336, 4096] };
    let on = ['q_proj', 'v_proj'];
    const ro = readout(); const sr = slider({ label: 'rank r', min: 1, max: 256, value: 16, oninput: draw });
    const box = h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    Object.keys(mods).forEach((m) => { const id = 'lm-' + m; box.appendChild(h('span', null, h('input', { type: 'checkbox', id, checked: on.includes(m), onchange: (e) => { on = e.target.checked ? on.concat(m) : on.filter((x) => x !== m); draw(); } }), h('label', { for: id, class: 'mono', style: { marginLeft: '4px' } }, m))); });
    function draw() {
      const per = on.reduce((a, m) => a + sr.value * (mods[m][0] + mods[m][1]), 0) * 32;
      ro.set([['trainable parameters', human(per)], ['share of 8.03B', ((per / 8.03e9) * 100).toFixed(3) + '%'], ['adapter file (BF16)', bytes(per * 2)]]);
    }
    w.body.append(sr.el, box, ro.el);
    draw();
    return w.el;
  }

  function lowRank() {
    const w = widget('Why a low rank is often enough', 'Mechanics', 'A 64 × 64 “true update” built with rank 4 plus small noise. The best rank-r approximation is found by power iteration (truncated SVD) in your browser.');
    const r = rng(2), n = 64;
    const U = Array.from({ length: 4 }, () => Array.from({ length: n }, () => randn(r))), V = Array.from({ length: 4 }, () => Array.from({ length: n }, () => randn(r)));
    const S = [8, 5, 3, 2];
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => U.reduce((a, u, k) => a + S[k] * u[i] * V[k][j], 0) / 8 + randn(r) * 0.15));
    const tot = M.flat().reduce((a, x) => a + x * x, 0);
    const errs = []; let R = M.map((rw) => rw.slice());
    for (let k = 1; k <= 12; k++) {
      let v = Array.from({ length: n }, () => 1); for (let it = 0; it < 40; it++) { const u = R.map((rw) => rw.reduce((a, x, j) => a + x * v[j], 0)); const nv = Array.from({ length: n }, (_, j) => R.reduce((a, rw, i) => a + rw[j] * u[i], 0)); const nn = Math.hypot(...nv); v = nv.map((x) => x / nn); }
      const u = R.map((rw) => rw.reduce((a, x, j) => a + x * v[j], 0));
      R = R.map((rw, i) => rw.map((x, j) => x - u[i] * v[j]));
      errs.push([k, R.flat().reduce((a, x) => a + x * x, 0) / tot]);
    }
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const sl = slider({ label: 'rank r', min: 1, max: 12, value: 4, oninput: draw });
    function draw() { const e = errs[sl.value - 1][1]; ch.draw([{ pts: errs, color: 'var(--t3)', dots: [errs[sl.value - 1]] }], { ymin: 0, ymax: 1, xlabel: 'rank', ylabel: 'unexplained share of the update' }); ro.set([['explained', ((1 - e) * 100).toFixed(1) + '%'], ['parameters vs full', ((sl.value * 128) / 4096 * 100).toFixed(1) + '%']]); }
    w.body.append(sl.el, ch.el, ro.el);
    draw();
    return w.el;
  }

  function memCalc() {
    const w = widget('GPU memory: full vs LoRA vs QLoRA', 'Try it', 'Model states only (no activations). Full: 16 B/param with Adam in mixed precision. LoRA: 2 B/param frozen BF16 base + 16 B per adapter parameter. QLoRA: ≈0.55 B/param NF4 base with double-quantised scales + adapters.');
    const st = { P: 8, frac: 0.5 };
    const out = h('div'); const ro = readout();
    const sp = slider({ label: 'model parameters (B)', min: 1, max: 405, value: st.P, oninput: (v) => { st.P = v; draw(); } });
    const sa = slider({ label: 'adapter size (% of params)', min: 0.05, max: 3, step: 0.05, value: st.frac, fmt: (v) => v.toFixed(2) + '%', oninput: (v) => { st.frac = v; draw(); } });
    function draw() {
      const P = st.P * 1e9, A = P * st.frac / 100;
      const rows = [['full fine-tune', 16 * P], ['LoRA', 2 * P + 16 * A], ['QLoRA', 0.55 * P + 16 * A]];
      clear(out).appendChild(barRows(560, rows.map(([l, v]) => ({ label: l, v, text: bytes(v), color: v < 24 * 2 ** 30 ? 'var(--pass)' : v < 80 * 2 ** 30 ? 'var(--warn)' : 'var(--fail)' })), { max: rows[0][1], labelW: 110 }));
      ro.set([['fits 24 GB', rows.filter((r2) => r2[1] < 24 * 2 ** 30).map((r2) => r2[0]).join(', ') || 'none'], ['fits 80 GB', rows.filter((r2) => r2[1] < 80 * 2 ** 30).map((r2) => r2[0]).join(', ') || 'none']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, sp.el, sa.el), out, ro.el);
    draw();
    return w.el;
  }

  function whenTo() {
    const w = widget('Prompt, retrieve or fine-tune?', 'Try it');
    const qs = [['The model needs facts that change weekly or are private', 'rag'], ['You need a consistent output format or style across thousands of calls', 'ft'], ['A few examples in the prompt already work', 'prompt'], ['You must cite sources for every answer', 'rag'], ['You need a smaller, cheaper model to match a big one on one task', 'ft'], ['Requirements are still changing every day', 'prompt']];
    const ro = readout();
    const ck = checklist(qs.map(([l]) => ({ label: l })), draw);
    function draw(stt = ck.state) { const sc = { prompt: 0, rag: 0, ft: 0 }; stt.forEach((v, i) => v && sc[qs[i][1]]++); const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]; ro.set([['prompting', sc.prompt], ['retrieval (Part 5)', sc.rag], ['fine-tuning', sc.ft], ['start with', best[1] ? { prompt: 'better prompts', rag: 'RAG', ft: 'fine-tuning (LoRA first)' }[best[0]] : 'tick what applies']]); }
    w.body.append(ck.el, ro.el, h('p', { class: 'note-sim' }, 'Rule of thumb: fine-tuning teaches behaviour and format; retrieval supplies knowledge. They combine well.'));
    draw();
    return w.el;
  }

  LLM.mod('20', {
    hook: 'Can you teach an 8-billion-parameter model a new skill by training 0.1% of it?',
    intro: ['Fine-tuning continues training on your own examples. Updating every weight is expensive: Adam needs about 16 bytes per parameter. Parameter-efficient methods freeze the model and train a small add-on instead. LoRA, the most popular, learns a low-rank update to chosen weight matrices; QLoRA does the same on top of a 4-bit base model.'],
    hero: {
      steps: [
        { title: 'Full fine-tuning', text: 'Every weight gets a gradient and two Adam moments. An 8B model needs about 128 GB of model states before activations.' },
        { title: 'Freeze and add', text: 'LoRA freezes the original W₀ and adds two thin matrices, B and A, with a small inner rank r. Only they train.' },
        { title: 'A low-rank update', text: 'Their product BA has the full shape of W but only r·(d + k) parameters. Fine-tuning updates tend to have low intrinsic rank, so this loses little.' },
        { title: 'Scale and merge', text: 'The update is scaled by α/r. B starts at zero so training begins exactly at the base model. After training, BA can be added into W₀ for free inference, or kept separate and swapped per task.', maths: 'h=W_0x+\\frac{\\alpha}{r}\\,BAx' },
        { title: 'QLoRA', text: 'Store the frozen base in 4-bit NF4 with double-quantised scales, page optimiser states to CPU when memory spikes, and keep the adapters in 16-bit.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Choosing rank, alpha and targets', body: ['Common starting points: r = 8–64, α = r or 2r, applied to all attention and MLP projections. Higher rank helps for large domain shifts; more target modules usually beat higher rank on fewer modules. <b>DoRA</b> splits each weight into magnitude and direction and applies LoRA to the direction. <b>Adapters</b> and <b>prefix tuning</b> are earlier PEFT methods that insert small layers or learned prefix vectors.'], widget: rankSlider },
      { title: 'Low rank in action', depth: 'mechanics', widget: lowRank },
      { title: 'Memory', widget: memCalc },
      { title: 'Doing it well', body: [
        '<b>Data</b>: a few thousand clean, diverse examples in the model’s chat template beat a large noisy set. Mask the prompt so loss is computed on responses only.',
        '<b>Catastrophic forgetting</b>: track a held-out general benchmark alongside your task metric; LoRA forgets less than full fine-tuning, but not nothing.',
        '<b>Merging</b>: adapters merge into the base; whole fine-tunes of the same base can be averaged or combined with task-vector methods. <b>Preference tuning</b> (DPO, Module 8) is a natural next step after supervised fine-tuning.',
      ], widget: whenTo },
    ],
    maths: [
      { note: 'LoRA update with B initialised to zero:', tex: 'h=W_0x+\\Delta W x=W_0x+\\frac{\\alpha}{r}\\,BAx,\\qquad B\\in\\mathbb{R}^{d\\times r},\\;A\\in\\mathbb{R}^{r\\times k},\\;r\\ll\\min(d,k)' },
      { note: 'Trainable parameters and memory, per adapted matrix and in total:', tex: 'd\\cdot k\\;\\to\\;r(d+k),\\qquad M_{\\text{full}}\\approx 16N,\\qquad M_{\\text{QLoRA}}\\approx 0.5N+16N_{\\text{adapter}}' },
    ],
    leaves: ['Memory figures exclude activations, which dominate at long sequence lengths and big batches.', 'The plan’s before/after output demo needs an adapter trained for the site; it is not included.', 'Fine-tuning runs on GPUs, not in the browser; the build plan points to free cloud notebooks.'],
    quiz: [
      { q: 'LoRA with r = 8 on a 4096 × 4096 matrix trains how many parameters?', opts: ['65,536', '32,768', '16.8M', '4,096'], a: 0, why: '8 × (4096 + 4096) = 65,536, about 0.4% of 16.8M.' },
      { q: 'Why is B initialised to zero?', opts: ['To save memory', 'So BA = 0 and training starts exactly from the base model', 'Because A is random', 'It is required by QLoRA only'], a: 1, why: 'The model’s initial outputs are unchanged; the update grows from nothing.' },
      { q: 'What does QLoRA keep in 4-bit?', opts: ['The adapters', 'The frozen base weights', 'The gradients', 'The optimiser states'], a: 1, why: 'The base is NF4; adapters and their optimiser states stay in higher precision.' },
    ],
  });
})();
