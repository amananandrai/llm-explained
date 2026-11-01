(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, barRows } = LLM.util;
  const DEV = ['var(--t0)', 'var(--t1)', 'var(--t2)', 'var(--t4)'];

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'A model sliced across GPUs three ways, then ZeRO sharding shrinking per-GPU memory' }); box.appendChild(g);
    const L = 8, C = 8;
    function model(x, y, cw, colorOf, label) {
      for (let l = 0; l < L; l++) for (let c = 0; c < C; c++) g.appendChild(s('rect', { x: x + c * cw, y: y + l * cw, width: cw - 1.5, height: cw - 1.5, rx: 1.5, fill: colorOf(l, c), style: 'opacity:.8' }));
      if (label) g.appendChild(s('text', { x, y: y - 6, class: 'lbl', text: label }));
    }
    function zeroBars(stage) {
      const P = 1; const N = 4;
      const rows = [['weights (bf16)', 2, stage >= 3], ['gradients (bf16)', 2, stage >= 2], ['optimiser: fp32 master, m, v', 12, stage >= 1]];
      let y = 70;
      g.appendChild(s('text', { x: 14, y: 50, 'font-size': 12, text: `bytes per parameter on each of 4 GPUs: ${['no ZeRO', 'ZeRO-1', 'ZeRO-2', 'ZeRO-3'][stage]}`, style: 'font-weight:600' }));
      let tot = 0;
      rows.forEach(([lab, b, sh]) => { const v = sh ? b / N : b; tot += v; g.appendChild(s('text', { x: 200, y: y + 16, 'text-anchor': 'end', 'font-size': 11.5, text: lab })); g.appendChild(s('rect', { x: 206, y: y + 2, width: 12 * 25, height: 20, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: 206, y: y + 2, width: v * 25, height: 20, rx: 3, fill: sh ? 'var(--pass)' : 'var(--res)' })); g.appendChild(s('text', { x: 212 + v * 25, y: y + 16, 'font-size': 11, text: v + ' B' + (sh ? ' (sharded ÷4)' : '') })); y += 30; });
      g.appendChild(s('text', { x: 14, y: y + 26, 'font-size': 22, text: tot + ' bytes / param', style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: 14, y: y + 48, class: 'lbl', text: `For a 7B model: ${bytes(tot * 7e9)} per GPU before activations.` }));
    }
    function draw(step) {
      clear(g);
      const titles = ['Where training memory goes', 'Data parallel: a full copy per GPU, different batches', 'ZeRO shards optimiser states, then gradients, then weights', 'Tensor parallel: split every matrix by columns', 'Pipeline parallel: split the stack by layers', '3-D parallelism: all three at once'];
      g.appendChild(s('text', { x: 14, y: 22, 'font-size': 13, text: titles[step], style: 'font-weight:600' }));
      if (step === 0) zeroBars(0);
      if (step === 1) for (let d = 0; d < 4; d++) model(20 + d * 136, 70, 14, () => DEV[d], 'GPU ' + (d + 1) + ': all layers');
      if (step === 2) { zeroBars(3); }
      if (step === 3) { model(150, 60, 30, (l, c) => DEV[Math.floor(c / 2)], 'column slices → GPUs 1–4 (all-reduce after each layer)'); }
      if (step === 4) { model(150, 60, 30, (l) => DEV[Math.floor(l / 2)], 'layers 1–2 → GPU 1, 3–4 → GPU 2, …'); }
      if (step === 5) { [0, 1].forEach((rep) => model(40 + rep * 260, 70, 26, (l, c) => mix(DEV[Math.floor(c / 4) + 2 * Math.floor(l / 4)], rep ? 60 : 100), `replica ${rep + 1}: TP=2 × PP=2`)); g.appendChild(s('text', { x: 14, y: 320, class: 'lbl', text: '8 GPUs = DP 2 × TP 2 × PP 2. Tensor parallel inside a node (fast links), pipeline across nodes.' })); }
    }
    let cur = 0, timer;
    return { go(i) { clearInterval(timer); cur = i; if (i === 2 && !LLM.util.reduced()) { let st = 0; clear(g); draw(2); g.lastChild; const redo = () => { clear(g); g.appendChild(s('text', { x: 14, y: 22, 'font-size': 13, text: 'ZeRO shards optimiser states, then gradients, then weights', style: 'font-weight:600' })); zeroBars(st); }; redo(); timer = setInterval(() => { st++; if (st > 3) return clearInterval(timer); redo(); }, 900); } else draw(i); } };
  }

  function zeroCalc() {
    const w = widget('ZeRO memory calculator', 'Try it');
    const st = { P: 70, N: 64, stage: 3 };
    const ro = readout(); const out = h('div');
    const sp = slider({ label: 'parameters (B)', min: 1, max: 1000, value: st.P, oninput: (v) => { st.P = v; draw(); } });
    const sn = slider({ label: 'data-parallel GPUs N_d', min: 1, max: 1024, value: st.N, oninput: (v) => { st.N = v; draw(); } });
    const sg = seg([[0, 'none'], [1, 'ZeRO-1'], [2, 'ZeRO-2'], [3, 'ZeRO-3']], 3, (v) => { st.stage = v; draw(); }, 'Stage');
    function draw() {
      const Ps = st.P * 1e9, N = st.N;
      const per = [16 * Ps, 4 * Ps + (12 * Ps) / N, 2 * Ps + (14 * Ps) / N, (16 * Ps) / N];
      clear(out).appendChild(barRows(560, ['no ZeRO', 'ZeRO-1', 'ZeRO-2', 'ZeRO-3'].map((l, i) => ({ label: l, v: per[i], text: bytes(per[i]), color: i === st.stage ? (per[i] > 80 * 2 ** 30 ? 'var(--fail)' : 'var(--pass)') : 'var(--res)' })), { max: per[0], labelW: 80 }));
      ro.set([['model states per GPU', bytes(per[st.stage])], ['fits 80 GB (before activations)?', per[st.stage] < 80 * 2 ** 30 ? 'yes' : 'no', per[st.stage] < 80 * 2 ** 30 ? 'var(--pass)' : 'var(--fail)']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, sp.el, sn.el, h('div', { class: 'ctl' }, h('label', null, 'stage'), sg.el)), out, ro.el, h('p', { class: 'note-sim' }, 'Mixed-precision Adam: 2 B weights + 2 B gradients + 12 B fp32 master copy, momentum and variance = 16 B/param. Activations come on top.'));
    draw();
    return w.el;
  }

  function pipeline() {
    const w = widget('Pipeline schedule and the bubble', 'Try it');
    const st = { p: 4, m: 4 };
    const g = svg(560, 200); const ro = readout();
    function draw() {
      clear(g);
      const { p, m } = st, T = 2 * (m + p - 1), cw = Math.min(26, 520 / T), ch = 30;
      for (let d = 0; d < p; d++) {
        g.appendChild(s('text', { x: 8, y: 30 + d * (ch + 6) + 19, class: 'lbl', text: 'GPU ' + (d + 1) }));
        for (let t = 0; t < T; t++) {
          let lab = null, fill = 'var(--sunk)';
          const f = t - d, b = t - (m + p - 1) - (p - 1 - d);
          if (f >= 0 && f < m) { lab = 'F' + (f + 1); fill = mix(DEV[d % 4], 55); }
          else if (b >= 0 && b < m) { lab = 'B' + (b + 1); fill = mix(DEV[d % 4], 95); }
          g.appendChild(s('rect', { x: 50 + t * cw, y: 30 + d * (ch + 6), width: cw - 2, height: ch, rx: 3, fill }));
          if (lab && cw > 18) g.appendChild(s('text', { x: 50 + t * cw + cw / 2 - 1, y: 30 + d * (ch + 6) + 19, 'text-anchor': 'middle', 'font-size': 9, text: lab, style: 'fill:var(--surface)' }));
        }
      }
      g.appendChild(s('text', { x: 50, y: 18, class: 'lbl', text: 'GPipe-style: all forwards (F), then all backwards (B). Grey = idle bubble.' }));
      ro.set([['bubble fraction (p−1)/(m+p−1)', ((p - 1) / (m + p - 1) * 100).toFixed(1) + '%', (p - 1) / (m + p - 1) > 0.3 ? 'var(--fail)' : 'var(--pass)']]);
    }
    const sp = slider({ label: 'pipeline stages p', min: 2, max: 8, value: st.p, oninput: (v) => { st.p = v; draw(); } });
    const sm = slider({ label: 'micro-batches m', min: 1, max: 16, value: st.m, oninput: (v) => { st.m = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, sp.el, sm.el), g, ro.el, h('p', { class: 'note-sim' }, '1F1B schedules interleave one forward and one backward per step after warm-up; the bubble is the same but far fewer activations are held at once.'));
    draw();
    return w.el;
  }

  function planner() {
    const w = widget('Parallelism planner', 'Mechanics', 'Rule-of-thumb planner: tensor parallel up to the GPUs in one node, pipeline until model states fit with ZeRO-1, data parallel with the rest. Real planners also model activations, network and MFU.');
    const st = { P: 70, G: 256, node: 8 };
    const ro = readout();
    function draw() {
      const Ps = st.P * 1e9, budget = 70 * 2 ** 30;
      let best = null;
      for (let tp = 1; tp <= st.node; tp *= 2) for (let pp = 1; pp <= 64; pp *= 2) {
        if (st.G % (tp * pp)) continue; const dp = st.G / (tp * pp);
        const mem = (4 * Ps + (12 * Ps) / dp) / (tp * pp);
        if (mem < budget) { const score = tp * 1.0 + pp * 1.5; if (!best || score < best.score) best = { tp, pp, dp, mem, score }; }
      }
      ro.set(best ? [['tensor parallel', best.tp], ['pipeline stages', best.pp], ['data parallel', best.dp], ['model states per GPU', bytes(best.mem)]] : [['result', 'no layout fits: add GPUs or use ZeRO-3 / offload', 'var(--fail)']]);
    }
    const sp = slider({ label: 'parameters (B)', min: 1, max: 1000, value: st.P, oninput: (v) => { st.P = v; draw(); } });
    const sg = slider({ label: 'GPUs', min: 8, max: 4096, step: 8, value: st.G, oninput: (v) => { st.G = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, sp.el, sg.el), ro.el);
    draw();
    return w.el;
  }

  LLM.mod('13', {
    hook: 'A 70B model needs over a terabyte of memory to train. No GPU has that. Now what?',
    intro: ['Training memory is not just the weights. With Adam in mixed precision each parameter needs about 16 bytes before activations, so a 70B model needs about 1.1 TB. Training spreads that across hundreds of GPUs by copying, slicing and sharding the model, and the trick is to keep the GPUs computing while they talk.'],
    hero: {
      steps: [
        { title: '16 bytes per parameter', text: 'Weights and gradients in 16-bit (2 + 2 bytes), plus a 32-bit master copy and Adam’s two moment estimates (4 + 4 + 4 bytes).' },
        { title: 'Data parallelism', text: 'Every GPU holds the whole model and processes a different slice of the batch. After the backward pass an all-reduce averages gradients so every copy takes the same step.', mech: 'All-reduce = reduce-scatter + all-gather; each GPU sends and receives about 2× the gradient size.' },
        { title: 'ZeRO: stop storing copies', text: 'Data parallel stores the same optimiser state N times. ZeRO-1 shards optimiser states across GPUs, ZeRO-2 also gradients, ZeRO-3 (and PyTorch FSDP) also the weights, gathering each layer just before it is used.' },
        { title: 'Tensor parallelism', text: 'Split each weight matrix across GPUs, so each computes part of every layer. It needs fast links (NVLink) because GPUs exchange partial results inside every layer.' },
        { title: 'Pipeline parallelism', text: 'Put different layers on different GPUs and pass activations along. Micro-batches keep stages busy, but the start and end of each batch leave idle time: the bubble.', maths: '\\text{bubble}=\\frac{p-1}{m+p-1}' },
        { title: 'Combine them', text: 'Large runs use 3-D (or 4-D, adding sequence/context or expert parallelism) layouts: tensor parallel inside a node, pipeline across nodes, data parallel over replicas.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Sharding with ZeRO', widget: zeroCalc },
      { title: 'Pipelines', depth: 'mechanics', widget: pipeline },
      { title: 'Everything else that keeps GPUs busy', depth: 'mechanics', body: [
        '<b>Collectives.</b> All-reduce (sum and share), all-gather (everyone gets all shards), reduce-scatter (sum, keep one shard), all-to-all (each sends a different piece to each, used by MoE expert parallelism).',
        '<b>Sequence and context parallelism</b> split long sequences across GPUs; ring attention passes key/value blocks around a ring so each GPU sees every block.',
        '<b>Activation checkpointing</b> stores only some activations and recomputes the rest in the backward pass. <b>ZeRO-Offload</b> moves optimiser states to CPU memory. <b>FP8 training</b> halves matmul memory traffic again. <b>FlashAttention</b> avoids storing attention matrices.',
        '<b>Overlap</b> communication with computation (prefetch the next layer’s shards during this layer’s maths). The headline metric is <b>MFU</b>, model FLOPs utilisation: useful FLOPs achieved ÷ the hardware’s peak. 40–55% is good at scale.',
      ], widget: planner },
    ],
    maths: [
      { note: 'Per-GPU model-state memory for Ψ parameters across N_d data-parallel GPUs (bytes):', tex: 'M_{\\text{ZeRO-1}}=4\\Psi+\\frac{12\\Psi}{N_d},\\quad M_{\\text{ZeRO-2}}=2\\Psi+\\frac{14\\Psi}{N_d},\\quad M_{\\text{ZeRO-3}}=\\frac{16\\Psi}{N_d}' },
      { note: 'Pipeline bubble with p stages and m micro-batches, and MFU:', tex: '\\text{bubble}=\\frac{p-1}{m+p-1},\\qquad \\mathrm{MFU}=\\frac{6\\,N\\,\\text{tokens/s}}{\\text{peak FLOP/s}}' },
    ],
    leaves: ['Activation memory, often the largest term at long sequence lengths, is left out of the calculators.', 'Real schedules (interleaved 1F1B, zero-bubble) and network topology change the numbers a lot.', 'The planner is a heuristic, not an optimiser.'],
    quiz: [
      { q: 'With ZeRO-3 on 64 GPUs, model-state memory per GPU for a 70B model is about…', opts: ['1.1 TB', '17.5 GB', '70 GB', '4.4 GB'], a: 1, why: '16 × 70e9 / 64 = 17.5e9 bytes ≈ 16.3 GiB.' },
      { q: '4 pipeline stages, 12 micro-batches. Bubble fraction?', opts: ['25%', '20%', '33%', '8%'], a: 1, why: '(4 − 1)/(12 + 4 − 1) = 3/15 = 20%.' },
      { q: 'Why keep tensor parallelism inside one node?', opts: ['It needs less memory', 'It communicates inside every layer, so it needs the fastest links', 'It cannot span nodes by definition', 'It avoids the bubble'], a: 1, why: 'Per-layer all-reduces are latency- and bandwidth-sensitive; NVLink inside a node is much faster than the network between nodes.' },
    ],
  });
})();
