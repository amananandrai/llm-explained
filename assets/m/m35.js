(function () {
  const { h, s, svg, clear, widget, readout, mix, diagram, code, table } = LLM.util;

  function heroInit(box) {
    const nodes = [
      { id: 'u', x: 10, y: 140, w: 90, h: 40, label: 'user', color: 'var(--res)', shape: 'pill' },
      { id: 'o', x: 140, y: 140, w: 120, h: 44, label: 'travel agent', sub: 'orchestrator', color: 'var(--accent)' },
      { id: 'f', x: 380, y: 30, w: 160, h: 44, label: 'flights agent', sub: 'vendor X', color: 'var(--t0)' },
      { id: 'ho', x: 380, y: 140, w: 160, h: 44, label: 'hotels agent', sub: 'vendor Y', color: 'var(--t2)' },
      { id: 'v', x: 380, y: 250, w: 160, h: 44, label: 'visa agent', sub: 'vendor Z', color: 'var(--t4)' },
    ];
    const d = diagram(560, 320, nodes, [['u', 'o'], ['o', 'u'], ['o', 'f'], ['o', 'ho'], ['o', 'v'], ['f', 'o'], ['ho', 'o'], ['v', 'o']], 'Agent-to-agent delegation');
    const pre = h('pre', { class: 'code', style: { marginTop: '8px', fontSize: '.76rem', maxHeight: '170px' } });
    box.append(d.el, pre);
    const MSG = [
      { notes: 'Discover: fetch each agent’s card', flow: [['o', 'f'], ['o', 'ho'], ['o', 'v']], json: { name: 'Hotels Agent', url: 'https://hotels.example/a2a', skills: [{ id: 'search_hotels', name: 'Search hotels' }], capabilities: { streaming: true } } },
      { notes: 'Send a task to each specialist', flow: [['o', 'ho']], json: { jsonrpc: '2.0', id: 11, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: '3 nights in Lisbon from 12 March, under €150/night' }], messageId: 'm-1' } } } },
      { notes: 'Tasks have a lifecycle and can stream updates', flow: [['ho', 'o']], json: { kind: 'status-update', taskId: 't-77', status: { state: 'working', message: { parts: [{ kind: 'text', text: 'Checking 41 hotels…' }] } } } },
      { notes: 'Results come back as artifacts', flow: [['f', 'o'], ['ho', 'o'], ['v', 'o']], json: { kind: 'task', id: 't-77', status: { state: 'completed' }, artifacts: [{ name: 'shortlist', parts: [{ kind: 'data', data: { hotels: [{ name: 'Casa Azul', price_eur: 128 }] } }] }] } },
      { notes: 'The orchestrator merges artifacts and answers', flow: [['o', 'u']], json: { answer: 'Flights TP1350, Casa Azul (€128/night), no visa needed for 3 nights.' } },
    ];
    return { go(i) { const m = MSG[i]; d.draw({ flow: m.flow, hot: m.flow.flat().filter((x, k, a) => a.indexOf(x) === k), notes: [[14, 20, m.notes, 'font-weight:600']] }); pre.textContent = JSON.stringify(m.json, null, 2); } };
  }

  function cardBuilder() {
    const w = widget('Agent card builder', 'Try it', 'Field names follow the A2A AgentCard in the published specification; check the current version for required fields.');
    const f = { name: 'Invoice Checker', description: 'Checks supplier invoices against purchase orders and flags mismatches.', url: 'https://agents.example.com/invoice', streaming: true, skill: 'Match invoice to PO', tags: 'finance, invoices', auth: 'oauth2' };
    const form = h('div', { class: 'ctl-row' }); const pre = h('pre', { class: 'code' }); const ro = readout();
    Object.entries(f).forEach(([k, v]) => { const id = 'ac-' + k; form.appendChild(h('div', { class: 'ctl' }, h('label', { for: id }, k), typeof v === 'boolean' ? h('select', { id, onchange: (e) => { f[k] = e.target.value === 'true'; draw(); } }, h('option', { value: 'true', selected: v }, 'true'), h('option', { value: 'false', selected: !v }, 'false')) : h('input', { type: 'text', id, value: v, oninput: (e) => { f[k] = e.target.value; draw(); } }))); });
    function draw() {
      const card = { protocolVersion: '0.3.0', name: f.name, description: f.description, url: f.url, version: '1.0.0', capabilities: { streaming: f.streaming, pushNotifications: false }, defaultInputModes: ['text/plain', 'application/json'], defaultOutputModes: ['application/json'], skills: [{ id: f.skill.toLowerCase().replace(/\W+/g, '_'), name: f.skill, description: f.description, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) }], securitySchemes: { [f.auth]: { type: f.auth } }, security: [{ [f.auth]: [] }] };
      pre.textContent = JSON.stringify(card, null, 2);
      const warn = []; if (!/^https:\/\//.test(f.url)) warn.push('use an https URL'); if (f.description.length < 30) warn.push('describe what the agent does so other agents can choose it'); if (!f.auth || f.auth === 'none') warn.push('no authentication declared');
      ro.set([['served at', '/.well-known/agent-card.json'], ['checks', warn.length ? warn.join('; ') : 'ok', warn.length ? 'var(--warn)' : 'var(--pass)']]);
    }
    w.body.append(form, ro.el, pre);
    draw();
    return w.el;
  }

  function lifecycle() {
    const w = widget('Task lifecycle replay', 'Try it', 'A written example of three tasks moving through A2A task states.');
    const lanes = [['flights', [['submitted', 0], ['working', 1], ['completed', 4]]], ['hotels', [['submitted', 0], ['working', 1], ['input-required', 2], ['working', 3], ['completed', 5]]], ['visa', [['submitted', 0], ['working', 1], ['failed', 2], ['submitted', 3], ['working', 3.5], ['completed', 4.5]]]];
    const COL = { submitted: 'var(--res)', working: 'var(--q)', 'input-required': 'var(--warn)', completed: 'var(--pass)', failed: 'var(--fail)' };
    const g = svg(560, 170);
    lanes.forEach(([n, ev], i) => { const y = 20 + i * 44; g.appendChild(s('text', { x: 10, y: y + 18, 'font-size': 11.5, text: n })); ev.forEach(([st, t], k) => { const t2 = k < ev.length - 1 ? ev[k + 1][1] : 6; g.appendChild(s('rect', { x: 70 + t * 80, y, width: Math.max(4, (t2 - t) * 80 - 2), height: 26, rx: 4, fill: mix(COL[st], 40), stroke: COL[st] })); g.appendChild(s('text', { x: 74 + t * 80, y: y + 17, 'font-size': 9.5, text: st })); }); });
    g.appendChild(s('text', { x: 70, y: 160, class: 'lbl', text: 'time → · hotels asked the user a question (input-required); visa failed once and was retried' }));
    w.body.append(g);
    return w.el;
  }

  LLM.mod('35', {
    hook: 'Your agent needs help from an agent built by another company. How do they talk?',
    intro: ['Multi-agent systems help when work splits cleanly (parallel research, separation of concerns) and hurt when it does not (cost, lost context, coordination errors). When the agents come from different vendors, they need a shared protocol. Agent2Agent (A2A) is an open protocol for that: discovery through agent cards, tasks with a lifecycle, messages, artifacts and streaming updates.'],
    hero: { steps: [
      { title: 'Discovery', text: 'Each agent publishes an agent card: what it can do (skills), where to reach it, and how to authenticate. The orchestrator reads the cards to pick helpers.' },
      { title: 'Send a task', text: 'The orchestrator sends a message to each specialist. The specialist does not expose its internal tools or prompts, only its skills.' },
      { title: 'Lifecycle and streaming', text: 'Tasks move through states such as submitted, working, input-required and completed, and can stream progress updates.' },
      { title: 'Artifacts', text: 'Results come back as artifacts made of parts: text, files or structured data.' },
      { title: 'Merge', text: 'The orchestrator combines the artifacts into one answer.' },
    ], init: heroInit },
    sections: [
      { title: 'Agent cards', widget: cardBuilder },
      { title: 'Tasks over time', widget: lifecycle },
      { title: 'A2A and MCP together', body: [table(['', 'MCP', 'A2A'], [['Connects', 'agent ↔ tool or data', 'agent ↔ agent'], ['The other side is', 'a capability with a schema', 'an autonomous peer with its own reasoning'], ['Typical unit', 'tool call', 'task with a lifecycle'], ['Discovery', 'tools/list on a server', 'agent card at a well-known URL']]), 'A specialist agent reached over A2A may itself use MCP servers internally. <b>Patterns</b> on top: orchestrator–workers, hand-offs, pipelines, and debate or critique between agents. <b>Trust</b>: authenticate every agent, scope what each may request, and treat another agent’s output as untrusted input (it can carry injections, Module 39). Keep data boundaries explicit: what may leave your organisation in a task message?'] },
    ],
    maths: [{ note: 'Pairwise links between n agents without a shared protocol vs adapters with one:', tex: '\\binom{n}{2}=\\frac{n(n-1)}{2}\\quad\\text{vs}\\quad n' }],
    leaves: ['Message and card shapes are simplified from the specification, which is evolving.', 'The lifecycle replay is written for this page.', 'Most multi-agent value today comes from agents within one system; cross-vendor A2A use is early.'],
    quiz: [
      { q: 'Where does an A2A client learn what a remote agent can do?', opts: ['Its source code', 'Its agent card', 'tools/list', 'Its model weights'], a: 1, why: 'Agent cards describe skills, endpoint, capabilities and auth.' },
      { q: 'Which state means the remote agent needs more from the requester?', opts: ['working', 'input-required', 'completed', 'submitted'], a: 1, why: 'The task pauses until the requester answers.' },
      { q: 'A2A vs MCP: which connects an agent to another autonomous agent?', opts: ['MCP', 'A2A', 'Both equally', 'Neither'], a: 1, why: 'MCP is agent ↔ tool; A2A is agent ↔ agent.' },
    ],
  });
})();
