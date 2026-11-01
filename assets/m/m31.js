(function () {
  const { h, s, svg, clear, seg, slider, widget, readout, mix, code, lineChart, rng } = LLM.util;

  function heroInit(box) {
    const g = svg(560, 300, { 'aria-label': 'A loop wheel turning lap by lap with an iteration counter and cost meter until tests pass' }); box.appendChild(g);
    const ST = ['read plan + progress', 'do next piece', 'run tests', 'write progress, commit', 'wipe context'];
    const passing = [2, 3, 5, 6, 8, 9, 10, 12]; // tests passing out of 12, per lap
    function draw(step) {
      clear(g);
      const lap = [0, 1, 3, 6, 8][step], cx = 140, cy = 150, R = 95;
      g.appendChild(s('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 12 }));
      const act = step === 0 ? -1 : (lap * 5 + step) % 5;
      ST.forEach((t, i) => { const a = -Math.PI / 2 + (i / 5) * 2 * Math.PI, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); g.appendChild(s('circle', { cx: x, cy: y, r: 11, fill: i === act ? 'var(--accent)' : 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 })); g.appendChild(s('text', { x: x + (Math.cos(a) >= 0 ? 16 : -16), y: y + 4, 'text-anchor': Math.cos(a) >= 0 ? 'start' : 'end', 'font-size': 10.5, text: t })); });
      g.appendChild(s('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 26, text: lap, style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', class: 'lbl', text: 'iterations' }));
      const pass = lap ? passing[lap - 1] : 0, done = pass === 12;
      g.appendChild(s('text', { x: 330, y: 60, 'font-size': 12, text: 'tests passing', style: 'font-weight:600' }));
      for (let t = 0; t < 12; t++) g.appendChild(s('circle', { cx: 336 + t * 17, cy: 78, r: 6.5, fill: t < pass ? 'var(--pass)' : 'var(--sunk)', stroke: t < pass ? 'none' : 'var(--fail)' }));
      g.appendChild(s('text', { x: 330, y: 120, 'font-size': 12, text: 'cost so far', style: 'font-weight:600' }));
      g.appendChild(s('rect', { x: 330, y: 128, width: 200, height: 14, rx: 3, fill: 'var(--sunk)' })); g.appendChild(s('rect', { x: 330, y: 128, width: Math.min(200, lap * 22), height: 14, rx: 3, fill: 'var(--warn)' }));
      g.appendChild(s('text', { x: 330, y: 160, 'font-size': 11, text: `≈ $${(lap * 1.8).toFixed(2)} (illustrative, $1.80 per lap)` }));
      g.appendChild(s('text', { x: 330, y: 200, 'font-size': 12, text: done ? '✓ All tests green: the loop stops.' : step === 0 ? 'A spec, a test suite and an empty progress file.' : 'Each lap starts with a fresh context.', style: done ? 'fill:var(--pass);font-weight:600' : '' }));
      g.appendChild(s('text', { x: 330, y: 220, class: 'lbl', text: 'State lives in files and git, not in the window.' }));
    }
    return { go: draw };
  }

  function designer() {
    const w = widget('Loop designer', 'Try it', 'A deterministic simulation: each lap makes progress with a seeded chance, may introduce a regression, and costs $1.80. It shows what each part of a loop protects against, not real agent behaviour.');
    const st = { goal: true, verify: 'tests', memory: true, iso: true, cap: 40 };
    const ch = lineChart({ w: 560, h: 200 }); const ro = readout();
    function run() {
      const r = rng(31); let done = 0, laps = 0, cost = 0, broken = 0, pts = [[0, 0]], reason = '';
      const HARD = 200;
      while (laps < Math.min(st.cap || HARD, HARD)) {
        laps++; cost += 1.8;
        const before = st.memory ? done : 0; // without memory, each lap re-derives from scratch and keeps ~1 unit
        let gain = r() < 0.7 ? 1 : 0; let regress = r() < (st.iso ? 0.15 : 0.35) ? 1 : 0;
        if (st.verify === 'tests') regress = 0; else if (st.verify === 'judge' && r() < 0.6) regress = 0;
        done = Math.max(0, Math.min(12, before + gain - regress)); if (!st.memory) done = Math.min(done, 2);
        if (regress) broken++;
        pts.push([laps, done]);
        if (st.goal && done >= 12) { reason = 'goal met'; break; }
      }
      if (!reason) reason = laps >= HARD && !st.cap ? 'no cap: ran until stopped by hand' : st.goal ? 'hit the iteration cap before finishing' : 'no done-test: kept going until the cap';
      return { laps, cost, done, broken, pts, reason };
    }
    function draw() { const R = run(); ch.draw([{ pts: R.pts, color: 'var(--pass)', area: true }], { ymin: 0, ymax: 12, xlabel: 'iteration', ylabel: 'tests passing (of 12)' }); ro.set([['outcome', R.reason, R.reason === 'goal met' ? 'var(--pass)' : 'var(--fail)'], ['iterations', R.laps], ['cost', '$' + R.cost.toFixed(2)], ['regressions shipped', R.broken, R.broken ? 'var(--fail)' : 'var(--pass)']]); }
    const tg = (k, opts, l) => { const sg = seg(opts, st[k], (v) => { st[k] = v; draw(); }, l); return h('div', { class: 'ctl' }, h('label', null, l), sg.el); };
    const cap = slider({ label: 'iteration cap (0 = none)', min: 0, max: 100, value: st.cap, oninput: (v) => { st.cap = v; draw(); } });
    w.body.append(h('div', { class: 'ctl-row' }, tg('goal', [[true, 'yes'], [false, 'no']], 'clear “done” test'), tg('verify', [['tests', 'tests'], ['judge', 'LLM judge'], ['none', 'none']], 'verification'), tg('memory', [[true, 'progress file + git'], [false, 'none']], 'memory between laps'), tg('iso', [[true, 'worktree / sandbox'], [false, 'shared checkout']], 'isolation'), cap.el), ch.el, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('31', {
    hook: 'What if, instead of driving the agent turn by turn, you design the loop that drives it?',
    intro: ['Prompt engineering shapes one call; context engineering shapes each turn; harness engineering shapes the environment. Loop engineering designs the system that prompts, checks, remembers and re-runs an agent until a goal is met, without a person steering every step.'],
    hero: { steps: [
      { title: 'Ingredients', text: 'A written spec, a test suite that defines “done”, and a progress file on disk.' },
      { title: 'One lap', text: 'Start fresh: read the plan and progress, do the next piece of work, run the tests, record progress, commit, exit.' },
      { title: 'Fresh context every time', text: 'Because each lap wipes the window, it never suffers context rot (Module 28). Memory lives in files and git history.' },
      { title: 'Progress accumulates', text: 'Tests turn green lap by lap. Cost rises linearly, so the cap matters.' },
      { title: 'Stop on green', text: 'The done-test passes and the loop ends. Without strong tests, it would drift or never stop.' },
    ], init: heroInit },
    sections: [
      { title: 'The Ralph Wiggum loop', body: ['A deliberately simple pattern popularised by Geoffrey Huntley in 2025: run a coding agent on the same prompt in an endless shell loop.', code(window.PLAN.modules['31'].code[0] || 'while :; do cat PROMPT.md | coding-agent ; done'), 'Each pass reads the spec and progress file, does one piece of work, commits and exits. It works when tests are strong and there is a cost cap; otherwise it drifts and burns money.'] },
      { title: 'Parts of a loop', body: ['<b>Trigger</b>: a schedule, an event, or a command such as /loop or /goal. <b>Goal</b> with a clear done test. <b>Verification</b> every pass: tests, type checks, or an LLM judge. <b>Memory</b> between passes: progress files, git. <b>Isolation</b>: worktrees, sandboxes. <b>Skills and connectors</b> for the tools it needs, <b>subagents</b> for side work, <b>budgets and a hard iteration cap</b>, and <b>escalation</b> to a human when stuck.'], widget: designer },
    ],
    maths: [{ note: 'Expected cost with per-lap cost c and per-lap success probability p of finishing (geometric number of laps), capped at N:', tex: '\\mathbb{E}[\\text{cost}]=c\\sum_{n=1}^{N}(1-p)^{n-1}=c\\,\\frac{1-(1-p)^N}{p}' }],
    leaves: ['The simulation’s probabilities are invented to show failure modes, not measured.', 'Real loops need guards against the agent editing its own tests to make them pass.', 'Unattended loops still need someone accountable for what they ship.'],
    quiz: [
      { q: 'Why does the Ralph loop avoid context rot?', opts: ['It uses a bigger window', 'Every pass starts with a fresh context and reads state from files', 'It never reads files', 'It uses subagents'], a: 1, why: 'State is on disk; the window is wiped each lap.' },
      { q: 'A loop with no done-test and no iteration cap will…', opts: ['stop when the code is good', 'keep running and spending until someone stops it', 'crash immediately', 'ask the user'], a: 1, why: 'Nothing tells it to stop.' },
      { q: 'Which part catches a lap that breaks previously passing behaviour?', opts: ['Trigger', 'Verification on every pass', 'Memory', 'The prompt'], a: 1, why: 'Running the tests each pass rejects regressions.' },
    ],
  });
})();
