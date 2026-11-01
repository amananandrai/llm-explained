(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, tokColor, lineChart } = LLM.util;
  const GB = 2 ** 30;
  // Scenario: 8B model in BF16 (16 GB) on an 80 GB GPU; 32 layers, d_head 128; max context 8k, average use 3k; 1k shared system prompt.
  const STAGES = [
    { t: 'Baseline: MHA (32 KV heads), BF16, each user reserves the full 8k', kvh: 32, bp: 2, tok: 8192 },
    { t: 'Architecture: GQA with 8 KV heads', kvh: 8, bp: 2, tok: 8192 },
    { t: 'Shrinking: FP8 cache (1 byte per value)', kvh: 8, bp: 1, tok: 8192 },
    { t: 'System: PagedAttention allocates only the 3k tokens in use', kvh: 8, bp: 1, tok: 3072 },
    { t: 'System: prefix caching stores the 1k shared prompt once', kvh: 8, bp: 1, tok: 2048, shared: 1024 },
  ];
  const perUser = (st) => 2 * 32 * st.kvh * 128 * st.bp * st.tok;
  const users = (st) => Math.floor((64 * GB - (st.shared ? 2 * 32 * st.kvh * 128 * st.bp * st.shared : 0)) / perUser(st));

  function heroInit(box) {
    const g = svg(560, 330, { 'aria-label': 'GPU memory filling with KV cache blocks and three families of tricks freeing it' }); box.appendChild(g);
    function draw(i) {
      clear(g);
      const st = STAGES[i], u = users(st);
      g.appendChild(s('text', { x: 12, y: 22, 'font-size': 12.5, text: st.t, style: 'font-weight:600' }));
      const W = 520, x0 = 12, y0 = 40;
      g.appendChild(s('rect', { x: x0, y: y0, width: W, height: 150, rx: 8, fill: 'var(--sunk)' }));
      g.appendChild(s('rect', { x: x0, y: y0, width: W * (16 / 80), height: 150, rx: 8, fill: 'var(--res)' }));
      g.appendChild(s('text', { x: x0 + 10, y: y0 + 80, 'font-size': 11, text: 'weights 16 GB', style: 'fill:var(--surface)' }));
      const free = W * (64 / 80), bx = x0 + W * (16 / 80) + 4, cols = 40, rows = 10, cw = (free - 8) / cols, ch = 140 / rows;
      const cells = cols * rows, usedFrac = Math.min(1, (u * perUser(st)) / (64 * GB));
      const per = Math.max(1, Math.floor(cells / Math.max(1, u)));
      for (let c = 0; c < cells; c++) {
        const user = Math.floor(c / per); if (user >= Math.min(u, 400)) break;
        const within = c % per, reserved = i < 3 && within >= per * (3072 / 8192);
        const shared = st.shared && within < per * 0.33;
        g.appendChild(s('rect', { x: bx + (c % cols) * cw, y: y0 + 5 + Math.floor(c / cols) * ch, width: cw - 1, height: ch - 1, rx: 1, fill: shared ? 'var(--accent)' : reserved ? 'var(--surface)' : tokColor(user), stroke: reserved ? tokColor(user) : 'none', style: reserved ? 'opacity:.5' : 'opacity:.85' }));
      }
      g.appendChild(s('text', { x: x0, y: y0 + 172, class: 'lbl', text: i < 3 ? 'outlined cells = memory reserved but never used (fragmentation)' : i === 4 ? 'shared prompt blocks (pink) are stored once, referenced by every user' : 'blocks are allocated on demand, 16 tokens at a time' }));
      g.appendChild(s('text', { x: x0, y: 250, 'font-size': 28, text: u.toLocaleString(), style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: x0 + 12 + String(u.toLocaleString()).length * 17, y: 250, 'font-size': 13, text: `concurrent users fit   ·   ${bytes(perUser(st))} each` }));
      g.appendChild(s('text', { x: x0, y: 276, class: 'lbl', text: `Llama-3-8B-shaped model, 32 layers, d_head 128, 64 GB free for cache. ${usedFrac < 0 ? '' : ''}` }));
    }
    return { go: draw };
  }

  function fitCalc() {
    const w = widget('Will this context fit?', 'Try it');
    const st = { P: 8, wb: 16, L: 32, kvh: 8, dh: 128, kvb: 16, ctx: 32768, avg: 8000, pref: 2000, gpu: 80, paged: true };
    const sl = {}; const ro = readout(); const bar = h('div');
    const mk = (k, l, a, b, step, f) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('P', 'parameters (B)', 1, 405, 1); mk('wb', 'weight bits', 2, 16, 1); mk('L', 'layers', 1, 128, 1); mk('kvh', 'KV heads', 1, 128, 1); mk('dh', 'd_head', 64, 256, 64); mk('kvb', 'cache bits', 3, 16, 1); mk('ctx', 'max context', 1024, 131072, 1024, human); mk('avg', 'average tokens used', 256, 131072, 256, human); mk('pref', 'shared prefix tokens', 0, 16384, 256, human); mk('gpu', 'GPU memory (GB)', 16, 640, 8);
    const pg = seg([[true, 'paged'], [false, 'contiguous']], true, (v) => { st.paged = v; draw(); }, 'Allocation');
    function draw() {
      const weights = st.P * 1e9 * st.wb / 8, perTok = 2 * st.L * st.kvh * st.dh * st.kvb / 8;
      const free = st.gpu * GB * 0.9 - weights;
      const sharedB = st.paged ? perTok * Math.min(st.pref, st.avg) : 0;
      const each = perTok * (st.paged ? Math.max(0, Math.min(st.avg, st.ctx) - Math.min(st.pref, st.avg)) : st.ctx);
      const n = free <= 0 ? 0 : Math.max(0, Math.floor((free - sharedB) / Math.max(1, each)));
      ro.set([['weights', bytes(weights)], ['cache per token', bytes(perTok)], ['cache per user', bytes(each)], ['concurrent users', free <= 0 ? 'weights do not fit' : n.toLocaleString(), n > 0 ? 'var(--pass)' : 'var(--fail)']]);
      clear(bar).appendChild(LLM.util.barRows(560, [{ label: 'weights', v: weights, text: bytes(weights), color: 'var(--res)' }, { label: 'free for cache', v: Math.max(0, free), text: bytes(Math.max(0, free)), color: 'var(--kv)' }], { max: st.gpu * GB, labelW: 110 }));
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el), h('div', { class: 'ctl' }, h('label', null, 'allocation'), pg.el)), bar, ro.el, h('p', { class: 'note-sim' }, '10% of GPU memory is held back for activations and runtime. Contiguous allocation reserves the full max context per user; paged allocation stores only used tokens and shares the prefix.'));
    draw();
    return w.el;
  }

  function pagedViz() {
    const w = widget('PagedAttention block table', 'Try it');
    const B = 4; // tokens per block (real systems use 16)
    let seqs = [{ name: 'user A', len: 9 }, { name: 'user B', len: 6 }, { name: 'user C', len: 11 }];
    const shared = 4; // first block is a shared system prompt
    const g = svg(560, 250);
    function draw() {
      clear(g);
      // physical pool 24 blocks
      const phys = []; let next = 1; const map = seqs.map((sq) => { const nb = Math.ceil(sq.len / B); const ids = [0]; for (let b = 1; b < nb; b++) ids.push(next++); return ids; });
      g.appendChild(s('text', { x: 10, y: 16, class: 'lbl', text: `logical blocks per sequence (${B} tokens each) → physical block ids` }));
      seqs.forEach((sq, i) => {
        const y = 28 + i * 44;
        g.appendChild(s('text', { x: 10, y: y + 18, 'font-size': 11.5, text: sq.name }));
        map[i].forEach((pid, b) => { const fill = Math.min(B, sq.len - b * B); g.appendChild(s('rect', { x: 70 + b * 58, y, width: 54, height: 26, rx: 4, fill: pid === 0 ? mix('var(--accent)', 30) : mix(tokColor(i), 25), stroke: pid === 0 ? 'var(--accent)' : tokColor(i) })); g.appendChild(s('text', { x: 97 + b * 58, y: y + 17, 'text-anchor': 'middle', 'font-size': 10.5, text: `#${pid} ${fill}/${B}` })); });
      });
      const total = next; g.appendChild(s('text', { x: 10, y: 176, class: 'lbl', text: 'physical pool' }));
      for (let p = 0; p < 24; p++) { const owner = p === 0 ? -1 : map.findIndex((ids) => ids.includes(p)); g.appendChild(s('rect', { x: 10 + p * 22, y: 184, width: 19, height: 19, rx: 3, fill: p === 0 ? 'var(--accent)' : owner >= 0 ? tokColor(owner) : 'var(--sunk)', style: 'opacity:.8' })); }
      const used = seqs.reduce((a, sq) => a + sq.len, 0) - shared * (seqs.length - 1), alloc = total * B;
      g.appendChild(s('text', { x: 10, y: 228, 'font-size': 12, text: `${total} blocks in use · waste ${alloc - used} token slots (only in each sequence’s last block) · block #0 shared by all three` }));
    }
    w.body.append(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, seqs.map((sq, i) => h('button', { class: 'btn', type: 'button', onclick: () => { if (seqs[i].len < 30) seqs[i].len++; draw(); } }, `+1 token to ${sq.name}`)), h('button', { class: 'btn', type: 'button', onclick: () => { seqs = seqs.map((x, i) => ({ ...x, len: [9, 6, 11][i] })); draw(); } }, 'Reset')), g,
      h('p', { class: 'note-sim' }, 'Blocks need not be contiguous: like OS memory pages, a block table maps each sequence’s logical blocks to any free physical block. Only the last block of each sequence can be partly empty.'));
    draw();
    return w.el;
  }

  function specDecode() {
    const w = widget('Speculative decoding', 'Try it');
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const a = slider({ label: 'acceptance rate α', min: 0.3, max: 0.95, step: 0.01, value: 0.75, fmt: (v) => v.toFixed(2), oninput: draw });
    const c = slider({ label: 'draft cost ÷ target cost', min: 0.01, max: 0.5, step: 0.01, value: 0.05, fmt: (v) => v.toFixed(2), oninput: draw });
    function draw() {
      const E = (al, k) => (1 - al ** (k + 1)) / (1 - al), S = (al, k) => E(al, k) / (k * c.value + 1);
      const pts = Array.from({ length: 12 }, (_, i) => [i + 1, S(a.value, i + 1)]);
      const best = pts.reduce((m, p) => (p[1] > m[1] ? p : m));
      ch.draw([{ pts, color: 'var(--q)', dots: [best] }], { xlabel: 'draft tokens per step k', ylabel: 'speed-up vs plain decoding', ymin: 0 });
      ro.set([['best k', best[0]], ['tokens per target pass', fmt(E(a.value, best[0]), 2)], ['speed-up', fmt(best[1], 2) + '×']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, a.el, c.el), ch.el, ro.el, h('p', { class: 'note-sim' }, 'A cheap draft model proposes k tokens; the big model checks all k in one pass and keeps the accepted prefix plus one token of its own. The output distribution is unchanged. Formula from Leviathan et al. 2022, assuming independent acceptances.'));
    draw();
    return w.el;
  }

  LLM.mod('11', {
    hook: 'Your model fits on the GPU. Why can it only serve a handful of users?',
    intro: ['Every user’s conversation holds a KV cache that grows with every token. It grows with layers × KV heads × context × users, so at scale it, not the weights, fills the GPU. The fixes fall into three families: make less cache, store each value in fewer bits, and waste less memory.'],
    hero: {
      steps: STAGES.map((st, i) => ({ title: ['The cache fills the GPU', 'Family 1: architecture', 'Family 2: shrinking spells', 'Family 3: paging', 'Family 3: prefix sharing'][i], text: [
        'An 8B model needs 16 GB for weights, leaving 64 GB. With full multi-head attention each token costs 512 KB, and naive servers reserve the whole 8k context up front.',
        'Grouped-query attention (Module 10) shares K/V heads: 4× less cache per token, so 4× more users.',
        'Store keys and values in FP8 instead of 16-bit. Per-channel quantisation (KIVI) and rotation tricks (TurboQuant, 2026, about 3 bits per value) go further without retraining.',
        'Most conversations never reach the maximum. PagedAttention allocates fixed-size blocks only as tokens arrive, like operating-system pages, so reserved-but-empty memory disappears.',
        'Many users send the same long system prompt. Prefix caching stores its blocks once and lets every sequence point to them.',
      ][i] })),
      init: heroInit,
    },
    sections: [
      { title: 'Combining the families', widget: fitCalc },
      { title: 'Paging in detail', depth: 'mechanics', widget: pagedViz },
      { title: 'Other system tricks', body: [
        '<b>Continuous batching</b> adds and removes requests from the running batch every step instead of waiting for the whole batch to finish. <b>Chunked prefill</b> splits a long prompt into pieces interleaved with other users’ decode steps, so one big prompt does not stall everyone. <b>Offloading and eviction</b> move cold cache blocks to CPU memory or drop unimportant tokens (keeping attention sinks and recent tokens).',
      ], widget: specDecode },
    ],
    maths: [
      { note: 'Cache size:', tex: '\\text{KV bytes}=2\\times L\\times H_{kv}\\times d_{head}\\times n_{tokens}\\times B\\times \\text{bytes per value}' },
      { note: '<b>Speculative decoding</b> with acceptance rate α and k draft tokens: expected tokens per target pass, and speed-up when a draft step costs c of a target step:', tex: '\\mathbb{E}[\\text{tokens}]=\\frac{1-\\alpha^{k+1}}{1-\\alpha},\\qquad \\text{speed-up}=\\frac{1-\\alpha^{k+1}}{(1-\\alpha)(kc+1)}' },
    ],
    leaves: ['User counts ignore activation memory, batching limits and compute; memory is one of several ceilings.', 'Quantising the cache trades a little accuracy; how much depends on the method and the model.', 'TurboQuant and similar 2026 methods report their own results; they are not yet widely replicated.'],
    quiz: [
      { q: 'What does PagedAttention mainly eliminate?', opts: ['Attention computation', 'Memory reserved for tokens that never arrive, and fragmentation', 'The need for a KV cache', 'Quantisation error'], a: 1, why: 'Blocks are allocated on demand and need not be contiguous, so waste is limited to each sequence’s last block.' },
      { q: 'With α = 0.8 and k = 4, how many tokens does each target pass yield on average?', opts: ['≈ 2.0', '≈ 3.4', '4', '5'], a: 1, why: '(1 − 0.8⁵)/(1 − 0.8) = (1 − 0.328)/0.2 ≈ 3.36.' },
      { q: 'Switching the cache from BF16 to FP8 (all else equal) lets roughly how many more users fit?', opts: ['The same', '2×', '4×', '8×'], a: 1, why: 'Half the bytes per value, so twice the tokens in the same memory.' },
    ],
  });
})();
