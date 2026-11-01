(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, rng, randn, barRows, softmax } = LLM.util;
  const H = 32, DH = 128;
  const METHODS = [
    { k: 'MHA', per: () => 2 * H * DH, groups: 32, note: 'every head has its own K and V' },
    { k: 'GQA', per: () => 2 * 8 * DH, groups: 8, note: '4 query heads share each K/V head (G = 8)' },
    { k: 'MQA', per: () => 2 * DH, groups: 1, note: 'one K/V head for all queries' },
    { k: 'MLA', per: () => 512 + 64, groups: 0, note: 'cache a 512-wide latent + 64-wide RoPE key' },
    { k: 'LRKV', per: () => 2 * (DH + H * 8), groups: -1, note: 'shared full-rank K/V + rank-8 per-head residuals' },
  ];

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Query heads sharing fewer and fewer key and value columns, with a falling memory meter' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const m = METHODS[Math.min(step, 4)];
      g.appendChild(s('text', { x: 14, y: 22, 'font-size': 13, text: `${m.k}: ${m.note}`, style: 'font-weight:600' }));
      const n = 16, cw = 18, ox = 30;
      g.appendChild(s('text', { x: ox, y: 46, class: 'lbl', text: '32 query heads (16 drawn)' }));
      for (let i = 0; i < n; i++) g.appendChild(s('rect', { x: ox + i * (cw + 4), y: 54, width: cw, height: 40, rx: 3, fill: 'var(--q)', style: 'opacity:.8' }));
      const y = 130;
      g.appendChild(s('text', { x: ox, y: y - 8, class: 'lbl', text: 'cached per token, per layer' }));
      const col = (x, w, hh, c, op = 0.85) => g.appendChild(s('rect', { x, y, width: w, height: hh, rx: 3, fill: c, style: `opacity:${op}` }));
      if (m.groups > 0) {
        const per = n / Math.max(1, Math.round((m.groups / 32) * n));
        for (let i = 0; i < n; i += per) { const x = ox + i * (cw + 4), w = per * (cw + 4) - 4; col(x, w, 34, 'var(--k)'); col(x, w, 34, 'var(--v)'); g.lastChild.setAttribute('y', y + 38); for (let j = 0; j < per; j++) g.appendChild(s('line', { x1: ox + (i + j) * (cw + 4) + cw / 2, y1: 94, x2: x + w / 2, y2: y, stroke: 'var(--muted)', 'stroke-width': 0.8 })); }
        g.appendChild(s('text', { x: ox + n * (cw + 4) + 6, y: y + 20, class: 'lbl', text: 'K' })); g.appendChild(s('text', { x: ox + n * (cw + 4) + 6, y: y + 58, class: 'lbl', text: 'V' }));
      } else if (m.groups === 0) {
        col(ox, 200, 14, 'var(--kv)'); col(ox + 206, 26, 14, 'var(--k)');
        g.appendChild(s('text', { x: ox, y: y + 30, class: 'lbl', text: 'latent c (512)  +  RoPE key k_R (64)' }));
        for (let i = 0; i < n; i++) { const x = ox + i * (cw + 4); g.appendChild(s('rect', { x, y: y + 44, width: cw, height: 16, rx: 2, fill: 'var(--k)', style: 'opacity:.35' })); g.appendChild(s('rect', { x, y: y + 62, width: cw, height: 16, rx: 2, fill: 'var(--v)', style: 'opacity:.35' })); }
        g.appendChild(s('text', { x: ox, y: y + 94, class: 'lbl', text: 'per-head K and V rebuilt on read by up-projections (not cached)' }));
      } else {
        col(ox, 140, 30, 'var(--k)'); col(ox + 146, 140, 30, 'var(--v)');
        for (let i = 0; i < n; i++) { const x = ox + i * (cw + 4); g.appendChild(s('rect', { x, y: y + 40, width: cw, height: 6, rx: 1, fill: 'var(--k)' })); g.appendChild(s('rect', { x, y: y + 50, width: cw, height: 6, rx: 1, fill: 'var(--v)' })); }
        g.appendChild(s('text', { x: ox, y: y + 74, class: 'lbl', text: 'one shared K/V base + thin per-head low-rank slivers' }));
      }
      // memory meter
      const my = 270;
      g.appendChild(s('text', { x: 14, y: my - 6, 'font-size': 12, text: 'values cached per token per layer (H = 32, d_head = 128)', style: 'font-weight:600' }));
      METHODS.forEach((mm, i) => {
        const v = mm.per(), on = i <= step;
        g.appendChild(s('text', { x: 60, y: my + 16 + i * 19, 'text-anchor': 'end', 'font-size': 11, text: mm.k, style: on ? '' : 'opacity:.3' }));
        g.appendChild(s('rect', { x: 66, y: my + 5 + i * 19, width: (v / 8192) * 400, height: 14, rx: 3, fill: i === step ? 'var(--accent)' : 'var(--kv)', style: on ? '' : 'opacity:.15' }));
        if (on) g.appendChild(s('text', { x: 72 + (v / 8192) * 400, y: my + 16 + i * 19, 'font-size': 10.5, text: `${v.toLocaleString()} (${((v / 8192) * 100).toFixed(1)}%)` }));
      });
    }
    return { go: draw };
  }

  function kvByMethod() {
    const w = widget('KV-cache calculator by method', 'Try it');
    const st = { L: 60, H: 128, dh: 128, G: 8, lat: 512, rope: 64, r: 16, ctx: 32768, b: 8, bp: 2 };
    const out = h('div'); const ro = readout(); const sl = {};
    const mk = (k, l, a, b, step, f) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('L', 'layers', 1, 128, 1); mk('H', 'query heads H', 1, 128, 1); mk('dh', 'd_head', 32, 256, 32); mk('G', 'GQA groups G', 1, 64, 1); mk('lat', 'MLA latent', 64, 1024, 64); mk('rope', 'MLA RoPE dims', 0, 128, 16); mk('r', 'LRKV rank r', 1, 64, 1); mk('ctx', 'context', 1024, 131072, 1024, human); mk('b', 'batch', 1, 64, 1);
    function draw() {
      const per = { MHA: 2 * st.H * st.dh, GQA: 2 * Math.min(st.G, st.H) * st.dh, MQA: 2 * st.dh, MLA: st.lat + st.rope, LRKV: 2 * (st.dh + st.H * st.r) };
      const tot = (k) => per[k] * st.L * st.ctx * st.b * st.bp;
      const max = tot('MHA');
      clear(out).appendChild(barRows(560, Object.keys(per).map((k) => ({ label: k, v: tot(k), text: bytes(tot(k)), color: tot(k) > 80 * 2 ** 30 ? 'var(--fail)' : 'var(--kv)' })), { max, labelW: 60 }));
      ro.set([['MHA per token', bytes(per.MHA * st.L * st.bp)], ['MLA per token', bytes(per.MLA * st.L * st.bp)], ['MLA vs MHA', (per.MHA / per.MLA).toFixed(1) + '× smaller']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), out, ro.el, h('p', { class: 'note-sim' }, 'Defaults are DeepSeek-V2-like (60 layers, 128 heads, latent 512, RoPE key 64). Red bars exceed one 80 GB GPU. LRKV figures follow the per-token formula in the build plan; check the paper for exact layouts.'));
    draw();
    return w.el;
  }

  function absorption() {
    const w = widget('Where RoPE breaks the MLA fold', 'Mechanics', 'Random 2-D toy matrices. The “folded” matrix is what inference would precompute once: W_UQᵀ·R·W_UK. If it changes with position, it cannot be precomputed.');
    const r = rng(7); const M = () => [[randn(r), randn(r)], [randn(r), randn(r)]];
    const WUQ = M(), WUK = M();
    const mm = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((a, x, k) => a + x * B[k][j], 0)));
    const Tm = (A) => A[0].map((_, j) => A.map((rw) => rw[j]));
    const R = (a) => [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
    let mode = 'rope-on-latent', n = 3; const m = 5, th = 0.6;
    const out = h('div', { class: 'w-split' }); const ro = readout();
    function draw() {
      const folded = mode === 'rope-on-latent' ? mm(mm(Tm(WUQ), mm(Tm(R(m * th)), R(n * th))), WUK) : mm(Tm(WUQ), WUK);
      const ref = mode === 'rope-on-latent' ? mm(mm(Tm(WUQ), mm(Tm(R(m * th)), R(0))), WUK) : folded;
      const cell = (v) => h('td', { class: 'num' }, fmt(v, 3));
      clear(out).append(h('div', null, h('div', { class: 'eyebrow' }, `folded matrix for key at position n = ${n}`), h('div', { class: 'tbl-wrap' }, h('table', null, h('tbody', null, folded.map((rw) => h('tr', null, rw.map(cell))))))),
        h('div', { class: 'prose' }, h('p', null, mode === 'rope-on-latent' ? 'RoPE rotates the rebuilt key by R(nθ). That rotation sits between W_UQ and W_UK, so the product changes for every key position: move the slider and watch it change. Folding fails.' : 'Decoupled RoPE: the big content key is never rotated, so W_UQᵀW_UK is one fixed matrix, folded once. Position lives in a small separate key k_R that is rotated and cached beside the latent.')));
      const diff = Math.hypot(...folded.flat().map((x, i) => x - ref.flat()[i]));
      ro.set([['changes with n?', mode === 'rope-on-latent' && diff > 1e-6 ? 'yes: cannot precompute' : 'no: precompute once', mode === 'rope-on-latent' && diff > 1e-6 ? 'var(--fail)' : 'var(--pass)']]);
    }
    const sg = seg([['rope-on-latent', 'RoPE on rebuilt key'], ['decoupled', 'Decoupled RoPE']], mode, (v) => { mode = v; draw(); }, 'Mode');
    const sn = slider({ label: 'key position n', min: 0, max: 20, value: n, oninput: (v) => { n = v; draw(); } });
    w.body.append(sg.el, sn.el, out, ro.el);
    draw();
    return w.el;
  }

  function flashReplay() {
    const w = widget('FlashAttention, one row, tile by tile', 'Try it');
    const r = rng(3); const scores = Array.from({ length: 16 }, () => +(randn(r) * 2).toFixed(2)); const vals = scores.map(() => +(randn(r)).toFixed(2));
    const tile = 4; let k = 0;
    const g = svg(560, 170); const ro = readout();
    function draw() {
      clear(g);
      let mx = -Infinity, l = 0, acc = 0;
      for (let t = 0; t < k; t++) { const blk = scores.slice(t * tile, t * tile + tile), bv = vals.slice(t * tile, t * tile + tile); const nm = Math.max(mx, ...blk); const scale = Math.exp(mx - nm); l = l * scale + blk.reduce((a, x) => a + Math.exp(x - nm), 0); acc = acc * scale + blk.reduce((a, x, i) => a + Math.exp(x - nm) * bv[i], 0); mx = nm; }
      scores.forEach((sc, i) => { const t = Math.floor(i / tile), done = t < k, cur = t === k - 1; g.appendChild(s('rect', { x: 10 + i * 33, y: 20, width: 30, height: 30, rx: 3, fill: done ? mix('var(--q)', 25 + Math.abs(sc) * 15) : 'var(--sunk)', stroke: cur ? 'var(--ink)' : 'none', 'stroke-width': 2 })); g.appendChild(s('text', { x: 25 + i * 33, y: 39, 'text-anchor': 'middle', 'font-size': 9.5, text: sc })); });
      g.appendChild(s('text', { x: 10, y: 14, class: 'lbl', text: 'scores for one query against 16 keys, in tiles of 4 (only one tile in fast memory at a time)' }));
      const full = softmax(scores).reduce((a, p, i) => a + p * vals[i], 0);
      g.appendChild(s('text', { x: 10, y: 80, 'font-size': 12, text: `running max m = ${k ? fmt(mx, 2) : '−∞'}   running sum ℓ = ${fmt(l, 3)}   running output = ${k ? fmt(acc / l, 4) : '—'}` }));
      g.appendChild(s('text', { x: 10, y: 104, 'font-size': 12, text: `exact softmax output (all 16 at once) = ${fmt(full, 4)}` }));
      g.appendChild(s('text', { x: 10, y: 136, class: 'lbl', text: 'When a new tile raises the max, old sums are rescaled by e^(m_old − m_new). After the last tile the result is exact.' }));
      ro.set([['tiles processed', `${k} / 4`], ['matches exact?', k === 4 ? 'yes' : 'not yet', k === 4 ? 'var(--pass)' : 'var(--muted)']]);
    }
    w.body.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => { k = Math.min(4, k + 1); draw(); } }, 'Load next tile'), h('button', { class: 'btn', type: 'button', onclick: () => { k = 0; draw(); } }, 'Reset')), g, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('10', {
    hook: 'At long context, the GPU runs out of memory before it runs out of maths. What do you cut?',
    intro: ['During generation, every past token’s keys and values sit in the KV cache. At 100k tokens and many users, that cache, not the arithmetic, sets how many requests fit on a GPU. The history of attention since 2019 is mostly a history of caching less per token.'],
    hero: {
      steps: [
        { title: 'Multi-head attention', text: 'The 2017 design: every query head has its own key and value head. Full diversity, and the biggest cache: 2 × 32 × 128 = 8,192 numbers per token per layer.' },
        { title: 'Grouped-query attention', text: 'Groups of query heads share one K/V head. With 8 groups the cache is 4× smaller and quality barely moves. Llama 2 70B onwards, Llama 3, Mistral and Qwen use it.', maths: '\\text{cache}=2\\times G\\times d_{head}' },
        { title: 'Multi-query attention', text: 'The extreme: one K/V head for all 32 queries. 32× smaller, but heads lose diversity and quality drops on harder tasks.' },
        { title: 'Multi-head latent attention', text: 'DeepSeek-V2’s idea: compress each token into one small latent vector c and cache only that. Per-head keys and values are rebuilt from c by up-projection matrices when needed.', mech: 'At inference the key up-projection is folded into the query projection, so keys are never rebuilt explicitly. RoPE breaks the fold; the fix is a small decoupled RoPE key cached beside c (see the widget).', maths: 'c^{KV}_t=W^{DKV}h_t,\\quad \\K{k^C_t}=W^{UK}c^{KV}_t,\\quad \\V{v^C_t}=W^{UV}c^{KV}_t' },
        { title: 'Low-rank KV attention', text: 'LRKV (2026) keeps one shared full-rank K/V projection plus thin per-head low-rank residuals, aiming for most of MHA’s diversity at near-MQA cost. It is new: treat its numbers as the authors’ claims.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Comparing the five', body: [LLM.util.table(['Method', 'Cached per token, per layer', 'Trade-off'], (window.PLAN.modules['10'].tables[0] || { rows: [] }).rows)] , widget: kvByMethod },
      { title: 'The RoPE headache', depth: 'mechanics', widget: absorption },
      { title: 'FlashAttention and longer contexts', body: [
        '<b>FlashAttention</b> computes exact attention without writing the n × n score matrix to slow GPU memory. It streams tiles of keys through fast on-chip memory, keeps a running max and sum per query (the online softmax), and recomputes tiles in the backward pass instead of storing them.',
        '<b>Sliding-window attention</b> limits each token to the last w tokens, capping the cache. <b>Attention sinks</b>: models dump spare attention on the first few tokens, so keeping those when evicting the rest keeps generation stable. <b>Context extension</b> stretches RoPE’s frequencies (position interpolation, NTK scaling, YaRN) so a model trained at 8k works at 128k after brief fine-tuning.',
      ], widget: flashReplay },
    ],
    maths: [
      { note: 'MLA with decoupled RoPE (DeepSeek-V2):', tex: 'c^{KV}_t=W^{DKV}h_t,\\quad \\K{k^{C}_{t}}=W^{UK}c^{KV}_t,\\quad \\V{v^{C}_{t}}=W^{UV}c^{KV}_t,\\quad \\K{k^{R}_t}=\\mathrm{RoPE}(W^{KR}h_t),\\quad \\K{k_{t,i}}=\\big[\\K{k^{C}_{t,i}};\\,\\K{k^{R}_t}\\big]' },
      { note: '<b>Why the fold works without RoPE</b>: the score is', tex: '\\Q{q}^{\\top}\\K{k}=(W^{UQ}c^Q)^{\\top}(W^{UK}c^{KV})=c^{Q\\top}\\underbrace{(W^{UQ\\top}W^{UK})}_{\\text{fixed: precompute}}c^{KV}', after: 'With RoPE on the content key, a rotation R(nθ) lands between the two matrices and depends on the key’s position n, so the product can no longer be precomputed.' },
      { note: '<b>Online softmax</b>, merging a new tile with max m′ and sum ℓ′:', tex: 'm_{new}=\\max(m,m\'),\\qquad \\ell_{new}=e^{m-m_{new}}\\ell+e^{m\'-m_{new}}\\ell\'' },
    ],
    leaves: ['Cache sizes ignore the extra compute of MLA’s up-projections and the decoupled RoPE’s attention cost.', 'Quality differences between methods depend on training; a smaller cache is not free.', 'LRKV is a 2026 paper and not yet widely replicated.'],
    quiz: [
      { q: '32 query heads, GQA with 8 groups, d_head 128. Values cached per token per layer?', opts: ['8,192', '2,048', '256', '1,024'], a: 1, why: '2 × 8 × 128 = 2,048, a quarter of MHA’s 8,192.' },
      { q: 'Why does MLA need a decoupled RoPE key?', opts: ['RoPE makes keys too large', 'A position-dependent rotation between W_UQ and W_UK prevents folding them into one precomputed matrix', 'Latents cannot store position', 'FlashAttention requires it'], a: 1, why: 'The fold relies on a fixed product; rotation by nθ changes it for every key.' },
      { q: 'What does FlashAttention avoid?', opts: ['Computing softmax', 'Writing the full n × n score matrix to slow memory', 'Using the KV cache', 'Exact attention'], a: 1, why: 'It tiles the computation through on-chip memory with an online softmax; the result is exact.' },
    ],
  });
})();
