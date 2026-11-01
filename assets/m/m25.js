(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, mix, diagram, table } = LLM.util;
  const N = (id, x, y, w, label, sub, color, shape) => ({ id, x, y, w, h: 40, label, sub, color, shape });
  const nodes = [
    N('q', 10, 150, 80, 'question', '', 'var(--q)', 'pill'),
    N('rw', 104, 150, 106, 'rewrite', 'HyDE, multi-query', 'var(--q)'),
    N('agent', 110, 40, 90, 'agent', 'decides, loops', 'var(--k)'),
    N('dense', 230, 100, 90, 'dense', 'vector search', 'var(--t5)', 'cyl'),
    N('bm25', 230, 200, 90, 'BM25', 'keywords', 'var(--t5)', 'cyl'),
    N('graph', 230, 290, 90, 'graph', 'entities, hops', 'var(--t4)', 'cyl'),
    N('mm', 230, 10, 90, 'media', 'tables, images', 'var(--t6)', 'cyl'),
    N('rrf', 340, 150, 70, 'fuse', 'RRF', 'var(--t5)'),
    N('rr', 340, 230, 70, 'rerank', '', 'var(--t5)'),
    N('grade', 430, 230, 80, 'grade', 'good enough?', 'var(--warn)'),
    N('web', 430, 300, 80, 'web search', 'fallback', 'var(--res)'),
    N('llm', 430, 150, 80, 'LLM', 'generate', 'var(--accent)'),
    N('a', 430, 60, 80, 'answer', 'with citations', 'var(--pass)', 'pill'),
  ];
  const edges = [['q', 'rw'], ['q', 'dense'], ['rw', 'dense'], ['rw', 'bm25'], ['dense', 'rrf'], ['bm25', 'rrf'], ['rrf', 'rr'], ['rr', 'grade'], ['grade', 'llm'], ['grade', 'web'], ['web', 'llm'], ['dense', 'llm'], ['rrf', 'llm'], ['llm', 'a'], ['q', 'agent'], ['agent', 'dense'], ['agent', 'bm25'], ['agent', 'graph'], ['graph', 'llm'], ['mm', 'llm'], ['agent', 'mm']];
  const TYPES = [
    { name: 'Naive RAG', show: ['q', 'dense', 'llm', 'a'], flow: [['q', 'dense'], ['dense', 'llm'], ['llm', 'a']], text: 'Chunk, embed, retrieve top-k, paste into the prompt, generate. Fails when the question’s wording differs from the document’s, or when the top chunks are near-misses.' },
    { name: 'Advanced RAG', show: ['q', 'rw', 'dense', 'rrf', 'rr', 'llm', 'a'], flow: [['q', 'rw'], ['rw', 'dense'], ['dense', 'rrf'], ['rrf', 'rr']], text: 'Add stations before retrieval (rewrite the query, generate a hypothetical answer to search with (HyDE), or several query variants) and after it (re-rank, compress).' },
    { name: 'Hybrid RAG', show: ['q', 'rw', 'dense', 'bm25', 'rrf', 'rr', 'llm', 'a'], flow: [['rw', 'bm25'], ['dense', 'rrf'], ['bm25', 'rrf']], text: 'Dense vectors catch meaning; BM25 catches exact terms like error codes and names. Reciprocal rank fusion merges the two ranked lists.' },
    { name: 'Graph RAG', show: ['q', 'agent', 'graph', 'llm', 'a'], flow: [['agent', 'graph'], ['graph', 'llm']], text: 'Extract entities and relations into a knowledge graph. Multi-hop and “what are the main themes” questions follow edges and community summaries instead of nearest chunks (Module 26).' },
    { name: 'Agentic RAG', show: ['q', 'agent', 'dense', 'bm25', 'graph', 'llm', 'a'], flow: [['q', 'agent'], ['agent', 'dense'], ['agent', 'bm25'], ['agent', 'graph']], text: 'An agent decides whether to search, which tool to use, and whether to search again after reading results (Module 27).' },
    { name: 'Self-RAG and CRAG', show: ['q', 'rw', 'dense', 'bm25', 'rrf', 'rr', 'grade', 'web', 'llm', 'a'], flow: [['rr', 'grade'], ['grade', 'web'], ['web', 'llm']], text: 'Grade the retrieved context (and the draft answer). If it is weak, re-retrieve or fall back to web search before answering.' },
    { name: 'Multimodal RAG', show: ['q', 'agent', 'mm', 'dense', 'llm', 'a'], flow: [['agent', 'mm'], ['mm', 'llm']], text: 'Retrieve tables, charts, images, audio and video segments, embedded with multimodal models (Module 19), and pass them to a model that can read them.' },
  ];

  function heroInit(box) {
    const d = diagram(530, 350, nodes, edges, 'RAG pipeline variants'); box.appendChild(d.el);
    return { go(i) { const t = TYPES[i]; d.draw({ show: t.show, flow: t.flow, hot: t.flow.flat().filter((x, k, a) => a.indexOf(x) === k && !['q', 'llm', 'a'].includes(x)), notes: [[300, 345, t.name, 'font-weight:700;font-family:var(--f-display);font-size:14px']] }); } };
  }

  function rrf() {
    const w = widget('Reciprocal rank fusion', 'Try it');
    const dense = ['refund-policy', 'billing-faq', 'duplicate-charges', 'pricing', 'card-update'];
    const bm25 = ['error-E402', 'duplicate-charges', 'refund-policy', 'chargeback', 'billing-faq'];
    const out = h('div'); const ro = readout();
    const sk = slider({ label: 'k (damping)', min: 1, max: 120, value: 60, oninput: draw });
    function draw() {
      const sc = new Map(); [dense, bm25].forEach((L) => L.forEach((d, r) => sc.set(d, (sc.get(d) || 0) + 1 / (sk.value + r + 1))));
      const fused = [...sc.entries()].sort((a, b) => b[1] - a[1]);
      clear(out).appendChild(h('div', { class: 'w-split' }, h('div', null, table(['#', 'dense', 'BM25'], dense.map((d, i) => [i + 1, d, bm25[i]]))), h('div', null, table(['fused', 'RRF score'], fused.map(([d, v]) => [d, fmt(v, 4)]), { num: [1] }))));
      ro.set([['top fused result', fused[0][0]], ['appears in both lists', fused.filter(([d]) => dense.includes(d) && bm25.includes(d)).length + ' docs']]);
    }
    w.body.append(sk.el, out, ro.el, h('p', { class: 'note-sim' }, 'RRF uses only ranks, so it needs no score calibration between retrievers. Documents found by both lists rise to the top.'));
    draw();
    return w.el;
  }

  function diagnose() {
    const w = widget('Diagnose this answer', 'Try it', 'Cases written for this page.');
    const MODES = ['Missed retrieval', 'Wrong chunk', 'Ignored context', 'Invented citation'];
    const cases = [
      { q: 'What is the return window for opened items?', ctx: '[1] Refunds go to the original payment method. [2] Card refunds take 3–5 business days.', ans: 'Opened items can be returned within 30 days [1].', a: 0, why: 'Nothing retrieved mentions opened items: the right chunk never reached the model. Fix retrieval (hybrid search, query rewriting, better chunking).' },
      { q: 'How fast are card refunds?', ctx: '[1] Card refunds take 3–5 business days after we receive the parcel.', ans: 'Card refunds are instant.', a: 2, why: 'The right fact was in context; the model answered from its own prior. Tighten the instruction to answer only from context, and test faithfulness.' },
      { q: 'Who approves expense reports over $5,000?', ctx: '[1] Travel must be booked through the portal. [2] Expense reports over $5,000 require … (chunk ends)', ans: 'I could not find who approves them.', a: 1, why: 'The retrieved chunk was cut mid-sentence; the approver is in the next chunk. Use structure-aware or overlapping chunks, or small-to-big retrieval.' },
      { q: 'When was the policy last updated?', ctx: '[1] This policy applies to all EU customers. [2] Returns are free for members.', ans: 'It was updated on 3 March 2026 [2].', a: 3, why: 'The answer cites [2], which says nothing about dates. Check that every cited span supports its claim.' },
    ];
    let i = 0; const box = h('div', { style: { display: 'grid', gap: '10px' } });
    function draw(pick) {
      const c = cases[i];
      clear(box).append(h('div', null, h('div', { class: 'eyebrow' }, `Case ${i + 1} of ${cases.length} · question`), h('p', null, c.q)), h('div', null, h('div', { class: 'eyebrow' }, 'retrieved context'), h('pre', { class: 'code', style: { whiteSpace: 'pre-wrap' } }, c.ctx)), h('div', null, h('div', { class: 'eyebrow' }, 'answer'), h('p', null, c.ans)),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, MODES.map((m, k) => h('button', { type: 'button', class: 'btn', style: pick != null && (k === c.a || k === pick) ? { borderColor: k === c.a ? 'var(--pass)' : 'var(--fail)' } : null, onclick: () => draw(k) }, m))),
        pick != null ? h('p', { class: 'muted' }, (pick === c.a ? '✓ ' : '✗ ' + MODES[c.a] + '. ') + c.why) : null,
        h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: () => { i = (i + 1) % cases.length; draw(); } }, 'Next case')));
    }
    w.body.append(box); draw();
    return w.el;
  }

  LLM.mod('25', {
    hook: 'Your model does not know last week’s policy change. Retrain it, or look it up?',
    intro: ['Retrieval-augmented generation looks up relevant text at question time and puts it in the prompt: fresh, private and citable knowledge without retraining. The basic pipe is simple; each of the seven designs below adds a part that fixes a failure of the one before.'],
    hero: { steps: TYPES.map((t) => ({ title: t.name, text: t.text })), init: heroInit },
    sections: [
      { title: 'The ladder at a glance', body: [table(['Type', 'Core idea', 'Animation shows'], window.PLAN.modules['25'].tables[0].rows)] },
      { title: 'Merging ranked lists', depth: 'mechanics', widget: rrf },
      { title: 'Long context vs RAG', body: ['A million-token context can hold a lot, but cost and latency grow with every token, and accuracy drops as context grows (Module 28). Retrieval keeps prompts small and cites sources; long context avoids retrieval misses. Many systems retrieve generously into a long context.'] },
      { title: 'Evaluating RAG', body: ['Score the two halves separately. <b>Retrieval</b>: recall@k (is the needed passage in the top k?), MRR and nDCG (is it near the top?). <b>Answer</b>: faithfulness (is every claim supported by the context?), answer relevance, and context precision (how much of the context was needed). Use a labelled question set plus LLM judges (RAGAS-style), and spot-check the judges.'], widget: diagnose },
    ],
    maths: [
      { note: '<b>Reciprocal rank fusion</b> over retrievers R:', tex: '\\mathrm{RRF}(d)=\\sum_{r\\in R}\\frac{1}{k+\\mathrm{rank}_r(d)},\\qquad k\\approx 60' },
      { note: 'RAG as marginalising over retrieved passages z (Lewis et al. 2020):', tex: 'P(y\\mid x)\\approx\\sum_{z\\in\\mathrm{top}\\text{-}k(x)}P_\\eta(z\\mid x)\\,P_\\theta(y\\mid x,z)' },
      { note: '<b>BM25</b> score for query terms t in document d:', tex: '\\mathrm{BM25}(q,d)=\\sum_{t\\in q}\\mathrm{IDF}(t)\\,\\frac{f(t,d)\\,(k_1+1)}{f(t,d)+k_1\\big(1-b+b\\,\\frac{|d|}{\\mathrm{avgdl}}\\big)}' },
    ],
    leaves: ['The seven types overlap; real systems mix parts from several.', 'No measured quality, latency or cost scoreboard is shown; the plan’s pipeline builder needs a fixed question set and recorded runs.', 'Retrieved text can carry prompt injections (Module 39).'],
    quiz: [
      { q: 'A user searches for error code “E402”. Which retriever is most likely to find it?', opts: ['Dense embeddings', 'BM25 keyword search', 'Graph traversal', 'A re-ranker'], a: 1, why: 'Rare exact tokens are where keyword search beats embeddings; hybrid RAG combines both.' },
      { q: 'With k = 60, a document ranked 1st by one retriever and absent from the other scores…', opts: ['1/60', '1/61', '2/61', '1'], a: 1, why: '1/(60 + 1).' },
      { q: 'The answer contradicts a passage that was in the context. Which failure mode?', opts: ['Missed retrieval', 'Ignored context', 'Wrong chunk', 'Invented citation'], a: 1, why: 'Retrieval worked; generation did not use it. Measure faithfulness.' },
    ],
  });
})();
