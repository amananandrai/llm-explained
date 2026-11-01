(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, mix, human, diagram, barRows } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 330, { 'aria-label': 'An orchestrator delegating to three subagents with small contexts, beside a single agent whose context overflows' }); box.appendChild(g);
    function bar(x, y, w, used, cap, label) { g.appendChild(s('text', { x, y: y - 5, class: 'lbl', text: label })); g.appendChild(s('rect', { x, y, width: w, height: 14, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x, y, width: Math.min(w, (used / cap) * w), height: 14, rx: 3, fill: used > cap ? 'var(--fail)' : used > 0.6 * cap ? 'var(--warn)' : 'var(--v)' })); }
    function draw(step) {
      clear(g);
      g.appendChild(s('text', { x: 14, y: 20, 'font-size': 12.5, text: ['Task: compare three vendors’ security docs and write a recommendation', 'Single agent: reads all three vendors’ docs in one context', 'Orchestrator splits the task into three subtasks', 'Each subagent works in its own fresh context', 'Only short summaries return; the main context stays small'][step], style: 'font-weight:600' }));
      // single agent column
      const single = [0, 3, 3, 3, 3][step] * 70000 + 10000;
      g.appendChild(s('rect', { x: 14, y: 40, width: 200, height: 250, rx: 10, fill: 'var(--paper)', stroke: 'var(--rule)', style: step >= 2 ? 'opacity:.45' : '' }));
      g.appendChild(s('text', { x: 24, y: 62, 'font-size': 12, text: 'single agent', style: 'font-weight:600' }));
      bar(24, 84, 180, single, 200000, `context ${human(single)} / 200k`);
      if (step >= 1) ['vendor A docs', 'vendor B docs', 'vendor C docs'].forEach((t, i) => { g.appendChild(s('rect', { x: 24, y: 120 + i * 40, width: 180, height: 30, rx: 5, fill: mix(`var(--t${i})`, 25) })); g.appendChild(s('text', { x: 34, y: 140 + i * 40, 'font-size': 11, text: t + ' (70k tokens)' })); });
      if (step >= 1) g.appendChild(s('text', { x: 24, y: 270, 'font-size': 11, text: single > 200000 ? 'overflows: must truncate or compact' : '', style: 'fill:var(--fail)' }));
      if (step >= 2) {
        g.appendChild(s('rect', { x: 300, y: 40, width: 160, height: 44, rx: 22, fill: mix('var(--accent)', 22), stroke: 'var(--accent)' }));
        g.appendChild(s('text', { x: 380, y: 66, 'text-anchor': 'middle', 'font-size': 12, text: 'orchestrator', style: 'font-weight:600' }));
        bar(300, 104, 160, step >= 4 ? 13000 : 10000, 200000, 'main context');
        ['A', 'B', 'C'].forEach((v, i) => { const x = 250 + i * 100; g.appendChild(s('line', { x1: 380, y1: 84, x2: x + 40, y2: 160, stroke: step >= 4 ? 'var(--pass)' : 'var(--muted)', 'stroke-width': step >= 4 ? 2.5 : 1.2, 'stroke-dasharray': step >= 4 ? '5 3' : null })); g.appendChild(s('circle', { cx: x + 40, cy: 200, r: 40, fill: mix(`var(--t${i})`, step >= 3 ? 22 : 8), stroke: `var(--t${i})` })); g.appendChild(s('text', { x: x + 40, y: 198, 'text-anchor': 'middle', 'font-size': 11, text: 'subagent ' + v, style: 'font-weight:600' })); if (step >= 3) g.appendChild(s('text', { x: x + 40, y: 214, 'text-anchor': 'middle', class: 'lbl', text: '75k, fresh' })); if (step >= 4) { g.appendChild(s('rect', { x: x + 10, y: 250, width: 60, height: 18, rx: 4, fill: 'var(--pass)' })); g.appendChild(s('text', { x: x + 40, y: 263, 'text-anchor': 'middle', 'font-size': 9.5, text: '1k summary', style: 'fill:var(--surface)' })); } });
        if (step >= 4) g.appendChild(s('text', { x: 250, y: 300, 'font-size': 11, text: 'Total tokens rose (≈ 238k vs 220k), but no context exceeded 75k.' }));
      }
    }
    return { go: draw };
  }

  const PATTERNS = {
    'Single agent + tools': [[['a', 200, 100, 'agent'], ['t1', 60, 220, 'tool'], ['t2', 200, 220, 'tool'], ['t3', 340, 220, 'tool']], [['a', 't1'], ['a', 't2'], ['a', 't3']], 'One loop, many tools. Start here; add agents only when this breaks.'],
    'Sequential pipeline': [[['a', 30, 140, 'draft'], ['b', 170, 140, 'check'], ['c', 310, 140, 'format']], [['a', 'b'], ['b', 'c']], 'Fixed stages, each one’s output feeds the next.'],
    Router: [[['r', 170, 40, 'router'], ['a', 30, 200, 'billing'], ['b', 170, 200, 'tech'], ['c', 310, 200, 'sales']], [['r', 'a'], ['r', 'b'], ['r', 'c']], 'Classify then hand off. A cheap decision model (Module 18) can do the routing.'],
    'Orchestrator–workers': [[['o', 170, 30, 'orchestrator'], ['a', 30, 200, 'worker'], ['b', 170, 200, 'worker'], ['c', 310, 200, 'worker']], [['o', 'a'], ['o', 'b'], ['o', 'c'], ['a', 'o'], ['b', 'o'], ['c', 'o']], 'The orchestrator decides the subtasks at run time and merges results.'],
    'Fan-out / fan-in': [[['s', 20, 130, 'split'], ['a', 170, 40, 'A'], ['b', 170, 130, 'B'], ['c', 170, 220, 'C'], ['m', 320, 130, 'merge']], [['s', 'a'], ['s', 'b'], ['s', 'c'], ['a', 'm'], ['b', 'm'], ['c', 'm']], 'Run independent pieces in parallel, then combine.'],
    'Evaluator–optimiser': [[['g', 60, 130, 'generator'], ['e', 280, 130, 'evaluator']], [['g', 'e'], ['e', 'g']], 'Draft, critique, revise until the evaluator passes it.'],
    'Hierarchical team': [[['l', 170, 20, 'lead'], ['m1', 70, 130, 'manager'], ['m2', 270, 130, 'manager'], ['w1', 20, 240, 'worker'], ['w2', 120, 240, 'worker'], ['w3', 220, 240, 'worker'], ['w4', 320, 240, 'worker']], [['l', 'm1'], ['l', 'm2'], ['m1', 'w1'], ['m1', 'w2'], ['m2', 'w3'], ['m2', 'w4']], 'Managers of managers for very large tasks; coordination cost grows quickly.'],
    'State machine / graph': [[['s', 20, 130, 'start'], ['p', 150, 40, 'plan'], ['x', 280, 130, 'execute'], ['v', 150, 220, 'verify'], ['d', 400, 220, 'done']], [['s', 'p'], ['p', 'x'], ['x', 'v'], ['v', 'p'], ['v', 'd']], 'Explicit states and transitions; durable execution lets long jobs resume after failures.'],
  };
  function picker() {
    const w = widget('Pattern picker', 'Try it');
    let cur = 'Orchestrator–workers'; const box = h('div'); const note = h('p', { class: 'muted' });
    function draw() { const [ns, es, t] = PATTERNS[cur]; const d = diagram(500, 290, ns.map(([id, x, y, l]) => ({ id, x, y, w: 110, h: 40, label: l, color: 'var(--accent)', shape: 'pill' })), es, cur); d.draw({}); clear(box).appendChild(d.el); note.textContent = t; }
    const sel = h('select', { id: 'pat', onchange: (e) => { cur = e.target.value; draw(); } }, Object.keys(PATTERNS).map((k) => h('option', { value: k, selected: k === cur }, k)));
    w.body.append(h('div', { class: 'ctl' }, h('label', { for: 'pat' }, 'pattern'), sel), box, note);
    draw();
    return w.el;
  }

  function compare() {
    const w = widget('Single vs multi-agent: tokens and time', 'Mechanics', 'Simple model: each subtask reads R tokens and takes T seconds; subagents run in parallel and each also reads a shared brief; the orchestrator reads only summaries.');
    const st = { n: 4, R: 60000, brief: 3000, sum: 1500, T: 90 };
    const out = h('div'); const ro = readout(); const sl = {};
    const mk = (k, l, a, b, step, f) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('n', 'subtasks', 1, 12, 1); mk('R', 'tokens read per subtask', 1000, 200000, 1000, human); mk('brief', 'shared brief per subagent', 0, 20000, 500, human); mk('sum', 'summary returned', 100, 10000, 100, human); mk('T', 'seconds per subtask', 5, 600, 5);
    function draw() {
      const singleTok = st.n * st.R + st.brief, multiTok = st.n * (st.R + st.brief) + st.n * st.sum + st.brief;
      const singleMax = singleTok, multiMax = Math.max(st.R + st.brief, st.brief + st.n * st.sum);
      clear(out).appendChild(barRows(560, [{ label: 'single: total tokens', v: singleTok, text: human(singleTok), color: 'var(--res)' }, { label: 'multi: total tokens', v: multiTok, text: human(multiTok), color: 'var(--accent)' }, { label: 'single: biggest context', v: singleMax, text: human(singleMax), color: singleMax > 200000 ? 'var(--fail)' : 'var(--res)' }, { label: 'multi: biggest context', v: multiMax, text: human(multiMax), color: 'var(--accent)' }], { max: Math.max(singleTok, multiTok), labelW: 150 }));
      ro.set([['single wall time', st.n * st.T + ' s'], ['multi wall time (parallel)', st.T + 30 + ' s'], ['extra tokens for multi', '+' + (((multiTok - singleTok) / singleTok) * 100).toFixed(0) + '%']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), out, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('34', {
    hook: 'When does one agent become too few, and when are many agents too many?',
    intro: ['Orchestration is how work is split and routed between model calls. Subagents are child agents started with a fresh context, their own instructions, tools and permissions, that return only a compact summary. They buy context isolation, parallelism and specialisation, and they cost total tokens, lost nuance and coordination errors.'],
    hero: { steps: [
      { title: 'A big read', text: 'Three vendors, about 70k tokens of documentation each.' },
      { title: 'One agent', text: 'Reading everything into one context approaches the limit and invites context rot (Module 28).' },
      { title: 'Delegate', text: 'An orchestrator writes a brief for each vendor and starts three subagents.' },
      { title: 'Isolated work', text: 'Each subagent sees only its own vendor plus the brief, and can run in parallel.' },
      { title: 'Summaries back', text: 'The orchestrator receives three short summaries and writes the recommendation from a small, clean context.' },
    ], init: heroInit },
    sections: [
      { title: 'Patterns', widget: picker },
      { title: 'The trade-off in numbers', widget: compare },
      { title: 'When one agent is better', body: ['Tightly coupled work (one evolving codebase, a single argument) suffers when split: subagents miss each other’s decisions, and summaries drop nuance. Use subagents for independent, read-heavy or parallel subtasks with a clear brief and a clear return format. Long-running orchestrations need <b>durable execution</b>: persisted state so a crash resumes instead of restarting.'] },
    ],
    maths: [{ note: 'Tokens and wall time for n subtasks of size R, brief b, summary m, duration T:', tex: '\\text{tokens}_{\\text{multi}}=n(R+b)+nm+b,\\qquad \\max\\text{context}_{\\text{multi}}=\\max(R+b,\\;b+nm),\\qquad t_{\\text{multi}}\\approx T+t_{\\text{merge}}' }],
    leaves: ['The cost model ignores retries, coordination messages and the orchestrator’s planning tokens.', 'Recorded traces per pattern (as the plan suggests) are not included.', 'Parallel subagents can conflict when they write to shared resources.'],
    quiz: [
      { q: 'Main reason to use a subagent for a big search?', opts: ['Fewer total tokens', 'Its noisy reading stays out of the main context', 'It is always faster', 'It needs no tools'], a: 1, why: 'Isolation; total tokens usually go up.' },
      { q: 'Which pattern decides subtasks at run time?', opts: ['Sequential pipeline', 'Orchestrator–workers', 'Router', 'Evaluator–optimiser'], a: 1, why: 'The orchestrator plans the split for each input.' },
      { q: 'When is splitting into agents risky?', opts: ['Independent research tasks', 'Tightly coupled work where decisions depend on each other', 'Parallel file reading', 'Translating separate documents'], a: 1, why: 'Agents lose each other’s context and make inconsistent choices.' },
    ],
  });
})();
