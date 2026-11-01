(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, mix, tokColor, table } = LLM.util;
  // 50-turn conversation; facts at specific turns. key = slot (later facts on the same slot replace earlier ones)
  const FACTS = [[3, 'allergy', 'Daughter is allergic to peanuts'], [8, 'city', 'Lives in Pune'], [14, 'budget', 'Trip budget is ₹50,000'], [21, 'diet', 'Vegetarian'], [27, 'dates', 'Travelling 12–19 March'], [33, 'city', 'Moved to Bengaluru'], [40, 'pref', 'Prefers trains to flights'], [46, 'budget', 'Budget raised to ₹65,000']];
  const QUESTIONS = [['allergy', 'Any food we should avoid?'], ['city', 'Where do we start from?'], ['budget', 'What is the budget?'], ['diet', 'Restaurant type?'], ['dates', 'Which dates?'], ['pref', 'How should we travel?']];

  function heroInit(box) {
    const g = svg(560, 330, { 'aria-label': 'A conversation scrolling past a fixed context window, with older turns compressed and facts stored' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const turn = [10, 24, 36, 50, 50][step], W = 10;
      g.appendChild(s('text', { x: 14, y: 20, 'font-size': 12.5, text: ['Working memory: the last 10 turns fit in the window', 'Older turns scroll out', 'Compaction writes a summary card', 'Key facts go to a long-term store', 'A later question retrieves the right fact'][step], style: 'font-weight:600' }));
      // timeline
      for (let t = 1; t <= 50; t++) { const x = 14 + (t - 1) * 10.6, inWin = t > turn - W && t <= turn, fact = FACTS.find((f) => f[0] === t); g.appendChild(s('rect', { x, y: 40, width: 9, height: 30, rx: 2, fill: t > turn ? 'var(--sunk)' : inWin ? 'var(--v)' : 'var(--res)', style: t > turn ? '' : inWin ? '' : 'opacity:.35' })); if (fact && t <= turn) g.appendChild(s('circle', { cx: x + 4.5, cy: 80, r: 4, fill: 'var(--accent)' })); }
      g.appendChild(s('rect', { x: 14 + (turn - W) * 10.6 - 2, y: 36, width: W * 10.6 + 2, height: 38, rx: 4, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }));
      g.appendChild(s('text', { x: 14, y: 100, class: 'lbl', text: `turn ${turn} · green = in context window · pink dot = turn with a fact` }));
      if (step >= 2) { g.appendChild(s('rect', { x: 14, y: 120, width: 240, height: 70, rx: 8, fill: mix('var(--t6)', 18), stroke: 'var(--t6)' })); g.appendChild(s('text', { x: 24, y: 140, 'font-size': 11.5, text: 'Summary of turns 1–' + (turn - W), style: 'font-weight:600' })); g.appendChild(s('text', { x: 24, y: 160, 'font-size': 10.5, text: 'Planning a family trip; vegetarian;' })); g.appendChild(s('text', { x: 24, y: 176, 'font-size': 10.5, text: 'budget discussed; dates set…' })); }
      if (step >= 3) { g.appendChild(s('text', { x: 290, y: 132, 'font-size': 11.5, text: 'long-term store', style: 'font-weight:600' })); const slots = {}; FACTS.forEach((f) => (slots[f[1]] = f)); Object.values(slots).forEach((f, i) => { const hot = step === 4 && f[1] === 'allergy'; g.appendChild(s('rect', { x: 290, y: 140 + i * 24, width: 250, height: 20, rx: 4, fill: hot ? mix('var(--accent)', 30) : mix('var(--t6)', 22), stroke: hot ? 'var(--accent)' : 'var(--t6)' })); g.appendChild(s('text', { x: 298, y: 154 + i * 24, 'font-size': 10.5, text: f[2] })); }); }
      if (step === 4) { g.appendChild(s('text', { x: 14, y: 230, 'font-size': 12, text: 'Turn 50: “Any food we should avoid at the hotel?”' })); g.appendChild(s('text', { x: 14, y: 250, 'font-size': 12, text: 'The allergy from turn 3 is long out of the window and too detailed for' })); g.appendChild(s('text', { x: 14, y: 266, 'font-size': 12, text: 'the summary, but semantic memory brings it back.' })); }
    }
    return { go: draw };
  }

  function simulator() {
    const w = widget('Memory simulator', 'Try it', 'A deterministic 50-turn trip-planning chat with 8 facts (two later facts replace earlier ones). At turn 50 the agent is asked six questions. Summary keeps the newest facts that left the window, up to its capacity.');
    const st = { win: 10, cap: 2, store: false, update: true };
    const out = h('div'); const ro = readout();
    function knows() {
      const T = 50, inWin = (f) => f[0] > T - st.win;
      const left = FACTS.filter((f) => !inWin(f));
      const summary = left.slice(-st.cap);
      const latest = {}; FACTS.forEach((f) => (latest[f[1]] = f));
      return QUESTIONS.map(([slot, q]) => {
        const truth = latest[slot];
        const seen = FACTS.filter((f) => f[1] === slot && (inWin(f) || summary.includes(f) || st.store));
        let ans = null, src = '—';
        if (seen.length) {
          if (st.store && !st.update && seen.length > 1 && !seen.some(inWin)) { ans = seen.map((f) => f[2]).join(' / '); src = 'store (conflict)'; }
          else { const f = seen[seen.length - 1]; ans = f[2]; src = inWin(f) ? 'context window' : summary.includes(f) ? 'summary' : 'long-term store'; }
        }
        const ok = ans === truth[2];
        return [q, ans || 'does not know', src, h('b', { style: { color: ok ? 'var(--pass)' : ans ? 'var(--warn)' : 'var(--fail)' } }, ok ? '✓' : ans ? 'stale or conflicting' : '✗')];
      });
    }
    function draw() { const rows = knows(); clear(out).appendChild(table(['Question at turn 50', 'Agent recalls', 'From', ''], rows)); ro.set([['correct', rows.filter((r) => r[3].textContent === '✓').length + ' / 6']]); }
    const sw = slider({ label: 'context window (turns)', min: 2, max: 50, value: st.win, oninput: (v) => { st.win = v; draw(); } });
    const sc = slider({ label: 'summary capacity (facts)', min: 0, max: 8, value: st.cap, oninput: (v) => { st.cap = v; draw(); } });
    const ss = seg([[false, 'no long-term store'], [true, 'long-term store']], false, (v) => { st.store = v; draw(); }, 'Store');
    const su = seg([[true, 'update replaces old fact'], [false, 'append only']], true, (v) => { st.update = v; draw(); }, 'Update');
    w.body.append(h('div', { class: 'ctl-row' }, sw.el, sc.el), ss.el, su.el, ro.el, out);
    draw();
    return w.el;
  }

  LLM.mod('29', {
    hook: 'The assistant was told about the peanut allergy forty turns ago. Does it still know?',
    intro: ['A model has no memory between calls except what is in its weights and what you put in its context. Everything else that feels like memory is engineering: deciding what to write down, where to keep it, and when to bring it back. This page gives a reusable taxonomy and the operations that act on it.'],
    hero: { steps: [
      { title: 'Working memory', text: 'The context window (and the KV cache that holds it during generation) is the only thing the model reads directly. Here it holds the last 10 turns.' },
      { title: 'Scrolling out', text: 'At turn 24 the peanut allergy from turn 3 is no longer in the window. Without help, it is gone.' },
      { title: 'Compaction', text: 'Summarise old turns into a short card. Summaries keep the gist but drop specifics, and the allergy may not survive.' },
      { title: 'Long-term memory', text: 'Extract key facts into a store as they appear. Later facts about the same thing (the move to Bengaluru, the new budget) should update, not pile up.' },
      { title: 'Retrieval', text: 'When a question touches a stored fact, retrieve it back into the window. This is RAG over the agent’s own past (Part 5).' },
    ], init: heroInit },
    sections: [
      { title: 'A taxonomy', body: [table(['Kind', 'Where it lives', 'Changed by'], [['Parametric', 'The weights', 'Training or fine-tuning only'], ['Working (short-term)', 'Context window and its KV cache', 'Every turn'], ['Episodic', 'Records of past sessions and events', 'Written after sessions, retrieved when relevant'], ['Semantic', 'Facts about the user, world or project (vector store, graph)', 'Extraction, updates'], ['Procedural', 'How to do things: instructions, skills, examples', 'Editing instruction files and skills (Module 33)'], ['Scratchpad / notes', 'Files the agent writes to itself during a long task', 'The agent, as it works']])] },
      { title: 'Run a conversation', widget: simulator },
      { title: 'Operations and care', body: ['<b>Write</b> (what is worth remembering?), <b>consolidate</b> (merge duplicates, summarise episodes into facts), <b>retrieve</b> (by relevance and recency), <b>update</b> (newer replaces older), <b>forget</b> (expire, or on request). Users should be able to see, correct and delete what is remembered, and sensitive data needs consent and retention rules (Module 40).'] },
    ],
    maths: [
      { note: 'A common retrieval score mixes relevance, recency and importance (Generative Agents, Park et al. 2023):', tex: '\\mathrm{score}(m)=\\alpha\\,\\cos(q,e_m)+\\beta\\,\\gamma^{\\,t_{now}-t_m}+\\delta\\,\\mathrm{importance}(m)' },
    ],
    leaves: ['The simulator follows fixed rules; real summarisers and extractors are LLM calls that sometimes drop or distort facts.', 'Memory stores can hold injected or wrong information that resurfaces later.', 'More memory is not always better: irrelevant recalls add to context rot.'],
    quiz: [
      { q: 'Which memory changes only through training?', opts: ['Working', 'Episodic', 'Parametric', 'Scratchpad'], a: 2, why: 'Knowledge in the weights.' },
      { q: 'The user said “Pune” at turn 8 and “moved to Bengaluru” at turn 33. An append-only store returns both. What is missing?', opts: ['Retrieval', 'An update operation that replaces the old fact', 'A bigger window', 'Compaction'], a: 1, why: 'Without updates, stale facts conflict with new ones.' },
      { q: 'Why might a summary lose the allergy?', opts: ['Summaries are random', 'Compression keeps the gist and drops specific details', 'Allergies are not text', 'The KV cache deletes it'], a: 1, why: 'That is why important facts are also extracted to a store.' },
    ],
  });
})();
