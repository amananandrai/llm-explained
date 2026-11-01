(function () {
  const { h, s, svg, clear, widget, readout, mix, traceView, checklist, lineChart } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 330, { 'aria-label': 'A human sets a goal, agents work in parallel lanes, failing tests bounce work back, verified changes reach review' }); box.appendChild(g);
    const lanes = [['agent 1: API endpoint', [1, 1, 1]], ['agent 2: database migration', [1, 0, 1]], ['agent 3: UI form', [1, 1, 1]], ['agent 4: docs', [1, 1, 0]]];
    function draw(step) {
      clear(g);
      g.appendChild(s('rect', { x: 14, y: 40, width: 100, height: 230, rx: 10, fill: mix('var(--res)', 15), stroke: 'var(--res)' }));
      g.appendChild(s('text', { x: 64, y: 62, 'text-anchor': 'middle', 'font-size': 12, text: 'human', style: 'font-weight:700' }));
      ['goal', 'spec', 'constraints'].forEach((t, i) => g.appendChild(s('text', { x: 64, y: 90 + i * 18, 'text-anchor': 'middle', 'font-size': 10.5, text: t, style: step >= 0 ? '' : 'opacity:.3' })));
      g.appendChild(s('rect', { x: 440, y: 40, width: 110, height: 230, rx: 10, fill: mix('var(--pass)', 12), stroke: 'var(--pass)' }));
      g.appendChild(s('text', { x: 495, y: 62, 'text-anchor': 'middle', 'font-size': 12, text: 'review', style: 'font-weight:700' }));
      lanes.forEach(([n, res], i) => {
        const y = 50 + i * 55; const on = step >= 1;
        g.appendChild(s('rect', { x: 130, y, width: 296, height: 40, rx: 6, fill: 'var(--paper)', stroke: 'var(--rule)', style: on ? '' : 'opacity:.3' }));
        g.appendChild(s('text', { x: 138, y: y + 14, 'font-size': 10.5, text: n, style: on ? 'font-weight:600' : 'opacity:.3' }));
        const checks = ['tests', 'types', 'lint']; checks.forEach((c, k) => { const shown = step >= 2; const ok = step >= 4 ? 1 : res[k]; g.appendChild(s('rect', { x: 138 + k * 92, y: y + 20, width: 86, height: 15, rx: 3, fill: !shown ? 'var(--sunk)' : ok ? mix('var(--pass)', 40) : mix('var(--fail)', 40) })); g.appendChild(s('text', { x: 181 + k * 92, y: y + 31, 'text-anchor': 'middle', 'font-size': 9.5, text: shown ? (ok ? '✓ ' : '✗ ') + c : c })); });
        const pass = res.every(Boolean) || step >= 4;
        if (step >= 3 && !pass) g.appendChild(s('path', { d: `M${420},${y + 28} C${400},${y + 50} ${200},${y + 50} ${150},${y + 30}`, fill: 'none', stroke: 'var(--fail)', 'stroke-width': 1.8, 'stroke-dasharray': '4 3' }));
        if (step >= 3 && pass) g.appendChild(s('line', { x1: 426, y1: y + 20, x2: 446, y2: y + 20, stroke: 'var(--pass)', 'stroke-width': 3 }));
      });
      g.appendChild(s('text', { x: 14, y: 310, 'font-size': 12, text: ['The human writes the goal, a spec and the constraints', 'Several agents work in parallel, each on its own branch or worktree', 'Tests, type checks and linters run automatically on every change', 'Failures bounce back to the agent with the error; passing work goes to review', 'Only verified changes reach the human, who reviews diffs, not keystrokes'][step], style: 'font-weight:600' }));
    }
    return { go: draw };
  }

  function caseStudy() {
    const w = widget('Case study: one feature, built agentically', 'Try it', 'A written walk-through showing decisions at each stage, not a recorded session.');
    const steps = [
      { k: 'User', t: 'Goal: let customers export their order history as CSV. Constraint: no new dependencies; must pass existing tests.' },
      { k: 'Thought', t: '<b>Decision:</b> write a one-page spec first (endpoint, columns, auth, limits) and get it approved. Cheaper than reviewing the wrong code.' },
      { k: 'Action', t: 'Agent reads <code>AGENTS.md</code>: conventions say handlers live in <code>api/</code>, tests in <code>tests/api/</code>, use the existing <code>csv</code> helper.' },
      { k: 'Action', t: 'Writes a failing test for the endpoint first, then the handler.' },
      { k: 'Observation', t: '<code>pytest</code>: 1 failure. Timezone in the date column is UTC, spec says local time.' },
      { k: 'Thought', t: '<b>Decision:</b> fix the code, not the test. The test encodes the spec.' },
      { k: 'Observation', t: 'All tests, type check and lint pass. A second agent reviewed the diff for injection in the filename header: fixed.' },
      { k: 'Check', t: 'Human reviews a 140-line diff and the spec side by side, asks for a 10,000-row limit, approves.' },
      { k: 'Answer', t: 'Merged. The eval set gains a test for large exports; the conventions file gains one line about CSV headers.' },
    ];
    let k = 0; const out = h('div');
    function draw() { clear(out).appendChild(traceView(steps, k)); }
    w.body.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => { k = Math.min(steps.length - 1, k + 1); draw(); } }, 'Next step'), h('button', { class: 'btn', type: 'button', onclick: () => { k = 0; draw(); } }, 'Restart')), out);
    draw();
    return w.el;
  }

  function readiness() {
    const w = widget('How agent-ready is your codebase?', 'Try it');
    const items = ['One command runs all tests, and they finish in minutes', 'Type checks and linters run locally and in CI', 'An instruction file (AGENTS.md / CLAUDE.md) describes conventions and commands', 'A fresh checkout builds without hidden manual steps', 'Tests cover the behaviour you care about, not just lines', 'Secrets are out of the repo; agents run with least-privilege credentials', 'Work can happen on isolated branches or worktrees in parallel', 'CI blocks merges that fail checks', 'There is an eval or regression set for agent-made changes', 'Docs and error messages say what to do next, readable by people and agents'];
    const ro = readout();
    const ck = checklist(items.map((l) => ({ label: l })), (st) => draw(st));
    function draw(st = ck.state) { const n = st.filter(Boolean).length; ro.set([['score', `${n} / ${items.length}`, n >= 8 ? 'var(--pass)' : n >= 5 ? 'var(--warn)' : 'var(--fail)'], ['next step', n === items.length ? 'Measure: track how often agent changes pass review first time.' : 'Start with the first unticked item; each one turns into faster, safer feedback for agents.']]); }
    w.body.append(ck.el, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('36', {
    hook: 'If agents write much of the code, what is the engineer’s job?',
    intro: ['Agentic engineering is the discipline of building reliable software with agents and for agents. The work shifts from typing code to setting goals, writing specs, building the feedback loops agents learn from (tests, types, linters), running agents in parallel, and reviewing what they produce.'],
    hero: { steps: [
      { title: 'Goal and constraints', text: 'A clear goal, a short spec and explicit constraints are the agent’s brief. Ambiguity here costs the most later.' },
      { title: 'Parallel lanes', text: 'Independent pieces run in parallel on isolated branches or worktrees so they do not trample each other.' },
      { title: 'Automatic feedback', text: 'Tests, type checks and linters are the agent’s senses. Fast, trustworthy checks make agents dramatically better.' },
      { title: 'Bounce, don’t babysit', text: 'Failures go back to the agent with the error output; only passing work moves on.' },
      { title: 'Humans review', text: 'People review verified diffs against the spec, and decide what ships.' },
    ], init: heroInit },
    sections: [
      { title: 'Practices', body: ['<b>Specs and plans before code.</b> <b>Instruction files</b> that encode conventions and commands. <b>Verification before “done”</b>: the agent must run the checks, not claim it did. <b>Review agent output</b> like any contributor’s, with extra attention to tests it edited. <b>Design tools and docs for agent readers</b>: predictable commands, clear errors. <b>Eval-driven development</b>: a regression set of real tasks (Module 37). <b>Budgets</b> for cost, latency and reliability. <b>Humans in the loop</b> for intent, judgement and accountability.'], widget: caseStudy },
      { title: 'Readiness', widget: readiness },
    ],
    maths: [{ note: 'Why fast checks matter: with per-attempt pass probability p and check time t, the expected time to a passing change is', tex: '\\mathbb{E}[T]=\\frac{t_{\\text{work}}+t_{\\text{check}}}{p}' }],
    leaves: ['The case study is written to show decision points; real sessions are messier.', 'A checklist score is a conversation starter, not a measurement.', 'Agent-written code still needs owners who understand it.'],
    quiz: [
      { q: 'An agent says “tests pass” but did not run them. Which practice failed?', opts: ['Parallel lanes', 'Verification before done', 'Spec first', 'Instruction files'], a: 1, why: 'The harness should run the checks and show the output.' },
      { q: 'Why run agents on isolated branches or worktrees?', opts: ['To use more GPUs', 'So parallel work does not conflict and each change can be checked alone', 'Agents need Git to think', 'To hide changes from reviewers'], a: 1, why: 'Isolation keeps parallel changes independent and reviewable.' },
      { q: 'An agent fixed a failing test by changing the test’s expected value. What should review check?', opts: ['Nothing; tests pass', 'Whether the test or the code was wrong, against the spec', 'The commit message only', 'Lint'], a: 1, why: 'Edited tests can hide regressions; the spec decides.' },
    ],
  });
})();
