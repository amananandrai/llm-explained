(function () {
  const { h, s, svg, clear, slider, widget, readout, fmt, human, mix, tokColor, lineChart, rng, barRows } = LLM.util;
  // illustrative decay: accuracy vs input tokens (shape only)
  const acc = (n) => 0.93 - 0.32 * Math.log10(1 + n / 8000) / Math.log10(1 + 128);

  function heroInit(box) {
    const g = svg(560, 340, { 'aria-label': 'A desk filling with papers while an accuracy gauge drops, then compaction clears it' }); box.appendChild(g);
    const r0 = rng(28); const papers = Array.from({ length: 60 }, () => [r0(), r0(), (r0() - 0.5) * 20, Math.floor(r0() * 8)]);
    function draw(step) {
      clear(g);
      const n = [3, 12, 30, 60, 6][step], tokens = [4e3, 2e4, 6e4, 2e5, 1.2e4][step];
      g.appendChild(s('rect', { x: 14, y: 40, width: 330, height: 240, rx: 10, fill: mix('var(--t6)', 14), stroke: 'var(--t6)' }));
      papers.slice(0, n).forEach(([x, y, rot, c], i) => { const px = 30 + x * 270, py = 55 + y * 180; g.appendChild(s('rect', { x: px, y: py, width: 46, height: 32, rx: 2, fill: 'var(--surface)', stroke: tokColor(c), transform: `rotate(${rot} ${px + 23} ${py + 16})` })); });
      const needle = papers[2]; const nx = 30 + needle[0] * 270, ny = 55 + needle[1] * 180;
      g.appendChild(s('rect', { x: nx, y: ny, width: 46, height: 32, rx: 2, fill: mix('var(--accent)', 35), stroke: 'var(--accent)', 'stroke-width': 2 }));
      g.appendChild(s('text', { x: nx + 23, y: ny + 20, 'text-anchor': 'middle', 'font-size': 9, text: 'the fact' }));
      const a = step === 4 ? acc(tokens) : acc(tokens);
      g.appendChild(s('circle', { cx: nx + 23, cy: ny + 16, r: 60 - step * 8, fill: 'var(--warn)', style: `opacity:${(0.05 + 0.25 * a).toFixed(2)}` }));
      // gauge
      const gx = 450, gy = 170, R = 70; g.appendChild(s('path', { d: `M${gx - R},${gy} A${R},${R} 0 0 1 ${gx + R},${gy}`, fill: 'none', stroke: 'var(--sunk)', 'stroke-width': 14 }));
      const ang = Math.PI * (1 - a); g.appendChild(s('path', { d: `M${gx - R},${gy} A${R},${R} 0 0 1 ${gx + R * Math.cos(ang)},${gy - R * Math.sin(ang)}`, fill: 'none', stroke: a > 0.8 ? 'var(--pass)' : a > 0.7 ? 'var(--warn)' : 'var(--fail)', 'stroke-width': 14 }));
      g.appendChild(s('text', { x: gx, y: gy - 10, 'text-anchor': 'middle', 'font-size': 20, text: Math.round(a * 100) + '%', style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: gx, y: gy + 22, 'text-anchor': 'middle', class: 'lbl', text: 'accuracy (illustrative)' }));
      g.appendChild(s('text', { x: gx, y: gy + 44, 'text-anchor': 'middle', 'font-size': 12, text: human(tokens) + ' tokens' }));
      g.appendChild(s('text', { x: 14, y: 24, 'font-size': 12.5, text: ['A tidy desk: instructions, one document, the question', 'More documents, more tool output', 'Long history and distractors pile up', 'Near the advertised limit: the model still “has” the fact, but uses it worse', 'Compaction: summarise, keep the key facts, clear the rest'][step], style: 'font-weight:600' }));
      g.appendChild(s('text', { x: 14, y: 330, class: 'lbl', text: 'Accuracy curve is illustrative of the trend reported by Liu et al. 2023 and Chroma 2025, not a measurement.' }));
    }
    return { go: draw };
  }

  function middle() {
    const w = widget('Where is the fact?', 'Try it', 'Illustrative U-shape after Liu et al. 2023 (“Lost in the Middle”): accuracy is highest when the relevant document is first or last among 20, lowest in the middle. Exact values vary by model; newer models are flatter but rarely flat.');
    const U = (p) => 0.75 - 0.2 * Math.sin(Math.PI * p) ** 1.5 + (p < 0.05 ? 0.04 : 0);
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const sp = slider({ label: 'position of the relevant document (of 20)', min: 1, max: 20, value: 10, oninput: draw });
    const pts = Array.from({ length: 20 }, (_, i) => [i + 1, U(i / 19)]);
    function draw() { const v = U((sp.value - 1) / 19); ch.draw([{ pts, color: 'var(--q)', dots: [[sp.value, v]] }], { ymin: 0.4, ymax: 0.85, xlabel: 'position in context', ylabel: 'answer accuracy' }); ro.set([['accuracy at this position', (v * 100).toFixed(0) + '%'], ['vs best position', ((v - U(0)) * 100).toFixed(0) + ' points']]); }
    w.body.append(sp.el, ch.el, ro.el);
    draw();
    return w.el;
  }

  function budget() {
    const w = widget('Context-budget planner', 'Try it');
    const st = { win: 200000, sys: 3000, tools: 8000, ret: 20000, hist: 40000, out: 8000 };
    const sl = {}; const ro = readout(); const out = h('div');
    const mk = (k, l, a, b, step) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: human, oninput: (v) => { st[k] = v; draw(); } }));
    mk('win', 'context window', 8000, 1000000, 8000); mk('sys', 'system prompt + instructions', 0, 30000, 500); mk('tools', 'tool definitions', 0, 60000, 500); mk('ret', 'retrieved documents', 0, 400000, 1000); mk('hist', 'conversation + tool results', 0, 600000, 1000); mk('out', 'reserved for output', 1000, 64000, 1000);
    function draw() {
      const parts = [['system', st.sys, 'var(--res)'], ['tools', st.tools, 'var(--k)'], ['retrieval', st.ret, 'var(--t5)'], ['history', st.hist, 'var(--v)'], ['output', st.out, 'var(--accent)']];
      const used = parts.reduce((a, p) => a + p[1], 0);
      clear(out).appendChild(barRows(560, parts.map(([l, v, c]) => ({ label: l, v, text: human(v) + ` (${((v / st.win) * 100).toFixed(1)}%)`, color: c })), { max: st.win, labelW: 80 }));
      const advice = used > st.win ? 'Over the window: requests will fail or truncate.' : used > 0.6 * st.win ? 'Over 60% full: expect context rot. Compact history, trim tool output, retrieve less but better.' : st.tools > 0.2 * used ? 'Tool definitions take a large share: load tools on demand or use fewer, broader tools.' : 'Healthy: lean context leaves room and keeps attention sharp.';
      ro.set([['total', human(used) + ' / ' + human(st.win), used > st.win ? 'var(--fail)' : 'var(--ink)'], ['fill', ((used / st.win) * 100).toFixed(0) + '%'], ['advice', advice]]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), out, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('28', {
    hook: 'The model has a million-token window. Why does it get worse as you fill it?',
    intro: ['Context engineering is deciding what enters the window on every turn: instructions, tool definitions, retrieved documents, memory, history and tool results, in what order and at what size. It matters because of context rot: accuracy drops as the input grows, well before the advertised limit.'],
    hero: { steps: [
      { title: 'A small, clean context', text: 'Instructions, the one document that matters and the question. The model finds the fact easily.' },
      { title: 'More on the desk', text: 'Extra documents and verbose tool output arrive. Each is plausible; most are irrelevant to this question.' },
      { title: 'Distractors', text: 'Passages that look relevant but are not are worse than noise: they pull attention toward wrong answers.' },
      { title: 'Context rot', text: 'Near the limit the fact is still there, but the model uses it less reliably. Simple needle-in-a-haystack tests overstate long-context ability because the needle is lexically distinct from the hay.' },
      { title: 'Compaction', text: 'Summarise the history into notes, keep the key facts and recent turns, drop the rest. Or hand side tasks to a subagent with a fresh context (Module 34).' },
    ], init: heroInit },
    sections: [
      { title: 'Lost in the middle', widget: middle },
      { title: 'Engineering the window', body: [
        '<b>Order.</b> Stable content first (system prompt, tool definitions) so prompt caching can reuse it; long documents before the question; the most important instructions near the start or end.',
        '<b>Just in time.</b> Give the agent tools to fetch files, search and read, instead of pasting everything up front. Keep lightweight references (file paths, IDs) in context and load content when needed.',
        '<b>Trim tool output.</b> Return the 20 relevant lines, not 2,000; paginate; summarise logs.',
        '<b>Compaction and notes.</b> When the window fills, summarise and restart; let the agent keep a structured notes file it can reread (Module 29).',
        '<b>Isolation.</b> Run noisy side tasks in subagents and return only summaries.',
      ], widget: budget },
    ],
    maths: [
      { note: 'Attention spreads a fixed budget of weight across all keys, so each relevant token’s share tends to shrink as distractors are added:', tex: '\\sum_{j=1}^{n}\\alpha_{ij}=1\\quad\\Rightarrow\\quad \\alpha_{i,\\text{fact}}\\ \\text{falls as } n \\text{ grows, unless its score rises}' },
      { note: 'A budget constraint the planner checks:', tex: 'T_{\\text{sys}}+T_{\\text{tools}}+T_{\\text{retrieved}}+T_{\\text{history}}+T_{\\text{output}}\\le T_{\\text{window}}' },
    ],
    leaves: ['Both curves on this page are illustrative shapes; measured degradation depends on model, task and distractors.', 'Some models handle long context much better than others; test yours.', 'Compaction loses information; what to keep is a design decision.'],
    quiz: [
      { q: 'Why can needle-in-a-haystack tests overstate long-context ability?', opts: ['They use short contexts', 'The needle is easy to spot because it differs sharply from the surrounding text', 'They use images', 'They test output length'], a: 1, why: 'Real tasks need reasoning over similar-looking, partly relevant passages.' },
      { q: 'Where should stable content like the system prompt and tool definitions go?', opts: ['At the end', 'At the start, so prompt caching can reuse the prefix', 'In every message', 'Nowhere'], a: 1, why: 'Caches match prefixes; changing early content invalidates the cache.' },
      { q: 'A subagent helps against context rot because…', opts: ['it uses a bigger model', 'its noisy work happens in a fresh context and only a summary returns', 'it has no tools', 'it shares the parent’s context'], a: 1, why: 'Isolation keeps the main context small and clean.' },
    ],
  });
})();
