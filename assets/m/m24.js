(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, mix, diagram, lineChart, rng } = LLM.util;
  const Q = 'Can I get a refund if I was charged twice?';
  // [passage, graded relevance 0-3, bi-encoder rank order index, cross-encoder score]
  const DOCS = [
    ['Refunds go back to the original payment method within 3–5 days.', 1, 0.62],
    ['Our pricing page lists all subscription plans.', 0, 0.05],
    ['Duplicate charges are refunded automatically once we confirm them.', 3, 0.94],
    ['Charge your device for 2 hours before first use.', 0, 0.02],
    ['If you see two identical payments, contact billing and we will reverse one.', 3, 0.91],
    ['Refund requests for digital goods are reviewed case by case.', 1, 0.48],
    ['You can change your payment card in Settings.', 0, 0.12],
    ['Pending authorisations may look like a second charge and drop off in 7 days.', 2, 0.77],
  ];
  const BI = [0, 5, 1, 6, 2, 3, 7, 4]; // bi-encoder order (topical match, misses the “twice” nuance)
  const ndcg = (order, k) => { const rel = order.map((i) => DOCS[i][1]); const dcg = rel.slice(0, k).reduce((a, r, i) => a + (2 ** r - 1) / Math.log2(i + 2), 0); const ideal = rel.slice().sort((a, b) => b - a).slice(0, k).reduce((a, r, i) => a + (2 ** r - 1) / Math.log2(i + 2), 0); return dcg / ideal; };
  const CE = DOCS.map((_, i) => i).sort((a, b) => DOCS[b][2] - DOCS[a][2]);

  function listSvg(order, title, k = 5) {
    const g = svg(560, 40 + order.length * 26);
    g.appendChild(s('text', { x: 4, y: 16, 'font-size': 12, text: `${title} · nDCG@${k} = ${fmt(ndcg(order, k), 3)}`, style: 'font-weight:600' }));
    order.forEach((i, r) => { const rel = DOCS[i][1]; const y = 26 + r * 26; g.appendChild(s('rect', { x: 4, y, width: 552, height: 22, rx: 4, fill: r < k ? mix('var(--t5)', 6 + rel * 18) : 'var(--sunk)' })); g.appendChild(s('text', { x: 12, y: y + 15, 'font-size': 10.5, text: `${r + 1}. ${DOCS[i][0].slice(0, 70)}` })); g.appendChild(s('text', { x: 550, y: y + 15, 'text-anchor': 'end', 'font-size': 10.5, text: 'rel ' + rel, style: 'font-weight:600' })); });
    return g;
  }

  function heroInit(box) {
    const wrap = h('div'); box.appendChild(wrap);
    const nodes = [
      { id: 'q', x: 20, y: 20, w: 150, h: 34, label: 'query', color: 'var(--q)' }, { id: 'p', x: 200, y: 20, w: 150, h: 34, label: 'passage', color: 'var(--v)' },
      { id: 'e1', x: 20, y: 90, w: 150, h: 44, label: 'encoder', sub: 'run once per query', color: 'var(--res)' }, { id: 'e2', x: 200, y: 90, w: 150, h: 44, label: 'encoder', sub: 'run offline, once', color: 'var(--res)' },
      { id: 'cos', x: 110, y: 170, w: 150, h: 34, label: 'cosine(q, p)', color: 'var(--t5)' },
      { id: 'pair', x: 390, y: 20, w: 150, h: 34, label: '[CLS] query [SEP] passage', fs: 10, color: 'var(--k)' }, { id: 'ce', x: 390, y: 90, w: 150, h: 44, label: 'cross-encoder', sub: 'tokens attend across', color: 'var(--res)' }, { id: 'sc', x: 390, y: 170, w: 150, h: 34, label: 'relevance score', color: 'var(--t5)' },
    ];
    const d = diagram(560, 230, nodes, [['q', 'e1'], ['p', 'e2'], ['e1', 'cos'], ['e2', 'cos'], ['pair', 'ce'], ['ce', 'sc']], 'Bi-encoder versus cross-encoder');
    const listBox = h('div');
    wrap.append(d.el, listBox);
    return { go(i) {
      const bi = ['q', 'p', 'e1', 'e2', 'cos'], ce = ['pair', 'ce', 'sc'];
      d.draw({ dim: i === 0 || i === 1 ? ce : i === 2 ? bi : [], hot: i === 2 ? ce : i === 0 ? bi : [], flow: i === 2 ? [['pair', 'ce'], ['ce', 'sc']] : [] });
      clear(listBox).appendChild(i >= 3 ? listSvg(CE, 'After cross-encoder re-ranking') : listSvg(BI, 'Bi-encoder top 8 for: ' + Q.slice(0, 30) + '…'));
    } };
  }

  function rerankDemo() {
    const w = widget('Before and after', 'Try it', 'Passages, relevance grades and cross-encoder scores are written for this page. nDCG is computed live.');
    let k = 5, which = 'after';
    const out = h('div'); const ro = readout();
    function draw() { clear(out).appendChild(listSvg(which === 'after' ? CE : BI, which === 'after' ? 'Re-ranked' : 'Bi-encoder only', k)); ro.set([['nDCG@' + k + ' before', fmt(ndcg(BI, k), 3)], ['after', fmt(ndcg(CE, k), 3), 'var(--pass)']]); }
    const sg = seg([['before', 'Before'], ['after', 'After']], which, (v) => { which = v; draw(); }, 'List');
    const sk = slider({ label: 'k', min: 1, max: 8, value: k, oninput: (v) => { k = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, h('div', { class: 'ctl' }, h('label', null, 'list'), sg.el), sk.el), ro.el, out);
    draw();
    return w.el;
  }

  function depth() {
    const w = widget('Candidate depth: recall vs latency', 'Try it', 'Simulation: the best passage’s rank under the bi-encoder is drawn from a long-tailed distribution (median ≈ 8). Latency assumes a cross-encoder scores one pair in the time you set, batched 32 at a time.');
    const r = rng(24); const ranks = Array.from({ length: 2000 }, () => Math.ceil(Math.exp(r() * r() * 6.2)));
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const sd = slider({ label: 'candidates re-ranked', min: 5, max: 500, step: 5, value: 100, oninput: draw });
    const sm = slider({ label: 'ms per batch of 32 pairs', min: 2, max: 60, value: 15, oninput: draw });
    const curve = [5, 10, 20, 50, 100, 150, 200, 300, 400, 500].map((n) => [n, ranks.filter((x) => x <= n).length / ranks.length]);
    function draw() { const rec = ranks.filter((x) => x <= sd.value).length / ranks.length; ch.draw([{ pts: curve, color: 'var(--t5)', dots: [[sd.value, rec]] }], { ymin: 0, ymax: 1, xlabel: 'candidates', ylabel: 'best passage reaches the re-ranker', marks: [{ x: sd.value }] }); ro.set([['recall into re-ranker', (rec * 100).toFixed(1) + '%'], ['re-rank latency', Math.ceil(sd.value / 32) * sm.value + ' ms']]); }
    w.body.append(h('div', { class: 'ctl-row' }, sd.el, sm.el), ch.el, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('24', {
    hook: 'Search found the right topic. Why is the best answer only fifth?',
    intro: ['Embedding search is fast because it compares precomputed vectors, but query and passage never see each other inside the model, so it misses nuances like “charged twice”. A cross-encoder reads the query and passage together and scores their match far more accurately, but it is too slow to run on the whole corpus. So production search does both: retrieve broadly, then re-rank the shortlist.'],
    hero: {
      steps: [
        { title: 'Bi-encoder', text: 'Query and passage are encoded separately and compared by cosine. Passages are embedded once, offline, so search over millions is milliseconds.' },
        { title: 'Good topic, wrong order', text: 'All eight results are about refunds or charges, but the two passages about duplicate charges sit at ranks 5 and 8.' },
        { title: 'Cross-encoder', text: 'Feed “query [SEP] passage” through one transformer. Every query token attends to every passage token, and a linear head on the [CLS] vector outputs a relevance score.', maths: '\\mathrm{score}(q,p)=w^{\\top}\\,h_{[CLS]}\\big(\\text{[CLS]}\\,q\\,\\text{[SEP]}\\,p\\big)' },
        { title: 'Re-ranked', text: 'Scoring the shortlist moves the duplicate-charge passages to the top. nDCG@5 rises accordingly.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Measure it', widget: rerankDemo },
      { title: 'How deep to re-rank', body: ['Typical pipelines retrieve 50–200 candidates and keep the top 5–10. Deeper means the right passage is more likely to be in the shortlist, at a linear cost in re-ranking time.', '<b>LLM rerankers</b> prompt a language model to score each passage (pointwise), compare pairs (pairwise) or sort a list (listwise); strong but slow and costly. <b>ColBERT</b> late interaction stores one vector per token and scores by summing each query token’s best match: much of a cross-encoder’s accuracy at near bi-encoder cost.'], widget: depth },
    ],
    maths: [
      { note: '<b>nDCG@k</b> with graded relevance rel_i at rank i:', tex: '\\mathrm{nDCG@}k=\\frac{1}{\\mathrm{IDCG@}k}\\sum_{i=1}^{k}\\frac{2^{rel_i}-1}{\\log_2(i+1)}' },
      { note: '<b>MRR</b> over queries Q, using the rank of the first relevant result; and the cost comparison for N candidates per query:', tex: '\\mathrm{MRR}=\\frac{1}{|Q|}\\sum_{q}\\frac{1}{\\mathrm{rank}_q},\\qquad \\text{bi-encoder: 1 query encode}\\quad\\text{vs}\\quad\\text{cross-encoder: } N\\ \\text{forward passes}' },
      { note: '<b>ColBERT</b> late-interaction score (MaxSim):', tex: 's(q,p)=\\sum_{i\\in q}\\max_{j\\in p}\\;\\hat q_i\\cdot\\hat p_j' },
    ],
    leaves: ['Eight passages with hand-set scores show the mechanism, not a measured improvement.', 'Re-rankers can be domain-sensitive; evaluate on your own queries (BEIR shows how much results vary across domains).', 'The candidate-depth curve is simulated.'],
    quiz: [
      { q: 'Why not use a cross-encoder for the whole corpus?', opts: ['It is less accurate', 'It needs one forward pass per (query, passage) pair, so cost grows with corpus size per query', 'It cannot read long text', 'It needs labels'], a: 1, why: 'A million passages would mean a million passes per query.' },
      { q: 'Relevances at ranks 1–3 are [3, 0, 2]. DCG@3?', opts: ['5', '9', '8.5', '10'], a: 2, why: '(2³−1)/log₂2 + 0 + (2²−1)/log₂4 = 7 + 0 + 1.5 = 8.5.' },
      { q: 'What does ColBERT store per passage?', opts: ['One vector', 'One vector per token', 'Only keywords', 'A cross-encoder score'], a: 1, why: 'Token-level vectors enable MaxSim matching at query time.' },
    ],
  });
})();
