(function () {
  const { h, s, svg, clear, slider, widget, readout, fmt, mix, rng, randn } = LLM.util;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  function build(N, M, seed = 22) {
    const r = rng(seed); const pts = [];
    for (let i = 0; i < N; i++) { const c = Math.floor(r() * 5), cx = [0.25, 0.7, 0.5, 0.2, 0.8][c], cy = [0.3, 0.25, 0.6, 0.8, 0.75][c]; pts.push([Math.min(0.99, Math.max(0.01, cx + randn(r) * 0.11)), Math.min(0.99, Math.max(0.01, cy + randn(r) * 0.11))]); }
    const mL = 1 / Math.log(Math.max(2, M));
    const lev = pts.map(() => Math.min(3, Math.floor(-Math.log(1 - r()) * mL)));
    const maxL = Math.max(...lev); const layers = [];
    for (let l = 0; l <= maxL; l++) {
      const ids = pts.map((_, i) => i).filter((i) => lev[i] >= l); const nb = new Map(ids.map((i) => [i, new Set()]));
      ids.forEach((i) => { const near = ids.filter((j) => j !== i).sort((a, b) => d2(pts[i], pts[a]) - d2(pts[i], pts[b])).slice(0, l ? Math.max(2, M >> 1) : M); near.forEach((j) => { nb.get(i).add(j); nb.get(j).add(i); }); });
      layers.push({ ids, nb });
    }
    const entry = pts.map((_, i) => i).find((i) => lev[i] === maxL);
    return { pts, lev, layers, entry, maxL };
  }
  function search(G, q, ef, k = 10) {
    let cur = G.entry, comps = 0; const path = [];
    for (let l = G.maxL; l >= 1; l--) { let moved = true; path.push([l, cur]); while (moved) { moved = false; for (const n of G.layers[l].nb.get(cur)) { comps++; if (d2(G.pts[n], q) < d2(G.pts[cur], q)) { cur = n; moved = true; path.push([l, cur]); } } } }
    // beam search at layer 0
    const visited = new Set([cur]); let cand = [[d2(G.pts[cur], q), cur]], res = [[d2(G.pts[cur], q), cur]];
    while (cand.length) { cand.sort((a, b) => a[0] - b[0]); const [dc, c] = cand.shift(); res.sort((a, b) => a[0] - b[0]); if (res.length >= ef && dc > res[res.length - 1][0]) break; path.push([0, c]);
      for (const n of G.layers[0].nb.get(c)) { if (visited.has(n)) continue; visited.add(n); comps++; const dn = d2(G.pts[n], q); res.sort((a, b) => a[0] - b[0]); if (res.length < ef || dn < res[res.length - 1][0]) { cand.push([dn, n]); res.push([dn, n]); if (res.length > ef) { res.sort((a, b) => a[0] - b[0]); res.pop(); } } } }
    res.sort((a, b) => a[0] - b[0]);
    return { found: res.slice(0, k).map((x) => x[1]), comps, path };
  }
  const brute = (G, q, k = 10) => G.pts.map((p, i) => [d2(p, q), i]).sort((a, b) => a[0] - b[0]).slice(0, k).map((x) => x[1]);

  function panel(g, G, l, x0, y0, W, path, found, q) {
    const fx = (p) => x0 + p[0] * W, fy = (p) => y0 + p[1] * W;
    g.appendChild(s('rect', { x: x0 - 4, y: y0 - 4, width: W + 8, height: W + 8, rx: 6, fill: mix('var(--t5)', 6 + l * 8), stroke: 'var(--rule)' }));
    const L = G.layers[l];
    L.ids.forEach((i) => L.nb.get(i).forEach((j) => { if (j > i) g.appendChild(s('line', { x1: fx(G.pts[i]), y1: fy(G.pts[i]), x2: fx(G.pts[j]), y2: fy(G.pts[j]), stroke: 'var(--t5)', 'stroke-width': 0.5, style: 'opacity:.35' })); }));
    L.ids.forEach((i) => g.appendChild(s('circle', { cx: fx(G.pts[i]), cy: fy(G.pts[i]), r: l ? 3 : 1.8, fill: found && found.includes(i) && l === 0 ? 'var(--pass)' : 'var(--t5)' })));
    const pl = path.filter((p) => p[0] === l);
    pl.forEach(([, i], k) => { if (k) g.appendChild(s('line', { x1: fx(G.pts[pl[k - 1][1]]), y1: fy(G.pts[pl[k - 1][1]]), x2: fx(G.pts[i]), y2: fy(G.pts[i]), stroke: 'var(--accent)', 'stroke-width': 2 })); });
    if (pl.length) g.appendChild(s('circle', { cx: fx(G.pts[pl[0][1]]), cy: fy(G.pts[pl[0][1]]), r: 4.5, fill: 'var(--accent)' }));
    if (q) g.appendChild(s('path', { d: `M${fx(q) - 5},${fy(q)}L${fx(q) + 5},${fy(q)}M${fx(q)},${fy(q) - 5}L${fx(q)},${fy(q) + 5}`, stroke: 'var(--ink)', 'stroke-width': 2.2 }));
    g.appendChild(s('text', { x: x0, y: y0 + W + 18, class: 'lbl', text: `layer ${l}: ${L.ids.length} nodes` }));
  }

  function heroInit(box) {
    const G = build(400, 8), q = [0.62, 0.5], res = search(G, q, 16);
    const g = svg(560, 320, { 'aria-label': 'HNSW search descending from a sparse top layer to the dense bottom layer' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const show = Math.min(G.maxL, 2), W = 160;
      const path = step >= 2 ? res.path.filter((p) => p[0] >= G.maxL - (step - 2)) : [];
      for (let k = 0; k <= show; k++) { const l = show - k; panel(g, G, l, 14 + k * 184, 30, W, step >= 2 ? path : [], step >= 4 ? res.found : null, step >= 1 ? q : null); }
      const msgs = [`400 vectors. Top layers hold a random few: P(level ≥ ℓ) shrinks geometrically.`, 'Query ✚. Brute force would compute 400 distances.', 'Enter at the top layer and hop greedily to the closest neighbour.', 'Drop a layer, start from where you stopped, hop again.', `Bottom layer: beam search (ef = 16) returns the 10 nearest (green). ${res.comps} distances computed instead of 400.`];
      g.appendChild(s('text', { x: 14, y: 18, 'font-size': 12, text: msgs[step], style: 'font-weight:600' }));
      if (step === 4) { const truth = brute(G, q), hit = res.found.filter((i) => truth.includes(i)).length; g.appendChild(s('text', { x: 14, y: 250, 'font-size': 12, text: `recall@10 for this query: ${hit}/10` })); }
    }
    return { go: (i) => draw(Math.min(i, 4)) };
  }

  function playground() {
    const w = widget('HNSW playground', 'Try it', 'A real (simplified) HNSW built in your browser: layer levels drawn as ⌊−ln U · m_L⌋, M nearest neighbours per layer, greedy descent then beam search. Recall is averaged over 40 random queries against brute force.');
    const st = { N: 1000, M: 8, ef: 16 }; const ro = readout(); const g = svg(560, 230);
    const sn = slider({ label: 'points', min: 200, max: 1500, step: 100, value: st.N, oninput: (v) => { st.N = v; rebuild(); } });
    const sm = slider({ label: 'M (neighbours per node)', min: 2, max: 24, value: st.M, oninput: (v) => { st.M = v; rebuild(); } });
    const se = slider({ label: 'efSearch (beam width)', min: 1, max: 128, value: st.ef, oninput: (v) => { st.ef = v; measure(); } });
    let G;
    function rebuild() { G = build(st.N, st.M); measure(); }
    function measure() {
      const r = rng(99); let hit = 0, comps = 0;
      for (let t = 0; t < 40; t++) { const q = [r(), r()], res = search(G, q, Math.max(10, st.ef)), tr = brute(G, q); hit += res.found.filter((i) => tr.includes(i)).length; comps += res.comps; }
      clear(g); panel(g, G, 0, 10, 10, 200, [], null, null);
      if (G.maxL >= 1) panel(g, G, 1, 240, 10, 200, [], null, null);
      ro.set([['recall@10', (hit / 400 * 100).toFixed(1) + '%', hit / 400 > 0.95 ? 'var(--pass)' : hit / 400 > 0.8 ? 'var(--warn)' : 'var(--fail)'], ['distances per query', Math.round(comps / 40)], ['brute force', st.N], ['layers', G.maxL + 1]]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, sn.el, sm.el, se.el), ro.el, g);
    rebuild();
    return w.el;
  }

  LLM.mod('22', {
    hook: 'How do you find the 10 closest vectors among a billion without checking them all?',
    intro: ['Exact nearest-neighbour search compares the query with every vector: fine for thousands, too slow for billions. Approximate search gives up a little recall for a huge speed-up. HNSW, the most widely used method, builds a layered graph you can descend like an express-then-local train line.'],
    hero: {
      steps: [
        { title: 'A layered graph', text: 'Every vector is a node at the bottom layer. A random few are promoted to higher layers, fewer each level, and each node links to its nearest neighbours in every layer it lives in.' },
        { title: 'The query', text: 'Exact k-NN computes the distance to all 400 points. On a billion, that is a billion distance computations per query.' },
        { title: 'Express layer', text: 'Start at the single entry point on the top layer. Move to whichever neighbour is closer to the query, until none is.' },
        { title: 'Descend', text: 'Use that node as the entry for the next layer down and repeat. Each layer narrows the region.' },
        { title: 'Local search', text: 'At the bottom, keep a beam of the ef best candidates and expand their neighbours. Cost grows roughly with log N instead of N.', maths: '\\ell=\\lfloor -\\ln(U)\\cdot m_L\\rfloor' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Turn the knobs', widget: playground },
      { title: 'The wider toolbox', depth: 'mechanics', body: [
        '<b>Distance.</b> Cosine, inner product and L2 rank identically on normalised vectors, since ‖a − b‖² = 2 − 2 a·b.',
        '<b>Parameters.</b> M sets links per node (memory, recall). efConstruction sets beam width while building (quality of the graph). efSearch sets beam width per query (the recall–latency dial).',
        '<b>IVF</b> clusters vectors with k-means and searches only the nearest few clusters. <b>Product quantisation</b> splits each vector into sub-vectors and stores a short code per sub-vector, shrinking memory 10–50×; IVF-PQ combines both for billion-scale indexes.',
        '<b>Vector databases</b> wrap these indexes with filtering, updates, replication and hybrid keyword search. In a RAG pipeline (Module 25) this is the retrieve step between embedding (Module 21) and re-ranking (Module 24).',
      ] },
    ],
    maths: [
      { note: 'Level assignment with m_L = 1/ln M, and the identity that makes cosine and L2 equivalent on unit vectors:', tex: '\\ell=\\big\\lfloor -\\ln(U)\\cdot m_L \\big\\rfloor,\\quad U\\sim\\mathrm{Uniform}(0,1),\\qquad \\|\\hat a-\\hat b\\|^2=2-2\\,\\hat a\\cdot\\hat b' },
      { note: 'Expected nodes per layer fall geometrically, giving roughly logarithmic search cost:', tex: 'P(\\ell\\ge L)=M^{-L},\\qquad \\text{cost}\\sim O(\\log N)' },
    ],
    leaves: ['2-D points are easy; high-dimensional vectors make neighbour graphs much harder, so recall drops faster.', 'This build connects each node to its exact M nearest per layer; real HNSW inserts incrementally with a neighbour-selection heuristic.', 'Deletes, updates and metadata filters are where production vector search gets hard.'],
    quiz: [
      { q: 'Raising efSearch generally…', opts: ['lowers recall and latency', 'raises recall and latency', 'changes memory use', 'rebuilds the index'], a: 1, why: 'A wider beam examines more candidates: more accurate, slower.' },
      { q: 'On L2-normalised vectors, which ranking is identical to cosine?', opts: ['Only dot product', 'Dot product and L2 distance (reversed)', 'None', 'Manhattan distance'], a: 1, why: '‖a − b‖² = 2 − 2a·b, so larger cosine means smaller distance.' },
      { q: 'With M = 16, roughly what fraction of nodes reach layer 2 or higher?', opts: ['1/16', '1/256', '1/2', '1/4096'], a: 1, why: 'P(ℓ ≥ 2) = M⁻² = 1/256.' },
    ],
  });
})();
