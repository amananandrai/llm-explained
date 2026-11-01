(function () {
  const { h, s, svg, clear, tex, slider, seg, widget, readout, matrixGrid, softmax, matmul, T, fmt, rng, randn, mix, tokColor, human, probBars, lineChart } = LLM.util;

  // Toy example: 5 tokens, d_model = 4, d_k = 4. Fixed seeded weights so every number is reproducible.
  const toks = ['the', 'cat', 'sat', 'on', 'mat'];
  const X = [[0.2, 0.1, -0.3, 0.5], [0.9, -0.4, 0.3, 0.1], [-0.2, 0.8, 0.6, -0.1], [0.1, 0.2, -0.7, 0.4], [0.8, -0.2, 0.4, 0.6]];
  const r = rng(5);
  const mk = () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => +(randn(r) * 0.9).toFixed(2)));
  const WQ = mk(), WK = mk(), WV = mk();
  const Q = matmul(X, WQ), K = matmul(X, WK), V = matmul(X, WV);
  const S = matmul(Q, T(K));
  const dk = 4;
  const Ssc = S.map((row) => row.map((x) => x / Math.sqrt(dk)));
  const Smask = Ssc.map((row, i) => row.map((x, j) => (j <= i ? x : -Infinity)));
  const A = Smask.map((row) => softmax(row.map((x) => (x === -Infinity ? -1e9 : x))));
  const O = matmul(A, V);

  function heroInit(box) {
    const W = 560, H = 400;
    const g = svg(W, H, { 'aria-label': 'Attention computed step by step for a five token sentence' });
    box.appendChild(g);
    const cs = 34;
    let cellTimer = null;
    function draw(step, fillUpTo = 25) {
      clear(g);
      const lab = (x, y, t, c) => g.appendChild(s('text', { x, y, 'font-size': 12, text: t, style: c ? `fill:${c}` : '' }));
      // token labels on rows
      const rowLabels = (ox, oy) => toks.forEach((t, i) => g.appendChild(s('text', { x: ox - 6, y: oy + i * cs + cs / 2 + 3, 'text-anchor': 'end', 'font-size': 11, text: t, style: `fill:${tokColor(i)}` })));
      const colLabels = (ox, oy) => toks.forEach((t, j) => g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1, y: oy - 6, 'text-anchor': 'middle', 'font-size': 11, text: t, style: `fill:${tokColor(j)}` })));
      if (step === 0) {
        rowLabels(70, 40); g.appendChild(matrixGrid(X, { x: 70, y: 40, cell: cs, color: 'var(--res)', label: 'X  [seq=5, d_model=4]' }));
        lab(250, 60, 'Each token is a row of 4 numbers.', 'var(--muted)');
        lab(250, 80, 'Nothing has looked at anything yet.', 'var(--muted)');
        g.appendChild(s('text', { x: 250, y: 130, class: 'big', text: '5 tokens × 4 dims' }));
      }
      if (step === 1) {
        const blocks = [[Q, 'var(--q)', 'Q = X·W_Q  (what am I looking for?)'], [K, 'var(--k)', 'K = X·W_K  (what do I offer?)'], [V, 'var(--v)', 'V = X·W_V  (what do I pass on?)']];
        blocks.forEach(([M, c, t], b) => { const ox = 50 + b * 180; rowLabels(ox, 50); g.appendChild(matrixGrid(M, { x: ox, y: 50, cell: 32, color: c, fs: 8.5 })); g.appendChild(s('text', { x: ox, y: 34, 'font-size': 11, text: t.split('  ')[0], style: `fill:${c};font-weight:600` })); g.appendChild(s('text', { x: ox, y: 230, class: 'lbl', text: t.split('  ')[1] })); });
        g.appendChild(s('text', { x: 50, y: 270, class: 'lbl', text: 'Three learned 4×4 matrices turn every token row into a query, a key and a value.' }));
      }
      if (step >= 2) {
        const ox = 90, oy = 60;
        colLabels(ox, oy); rowLabels(ox, oy);
        let M, color, label;
        if (step === 2) { M = S; color = 'var(--q)'; label = 'scores = Q·Kᵀ   (row = query, column = key)'; }
        if (step === 3) { M = Ssc; color = 'var(--q)'; label = 'scores / √d_k = scores / 2'; }
        if (step === 4) { M = Smask.map((r) => r.map((x) => (x === -Infinity ? null : x))); color = 'var(--q)'; label = 'causal mask: no peeking at later tokens'; }
        if (step >= 5) { M = A; color = 'var(--q)'; label = 'softmax per row → attention weights'; }
        const max = Math.max(...M.flat().filter((x) => x != null).map(Math.abs));
        g.appendChild(s('text', { x: ox, y: 24, 'font-size': 12, text: label, style: 'font-weight:600' }));
        M.forEach((row, i) => row.forEach((v, j) => {
          const idx = i * 5 + j;
          const shown = step !== 2 || idx < fillUpTo;
          const masked = v == null;
          g.appendChild(s('rect', { x: ox + j * cs, y: oy + i * cs, width: cs - 2, height: cs - 2, rx: 3, fill: masked || !shown ? 'var(--sunk)' : mix(color, (Math.abs(v) / max) * 80 + 8), stroke: step === 2 && idx === fillUpTo - 1 ? 'var(--ink)' : 'none', 'stroke-width': 2 }));
          if (masked) g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1, y: oy + i * cs + cs / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, text: '−∞', class: 'lbl' }));
          else if (shown) g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1, y: oy + i * cs + cs / 2 + 3.5, 'text-anchor': 'middle', 'font-size': 9.5, text: fmt(v, step >= 5 ? 2 : 1) }));
        }));
        // side panel
        const px = 290;
        if (step === 2) {
          const k = Math.max(0, fillUpTo - 1), i = Math.floor(k / 5), j = k % 5;
          g.appendChild(s('text', { x: px, y: 80, 'font-size': 12, text: `cell (${toks[i]}, ${toks[j]})`, style: 'font-weight:600' }));
          g.appendChild(s('text', { x: px, y: 102, 'font-size': 11, text: `q_${toks[i]} = [${Q[i].map((x) => fmt(x, 1)).join(', ')}]`, style: 'fill:var(--q)' }));
          g.appendChild(s('text', { x: px, y: 120, 'font-size': 11, text: `k_${toks[j]} = [${K[j].map((x) => fmt(x, 1)).join(', ')}]`, style: 'fill:var(--k)' }));
          g.appendChild(s('text', { x: px, y: 142, 'font-size': 11, text: `dot = ${Q[i].map((x, t) => fmt(x * K[j][t], 1)).join(' + ').replace(/\+ -/g, '− ')}`, class: 'lbl' }));
          g.appendChild(s('text', { x: px, y: 162, 'font-size': 13, text: `     = ${fmt(S[i][j], 2)}` }));
        }
        if (step === 3) { g.appendChild(s('text', { x: px, y: 90, 'font-size': 11.5, text: 'Dividing by √4 = 2 keeps scores', class: 'lbl' })); g.appendChild(s('text', { x: px, y: 108, 'font-size': 11.5, text: 'in a range where softmax stays soft.', class: 'lbl' })); }
        if (step === 4) { g.appendChild(s('text', { x: px, y: 90, 'font-size': 11.5, text: 'Upper triangle set to −∞,', class: 'lbl' })); g.appendChild(s('text', { x: px, y: 108, 'font-size': 11.5, text: 'so e^(−∞) = 0 after softmax.', class: 'lbl' })); }
        if (step === 5) {
          g.appendChild(s('text', { x: px, y: 80, 'font-size': 12, text: 'row “mat” sums to 1:', style: 'font-weight:600' }));
          A[4].forEach((a, j) => { g.appendChild(s('rect', { x: px, y: 92 + j * 22, width: 200, height: 16, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: px, y: 92 + j * 22, width: a * 200, height: 16, rx: 3, fill: tokColor(j) })); g.appendChild(s('text', { x: px + 206, y: 104 + j * 22, 'font-size': 10.5, text: toks[j] + ' ' + fmt(a, 2) })); });
        }
        if (step === 6) {
          // output for "mat" as weighted sum of V rows
          g.appendChild(s('text', { x: px, y: 50, 'font-size': 12, text: 'out_mat = Σ weight × v', style: 'font-weight:600' }));
          V.forEach((v, j) => {
            const y = 66 + j * 34;
            g.appendChild(s('text', { x: px, y: y + 15, 'font-size': 10.5, text: fmt(A[4][j], 2) + ' ×', style: `fill:${tokColor(j)}` }));
            g.appendChild(matrixGrid([v], { x: px + 48, y, cell: 28, color: 'var(--v)', fs: 8, max: 3 }));
          });
          g.appendChild(s('line', { x1: px, x2: px + 160, y1: 240, y2: 240, stroke: 'var(--ink)' }));
          g.appendChild(matrixGrid([O[4]], { x: px + 48, y: 248, cell: 28, color: 'var(--v)', fs: 8, max: 3 }));
          g.appendChild(s('text', { x: px, y: 266, 'font-size': 11, text: '= ' }));
          g.appendChild(s('rect', { x: ox + 0, y: oy + 4 * cs, width: 5 * cs - 2, height: cs - 2, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, rx: 3 }));
        }
        if (step === 7) {
          // heads in colours
          const heads = ['var(--t0)', 'var(--t1)', 'var(--t2)', 'var(--t4)'];
          g.appendChild(s('text', { x: px, y: 60, 'font-size': 12, text: 'Multi-head: run this 4 times', style: 'font-weight:600' }));
          heads.forEach((c, hh) => {
            const rr = rng(20 + hh);
            const pat = toks.map((_, i) => softmax(toks.map((_, j) => (j <= i ? randn(rr) * 1.5 + (hh === 1 && j === i - 1 ? 3 : 0) + (hh === 2 && j === 0 ? 3 : 0) : -1e9))));
            g.appendChild(matrixGrid(pat, { x: px + (hh % 2) * 110, y: 80 + Math.floor(hh / 2) * 110, cell: 18, color: c, numbers: false, max: 1 }));
            g.appendChild(s('text', { x: px + (hh % 2) * 110, y: 80 + Math.floor(hh / 2) * 110 + 102, class: 'lbl', text: ['head 1', 'head 2: prev token', 'head 3: first token', 'head 4'][hh] }));
          });
          g.appendChild(s('text', { x: px, y: 320, class: 'lbl', text: 'Each head has its own W_Q, W_K, W_V; outputs are' }));
          g.appendChild(s('text', { x: px, y: 336, class: 'lbl', text: 'concatenated and mixed by W_O.' }));
        }
      }
    }
    return {
      go(i) {
        clearInterval(cellTimer);
        if (i === 2 && !LLM.util.reduced()) {
          let n = 1; draw(2, n);
          cellTimer = setInterval(() => { n++; draw(2, n); if (n >= 25) clearInterval(cellTimer); }, 110);
        } else draw(i);
      },
    };
  }

  /* ---- widgets ---- */
  function shapeStepper() {
    const w = widget('Tensor-shape stepper', 'Mechanics');
    const st = { b: 2, n: 5, d: 512, hds: 8 };
    const stages = (o) => {
      const dh = o.d / o.hds;
      return [
        ['Input X', `[${o.b}, ${o.n}, ${o.d}]`, '[batch, seq, d_model]'],
        ['Project Q, K, V', `[${o.b}, ${o.n}, ${o.d}] ×3`, 'X·W, each W is [d_model, d_model]'],
        ['Split heads', `[${o.b}, ${o.n}, ${o.hds}, ${dh}]`, 'reshape d_model → heads × d_head'],
        ['Transpose', `[${o.b}, ${o.hds}, ${o.n}, ${dh}]`, '[batch, heads, seq, d_head]'],
        ['Scores Q·Kᵀ', `[${o.b}, ${o.hds}, ${o.n}, ${o.n}]`, 'one seq×seq map per head'],
        ['Weights × V', `[${o.b}, ${o.hds}, ${o.n}, ${dh}]`, 'softmax rows, then mix values'],
        ['Merge heads', `[${o.b}, ${o.n}, ${o.d}]`, 'transpose back and concatenate'],
        ['Output W_O', `[${o.b}, ${o.n}, ${o.d}]`, 'same shape as the input: added to the residual stream'],
      ];
    };
    let at = 0;
    const list = h('ol', { style: { margin: 0, paddingLeft: '1.3em', display: 'grid', gap: '4px', fontFamily: 'var(--f-mono)', fontSize: '.86rem' } });
    const headsWarn = h('p', { class: 'note-sim' });
    function draw() {
      clear(list);
      const ok = st.d % st.hds === 0;
      headsWarn.textContent = ok ? `d_head = ${st.d}/${st.hds} = ${st.d / st.hds}` : `d_model must divide evenly by heads (${st.d} / ${st.hds} is not whole)`;
      if (!ok) return;
      stages(st).forEach(([n, shape, why], i) => list.appendChild(h('li', { style: { opacity: i <= at ? 1 : 0.35, fontWeight: i === at ? 600 : 400 } }, `${n}: `, h('span', { style: { color: i === at ? 'var(--accent)' : 'inherit' } }, shape), h('span', { class: 'muted' }, '  · ' + why))));
    }
    const sb = slider({ label: 'batch', min: 1, max: 8, value: st.b, oninput: (v) => { st.b = v; draw(); } });
    const sn = slider({ label: 'seq', min: 1, max: 32, value: st.n, oninput: (v) => { st.n = v; draw(); } });
    const sd = slider({ label: 'd_model', min: 64, max: 1024, step: 64, value: st.d, oninput: (v) => { st.d = v; draw(); } });
    const sh = slider({ label: 'heads', min: 1, max: 16, value: st.hds, oninput: (v) => { st.hds = v; draw(); } });
    const prev = h('button', { class: 'btn', type: 'button', onclick: () => { at = Math.max(0, at - 1); draw(); } }, '‹ Back');
    const next = h('button', { class: 'btn primary', type: 'button', onclick: () => { at = Math.min(7, at + 1); draw(); } }, 'Next step ›');
    w.body.append(h('div', { class: 'ctl-row' }, sb.el, sn.el, sd.el, sh.el), h('div', { style: { display: 'flex', gap: '8px' } }, prev, next), list, headsWarn);
    draw();
    return w.el;
  }

  function sqrtToggle() {
    const w = widget('Remove √d_k and watch softmax saturate', 'Try it');
    let scale = true, d = 64;
    const bars = probBars({ labelW: 60 });
    const ro = readout();
    const r0 = rng(11);
    const qv = Array.from({ length: 512 }, () => randn(r0)), keys = Array.from({ length: 6 }, () => Array.from({ length: 512 }, () => randn(r0)));
    function draw() {
      const sc = keys.map((k) => k.slice(0, d).reduce((a, x, i) => a + x * qv[i], 0));
      const z = sc.map((x) => (scale ? x / Math.sqrt(d) : x));
      const p = softmax(z);
      bars.draw(p.map((pp, i) => ({ label: 'key ' + (i + 1), p: pp, color: 'var(--k)' })), { scaleMax: 1 });
      const ent = -p.reduce((a, x) => a + (x > 0 ? x * Math.log2(x) : 0), 0);
      const sd = Math.sqrt(z.reduce((a, x) => a + x * x, 0) / z.length);
      ro.set([['score spread (std)', fmt(sd, 2)], ['max weight', (Math.max(...p) * 100).toFixed(1) + '%'], ['entropy', fmt(ent, 2) + ' bits (max 2.58)']]);
    }
    const tg = seg([[true, 'with √d_k'], [false, 'without']], true, (v) => { scale = v; draw(); }, 'Scaling');
    const sd = slider({ label: 'd_k (vector length)', min: 4, max: 512, step: 4, value: d, oninput: (v) => { d = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'scaling'), tg.el), sd.el), bars.el, ro.el,
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Random unit-variance query and keys. A dot product of d_k such terms has variance d_k, so without the scale the spread grows like √d_k and one key takes nearly all the weight; its gradients then vanish.'));
    draw();
    return w.el;
  }

  function headViewer() {
    const w = widget('Head viewer', 'Try it', 'Illustrative patterns: the shapes match head types reported in trained models, but these weights are constructed for this page, not taken from a model.');
    const sent = ['The', 'trophy', 'did', 'not', 'fit', 'in', 'the', 'case', 'because', 'it', 'was', 'big'];
    const n = sent.length;
    const pats = {
      'Previous token': (i, j) => (j === i - 1 ? 4 : j === i ? 1 : 0),
      'First token (sink)': (i, j) => (j === 0 ? 4 : 0.3),
      'Same word earlier': (i, j) => (j < i && sent[j].toLowerCase() === sent[i].toLowerCase() ? 4 : j === i ? 1.5 : 0),
      'Coreference: it → trophy': (i, j) => (i === 9 && j === 1 ? 5 : i === 11 && j === 1 ? 3 : j === i ? 1.5 : 0),
      'Broad / averaging': () => 0,
    };
    let cur = 'Previous token', hover = 9;
    const g = svg(560, 330);
    function draw() {
      clear(g);
      const f = pats[cur];
      const Am = sent.map((_, i) => softmax(sent.map((_, j) => (j <= i ? f(i, j) : -1e9))));
      const cs = 21, ox = 70, oy = 70;
      sent.forEach((t, j) => g.appendChild(s('text', { x: ox + j * cs + 8, y: oy - 6, 'font-size': 10, transform: `rotate(-50 ${ox + j * cs + 8} ${oy - 6})`, text: t })));
      sent.forEach((t, i) => g.appendChild(s('text', { x: ox - 6, y: oy + i * cs + 14, 'text-anchor': 'end', 'font-size': 10, text: t, style: i === hover ? 'font-weight:700;fill:var(--accent)' : '' })));
      Am.forEach((row, i) => row.forEach((v, j) => { const rct = s('rect', { x: ox + j * cs, y: oy + i * cs, width: cs - 2, height: cs - 2, rx: 2, fill: j > i ? 'var(--sunk)' : mix('var(--q)', v * 90 + 5), stroke: i === hover ? 'var(--ink)' : 'none' }); rct.addEventListener('mouseenter', () => { hover = i; draw(); }); g.appendChild(rct); }));
      // sentence with lines for hovered row
      const sx = 340, sy = 80;
      g.appendChild(s('text', { x: sx, y: sy - 18, class: 'lbl', text: `“${sent[hover]}” attends to:` }));
      Am[hover].forEach((v, j) => { if (j > hover) return; g.appendChild(s('rect', { x: sx, y: sy + j * 20, width: 120, height: 14, rx: 2, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: sx, y: sy + j * 20, width: v * 120, height: 14, rx: 2, fill: 'var(--q)' })); g.appendChild(s('text', { x: sx + 126, y: sy + j * 20 + 11, 'font-size': 10.5, text: `${sent[j]} ${(v * 100).toFixed(0)}%` })); });
    }
    const sg = seg(Object.keys(pats), cur, (v) => { cur = v; draw(); }, 'Head pattern');
    w.body.append(sg.el, g, h('p', { class: 'note-sim' }, 'Hover a row in the grid to read that token’s weights.'));
    draw();
    return w.el;
  }

  function paramCounter() {
    const w = widget('Parameter counter: the 12·d² rule', 'Mechanics');
    const st = { d: 4096, L: 32, V: 50257, ff: 4 };
    const ro = readout();
    const tbl = h('div', { class: 'tbl-wrap' });
    function draw() {
      const att = 4 * st.d * st.d, mlp = 2 * st.ff * st.d * st.d, norms = 4 * st.d;
      const per = att + mlp + norms, emb = st.V * st.d;
      const total = per * st.L + emb;
      clear(tbl).appendChild(h('table', null, h('thead', null, h('tr', null, h('th', null, 'Piece'), h('th', null, 'Formula'), h('th', { class: 'num' }, 'Parameters'))), h('tbody', null,
        [['Attention W_Q, W_K, W_V, W_O', '4·d²', att], [`MLP up + down (${st.ff}× expansion)`, `2·${st.ff}·d²`, mlp], ['Norm gains and biases', '≈4·d', norms], ['One block', '≈12·d²', per], [`× ${st.L} layers`, '', per * st.L], ['Token embedding (tied output)', 'V·d', emb], ['Total', '', total]]
          .map(([a, b, c], i) => h('tr', { style: i === 3 || i === 6 ? { fontWeight: 600 } : null }, h('td', null, a), h('td', { class: 'mono' }, b), h('td', { class: 'num' }, human(c)))))));
      ro.set([['12·d²·L estimate', human(12 * st.d * st.d * st.L)], ['exact blocks', human(per * st.L)], ['estimate error', ((1 - (12 * st.d * st.d * st.L) / (per * st.L)) * 100).toFixed(2) + '%']]);
    }
    const presets = { 'GPT-2 small': [768, 12, 50257], 'GPT-2 XL': [1600, 48, 50257], 'GPT-3 175B': [12288, 96, 50257] };
    const sd = slider({ label: 'd_model', min: 128, max: 12288, step: 64, value: st.d, oninput: (v) => { st.d = v; draw(); } });
    const sl = slider({ label: 'layers', min: 1, max: 96, value: st.L, oninput: (v) => { st.L = v; draw(); } });
    const pr = seg(Object.keys(presets), null, (k) => { [st.d, st.L, st.V] = presets[k]; sd.set(st.d); sl.set(st.L); draw(); }, 'Presets');
    w.body.append(pr.el, h('div', { class: 'ctl-row' }, sd.el, sl.el), ro.el, tbl, h('p', { class: 'note-sim' }, 'GPT-2 small lands near its published 124M; GPT-3 lands near 175B. Ignores biases in linear layers and positional embeddings.'));
    draw();
    return w.el;
  }

  LLM.mod('5', {
    hook: 'How does a word decide which other words matter to it?',
    intro: ['Attention lets every token look at every earlier token at once, score how relevant each one is, and pull in a weighted mix of what they carry. Scroll to watch it computed from real numbers: five tokens, four dimensions, every value on screen.'],
    hero: {
      steps: [
        { title: 'Five tokens, four numbers each', text: 'The sentence “the cat sat on mat” arrives as a 5 × 4 grid. Each row is one token’s embedding. Grey is the residual stream colour: the running representation every layer reads and writes.', mech: 'X has shape [seq = 5, d_model = 4]. In a real model, d_model is 768 to 12,288.' },
        { title: 'Ask, offer, pass on', text: 'Three learned matrices turn each row into a <b style="color:var(--q)">query</b> (what am I looking for?), a <b style="color:var(--k)">key</b> (what do I contain?) and a <b style="color:var(--v)">value</b> (what will I hand over?).', mech: 'Q = X·W_Q, K = X·W_K, V = X·W_V, each [5, 4]. The weights are seeded so you can reproduce every number.', maths: '\\Q{Q}=XW_Q,\\quad \\K{K}=XW_K,\\quad \\V{V}=XW_V' },
        { title: 'Score every pair', text: 'Each query is compared with each key by a dot product: multiply matching entries and add. Watch the 5 × 5 grid fill cell by cell. A big score means “this key answers my question”.', mech: 'Q·Kᵀ is [5, 4] × [4, 5] = [5, 5]. Row i, column j is the score of query i against key j.', maths: 'S_{ij}=\\Q{q_i}\\cdot\\K{k_j}=\\sum_{t=1}^{d_k}\\Q{q_{it}}\\K{k_{jt}}' },
        { title: 'Scale down by √d_k', text: 'Dot products of longer vectors grow larger. Dividing by the square root of the vector length (here √4 = 2) keeps scores in a comfortable range.', mech: 'If q and k entries have variance 1, q·k has variance d_k. Dividing by √d_k restores variance 1. The “Try it” widget removes this and shows what breaks.', maths: '\\frac{\\Q{q}\\cdot\\K{k}}{\\sqrt{d_k}},\\qquad \\mathrm{Var}(\\Q{q}\\cdot\\K{k})=d_k' },
        { title: 'Hide the future', text: 'A model that predicts the next word must not see it. Every cell above the diagonal is set to minus infinity, so “the” sees only itself and “mat” sees all five.', mech: 'M is a [5, 5] matrix with 0 on and below the diagonal and −∞ above it, added to the scaled scores.', maths: 'M_{ij}=\\begin{cases}0 & j\\le i\\\\-\\infty & j>i\\end{cases}' },
        { title: 'Turn scores into weights', text: 'Softmax runs along each row: exponentiate, then divide by the row total. Every row now sums to exactly 1, a share of attention spread over the visible tokens.', maths: 'A_{ij}=\\frac{e^{S_{ij}/\\sqrt{d_k}+M_{ij}}}{\\sum_{j\'} e^{S_{ij\'}/\\sqrt{d_k}+M_{ij\'}}}' },
        { title: 'Mix the values', text: 'Each token’s output is its weights times the <b style="color:var(--v)">value</b> vectors, added up. “mat” ends up as a blend of what all five tokens offered, mostly the ones it scored highly.', mech: 'A·V is [5, 5] × [5, 4] = [5, 4]: the same shape as X, so it can be added back to the residual stream.', maths: '\\mathrm{out}_i=\\sum_j A_{ij}\\,\\V{v_j}' },
        { title: 'Many heads at once', text: 'A real layer runs several attention heads in parallel, each with its own matrices, so one head can track the previous word while another tracks the subject of the sentence.', mech: 'With d_model = 512 and 8 heads, each head works in d_head = 64. Outputs are concatenated back to 512 and mixed by W_O.', maths: '\\mathrm{MHA}(X)=[\\mathrm{head}_1;\\dots;\\mathrm{head}_h]\\,W_O' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'The rest of the block', depth: 'mechanics', body: [
        'Attention is half a transformer block. The full pre-norm block used by most current models is:',
        h('pre', { class: 'code' }, 'x = x + Attention(RMSNorm(x))    # tokens talk to each other\nx = x + MLP(RMSNorm(x))          # each token thinks alone'),
        '<b>Residual stream.</b> Each sub-layer adds its output to x instead of replacing it. Gradients flow straight down the additions, which is why 100-layer stacks train at all.',
        '<b>LayerNorm vs RMSNorm.</b> LayerNorm subtracts the mean and divides by the standard deviation; RMSNorm skips the mean and divides by the root-mean-square. It is cheaper and works as well. <b>Pre-norm</b> normalises the input to each sub-layer; the 2017 <b>post-norm</b> normalised after the addition, which trains less stably when deep.',
        '<b>Feed-forward network.</b> Two (or, for SwiGLU, three) matrices with a 4× wider hidden layer and a GELU or SwiGLU nonlinearity in between. It holds about two-thirds of the block’s parameters.',
        '<b>Why very deep stacks degrade.</b> Every layer adds with equal weight, so early contributions get diluted in a growing residual stream; token representations can collapse toward each other (rank collapse); and attention can become over-peaked (entropy collapse). Residuals, normalisation and careful initialisation fight all three. Module 17 shows a 2026 design that attacks dilution directly.',
      ], widget: shapeStepper },
      { title: 'Counting parameters', depth: 'mechanics', sub: 'The success test for Part 2: estimate a decoder’s size within 10%.', widget: paramCounter },
    ],
    maths: [
      { note: 'Scaled dot-product attention with a causal mask, for one head:', tex: '\\mathrm{Attention}(\\Q{Q},\\K{K},\\V{V})=\\mathrm{softmax}\\!\\left(\\frac{\\Q{Q}\\K{K}^{\\top}}{\\sqrt{d_k}}+M\\right)\\V{V},\\qquad \\Q{Q}=X W_Q,\\;\\K{K}=X W_K,\\;\\V{V}=X W_V' },
      { note: '<b>Why √d_k.</b> Suppose the entries of q and k are independent with mean 0 and variance 1. Then', tex: '\\mathbb{E}[\\Q{q}\\cdot\\K{k}]=\\sum_{t=1}^{d_k}\\mathbb{E}[\\Q{q_t}]\\,\\mathbb{E}[\\K{k_t}]=0,\\qquad \\mathrm{Var}(\\Q{q}\\cdot\\K{k})=\\sum_{t=1}^{d_k}\\mathrm{Var}(\\Q{q_t}\\K{k_t})=d_k', after: 'So the standard deviation of a score is √d_k. Dividing by √d_k brings it back to 1, keeping softmax away from the saturated region where one weight is ≈1, the rest ≈0, and gradients ≈0.' },
      { note: '<b>Parameters per layer.</b> Four d×d attention matrices plus a 4× MLP:', tex: '\\underbrace{4d^2}_{W_Q,W_K,W_V,W_O}+\\underbrace{2\\cdot 4d\\cdot d}_{\\text{MLP up, down}}=12d^2,\\qquad \\text{FLOPs per token per layer}\\approx 2\\cdot 12d^2+\\underbrace{4\\,n\\,d}_{\\text{scores, mixing}}' },
      { note: '<b>RMSNorm</b> with learned gain g:', tex: '\\mathrm{RMSNorm}(x)=\\frac{x}{\\sqrt{\\tfrac{1}{d}\\sum_i x_i^2+\\epsilon}}\\odot g' },
    ],
    mathsLegend: 'blue is query, orange is key, green is value.',
    tryit: [sqrtToggle, headViewer],
    leaves: [
      'Real models use d_model in the thousands and dozens of heads; the grid here is 5 × 4 so every number fits.',
      'The weights here are random, so the attention pattern means nothing. Trained weights are what make heads specialise.',
      'Positional information (RoPE, Module 4) is left out; without it attention cannot tell word order apart.',
      'Real implementations never build the full n × n matrix in memory; FlashAttention (Module 10) computes it tile by tile.',
      'Attention weights are not explanations of model behaviour (Module 39).',
    ],
    quiz: [
      { q: 'Q has shape [5, 64] and K has shape [5, 64]. What is the shape of Q·Kᵀ?', opts: ['[64, 64]', '[5, 5]', '[5, 64]', '[1, 5]'], a: 1, why: '[5, 64] × [64, 5] = [5, 5]: one score for every (query, key) pair.' },
      { q: 'What goes wrong if you drop the 1/√d_k scale with d_k = 512?', opts: ['Scores become too small and attention is uniform', 'Scores spread widely, softmax saturates onto one key, and gradients nearly vanish', 'Nothing; softmax is scale-invariant', 'The causal mask stops working'], a: 1, why: 'The score variance grows with d_k. Softmax is invariant to adding a constant, not to scaling, so large spreads push it to a near one-hot output with tiny gradients.' },
      { q: 'A decoder has d_model = 2048 and 24 layers. Roughly how many parameters are in its blocks?', opts: ['≈ 100M', '≈ 1.2B', '≈ 12B', '≈ 50M'], a: 1, why: '12 × 2048² × 24 ≈ 12 × 4.19M × 24 ≈ 1.21B.' },
    ],
  });
})();
