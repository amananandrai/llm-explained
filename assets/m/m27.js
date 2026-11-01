(function () {
  const { h, s, svg, clear, seg, widget, readout, mix, traceView, table, code } = LLM.util;
  const TRACE = [
    { k: 'User', t: 'Is it warmer in Lisbon or Oslo right now, and by how much?' },
    { k: 'Thought', t: 'I need current temperatures for both cities. I have a weather tool.' },
    { k: 'Action', t: '<code>get_weather({"city": "Lisbon"})</code>' },
    { k: 'Observation', t: '<code>{"city": "Lisbon", "temp_c": 19}</code>' },
    { k: 'Thought', t: 'Now Oslo.' },
    { k: 'Action', t: '<code>get_weather({"city": "Oslo"})</code>' },
    { k: 'Observation', t: '<code>{"city": "Oslo", "temp_c": 4}</code>' },
    { k: 'Thought', t: '19 − 4 = 15. I could compute this myself, but the calculator avoids arithmetic slips.' },
    { k: 'Action', t: '<code>calculator({"expr": "19 - 4"})</code>' },
    { k: 'Observation', t: '<code>15</code>' },
    { k: 'Answer', t: 'Lisbon is warmer: 19 °C vs 4 °C in Oslo, a difference of 15 °C.' },
  ];
  const STEP_UPTO = [0, 1, 3, 6, 9, 10];

  function heroInit(box) {
    const g = svg(560, 230, { 'aria-label': 'The agent loop: think, call a tool, the tool runs, the result returns into context' }); box.appendChild(g);
    const tr = h('div', { style: { marginTop: '10px', maxHeight: '260px', overflow: 'auto' } }); box.appendChild(tr);
    const ST = [['think', 'var(--q)'], ['tool call', 'var(--k)'], ['tool runs', 'var(--res)'], ['result → context', 'var(--v)']];
    function draw(step) {
      clear(g);
      const cx = 120, cy = 115, R = 78;
      g.appendChild(s('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 10 }));
      const upto = STEP_UPTO[step]; const lastK = TRACE[upto].k;
      const active = { User: -1, Thought: 0, Action: 1, Observation: 3, Answer: -1 }[lastK];
      ST.forEach(([n, c], i) => { const a = -Math.PI / 2 + (i * Math.PI) / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); g.appendChild(s('circle', { cx: x, cy: y, r: 16, fill: i === active ? c : 'var(--surface)', stroke: c, 'stroke-width': 2.5 })); g.appendChild(s('text', { x: x + (i === 1 ? 22 : i === 3 ? -22 : 0), y: y + (i === 0 ? -24 : i === 2 ? 32 : 4), 'text-anchor': i === 1 ? 'start' : i === 3 ? 'end' : 'middle', 'font-size': 11, text: n })); });
      const laps = TRACE.slice(0, upto + 1).filter((t) => t.k === 'Action').length;
      g.appendChild(s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 13, text: lastK === 'Answer' ? 'done' : `lap ${laps}`, style: 'font-weight:600' }));
      // context window bar
      const used = TRACE.slice(0, upto + 1).reduce((a, t) => a + t.t.length, 0) + 600;
      g.appendChild(s('text', { x: 260, y: 40, 'font-size': 12, text: 'context window', style: 'font-weight:600' }));
      g.appendChild(s('rect', { x: 260, y: 50, width: 280, height: 22, rx: 4, fill: 'var(--sunk)' }));
      g.appendChild(s('rect', { x: 260, y: 50, width: 60, height: 22, rx: 4, fill: 'var(--res)' }));
      g.appendChild(s('rect', { x: 320, y: 50, width: Math.min(220, (used - 600) / 4), height: 22, fill: 'var(--v)', style: 'opacity:.7' }));
      g.appendChild(s('text', { x: 260, y: 90, class: 'lbl', text: 'grey: system prompt + tool schemas · green: conversation and tool results' }));
      g.appendChild(s('text', { x: 260, y: 120, 'font-size': 12, text: `≈ ${Math.round(used / 4)} tokens used` }));
      g.appendChild(s('text', { x: 260, y: 150, class: 'lbl', text: 'Every lap re-reads the whole context.' }));
      g.appendChild(s('text', { x: 260, y: 168, class: 'lbl', text: 'Stop when the model answers, or a turn/token budget runs out.' }));
      clear(tr).appendChild(traceView(TRACE, upto));
    }
    return { go: draw };
  }

  function schemaEditor() {
    const w = widget('Tool descriptions decide tool choice', 'Try it', 'A toy chooser scores each tool by word overlap between the request and its description, standing in for the model. Real models read descriptions far more cleverly, but vague descriptions mislead them in the same way.');
    const tools = [{ name: 'search_docs', desc: 'Search.' }, { name: 'search_web', desc: 'Search the public web for news, prices and current events.' }, { name: 'query_orders', desc: 'Look things up.' }];
    const GOOD = ['Search the company handbook and internal policy documents (HR, expenses, security).', 'Search the public web for news, prices and current events.', 'Look up a customer order by order ID: status, items, shipping and refund state.'];
    const reqs = ['What is our policy on expenses for client dinners?', 'Where is order 88213 and has it shipped?', 'What is the latest news on interest rates today?'];
    const want = ['search_docs', 'query_orders', 'search_web'];
    const box = h('div', { style: { display: 'grid', gap: '8px' } }); const out = h('div');
    const stem = (x) => x.toLowerCase().match(/[a-z0-9]+/g)?.filter((w2) => w2.length > 3).map((w2) => w2.replace(/(es|s|ed|ing)$/, '')) || [];
    function choose(req) { const rq = stem(req); const sc = tools.map((t) => { const d = stem(t.desc + ' ' + t.name.replace('_', ' ')); return rq.filter((x) => d.includes(x)).length; }); const m = Math.max(...sc); return m ? tools[sc.indexOf(m)].name : '(no tool: guesses)'; }
    function draw() {
      clear(box); tools.forEach((t, i) => box.appendChild(h('div', { class: 'ctl' }, h('label', { for: 'td' + i }, t.name), h('input', { type: 'text', id: 'td' + i, value: t.desc, oninput: (e) => { t.desc = e.target.value; result(); } }))));
      result();
    }
    function result() { clear(out).appendChild(table(['Request', 'Chosen tool', 'Right?'], reqs.map((r, i) => { const c = choose(r); return [r, h('code', null, c), h('b', { style: { color: c === want[i] ? 'var(--pass)' : 'var(--fail)' } }, c === want[i] ? '✓' : '✗ want ' + want[i])]; }))); }
    w.body.append(box, h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => { tools.forEach((t, i) => (t.desc = GOOD[i])); draw(); } }, 'Use precise descriptions'), h('button', { class: 'btn', type: 'button', onclick: () => { tools[0].desc = 'Search.'; tools[2].desc = 'Look things up.'; draw(); } }, 'Back to vague')), out);
    draw();
    return w.el;
  }

  LLM.mod('27', {
    hook: 'What turns a model that answers questions into one that gets things done?',
    intro: ['An agent is a model choosing actions in a loop until a goal is met. Each lap it reads the context, decides to call a tool or answer, and the tool’s result is appended to the context for the next lap. ReAct (2022) named the pattern: interleave a thought, an action and an observation.'],
    hero: {
      steps: [
        { title: 'A question that needs fresh facts', text: 'The model does not know today’s weather. It does know, from the system prompt, that it has a <code>get_weather</code> tool and a calculator.' },
        { title: 'Thought', text: 'The model writes its plan. In modern APIs this may be hidden reasoning, but the role is the same.' },
        { title: 'Action and observation', text: 'It emits a structured tool call. The harness runs the tool and appends the result to the context. The model then thinks again with new facts.' },
        { title: 'Lap two', text: 'Same loop, second city. The context window grows each lap.' },
        { title: 'Lap three', text: 'A calculator call. Delegating exact work to tools is cheaper and more reliable than doing it in-head.' },
        { title: 'Answer and stop', text: 'The model answers instead of calling a tool, which ends the loop. Harnesses also stop on turn, token or cost budgets.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Function calling', depth: 'mechanics', body: ['Tools are declared as JSON schemas; the model outputs a call matching one, and the harness validates and executes it:', code('{\n  "name": "get_weather",\n  "description": "Current weather for a city. Use for questions about temperature, rain or wind right now.",\n  "input_schema": {\n    "type": "object",\n    "properties": { "city": { "type": "string", "description": "City name, e.g. Lisbon" } },\n    "required": ["city"]\n  }\n}'), 'Native tool calling is ReAct built into the model and API: the model was trained to emit these calls, and the API returns them as structured blocks instead of text to parse.'], widget: schemaEditor },
      { title: 'Why interleaving wins', body: ['Reasoning-only (chain of thought) has no fresh facts and can confidently invent them. Acting-only has no plan and wanders between tools. Interleaving lets each observation correct the plan.'] },
      { title: 'Workflows vs agents, and common patterns', body: [table(['Pattern', 'What it is'], [['Prompt chaining', 'Fixed sequence of LLM calls, each using the last one’s output'], ['Routing', 'Classify the input, send it to a specialised prompt or model'], ['Parallelisation', 'Run independent subtasks at once, or vote over several attempts'], ['Orchestrator–workers', 'One model splits a task and delegates pieces (Module 34)'], ['Evaluator–optimiser', 'One model drafts, another critiques, loop until good'], ['Autonomous agent', 'The model picks the next step itself until done']]), 'Use a fixed workflow when the steps are known; use an agent when they are not. <b>Planning</b> (decompose first), <b>reflection</b> (Reflexion: critique the last attempt and retry) and clear <b>stop conditions</b> make agents more reliable.', '<b>Why agents fail</b>: errors compound over many steps, tools get misused with wrong arguments, loops repeat the same failing call, and tool results can contain prompt injections (Module 39).'] },
    ],
    maths: [
      { note: 'The loop as a policy over context cₜ, with tool results oₜ appended:', tex: 'a_t\\sim\\pi_\\theta(\\cdot\\mid c_t),\\qquad o_t=\\mathrm{Tool}(a_t),\\qquad c_{t+1}=c_t\\oplus a_t\\oplus o_t' },
      { note: 'Why long tasks are hard: if each step succeeds independently with probability p, n steps all succeed with', tex: 'P(\\text{success})=p^{\\,n},\\qquad 0.95^{20}\\approx 0.36' },
    ],
    leaves: ['The trace is written for this page, not recorded from a model.', 'Real harnesses add permissions, sandboxes and retries (Module 30).', 'Independence of step errors is a simplification; good agents recover from mistakes.'],
    quiz: [
      { q: 'In ReAct, what is an observation?', opts: ['The model’s plan', 'The tool’s result, appended to the context', 'The user’s question', 'The final answer'], a: 1, why: 'Thought → Action → Observation, repeated.' },
      { q: 'An agent step succeeds 90% of the time. Chance of 10 steps all succeeding?', opts: ['90%', '≈ 35%', '≈ 10%', '≈ 65%'], a: 1, why: '0.9¹⁰ ≈ 0.349.' },
      { q: 'When is a fixed workflow better than an agent?', opts: ['When steps are unknown', 'When the steps are known in advance and predictability matters', 'Always', 'Never'], a: 1, why: 'Workflows are cheaper, faster and easier to test when the path is fixed.' },
    ],
  });
})();
