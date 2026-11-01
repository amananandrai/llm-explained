(function () {
  const { h, s, svg, clear, seg, widget, readout, mix, tokColor, rng, table, code } = LLM.util;
  const PARA = 'Ada Lovelace worked with Charles Babbage. Charles Babbage designed the Analytical Engine. The Analytical Engine inspired Alan Turing. Alan Turing founded computer science. Ada Lovelace wrote the first algorithm. Alan Turing worked at Bletchley Park. Bletchley Park is located in England. Charles Babbage was born in London. London is located in England.';
  const VERBS = ['worked with', 'designed', 'inspired', 'founded', 'wrote', 'worked at', 'is located in', 'was born in'];
  function triples(text) {
    const out = [];
    text.split(/(?<=\.)\s*/).forEach((sent) => { const t = sent.replace(/\.$/, '').trim(); for (const v of VERBS) { const i = t.indexOf(' ' + v + ' '); if (i > 0) { out.push([t.slice(0, i).replace(/^The /, ''), v, t.slice(i + v.length + 2).replace(/^the /, '')]); break; } } });
    return out;
  }
  function bfs(T, a, b) { const adj = new Map(); T.forEach(([x, r, y]) => { (adj.get(x) || adj.set(x, []).get(x)).push([y, r]); (adj.get(y) || adj.set(y, []).get(y)).push([x, r + ' (rev)']); }); const prev = new Map([[a, null]]); const Q = [a]; while (Q.length) { const c = Q.shift(); if (c === b) break; for (const [n, r] of adj.get(c) || []) if (!prev.has(n)) { prev.set(n, [c, r]); Q.push(n); } } if (!prev.has(b)) return null; const path = []; let c = b; while (prev.get(c)) { const [p, r] = prev.get(c); path.unshift([p, r, c]); c = p; } return path; }

  function graphSvg(T, path, W = 560, H = 300) {
    const g = svg(W, H); const ents = [...new Set(T.flatMap(([a, , b]) => [a, b]))];
    const pos = new Map(ents.map((e, i) => [e, [W / 2 + Math.cos((i / ents.length) * 2 * Math.PI) * (W / 2 - 90), H / 2 + Math.sin((i / ents.length) * 2 * Math.PI) * (H / 2 - 30)]]));
    const onPath = (a, b) => path && path.some(([x, , y]) => (x === a && y === b) || (x === b && y === a));
    T.forEach(([a, r, b]) => { const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b); const hot = onPath(a, b); g.appendChild(s('line', { x1, y1, x2, y2, stroke: hot ? 'var(--accent)' : 'var(--rule)', 'stroke-width': hot ? 3 : 1.2 })); g.appendChild(s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 3, 'text-anchor': 'middle', class: 'lbl', text: r, style: hot ? 'fill:var(--accent)' : '' })); });
    ents.forEach((e, i) => { const [x, y] = pos.get(e); const hot = path && path.some(([a, , b]) => a === e || b === e); g.appendChild(s('rect', { x: x - 58, y: y - 12, width: 116, height: 24, rx: 12, fill: mix('var(--t4)', hot ? 45 : 15), stroke: hot ? 'var(--accent)' : 'var(--t4)' })); g.appendChild(s('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 10.5, text: e })); });
    return g;
  }

  const TREE = { t: 'Employee handbook (212 pages)', c: [
    { t: '1 Working here', c: [{ t: '1.1 Hours and leave' }, { t: '1.2 Remote work' }] },
    { t: '2 Money', c: [{ t: '2.1 Payroll' }, { t: '2.2 Expenses', c: [{ t: '2.2.1 What you can claim, p. 41' }, { t: '2.2.2 Approval limits, p. 43' }] }, { t: '2.3 Pensions' }] },
    { t: '3 Security', c: [{ t: '3.1 Devices' }, { t: '3.2 Data handling' }] },
  ] };
  const WALK = [['Employee handbook (212 pages)', 'Question is about approving an expense, which is money.'], ['2 Money', 'Expenses, not payroll or pensions.'], ['2.2 Expenses', 'Approval rules, not what can be claimed.'], ['2.2.2 Approval limits, p. 43', 'Read this section: “Claims over $5,000 need director approval.” Cite p. 43.']];

  function treeSvg(step, W = 560) {
    const g = svg(W, 260); let y = 18;
    const onPath = WALK.slice(0, step + 1).map((w) => w[0]);
    const walk = (n, d) => { const hot = onPath.includes(n.t); g.appendChild(s('text', { x: 10 + d * 22, y, 'font-size': 11.5, text: (n.c ? '▸ ' : '• ') + n.t, style: hot ? 'fill:var(--accent);font-weight:700' : 'fill:var(--muted)' })); y += 19; if (n.c && (hot || d === 0)) n.c.forEach((c) => walk(c, d + 1)); };
    walk(TREE, 0); return g;
  }

  function heroInit(box) {
    const g = svg(560, 300, { 'aria-label': 'The same question answered by vector search, graph traversal and tree navigation' }); box.appendChild(g);
    const T = triples(PARA), path = bfs(T, 'Ada Lovelace', 'Alan Turing');
    function draw(step) {
      clear(g);
      const cols = [[10, 'Vector RAG'], [196, 'Graph RAG'], [382, 'Vectorless RAG']];
      cols.forEach(([x, n], i) => { const on = step === 0 || step === i + 1 || step === 4; const gg = s('g', { style: on ? '' : 'opacity:.2' }); g.appendChild(gg); gg.appendChild(s('rect', { x, y: 30, width: 172, height: 230, rx: 10, fill: 'var(--paper)', stroke: 'var(--rule)' })); gg.appendChild(s('text', { x: x + 10, y: 50, 'font-size': 12, text: n, style: 'font-weight:600' }));
        if (i === 0) { const r = rng(4); for (let k = 0; k < 40; k++) { const px = x + 20 + r() * 140, py = 70 + r() * 170, near = Math.hypot(px - (x + 100), py - 150) < 28; gg.appendChild(s('circle', { cx: px, cy: py, r: near ? 4.5 : 3, fill: near && (step === 1 || step === 4) ? 'var(--t5)' : 'var(--rule)' })); } gg.appendChild(s('circle', { cx: x + 100, cy: 150, r: 28, fill: 'none', stroke: 'var(--t5)', 'stroke-dasharray': '3 3' })); }
        if (i === 1) { const ents = ['Ada', 'Babbage', 'Engine', 'Turing']; ents.forEach((e, k) => { const ex = x + 30 + (k % 2) * 100, ey = 90 + k * 40; gg.appendChild(s('rect', { x: ex - 26, y: ey - 11, width: 60, height: 22, rx: 11, fill: mix('var(--t4)', step >= 2 ? 40 : 15), stroke: 'var(--t4)' })); gg.appendChild(s('text', { x: ex + 4, y: ey + 4, 'text-anchor': 'middle', 'font-size': 10, text: e })); if (k) { const px = x + 30 + ((k - 1) % 2) * 100, py = 90 + (k - 1) * 40; gg.appendChild(s('line', { x1: px + 4, y1: py + 11, x2: ex + 4, y2: ey - 11, stroke: step === 2 || step === 4 ? 'var(--accent)' : 'var(--rule)', 'stroke-width': 2 })); } }); gg.appendChild(s('text', { x: x + 10, y: 250, class: 'lbl', text: '3 hops: Ada → Babbage → Engine → Turing' })); }
        if (i === 2) { ['Handbook', '2 Money', '2.2 Expenses', '2.2.2 Approval'].forEach((t, k) => { gg.appendChild(s('text', { x: x + 14 + k * 12, y: 80 + k * 34, 'font-size': 10.5, text: '▸ ' + t, style: step === 3 || step === 4 ? 'fill:var(--accent);font-weight:600' : '' })); }); gg.appendChild(s('text', { x: x + 10, y: 250, class: 'lbl', text: 'cites page 43' })); }
      });
      const msg = ['Three indexes, three ways to find an answer.', 'Vector: nearest chunks to the question’s embedding. Great for “find text about X”.', 'Graph: “How is Ada Lovelace connected to Alan Turing?” needs a chain of facts spread over several sentences.', 'Vectorless: an LLM reads a table of contents and reasons down the tree to the right section.', 'Each wins on a different kind of question.'];
      g.appendChild(s('text', { x: 10, y: 18, 'font-size': 12, text: msg[step], style: 'font-weight:600' }));
      g.appendChild(s('text', { x: 10, y: 285, class: 'lbl', text: path ? 'Graph path computed by breadth-first search over triples extracted from a paragraph (see widget).' : '' }));
    }
    return { go: draw };
  }

  function kgBuilder() {
    const w = widget('Build a mini knowledge graph', 'Try it', 'Triples are extracted with simple verb patterns as a stand-in for LLM extraction. Edit the paragraph using the same verbs (worked with, designed, inspired, founded, wrote, worked at, is located in, was born in).');
    const ta = h('textarea', { id: 'kg-in', rows: 4 }, PARA);
    const out = h('div'); const ro = readout(); const sel = {};
    const pick = (id, v) => (sel[id] = h('select', { id, onchange: draw }, []));
    pick('kg-a'); pick('kg-b');
    let T = [];
    function fill() { T = triples(ta.value); const ents = [...new Set(T.flatMap(([a, , b]) => [a, b]))]; ['kg-a', 'kg-b'].forEach((id, k) => { const cur = sel[id].value; clear(sel[id]); ents.forEach((e) => sel[id].appendChild(h('option', { value: e, selected: cur ? e === cur : e === (k ? 'England' : 'Ada Lovelace') }, e))); }); }
    function draw() {
      const path = bfs(T, sel['kg-a'].value, sel['kg-b'].value);
      clear(out).append(graphSvg(T, path), table(['subject', 'relation', 'object'], T));
      ro.set([['triples', T.length], ['path', path ? path.map(([a, r, b]) => `${a} —${r}→ ${b}`).join(' · ') || 'same entity' : 'not connected'], ['hops', path ? path.length : '—']]);
    }
    ta.addEventListener('input', () => { fill(); draw(); });
    w.body.append(ta, h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', { for: 'kg-a' }, 'from'), sel['kg-a']), h('div', { class: 'ctl' }, h('label', { for: 'kg-b' }, 'to'), sel['kg-b'])), ro.el, out);
    fill(); draw();
    return w.el;
  }

  function treeNav() {
    const w = widget('Tree-index navigator', 'Try it', 'A written walk-through of how a vectorless (PageIndex-style) retriever reasons down a document tree for: “Who must approve a $6,000 expense claim?”');
    let k = 0; const out = h('div'); const why = h('p', { class: 'muted' });
    function draw() { clear(out).appendChild(treeSvg(k)); why.textContent = `Step ${k + 1}: open “${WALK[k][0]}”. ${WALK[k][1]}`; }
    w.body.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => { k = Math.min(WALK.length - 1, k + 1); draw(); } }, 'Next reasoning step'), h('button', { class: 'btn', type: 'button', onclick: () => { k = 0; draw(); } }, 'Reset')), out, why);
    draw();
    return w.el;
  }

  LLM.mod('26', {
    hook: 'Which questions can’t nearest-neighbour search answer, however good the embeddings?',
    intro: ['Vector search finds passages that look like the question. It struggles when the answer is a chain of facts spread across documents, when the question is about the whole corpus, or when you need a traceable page-level citation in a long structured document. Graphs and tree indexes handle those cases.'],
    hero: { steps: [
      { title: 'Three kinds of index', text: 'Chunks as vectors, facts as a graph of entities and relations, or a document as a tree of sections.' },
      { title: 'Vector RAG', text: 'Embed the question and take the nearest chunks. Fast and general.' },
      { title: 'Graph RAG', text: 'Extract entities and relations with an LLM, then answer multi-hop questions by walking edges. Community detection groups the graph and pre-writes summaries for “main themes” questions (global search).' },
      { title: 'Vectorless RAG', text: 'No embeddings, no chunking: build a table-of-contents tree with section summaries, and let the LLM decide which branch to open at each level, as a person would. PageIndex is the leading open-source example.' },
      { title: 'Pick per question', text: 'Large loosely structured collections: vectors. Multi-hop and corpus-wide: graphs. Long well-structured documents needing traceable citations: trees, at more LLM calls per query.' },
    ], init: heroInit },
    sections: [
      { title: 'Graph RAG in practice', widget: kgBuilder },
      { title: 'Open knowledge graphs', depth: 'mechanics', body: ['Public graphs such as <b>Wikidata</b> and DBpedia store billions of facts as (subject, predicate, object) triples in RDF, queried with SPARQL. <b>Entity linking</b> maps a mention like “Turing” to an ID like Q7251. An LLM can write the SPARQL (or Cypher, for property graphs) and ground its answer in curated facts. This query lists people born in London, using Wikidata IDs:', code('SELECT ?person ?personLabel WHERE {\n  ?person wdt:P19 wd:Q84 .            # place of birth = London\n  ?person wdt:P31 wd:Q5 .             # instance of = human\n  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }\n} LIMIT 10'), 'Run it at query.wikidata.org; results are not reproduced here.'] },
      { title: 'Vectorless RAG', widget: treeNav },
      { title: 'Choosing', body: [table(['Approach', 'Index', 'Retrieval step', 'Best for'], window.PLAN.modules['26'].tables[0].rows)] },
    ],
    maths: [
      { note: 'A knowledge graph as a set of triples, and a k-hop answer as a path:', tex: '\\mathcal{G}=\\{(h,r,t)\\},\\qquad e_0\\xrightarrow{r_1}e_1\\xrightarrow{r_2}\\cdots\\xrightarrow{r_k}e_k' },
      { note: 'Community detection (e.g. Leiden) maximises modularity:', tex: 'Q=\\frac{1}{2m}\\sum_{ij}\\Big(A_{ij}-\\frac{k_ik_j}{2m}\\Big)\\delta(c_i,c_j)' },
    ],
    leaves: ['Regex extraction is far cruder than LLM extraction, which also has errors that need checking.', 'Building a graph over a large corpus costs many LLM calls; plan for it.', 'Tree navigation costs several LLM calls per query and is slower than a vector lookup.'],
    quiz: [
      { q: '“What are the main themes across these 10,000 support tickets?” suits…', opts: ['Vector top-k', 'Graph RAG global search over community summaries', 'BM25', 'A re-ranker'], a: 1, why: 'No single chunk answers a corpus-wide question; precomputed community summaries can.' },
      { q: 'What does entity linking do?', opts: ['Embeds entities', 'Maps a text mention to a unique ID in the knowledge graph', 'Draws the graph', 'Splits documents'], a: 1, why: '“Paris” → the city (Q90), not Paris Hilton.' },
      { q: 'A main advantage of tree-based vectorless retrieval is…', opts: ['Lowest latency', 'Traceable, section-level answers in long structured documents', 'No LLM needed', 'Works best on tweets'], a: 1, why: 'The reasoning path names the sections and pages it opened.' },
    ],
  });
})();
