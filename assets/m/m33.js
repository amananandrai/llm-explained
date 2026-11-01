(function () {
  const { h, s, svg, clear, slider, widget, readout, mix, tokColor, human, barRows, table, code } = LLM.util;
  const SKILLS = [['pdf-forms', 'Fill and read PDF forms'], ['brand-deck', 'Make slides in the company style'], ['sql-review', 'Review SQL for performance'], ['release-notes', 'Write release notes from git log'], ['invoice-check', 'Check invoices against POs'], ['test-gen', 'Generate unit tests'], ['incident', 'Run the incident checklist'], ['translate-ui', 'Translate UI strings']];

  function heroInit(box) {
    const g = svg(560, 320, { 'aria-label': 'Skills sit as thin spines on a shelf until one opens and its instructions slide into context' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      g.appendChild(s('text', { x: 14, y: 20, 'font-size': 12.5, text: ['Eight skills installed: only their names and one-line descriptions sit in context', 'A task arrives: “Our invoice from Acme doesn’t match the PO”', 'The matching skill opens: its SKILL.md loads, then scripts and references only if needed', 'A plugin is a box of skills, commands, an MCP server, hooks and subagents'][step], style: 'font-weight:600' }));
      g.appendChild(s('rect', { x: 14, y: 170, width: 330, height: 8, rx: 2, fill: 'var(--t6)' }));
      SKILLS.forEach(([n, d], i) => { const open = step >= 2 && i === 4, x = 24 + i * 38 + (open ? 0 : i > 4 && step >= 2 ? 120 : 0); if (open) { g.appendChild(s('rect', { x, y: 40, width: 150, height: 128, rx: 4, fill: mix('var(--t4)', 18), stroke: 'var(--t4)', 'stroke-width': 2 })); ['SKILL.md', '  steps: match lines,', '  flag price diffs > 2%', 'scripts/compare.py', 'reference/po-format.md'].forEach((t, k) => g.appendChild(s('text', { x: x + 8, y: 60 + k * 20, 'font-size': 10.5, text: t, style: k === 0 ? 'font-weight:700' : k >= 3 ? 'fill:var(--muted)' : '' }))); } else { g.appendChild(s('rect', { x, y: 60, width: 30, height: 108, rx: 3, fill: mix(tokColor(i), step === 1 && i === 4 ? 70 : 30), stroke: tokColor(i) })); g.appendChild(s('text', { x: x + 19, y: 160, 'font-size': 9.5, text: n, transform: `rotate(-90 ${x + 19} 160)` })); } });
      const tok = step >= 2 ? 8 * 40 + 1800 : 8 * 40;
      g.appendChild(s('text', { x: 370, y: 70, 'font-size': 12, text: 'skill tokens in context', style: 'font-weight:600' }));
      g.appendChild(s('text', { x: 370, y: 100, 'font-size': 26, text: tok.toLocaleString(), style: 'font-family:var(--f-display);font-weight:700' }));
      g.appendChild(s('text', { x: 370, y: 122, class: 'lbl', text: `vs ${(8 * 2200).toLocaleString()} if every skill were loaded` }));
      if (step === 3) { const items = [['skills/', 'var(--t4)'], ['commands/', 'var(--q)'], ['.mcp.json → server', 'var(--v)'], ['hooks/', 'var(--k)'], ['agents/', 'var(--accent)']]; g.appendChild(s('rect', { x: 14, y: 200, width: 530, height: 100, rx: 10, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-dasharray': '5 4' })); g.appendChild(s('text', { x: 24, y: 220, 'font-size': 11.5, text: 'finance-tools plugin', style: 'font-weight:600' })); items.forEach(([t, c], i) => { g.appendChild(s('rect', { x: 24 + i * 104, y: 236, width: 96, height: 44, rx: 6, fill: mix(c, 22), stroke: c })); g.appendChild(s('text', { x: 72 + i * 104, y: 262, 'text-anchor': 'middle', 'font-size': 10, text: t })); }); }
    }
    return { go: draw };
  }

  function disclosure() {
    const w = widget('Progressive disclosure, in tokens', 'Try it');
    const st = { n: 40, meta: 50, body: 2500, used: 1 };
    const out = h('div'); const ro = readout(); const sl = {};
    const mk = (k, l, a, b, step) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], oninput: (v) => { st[k] = v; draw(); } }));
    mk('n', 'skills installed', 1, 200, 1); mk('meta', 'tokens per name + description', 10, 200, 5); mk('body', 'tokens per full SKILL.md', 200, 10000, 100); mk('used', 'skills a task actually opens', 0, 5, 1);
    function draw() { const eager = st.n * st.body, lazy = st.n * st.meta + st.used * st.body; clear(out).appendChild(barRows(560, [{ label: 'load everything', v: eager, text: human(eager) + ' tokens', color: 'var(--fail)' }, { label: 'progressive', v: lazy, text: human(lazy) + ' tokens', color: 'var(--pass)' }], { max: eager, labelW: 120 })); ro.set([['saved per turn', human(eager - lazy) + ' tokens'], ['share of a 200k window (progressive)', ((lazy / 200000) * 100).toFixed(1) + '%']]); }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), out, ro.el);
    draw();
    return w.el;
  }

  function writer() {
    const w = widget('Write a skill', 'Try it', 'A toy selector matches tasks to skills by word overlap with each skill’s description, standing in for the agent. As with real agents, the description is what gets a skill picked.');
    const ta = h('textarea', { id: 'skill-md', rows: 9 }, '---\nname: expense-audit\ndescription: Audit expense claims and receipts against the travel policy; flag missing receipts and over-limit meals.\n---\n\n# Expense audit\n1. Load the claim and receipts.\n2. Check each line against policy limits in reference/limits.md.\n3. Output a table of flags.');
    const others = [['pdf-forms', 'Fill and read PDF forms and extract fields.'], ['release-notes', 'Write release notes from git commit history.'], ['sql-review', 'Review SQL queries for performance problems.']];
    const tasks = ['Check these travel receipts against our expense policy', 'Draft notes for the 2.4 release from the commits', 'Why is this SQL query slow?', 'Audit last month’s meal claims'];
    const out = h('div'); const ro = readout();
    const words = (x) => (x.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w2) => w2.length > 3).map((w2) => w2.replace(/(es|s|ed|ing)$/, ''));
    function draw() {
      const fm = ta.value.match(/^---\s*\n([\s\S]*?)\n---/); const name = fm && (fm[1].match(/name:\s*(.+)/) || [])[1]; const desc = fm && (fm[1].match(/description:\s*(.+)/) || [])[1];
      const all = [[name || '(no name)', desc || '']].concat(others);
      clear(out).appendChild(table(['Task', 'Skill picked'], tasks.map((t) => { const tw = words(t); const sc = all.map(([, d]) => tw.filter((x) => words(d).includes(x)).length); const m = Math.max(...sc); return [t, m ? h('code', null, all[sc.indexOf(m)][0]) : h('span', { class: 'muted' }, 'none')]; })));
      ro.set([['frontmatter', fm ? 'found' : 'missing: start with --- name / description ---', fm ? 'var(--pass)' : 'var(--fail)'], ['description length', (desc || '').length + ' chars', (desc || '').length > 40 ? 'var(--pass)' : 'var(--warn)']]);
    }
    ta.addEventListener('input', draw);
    w.body.append(ta, ro.el, out);
    draw();
    return w.el;
  }

  function anatomy() {
    const w = widget('Plugin anatomy', 'Try it');
    const parts = [['plugin.json', 'Manifest: name, version, description, author.'], ['skills/expense-audit/SKILL.md', 'A skill: frontmatter (name, description) plus instructions; loaded when relevant.'], ['skills/expense-audit/scripts/check.py', 'Code the skill can run instead of asking the model to compute.'], ['commands/audit.md', 'A slash command the user can type, e.g. /audit.'], ['.mcp.json', 'MCP servers to start (Module 32), e.g. the expenses database.'], ['hooks/hooks.json', 'Commands run before or after tool calls, e.g. block writes outside the repo.'], ['agents/reviewer.md', 'A subagent definition with its own prompt and tools (Module 34).']];
    let cur = 0; const desc = h('p'); const list = h('div', { style: { display: 'grid', gap: '4px' } });
    function draw() { clear(list); parts.forEach(([p], i) => list.appendChild(h('button', { type: 'button', class: 'btn', style: { justifyContent: 'flex-start', fontFamily: 'var(--f-mono)', fontSize: '.82rem', borderColor: i === cur ? 'var(--accent)' : null }, onclick: () => { cur = i; draw(); } }, p))); desc.textContent = parts[cur][1]; }
    w.body.append(h('div', { class: 'w-split' }, list, desc));
    draw();
    return w.el;
  }

  LLM.mod('33', {
    hook: 'How can an agent know a hundred specialised procedures without stuffing them all into its prompt?',
    intro: ['A skill is a folder of instructions, scripts and reference files that an agent loads only when a task needs it. Until then, only its name and a one-line description sit in context. A plugin bundles skills with commands, MCP servers, hooks and subagents into one installable unit.'],
    hero: { steps: [
      { title: 'Spines on a shelf', text: 'Each installed skill costs a few dozen tokens: its name and description.' },
      { title: 'A task arrives', text: 'The agent compares the task with the descriptions and picks the one that fits.' },
      { title: 'Open the book', text: 'It reads SKILL.md, then opens scripts or reference files only if the instructions call for them. This is progressive disclosure.' },
      { title: 'Plugins', text: 'Plugins package skills with slash commands, MCP servers, hooks and subagents, so a team can install a whole workflow at once and version it.' },
    ], init: heroInit },
    sections: [
      { title: 'The token budget', widget: disclosure },
      { title: 'Writing skills', body: ['The SKILL.md convention is shared across many agent tools: YAML frontmatter with a name and a description, then Markdown instructions. Put deterministic work in scripts, long reference material in separate files the skill points to, and examples of good output.'], widget: writer },
      { title: 'Inside a plugin', widget: anatomy },
      { title: 'Choosing and trusting', body: [table(['Use…', 'When'], [['A prompt or instruction file', 'Always-on project conventions'], ['A skill', 'A procedure needed sometimes, with steps, scripts or references'], ['An MCP server', 'Live access to an external system or data'], ['A plugin', 'Shipping several of these together to a team']]), 'Third-party skills and plugins run code and steer the agent. Review them like dependencies: read the instructions and scripts, pin versions, and prefer sources you trust.'] },
    ],
    maths: [{ note: 'Context cost of n skills when k are opened, with metadata cost m and body cost b:', tex: '\\text{eager}=n\\,b,\\qquad \\text{progressive}=n\\,m+k\\,b,\\qquad m\\ll b' }],
    leaves: ['Skill selection here is a word-overlap toy; agents use the model’s judgement.', 'Formats and folder names vary between tools; check your tool’s docs.', 'A loaded skill’s text still counts against the context budget.'],
    quiz: [
      { q: 'What sits in context before a skill is used?', opts: ['The whole folder', 'Its name and short description', 'Its scripts', 'Nothing'], a: 1, why: 'The rest loads only when the agent decides the skill is relevant.' },
      { q: '50 skills, 40-token descriptions, 3,000-token bodies, 1 opened. Progressive cost?', opts: ['150,000', '5,000', '2,000', '3,040'], a: 1, why: '50 × 40 + 1 × 3,000 = 5,000 tokens.' },
      { q: 'Which belongs in an MCP server rather than a skill?', opts: ['A writing style guide', 'Live read access to the CRM', 'A release checklist', 'Example outputs'], a: 1, why: 'Connections to external systems are servers; procedures are skills.' },
    ],
  });
})();
