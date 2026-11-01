(function () {
  const { h, s, svg, clear, widget, readout, mix, tokColor, tween, table } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'An LLM typing word by word, a concept model emitting sentence blocks, and a decision model flipping one switch' }); box.appendChild(g);
    let stop = () => {};
    const words = ['Route', ' this', ' ticket', ' to', ' billing', '.'];
    const sents = ['Customer was charged twice.', 'Wants a refund.', 'Route to billing.'];
    function draw(step, t) {
      clear(g);
      const lanes = [['LLM', 'one token at a time', 30], ['Concept model', 'one sentence embedding at a time', 140], ['Decision model', 'one typed answer, one pass', 250]];
      lanes.forEach(([n, sub, y], i) => { const on = step === 0 || step === i + 1 || step >= 4; const gg = s('g', { style: on ? '' : 'opacity:.2' }); g.appendChild(gg); gg.appendChild(s('text', { x: 14, y: y + 14, 'font-size': 13, text: n, style: 'font-weight:600' })); gg.appendChild(s('text', { x: 14, y: y + 30, class: 'lbl', text: sub }));
        if (i === 0) { const k = step === 1 ? Math.floor(t * words.length) : step >= 4 ? words.length : 0; let x = 150; words.slice(0, k).forEach((w, j) => { const ww = 10 + w.length * 8; gg.appendChild(s('rect', { x, y: y + 6, width: ww, height: 26, rx: 5, fill: mix(tokColor(j), 30), stroke: tokColor(j) })); gg.appendChild(s('text', { x: x + ww / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 11, text: w.trim() })); x += ww + 3; }); gg.appendChild(s('text', { x: 150, y: y + 54, class: 'lbl', text: `${k} forward passes so far` })); }
        if (i === 1) { const k = step === 2 ? Math.ceil(t * 3) : step >= 4 ? 3 : 0; sents.slice(0, k).forEach((st, j) => { gg.appendChild(s('rect', { x: 150 + j * 132, y: y + 4, width: 126, height: 32, rx: 6, fill: mix('var(--t5)', 25 + j * 15), stroke: 'var(--t5)' })); gg.appendChild(s('text', { x: 213 + j * 132, y: y + 24, 'text-anchor': 'middle', 'font-size': 9.5, text: st })); }); gg.appendChild(s('text', { x: 150, y: y + 54, class: 'lbl', text: 'predicts the next concept vector, decodes it to text' })); }
        if (i === 2) { const on2 = step === 3 ? t : step >= 4 ? 1 : 0; gg.appendChild(s('rect', { x: 150, y: y + 4, width: 70, height: 34, rx: 17, fill: on2 > 0.5 ? 'var(--pass)' : 'var(--sunk)', stroke: 'var(--ink)' })); gg.appendChild(s('circle', { cx: 150 + 17 + on2 * 36, cy: y + 21, r: 13, fill: 'var(--surface)', stroke: 'var(--ink)' })); gg.appendChild(s('text', { x: 236, y: y + 18, 'font-size': 12, text: 'queue = "billing"' })); gg.appendChild(s('rect', { x: 236, y: y + 26, width: 200, height: 10, rx: 3, fill: 'var(--sunk)' })); gg.appendChild(s('rect', { x: 236, y: y + 26, width: 200 * 0.91 * on2, height: 10, rx: 3, fill: 'var(--pass)' })); gg.appendChild(s('text', { x: 442, y: y + 35, 'font-size': 11, text: on2 ? 'p = 0.91' : '' })); }
      });
      if (step === 4) g.appendChild(s('text', { x: 14, y: 345, 'font-size': 12, text: 'Same task, three output shapes. Pick the shape the task needs.' }));
    }
    return { go(i) { stop(); stop = tween(i >= 1 && i <= 3 ? 1600 : 0, (t) => draw(i, t)); } };
  }

  function sorter() {
    const w = widget('Pick the right model for the job', 'Try it');
    const KINDS = ['LLM', 'Decision model / classifier', 'Concept / world model'];
    const tasks = [
      ['Draft a reply to a customer complaint', 0, 'Open-ended text generation.'],
      ['Decide which of three LLMs should handle a request', 1, 'A bounded choice with a confidence score; routing must be fast and cheap.'],
      ['Check whether an agent’s proposed tool call is allowed', 1, 'A typed yes/no with calibrated probability fits a guard step.'],
      ['Summarise a 40-page contract', 0, 'Long free-form output.'],
      ['Tag 10 million support tickets by product area', 1, 'High-volume classification; latency and cost dominate.'],
      ['Plan a robot’s movements from video', 2, 'Predicting future states in representation space is the JEPA / world-model research agenda.'],
      ['Write and debug a Python function', 0, 'Code generation and iterative reasoning.'],
      ['Flag whether a message is spam', 1, 'Binary decision.'],
      ['Translate a paragraph into many languages at the sentence level', 2, 'Large Concept Models work in a language-agnostic sentence space; LLMs also do this well today.'],
      ['Answer an open research question with citations', 0, 'Reasoning plus generation plus tool use.'],
      ['Score a loan application as approve / review / reject', 1, 'A typed decision, which also needs governance (Module 40).'],
      ['Learn image features without labels for later tasks', 2, 'I-JEPA style self-supervised representation learning.'],
    ];
    const ans = new Array(tasks.length).fill(null);
    const list = h('div', { style: { display: 'grid', gap: '8px' } }); const ro = readout();
    function draw() {
      clear(list);
      tasks.forEach(([t, k, why], i) => {
        const row = h('div', { style: { display: 'grid', gap: '4px', padding: '8px 10px', border: '1px solid var(--rule)', borderRadius: '8px', background: 'var(--paper)' } }, h('div', null, t),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, KINDS.map((kn, j) => h('button', { type: 'button', class: 'btn', style: ans[i] === j ? { borderColor: j === k ? 'var(--pass)' : 'var(--fail)', background: mix(j === k ? 'var(--pass)' : 'var(--fail)', 12, 'var(--surface)') } : null, onclick: () => { ans[i] = j; draw(); } }, kn))),
          ans[i] != null ? h('div', { class: 'muted', style: { fontSize: '.88rem' } }, (ans[i] === k ? '✓ ' : '✗ Best fit: ' + KINDS[k] + '. ') + why) : null);
        list.appendChild(row);
      });
      const done = ans.filter((x) => x != null).length, right = ans.filter((x, i) => x === tasks[i][1]).length;
      ro.set([['answered', `${done} / ${tasks.length}`], ['matching the suggested fit', right]]);
    }
    w.body.append(ro.el, list);
    draw();
    return w.el;
  }

  LLM.mod('18', {
    hook: 'Does every AI system need to write its answer one word at a time?',
    intro: ['Next-token prediction is powerful and general, but it is not the only shape a model can have. Some research predicts whole sentence-level concepts, some predicts representations instead of raw data, some generates a whole sequence by denoising, and some returns one typed decision. Several of these are early research; the shapes matter more than any single system.'],
    hero: {
      steps: [
        { title: 'Three output shapes', text: 'The same support ticket handled by three kinds of model.' },
        { title: 'LLM: token by token', text: 'One forward pass per token, each conditioned on everything before. Flexible, but long outputs cost many passes.' },
        { title: 'Large Concept Model', text: 'Meta’s LCM predicts the next sentence-level embedding in a language-agnostic space (SONAR), then decodes each concept to text. It plans in bigger steps.' },
        { title: 'Decision model', text: 'Returns one typed answer with a calibrated probability in a single pass. TypeSafe AI’s Jev (released 15 September 2026) is pitched as a “System One” model for routing, action checks and classification inside software. Claims are the vendor’s and one 2026 study’s.' },
        { title: 'Match the shape to the task', text: 'Generation and open reasoning: LLMs. Fast bounded choices: decision models and small classifiers. Long-horizon planning: concept and world models, still largely research.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'The families', body: [table(['Approach', 'Predicts', 'Status'], [
        ['Large Concept Models (Meta, 2024)', 'Next sentence embedding in a shared multilingual space', 'Research models'],
        ['JEPA (LeCun et al.): I-JEPA, V-JEPA, LLM-JEPA', 'Representations of hidden parts of the input, not raw pixels or tokens', 'Research; LLM-JEPA adds a JEPA loss to LLM training'],
        ['Diffusion language models', 'A whole sequence, refined by iterative denoising', 'Research and early products; parallel generation'],
        ['Decision models (e.g. Jev, 2026)', 'One typed decision with calibrated probabilities', 'Early commercial; verify claims'],
      ])], widget: sorter },
    ],
    maths: [
      { note: '<b>JEPA</b>: predict the target’s representation from the context’s, with an encoder for each (the target encoder is often an exponential moving average to prevent collapse):', tex: '\\mathcal{L}=\\big\\|\\,g_\\phi\\big(f_\\theta(x_{\\text{context}})\\big)-\\mathrm{sg}\\big(\\bar f(x_{\\text{target}})\\big)\\big\\|^2' },
      { note: '<b>Concept model</b>: autoregression over sentence embeddings cₜ instead of tokens:', tex: 'P(c_{1:T})=\\prod_t P(c_t\\mid c_{<t}),\\qquad c_t=\\mathrm{Enc}(\\text{sentence}_t)' },
      { note: '<b>Decision model</b>: a single distribution over a fixed set of typed outcomes:', tex: 'P(y\\mid x),\\quad y\\in\\{\\text{billing},\\ \\text{tech},\\ \\text{sales}\\}' },
    ],
    leaves: ['These families overlap: LLMs can classify, and classifiers can be built from LLMs.', 'No latency or cost comparison is shown here; the build plan asks for published, dated figures, which should be added per system.', 'The plan’s “context language model” is read as Large Concept Models; confirm the intended topic.'],
    quiz: [
      { q: 'What does a JEPA predict?', opts: ['The next token', 'Raw pixels of masked patches', 'The representation of hidden parts of the input', 'A typed label'], a: 2, why: 'Predicting in representation space lets the model ignore unpredictable detail.' },
      { q: 'Which task suits a decision model best?', opts: ['Writing a novel', 'Routing requests to one of four queues at high volume', 'Explaining a proof', 'Translating a book'], a: 1, why: 'A bounded, typed choice where speed and calibration matter.' },
      { q: 'How does a Large Concept Model differ from an LLM?', opts: ['It is smaller', 'It predicts sentence-level embeddings rather than tokens', 'It has no decoder', 'It only works in English'], a: 1, why: 'It autoregresses over concepts in a language-agnostic embedding space.' },
    ],
  });
})();
