(function () {
  const { h, s, svg, clear, seg, widget, readout, mix, tween } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'Accuracy rises with more examples and wobbles when they are reordered' }); box.appendChild(g);
    const acc = { 0: 0.58, 1: 0.71, 3: 0.82 };
    const orders = [0.82, 0.69, 0.86, 0.74];
    let stop = () => {};
    const promptLines = {
      0: ['Classify the review as positive or negative.', '', 'Review: "The battery died after two days."', 'Label:'],
      1: ['Classify the review as positive or negative.', '', 'Review: "Loved the screen." Label: positive', '', 'Review: "The battery died after two days."', 'Label:'],
      3: ['Classify the review as positive or negative.', '', 'Review: "Loved the screen." Label: positive', 'Review: "Arrived broken." Label: negative', 'Review: "Fast and quiet." Label: positive', '', 'Review: "The battery died after two days."', 'Label:'],
      cot: ['…3 examples, each with a short reason…', '', 'Review: "The battery died after two days."', 'Reason: a battery failing quickly is a defect.', 'Label: negative'],
      json: ['Return JSON matching this schema:', '{"label": "positive" | "negative",', ' "confidence": number between 0 and 1}', '', '→ {"label": "negative", "confidence": 0.93}'],
    };
    function draw(step, t = 1, ord = 0) {
      clear(g);
      const key = [0, 1, 3, 3, 'cot', 'json'][step];
      const lines = promptLines[key];
      g.appendChild(s('rect', { x: 10, y: 14, width: 330, height: 22 + lines.length * 17, rx: 8, fill: 'var(--sunk)' }));
      lines.forEach((l, i) => g.appendChild(s('text', { x: 22, y: 34 + i * 17, 'font-size': 10.5, text: l, style: /Label: (positive|negative)/.test(l) ? 'fill:var(--v)' : '' })));
      const bx = 380, by = 40, bh = 220;
      g.appendChild(s('text', { x: bx, y: 28, 'font-size': 12, text: 'accuracy', style: 'font-weight:600' }));
      g.appendChild(s('rect', { x: bx, y: by, width: 60, height: bh, rx: 6, fill: 'var(--sunk)' }));
      let a = step <= 2 ? acc[key] : step === 3 ? orders[ord] : step === 4 ? 0.88 : 0.9;
      if (step <= 2) { const prev = step === 0 ? 0 : acc[[0, 1, 3][step - 1]]; a = prev + (a - prev) * t; }
      g.appendChild(s('rect', { x: bx, y: by + bh * (1 - a), width: 60, height: bh * a, rx: 6, fill: 'var(--q)' }));
      g.appendChild(s('text', { x: bx + 30, y: by + bh * (1 - a) - 6, 'text-anchor': 'middle', 'font-size': 13, text: Math.round(a * 100) + '%', style: 'font-weight:600' }));
      if (step === 3) orders.forEach((o, i) => { g.appendChild(s('circle', { cx: bx + 90, cy: by + bh * (1 - o), r: i === ord ? 6 : 4, fill: i === ord ? 'var(--accent)' : 'var(--muted)' })); g.appendChild(s('text', { x: bx + 100, y: by + bh * (1 - o) + 4, class: 'lbl', text: 'order ' + (i + 1) })); });
      g.appendChild(s('text', { x: 10, y: 330, class: 'lbl', text: 'Accuracies are illustrative of the pattern reported for small models (Brown et al. 2020; Lu et al. 2022), not a measured run.' }));
    }
    return {
      go(i) {
        stop();
        if (i <= 2) stop = tween(800, (t) => draw(i, t));
        else if (i === 3) { let k = 0; draw(3, 1, 0); const id = setInterval(() => { k = (k + 1) % 4; draw(3, 1, k); }, LLM.util.reduced() ? 1e9 : 700); const tm = setTimeout(() => clearInterval(id), 700 * 8); stop = () => { clearInterval(id); clearTimeout(tm); }; }
        else draw(i);
      },
    };
  }

  function builder() {
    const w = widget('Few-shot prompt builder', 'Try it', 'Token count uses the rough rule of 4 characters per token for English. The checks are common prompt-design rules of thumb, not a model’s judgement.');
    const pool = [['Loved the screen.', 'positive'], ['Arrived broken.', 'negative'], ['Fast and quiet.', 'positive'], ['Support never replied.', 'negative'], ['Great value for money.', 'positive'], ['Stopped working in a week.', 'negative']];
    const st = { sys: true, delim: true, json: false, cot: false, chosen: [0, 1, 2] };
    const input = 'The battery died after two days.';
    const pre = h('pre', { class: 'code', style: { whiteSpace: 'pre-wrap' } }); const ro = readout(); const checks = h('ul', { style: { margin: 0, paddingLeft: '1.2em', display: 'grid', gap: '4px', fontSize: '.93rem' } });
    const list = h('div', { style: { display: 'grid', gap: '6px' } });
    function drawList() {
      clear(list);
      pool.forEach(([t, l], i) => {
        const on = st.chosen.includes(i), pos = st.chosen.indexOf(i);
        list.appendChild(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          h('input', { type: 'checkbox', id: 'ex' + i, checked: on, onchange: (e) => { if (e.target.checked) st.chosen.push(i); else st.chosen = st.chosen.filter((x) => x !== i); drawList(); draw(); } }),
          h('label', { for: 'ex' + i, style: { flex: 1, minWidth: '180px' } }, `“${t}” → `, h('b', { style: { color: l === 'positive' ? 'var(--pass)' : 'var(--fail)' } }, l), on ? h('span', { class: 'muted mono', style: { fontSize: '.8rem' } }, `  #${pos + 1}`) : null),
          on ? h('button', { class: 'btn iconbtn', type: 'button', 'aria-label': 'Move earlier', onclick: () => { if (pos > 0) { [st.chosen[pos - 1], st.chosen[pos]] = [st.chosen[pos], st.chosen[pos - 1]]; drawList(); draw(); } } }, '↑') : null));
      });
    }
    function draw() {
      const L = [];
      if (st.sys) L.push('[system] You are a careful sentiment classifier for product reviews.');
      L.push('Classify the review as positive or negative.' + (st.cot ? ' Think step by step: give a one-line reason, then the label.' : ''));
      if (st.json) L.push('Respond only with JSON: {"label": "positive" | "negative"}');
      L.push('');
      const wrap = (t) => (st.delim ? `<review>${t}</review>` : t);
      st.chosen.forEach((i) => { const [t, l] = pool[i]; L.push('Review: ' + wrap(t)); if (st.cot) L.push('Reason: …'); L.push('Label: ' + (st.json ? `{"label": "${l}"}` : l)); L.push(''); });
      L.push('Review: ' + wrap(input)); L.push(st.cot ? 'Reason:' : 'Label:');
      pre.textContent = L.join('\n');
      const labs = st.chosen.map((i) => pool[i][1]);
      const pos = labs.filter((l) => l === 'positive').length;
      clear(checks);
      const chk = (ok, txt) => checks.appendChild(h('li', { style: { color: ok ? 'var(--ink)' : 'var(--warn)' } }, (ok ? '✓ ' : '! ') + txt));
      chk(st.chosen.length > 0, st.chosen.length ? `${st.chosen.length}-shot: examples show the format and label set` : 'zero-shot: the model must infer the format from the instruction alone');
      if (st.chosen.length) chk(Math.abs(pos - (labs.length - pos)) <= 1, `label balance ${pos} positive / ${labs.length - pos} negative` + (Math.abs(pos - (labs.length - pos)) > 1 ? ': models drift toward the majority label' : ''));
      if (st.chosen.length) chk(labs.length < 2 || labs[labs.length - 1] !== labs[labs.length - 2], 'last two examples ' + (labs.length >= 2 && labs[labs.length - 1] === labs[labs.length - 2] ? 'share a label: recency bias can tilt the answer' : 'differ, reducing recency bias'));
      chk(st.delim, st.delim ? 'input wrapped in delimiters' : 'no delimiters: a review containing instructions could be read as instructions (prompt injection, Module 39)');
      chk(st.json, st.json ? 'output format is machine-checkable' : 'free-text label: parse defensively, or ask for JSON');
      ro.set([['≈ tokens', Math.ceil(pre.textContent.length / 4)], ['examples', st.chosen.length]]);
    }
    const tog = (k, label) => { const sg = seg([[true, 'on'], [false, 'off']], st[k], (v) => { st[k] = v; draw(); }, label); return h('div', { class: 'ctl' }, h('label', null, label), sg.el); };
    w.body.append(h('div', { class: 'ctl-row' }, tog('sys', 'system prompt'), tog('delim', 'delimiters'), tog('json', 'JSON output'), tog('cot', 'chain of thought')), h('div', { class: 'eyebrow' }, 'Example pool (tick to include, ↑ to reorder)'), list, pre, ro.el, checks);
    drawList(); draw();
    return w.el;
  }

  function diffViewer() {
    const w = widget('Prompt diff viewer', 'Try it', 'Outputs are written for this page to illustrate typical behaviour; they are not recorded from a model.');
    const versions = {
      'v1 → v2: add a format line': [['Summarise the email below.', 'Email: {email}'], ['Summarise the email below.', 'Use at most 3 bullet points, each under 15 words.', 'Email: {email}'], 'The email from Priya discusses the project timeline, noting that the design review has moved to Thursday because two reviewers are travelling, and asks whether…', '• Design review moved to Thursday\n• Two reviewers are travelling\n• Priya needs your slides by Wednesday'],
      'v2 → v3: add an audience': [['Summarise the email below.', 'Use at most 3 bullet points, each under 15 words.', 'Email: {email}'], ['Summarise the email below for a manager who has 10 seconds.', 'Use at most 3 bullet points, each under 15 words.', 'Lead with any action the reader must take.', 'Email: {email}'], '• Design review moved to Thursday\n• Two reviewers are travelling\n• Priya needs your slides by Wednesday', '• ACTION: send slides to Priya by Wednesday\n• Design review now Thursday\n• Cause: two reviewers travelling'],
    };
    const out = h('div', { style: { display: 'grid', gap: '12px' } });
    function lcs(a, b) { const dp = a.map(() => b.map(() => 0)).concat([b.map(() => 0)]); for (let i = a.length - 1; i >= 0; i--) { dp[i] = dp[i] || []; for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? 1 + ((dp[i + 1] || [])[j + 1] || 0) : Math.max((dp[i + 1] || [])[j] || 0, dp[i][j + 1] || 0); } const r = []; let i = 0, j = 0; while (i < a.length || j < b.length) { if (i < a.length && j < b.length && a[i] === b[j]) { r.push([' ', a[i]]); i++; j++; } else if (j < b.length && (i >= a.length || ((dp[i + 1] || [])[j] || 0) <= (dp[i][j + 1] || 0))) { r.push(['+', b[j]]); j++; } else { r.push(['−', a[i]]); i++; } } return r; }
    function draw(k) {
      const [a, b, oa, ob] = versions[k];
      clear(out).append(h('div', { class: 'tokbox', style: { fontFamily: 'var(--f-mono)', fontSize: '.86rem', lineHeight: 1.7 } }, lcs(a, b).map(([op, l]) => h('div', { style: { background: op === '+' ? mix('var(--pass)', 15, 'var(--paper)') : op === '−' ? mix('var(--fail)', 12, 'var(--paper)') : 'transparent', padding: '0 6px', borderRadius: '4px' } }, (op === ' ' ? '  ' : op + ' ') + l))),
        h('div', { class: 'w-split' }, [['before', oa], ['after', ob]].map(([t, o]) => h('div', null, h('div', { class: 'eyebrow' }, 'example output · ' + t), h('pre', { class: 'code', style: { whiteSpace: 'pre-wrap' } }, o)))));
    }
    const sg = seg(Object.keys(versions), Object.keys(versions)[0], draw, 'Version');
    w.body.append(sg.el, out);
    draw(Object.keys(versions)[0]);
    return w.el;
  }

  LLM.mod('9', {
    hook: 'The model is fixed. How much can you change by changing only the words you give it?',
    intro: ['A prompt is the whole input the model conditions on. Because the model predicts what comes next, the prompt sets the format, the task and the standard of the answer. Showing examples in the prompt, with no weight updates, is called in-context learning.'],
    hero: {
      steps: [
        { title: 'Zero-shot', text: 'Only an instruction. The model must guess the format and the label set.' },
        { title: 'One-shot', text: 'One worked example shows exactly what an answer looks like.' },
        { title: 'Few-shot', text: 'A handful of examples covering both labels. Accuracy climbs, especially for smaller models.' },
        { title: 'Order matters', text: 'Same three examples, shuffled. Small models can swing by many points with order alone, and lean toward the label of the most recent example. Large models are steadier, but not immune.' },
        { title: 'Chain of thought', text: 'Asking for a short reason before the answer gives the model room to compute. Self-consistency samples several reasoning paths and takes the majority answer.' },
        { title: 'Structured output', text: 'Ask for JSON matching a schema, or use constrained decoding that only allows tokens that keep the output valid. Downstream code can then parse it reliably.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'What good prompts have in common', body: [
        '<b>System prompts and roles.</b> Chat models separate system, user and assistant turns. The system turn sets standing instructions and persona.',
        '<b>Clear instructions.</b> Say what to do, for whom, in what format and length. State what to do when the input does not fit.',
        '<b>Delimiters and long documents.</b> Wrap inputs in tags or quotes so the model can tell data from instructions. Put long documents first and the question after them.',
        '<b>Choosing examples.</b> Cover the label set, match the real input distribution, keep the format identical, and vary the order if results swing.',
        '<b>Templates and versioning.</b> Treat prompts as code: store them with variables, version every change, and run an eval set before shipping (Module 37).',
        '<b>Automatic optimisation.</b> Tools in the DSPy style search over instructions and example sets against a metric instead of hand-tuning.',
        '<b>Where this leads.</b> Prompt engineering grows into context engineering (Module 28): choosing everything that enters the window on every turn, including tool results and memory. Text in the prompt can also carry hostile instructions: prompt injection (Module 39).',
      ], widget: builder },
    ],
    maths: [
      { note: 'In-context learning conditions on k demonstrations without changing the weights θ:', tex: '\\hat y=\\arg\\max_y\\;P_\\theta\\big(y\\mid \\text{instr},\\,(x_1,y_1),\\dots,(x_k,y_k),\\,x\\big)' },
      { note: '<b>Self-consistency</b> samples m reasoning paths r and votes on the final answers:', tex: '\\hat y=\\arg\\max_{y}\\sum_{i=1}^{m}\\mathbb{1}\\big[\\mathrm{ans}(r_i)=y\\big],\\qquad r_i\\sim P_\\theta(\\cdot\\mid\\text{prompt})' },
    ],
    tryit: [diffViewer],
    leaves: ['The accuracy bars are illustrative; real gains depend heavily on the model and task.', 'Prompt sensitivity shrinks with model size and instruction tuning, so old tricks may stop mattering or start hurting.', 'Good prompts do not make outputs correct; they make them more likely to be in the right shape. Evaluation is still required.'],
    quiz: [
      { q: 'What changes in the model when you add few-shot examples to a prompt?', opts: ['Its weights are fine-tuned on the examples', 'Nothing in the weights; only the context it conditions on', 'Its tokenizer', 'Its temperature'], a: 1, why: 'In-context learning uses the examples as input only. Close the chat and they are gone.' },
      { q: 'Your 4 examples are all labelled “positive”. What bias is likely?', opts: ['Recency and majority bias toward “positive”', 'No bias; labels do not matter', 'Bias toward longer outputs', 'The model refuses'], a: 0, why: 'Models tend to copy the majority and most recent labels in the context.' },
      { q: 'Why wrap user-supplied text in delimiters?', opts: ['It reduces token count', 'It helps the model separate data from instructions', 'It is required by the API', 'It enables JSON mode'], a: 1, why: 'Clear boundaries make it less likely that instructions inside the data are followed, though delimiters alone are not a full injection defence.' },
    ],
  });
})();
