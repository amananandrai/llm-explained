(function () {
  const { h, s, svg, clear, widget, readout, mix, diagram, table, code } = LLM.util;

  function heroInit(box) {
    const G = [['data', 'data review'], ['eval', 'evaluation'], ['red', 'red-team'], ['sign', 'sign-off'], ['ship', 'release']];
    const nodes = G.map(([id, l], i) => ({ id, x: 10 + i * 110, y: 100, w: 96, h: 44, label: l, color: id === 'ship' ? 'var(--pass)' : 'var(--res)' }));
    nodes.push({ id: 'inc', x: 210, y: 210, w: 200, h: 56, label: 'incident #142', sub: 'jailbreak bypasses refusal on 6% of prompts', color: 'var(--fail)' });
    const d = diagram(560, 290, nodes, [['data', 'eval'], ['eval', 'red'], ['red', 'sign'], ['sign', 'ship'], ['red', 'inc']], 'A model moving through release gates');
    box.appendChild(d.el);
    const ST = [
      { good: [], hot: ['data'], show: G.map((g) => g[0]), txt: 'Gate 1: provenance, licences and consent for training and fine-tuning data; PII handling checked.' },
      { good: ['data'], hot: ['eval'], show: G.map((g) => g[0]), txt: 'Gate 2: capability, safety and bias evaluations meet the thresholds agreed for this use.' },
      { good: ['data', 'eval'], bad: ['red'], show: 'all', flow: [['red', 'inc']], txt: 'Gate 3 fails: red-teamers find a jailbreak. The pipeline halts and an incident opens with an owner and a deadline.' },
      { good: ['data', 'eval', 'red'], hot: ['sign'], show: G.map((g) => g[0]), txt: 'Fixed and re-tested. Gate 4: an accountable owner signs off against the risk assessment.' },
      { good: ['data', 'eval', 'red', 'sign', 'ship'], show: G.map((g) => g[0]), txt: 'Released with a model card, monitoring, an audit log and an incident-response path.' },
    ];
    return { go(i) { const st = ST[i]; d.draw({ show: st.show, good: st.good, bad: st.bad, hot: st.hot, flow: st.flow, notes: [[10, 30, st.txt, 'font-weight:600;font-size:11.5px']] }); } };
  }

  function modelCard() {
    const w = widget('Model card template', 'Try it', 'Sections follow Mitchell et al. 2019, trimmed. Fill the fields to see the card; nothing is sent anywhere.');
    const F = [['name', 'Model name and version', 'support-router v2.3'], ['owner', 'Owner (team, contact)', 'Customer Platform team'], ['base', 'Base model and training', 'Fine-tuned from an open 8B model with LoRA on 40k labelled tickets'], ['use', 'Intended use', 'Route English support tickets to one of 9 queues'], ['oos', 'Out of scope', 'Legal or medical advice; languages other than English'], ['data', 'Training data and provenance', 'Tickets from 2023–2025, customer consent under ToS §4, PII redacted'], ['metrics', 'Evaluation', 'Accuracy 91.2% ± 0.9 on 4,000 held-out tickets; per-language and per-region breakdown attached'], ['risks', 'Known limitations and risks', 'Misroutes rare products; lower accuracy on very short tickets'], ['monitor', 'Monitoring and contact', 'Weekly drift report; incidents to #support-ml']];
    const form = h('div', { style: { display: 'grid', gap: '8px' } }); const pre = h('pre', { class: 'code', style: { whiteSpace: 'pre-wrap' } }); const vals = {};
    F.forEach(([k, l, v]) => { vals[k] = v; const id = 'mc-' + k; form.appendChild(h('div', { class: 'ctl' }, h('label', { for: id }, l), h('input', { type: 'text', id, value: v, oninput: (e) => { vals[k] = e.target.value; draw(); } }))); });
    function draw() { pre.textContent = `# Model card: ${vals.name}\n\n**Owner:** ${vals.owner}\n\n## Model details\n${vals.base}\n\n## Intended use\n${vals.use}\n\n**Out of scope:** ${vals.oos}\n\n## Training data\n${vals.data}\n\n## Evaluation\n${vals.metrics}\n\n## Limitations and risks\n${vals.risks}\n\n## Monitoring\n${vals.monitor}\n`; }
    w.body.append(h('div', { class: 'w-split' }, form, pre));
    draw();
    return w.el;
  }

  function riskQuiz() {
    const w = widget('Which EU AI Act risk tier?', 'Try it', 'A simplified teaching exercise based on the EU AI Act’s four tiers. Real classification depends on the full text, annexes and guidance; this is not legal advice.');
    const TIERS = ['Prohibited', 'High-risk', 'Transparency obligations', 'Minimal risk'];
    const cases = [['Social scoring of citizens by a public authority', 0, 'Listed among prohibited practices.'], ['Screening CVs to shortlist job candidates', 1, 'Employment and worker management is a high-risk area (Annex III).'], ['A customer-service chatbot', 2, 'People must be told they are interacting with an AI system.'], ['An email spam filter', 3, 'No specific obligations beyond existing law.'], ['Scoring individuals’ creditworthiness', 1, 'Access to essential private services such as credit is a high-risk area.'], ['Generating realistic synthetic video of real people', 2, 'Deepfakes must be disclosed as artificially generated.'], ['Inferring employees’ emotions from webcams at work', 0, 'Emotion recognition in workplaces and education is prohibited, with narrow medical or safety exceptions.'], ['Grading students’ exams automatically', 1, 'Education and vocational training uses are high-risk.']];
    const ans = new Array(cases.length).fill(null); const list = h('div', { style: { display: 'grid', gap: '8px' } }); const ro = readout();
    function draw() {
      clear(list); cases.forEach(([c, t, why], i) => list.appendChild(h('div', { style: { display: 'grid', gap: '4px', padding: '8px 10px', border: '1px solid var(--rule)', borderRadius: '8px', background: 'var(--paper)' } }, h('div', null, c), h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, TIERS.map((tn, j) => h('button', { type: 'button', class: 'btn', style: ans[i] === j ? { borderColor: j === t ? 'var(--pass)' : 'var(--fail)' } : null, onclick: () => { ans[i] = j; draw(); } }, tn))), ans[i] != null ? h('div', { class: 'muted', style: { fontSize: '.88rem' } }, (ans[i] === t ? '✓ ' : '✗ ' + TIERS[t] + '. ') + why) : null)));
      ro.set([['answered', ans.filter((x) => x != null).length + ' / ' + cases.length], ['correct', ans.filter((x, i) => x === cases[i][1]).length]]);
    }
    w.body.append(ro.el, list); draw();
    return w.el;
  }

  LLM.mod('40', {
    hook: 'Who decided this model was safe to ship, and how would you prove it?',
    intro: ['Governance is the set of processes that make AI use accountable: knowing which models you run, who owns them, what data trained them, what risks they carry, who approved them, and what happens when they fail. It is what lets an organisation answer a regulator, an auditor or an affected person with evidence.'],
    hero: { steps: [
      { title: 'Data review', text: 'Provenance, licensing and consent for training and fine-tuning data; personal data minimised or redacted.' },
      { title: 'Evaluation', text: 'Capability, safety and fairness evaluations against thresholds agreed before testing, not after.' },
      { title: 'Red-team fails', text: 'A failing check halts release and opens an incident with an owner. Governance is mostly about this moment.' },
      { title: 'Sign-off', text: 'An accountable person signs off against the documented risk assessment.' },
      { title: 'Release and watch', text: 'Ship with documentation, monitoring, audit logs and a way to report and respond to incidents.' },
    ], init: heroInit },
    sections: [
      { title: 'Documentation', body: ['<b>Model inventory</b> with an owner for every model and use case. <b>Model cards</b> describe a model’s intended use, evaluation and limits; <b>datasheets</b> do the same for datasets.'], widget: modelCard },
      { title: 'Risk classification', widget: riskQuiz },
      { title: 'Controls and frameworks', body: ['<b>Approval gates</b> scaled to risk tier; <b>access control</b> and <b>audit logs</b> for who used or changed what; <b>incident response</b> with severity levels; <b>privacy</b>: PII handling, retention limits, data-subject rights; <b>bias and fairness testing</b> across relevant groups; <b>human oversight</b> for high-impact decisions, with the ability to override.', table(['Framework', 'What it is'], [['NIST AI RMF 1.0 (2023)', 'Voluntary US framework: Govern, Map, Measure, Manage'], ['ISO/IEC 42001 (2023)', 'Certifiable AI management-system standard'], ['EU AI Act (2024)', 'Risk-tiered regulation with obligations phased in from 2025'], ['Local data-protection law', 'For example GDPR, India’s DPDP Act 2023']]), 'Map your controls to the frameworks that apply to you, and keep the evidence.'] },
    ],
    maths: [{ note: 'A common way to prioritise risks: score likelihood and impact, and gate on the product:', tex: '\\text{risk}=\\text{likelihood}\\times\\text{impact},\\qquad \\text{release only if}\\ \\text{risk}\\le\\tau_{\\text{tier}}' }],
    leaves: ['Regulation differs by country and changes; check current law with qualified advice.', 'The tier exercise simplifies the EU AI Act considerably.', 'Process without real evaluation is paperwork; governance depends on the technical work in Modules 37–39.'],
    quiz: [
      { q: 'What should happen when a release gate fails?', opts: ['Ship and fix later', 'Halt the release and open an incident with an owner', 'Lower the threshold', 'Delete the test'], a: 1, why: 'Gates only work if failing them stops the release.' },
      { q: 'What does a model card document?', opts: ['Weights', 'Intended use, evaluation, limitations and owners', 'Source code', 'API keys'], a: 1, why: 'It tells users and reviewers what the model is for and how far to trust it.' },
      { q: 'Under the EU AI Act, a customer-service chatbot mainly triggers…', opts: ['a ban', 'transparency obligations (tell people it is AI)', 'nothing', 'high-risk conformity assessment'], a: 1, why: 'Chatbots must disclose that the user is interacting with AI.' },
    ],
  });
})();
