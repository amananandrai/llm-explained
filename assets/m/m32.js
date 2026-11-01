(function () {
  const { h, s, svg, clear, seg, widget, readout, mix, diagram, code, table } = LLM.util;
  const PV = '2025-06-18';
  const SESSION = [
    ['client → server', 'initialize', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PV, capabilities: { roots: {}, sampling: {}, elicitation: {} }, clientInfo: { name: 'example-host', version: '1.0' } } }],
    ['server → client', 'initialize result', { jsonrpc: '2.0', id: 1, result: { protocolVersion: PV, capabilities: { tools: { listChanged: true }, resources: {}, prompts: {} }, serverInfo: { name: 'weather-server', version: '0.3' } } }],
    ['client → server', 'notifications/initialized', { jsonrpc: '2.0', method: 'notifications/initialized' }],
    ['client → server', 'tools/list', { jsonrpc: '2.0', id: 2, method: 'tools/list' }],
    ['server → client', 'tools/list result', { jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'get_forecast', description: 'Daily forecast for a city, up to 7 days ahead.', inputSchema: { type: 'object', properties: { city: { type: 'string' }, days: { type: 'integer', minimum: 1, maximum: 7 } }, required: ['city'] } }] } }],
    ['client → server', 'tools/call', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_forecast', arguments: { city: 'Lisbon', days: 2 } } }],
    ['server → client', 'tools/call result', { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'Lisbon: Mon 19°C sunny, Tue 17°C showers' }], isError: false } }],
  ];

  function heroInit(box) {
    const nodes = [
      { id: 'host', x: 10, y: 30, w: 150, h: 230, label: 'Host app', sub: 'chat UI / IDE / agent', color: 'var(--res)' },
      { id: 'model', x: 30, y: 80, w: 110, h: 40, label: 'model', color: 'var(--accent)' },
      { id: 'c1', x: 30, y: 150, w: 110, h: 30, label: 'client 1', color: 'var(--q)' }, { id: 'c2', x: 30, y: 200, w: 110, h: 30, label: 'client 2', color: 'var(--q)' },
      { id: 's1', x: 380, y: 130, w: 160, h: 50, label: 'weather server', sub: 'stdio (local)', color: 'var(--v)' }, { id: 's2', x: 380, y: 200, w: 160, h: 50, label: 'GitHub server', sub: 'streamable HTTP + OAuth', color: 'var(--v)' },
    ];
    const d = diagram(560, 280, nodes, [['c1', 's1'], ['s1', 'c1'], ['c2', 's2'], ['model', 'c1']], 'MCP host, clients and servers');
    const pre = h('pre', { class: 'code', style: { marginTop: '10px', fontSize: '.76rem', maxHeight: '190px' } });
    box.append(d.el, pre);
    const map = [0, 1, 4, 6, 6];
    return { go(i) {
      const msg = SESSION[map[i]]; const out = msg[0].startsWith('client');
      d.draw({ hot: i === 0 ? ['c1', 's1'] : i === 4 ? ['model'] : [out ? 'c1' : 's1'], flow: i === 4 ? [['s1', 'c1'], ['model', 'c1']] : [out ? ['c1', 's1'] : ['s1', 'c1']], dim: i === 4 ? [] : ['c2', 's2'], notes: [[180, 120, msg[0] + ': ' + msg[1], 'font-weight:600'], [14, 275, i === 0 ? 'One client per server connection, inside the host.' : i === 4 ? 'The result enters the model’s context like any tool result.' : '', 'fill:var(--muted);font-size:11px']] });
      pre.textContent = JSON.stringify(i === 2 ? SESSION[4][2] : i >= 3 ? SESSION[6][2] : SESSION[map[i]][2], null, 2);
    } };
  }

  function inspector() {
    const w = widget('MCP message inspector', 'Try it', `A JSON-RPC session in the shape of the MCP specification (protocol version ${PV}). Fields trimmed for readability; check the current spec for details.`);
    let i = 0; const pre = h('pre', { class: 'code', style: { maxHeight: '320px' } }); const lab = h('div', { class: 'eyebrow' }); const note = h('p', { class: 'muted', style: { fontSize: '.92rem' } });
    const NOTES = ['The client proposes a protocol version and declares what it can do (here: expose roots, allow sampling and elicitation requests).', 'The server answers with its own capabilities: it offers tools, resources and prompts, and will notify if its tool list changes.', 'A notification has no id and expects no reply.', 'Discovery: ask which tools exist.', 'Each tool has a name, a description the model reads, and a JSON Schema for its input.', 'The host calls a tool with arguments the model produced.', 'Results come back as content blocks. isError lets the model see and recover from failures.'];
    function draw() { lab.textContent = `${i + 1} / ${SESSION.length} · ${SESSION[i][0]} · ${SESSION[i][1]}`; pre.textContent = JSON.stringify(SESSION[i][2], null, 2); note.textContent = NOTES[i]; }
    w.body.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn', type: 'button', onclick: () => { i = Math.max(0, i - 1); draw(); } }, '‹ Previous'), h('button', { class: 'btn primary', type: 'button', onclick: () => { i = Math.min(SESSION.length - 1, i + 1); draw(); } }, 'Next message ›')), lab, pre, note);
    draw();
    return w.el;
  }

  function serverLab() {
    const w = widget('Define a tool for a mock host', 'Try it', 'The mock host validates your tool definition the way a careful host would, then shows the tools/list entry and a sample tools/call built from the schema.');
    const ta = h('textarea', { id: 'mcp-tool', rows: 12 }, JSON.stringify({ name: 'search_tickets', description: 'Search support tickets by keyword and status. Returns up to 20 matches with id, title and status.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords' }, status: { type: 'string', enum: ['open', 'closed', 'any'] } }, required: ['query'] } }, null, 2));
    const out = h('div'); const ro = readout();
    function draw() {
      let t, issues = [];
      try { t = JSON.parse(ta.value); } catch (e) { ro.set([['JSON', 'invalid: ' + e.message, 'var(--fail)']]); clear(out); return; }
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.name || '')) issues.push('name should be 1–64 letters, digits, _ or -');
      if (!t.description || t.description.length < 20) issues.push('description is the model’s only guide: say what it does, when to use it, and what it returns');
      if (!t.inputSchema || t.inputSchema.type !== 'object') issues.push('inputSchema must be a JSON Schema with type "object"');
      const props = (t.inputSchema && t.inputSchema.properties) || {};
      (t.inputSchema && t.inputSchema.required || []).forEach((r) => { if (!props[r]) issues.push(`required field “${r}” is not in properties`); });
      Object.entries(props).forEach(([k, v]) => { if (!v.type && !v.enum) issues.push(`property “${k}” has no type`); });
      if (/ignore (all|previous)|system prompt/i.test(t.description || '')) issues.push('description contains instruction-like text: a tool-poisoning red flag');
      const sample = {}; Object.entries(props).forEach(([k, v]) => (sample[k] = v.enum ? v.enum[0] : v.type === 'integer' || v.type === 'number' ? (v.minimum ?? 1) : v.type === 'boolean' ? true : 'example'));
      clear(out).append(h('div', { class: 'eyebrow' }, 'tools/call the host would send'), code(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: t.name, arguments: sample } }, null, 2)));
      ro.set([['validation', issues.length ? issues.length + ' issue(s)' : 'looks good', issues.length ? 'var(--warn)' : 'var(--pass)']].concat(issues.map((x) => ['·', x])));
    }
    ta.addEventListener('input', draw);
    w.body.append(ta, ro.el, out);
    draw();
    return w.el;
  }

  LLM.mod('32', {
    hook: 'Ten apps and ten tools: do you need a hundred integrations?',
    intro: ['The Model Context Protocol is an open standard for connecting AI applications to tools and data. Each tool provider writes one MCP server; each app implements an MCP client once. Ten apps and ten tools then need twenty implementations instead of a hundred custom integrations.'],
    hero: { steps: [
      { title: 'Host, client, server', text: 'The host is the AI app. It runs one MCP client per server connection. Servers expose capabilities: local ones over stdio, remote ones over streamable HTTP.' },
      { title: 'Initialise', text: 'The client and server agree on a protocol version and exchange capabilities. Messages are JSON-RPC 2.0.' },
      { title: 'Discover tools', text: '<code>tools/list</code> returns each tool’s name, description and input schema. The host turns these into tool definitions for the model.' },
      { title: 'Call a tool', text: 'When the model calls a tool, the host sends <code>tools/call</code> with the arguments and gets content back.' },
      { title: 'Into the context', text: 'The result goes into the model’s context as a tool result. From the model’s view, MCP tools are just tools.' },
    ], init: heroInit },
    sections: [
      { title: 'The session, message by message', widget: inspector },
      { title: 'Primitives', body: [table(['Side', 'Primitive', 'What it is'], [['Server', 'Tools', 'Functions the model can call'], ['Server', 'Resources', 'Data the app can read (files, records), addressed by URI'], ['Server', 'Prompts', 'Reusable prompt templates the user can pick'], ['Client', 'Sampling', 'Server asks the host’s model to generate text'], ['Client', 'Roots', 'Which directories or URIs the server may work within'], ['Client', 'Elicitation', 'Server asks the user for input through the host']]), '<b>Authorisation</b>: remote servers use OAuth so users grant scoped access. <b>MCP vs function calling</b>: function calling is how a model requests a tool; MCP is how an app discovers and connects to tools from anywhere. <b>MCP vs A2A</b>: agent ↔ tool vs agent ↔ agent (Module 35).'] },
      { title: 'Write a tool', widget: serverLab },
      { title: 'Security', body: ['<b>Tool poisoning</b>: a server’s tool descriptions are read by the model, so a malicious server can hide instructions in them. <b>Injection through results</b>: tool output may carry instructions (Module 39). <b>Over-broad scopes</b>: grant the narrowest access. <b>Untrusted servers</b>: a local server runs code on your machine; install only ones you trust, and review updates.'] },
    ],
    maths: [{ note: 'Integration count without and with a shared protocol, for A apps and T tools:', tex: 'A\\times T\\quad\\to\\quad A+T,\\qquad 10\\times 10=100\\ \\to\\ 20' }],
    leaves: ['The spec evolves; the message shapes here follow one version and omit optional fields.', 'Hosts differ in which primitives they support.', 'A protocol does not make a server safe; trust and permissions still apply.'],
    quiz: [
      { q: 'In MCP, which component talks directly to a server?', opts: ['The model', 'A client inside the host', 'The user', 'Another server'], a: 1, why: 'Hosts run one client per server connection.' },
      { q: 'What does tools/list return?', opts: ['Tool results', 'Each tool’s name, description and input JSON Schema', 'The model’s weights', 'OAuth tokens'], a: 1, why: 'Discovery metadata the host turns into tool definitions.' },
      { q: 'Which is a client-side primitive?', opts: ['Resources', 'Prompts', 'Sampling', 'Tools'], a: 2, why: 'Sampling lets a server ask the host’s model to generate; roots and elicitation are also client-side.' },
    ],
  });
})();
