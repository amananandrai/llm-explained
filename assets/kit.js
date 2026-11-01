/* LLM Explained — second-tier components shared by Parts 3–7:
   diagram (PipelineFlow / BlockDiagram), traceView (AgentTrace), table, code, checklist, bar rows. */
(function () {
  'use strict';
  const { h, s, svg, clear, mix, rich } = LLM.util;

  /* Diagram: nodes + edges; draw(state) highlights per step.
     node: {id, x, y, w, h, label, sub, color, shape:'rect'|'pill'|'cyl'}
     state: {show, dim, hot, bad, good, edges:[[a,b,label?]], flow:[[a,b]], caption, notes:[[x,y,text,style]], badge:{id:text}, extra:(g)=>{}} */
  function diagram(W, H, nodes, edges, label) {
    const g = svg(W, H, { 'aria-label': label || 'Diagram' });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    function port(a, b) {
      const A = byId[a], B = byId[b];
      const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
      const dx = bx - ax, dy = by - ay;
      const clip = (n, cx, cy, sx, sy) => { const tx = (n.w / 2) / Math.abs(sx || 1e-9), ty = (n.h / 2) / Math.abs(sy || 1e-9); const t = Math.min(tx, ty); return [cx + sx * t, cy + sy * t]; };
      const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      return [clip(A, ax, ay, ux, uy), clip(B, bx, by, -ux, -uy)];
    }
    function draw(st = {}) {
      clear(g);
      g.appendChild(s('defs', null,
        s('marker', { id: 'dgA', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--muted)' })),
        s('marker', { id: 'dgH', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0L10,5L0,10z', fill: 'var(--accent)' })),
        s('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('rect', { width: 6, height: 6, fill: 'var(--surface)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--fail)', 'stroke-width': 2.5 }))));
      const has = (arr, id) => arr && arr.includes(id);
      const shown = (id) => !st.show || st.show === 'all' || st.show.includes(id);
      const hotE = (a, b) => (st.edges || []).some((e) => e[0] === a && e[1] === b);
      const flowE = (a, b) => (st.flow || []).some((e) => e[0] === a && e[1] === b);
      edges.forEach(([a, b, lab]) => {
        if (!shown(a) || !shown(b)) return;
        const [[x1, y1], [x2, y2]] = port(a, b);
        const hot = hotE(a, b) || flowE(a, b);
        const dim = (has(st.dim, a) || has(st.dim, b)) && !hot;
        g.appendChild(s('line', { x1, y1, x2, y2, stroke: hot ? 'var(--accent)' : 'var(--muted)', 'stroke-width': hot ? 2.4 : 1.4, 'marker-end': hot ? 'url(#dgH)' : 'url(#dgA)', class: flowE(a, b) ? 'dg-flow' : '', style: dim ? 'opacity:.25' : '' }));
        if (lab) g.appendChild(s('text', { x: (x1 + x2) / 2 + 4, y: (y1 + y2) / 2 - 5, class: 'lbl', text: lab, style: dim ? 'opacity:.3' : '' }));
      });
      nodes.forEach((n) => {
        if (!shown(n.id)) return;
        const dim = has(st.dim, n.id), hot = has(st.hot, n.id), bad = has(st.bad, n.id), good = has(st.good, n.id);
        const col = bad ? 'var(--fail)' : good ? 'var(--pass)' : n.color || 'var(--res)';
        const grp = s('g', { style: dim ? 'opacity:.28' : '' });
        const rx = n.shape === 'pill' ? n.h / 2 : 9;
        if (n.shape === 'cyl') {
          grp.appendChild(s('rect', { x: n.x, y: n.y + 6, width: n.w, height: n.h - 6, fill: bad ? 'url(#hatch)' : mix(col, hot ? 30 : 14), stroke: hot ? 'var(--accent)' : col, 'stroke-width': hot ? 2.4 : 1.4 }));
          grp.appendChild(s('ellipse', { cx: n.x + n.w / 2, cy: n.y + 6, rx: n.w / 2, ry: 6, fill: mix(col, hot ? 40 : 22), stroke: hot ? 'var(--accent)' : col, 'stroke-width': hot ? 2.4 : 1.4 }));
        } else grp.appendChild(s('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx, fill: bad ? 'url(#hatch)' : mix(col, hot ? 30 : 13), stroke: hot ? 'var(--accent)' : col, 'stroke-width': hot ? 2.4 : 1.4 }));
        grp.appendChild(s('text', { x: n.x + n.w / 2, y: n.y + n.h / 2 + (n.sub ? -2 : 4), 'text-anchor': 'middle', 'font-size': n.fs || 12, text: n.label, style: 'font-weight:600' }));
        if (n.sub) grp.appendChild(s('text', { x: n.x + n.w / 2, y: n.y + n.h / 2 + 12, 'text-anchor': 'middle', 'font-size': 9.5, class: 'lbl', text: n.sub }));
        if (st.badge && st.badge[n.id]) { const t = st.badge[n.id]; grp.appendChild(s('rect', { x: n.x + n.w - 6 - t.length * 6.2, y: n.y - 9, width: t.length * 6.2 + 10, height: 16, rx: 8, fill: 'var(--ink)' })); grp.appendChild(s('text', { x: n.x + n.w - 1 - t.length * 3.1, y: n.y + 3, 'text-anchor': 'middle', 'font-size': 9.5, text: t, style: 'fill:var(--paper)' })); }
        g.appendChild(grp);
      });
      (st.notes || []).forEach(([x, y, t, style]) => g.appendChild(s('text', { x, y, 'font-size': 11.5, text: t, style: style || '' })));
      if (st.caption) g.appendChild(s('text', { x: 12, y: H - 10, 'font-size': 12, text: st.caption }));
      if (st.extra) st.extra(g);
    }
    return { el: g, draw };
  }

  /* Agent trace: items [{k:'Thought'|'Action'|'Observation'|'Answer'|'User'|..., t:text}] */
  const KIND = { Thought: ['var(--q)', '◆'], Action: ['var(--k)', '▶'], Observation: ['var(--v)', '●'], Answer: ['var(--accent)', '★'], User: ['var(--res)', '›'], System: ['var(--res)', '#'], Injected: ['var(--fail)', '!'], Check: ['var(--warn)', '?'] };
  function traceView(items, upto) {
    const el = h('ol', { class: 'trace' });
    items.forEach((it, i) => {
      const [c, mk] = KIND[it.k] || ['var(--muted)', '·'];
      el.appendChild(h('li', { class: 'trace-row', style: { opacity: upto == null || i <= upto ? 1 : 0.22, borderLeftColor: c } },
        h('span', { class: 'trace-k', style: { color: c } }, mk + ' ' + it.k), h('span', { class: 'trace-t' }, rich(it.t))));
    });
    return el;
  }

  function table(head, rows, opts = {}) {
    return h('div', { class: 'tbl-wrap' }, h('table', null, h('thead', null, h('tr', null, head.map((c, i) => h('th', { class: (opts.num || []).includes(i) ? 'num' : null }, c)))),
      h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', { class: (opts.num || []).includes(i) ? 'num' : null }, c instanceof Node ? c : rich(String(c)))))))));
  }
  const code = (t) => h('pre', { class: 'code' }, t);

  /* horizontal labelled bars; items [{label, v, color, text}] */
  function barRows(W, items, o = {}) {
    const rowH = o.rowH || 24, lw = o.labelW || 150, g = svg(W, items.length * rowH + 6);
    const max = o.max || Math.max(...items.map((d) => d.v), 1e-9), bw = W - lw - 90;
    items.forEach((d, i) => {
      const y = i * rowH;
      g.appendChild(s('text', { x: lw - 8, y: y + rowH * 0.66, 'text-anchor': 'end', 'font-size': 11.5, text: d.label }));
      g.appendChild(s('rect', { x: lw, y: y + 4, width: bw, height: rowH - 8, rx: 3, fill: 'var(--sunk)' }));
      g.appendChild(s('rect', { x: lw, y: y + 4, width: Math.max(0, Math.min(1, d.v / max)) * bw, height: rowH - 8, rx: 3, fill: d.color || 'var(--q)', style: d.hatch ? 'fill:url(#hatch)' : '' }));
      g.appendChild(s('text', { x: lw + bw + 6, y: y + rowH * 0.66, 'font-size': 11, text: d.text != null ? d.text : String(d.v) }));
    });
    return g;
  }

  function checklist(items, onchange) {
    const st = items.map((it) => !!it.on);
    const el = h('div', { style: { display: 'grid', gap: '6px' } });
    items.forEach((it, i) => {
      const id = 'ck-' + Math.random().toString(36).slice(2, 8);
      el.appendChild(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'baseline' } },
        h('input', { type: 'checkbox', id, checked: st[i], onchange: (e) => { st[i] = e.target.checked; onchange && onchange(st); } }),
        h('label', { for: id }, rich(it.label))));
    });
    return { el, get state() { return st; } };
  }

  // small seeded scramble used by sims
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  Object.assign(LLM.util, { diagram, traceView, table, code, barRows, checklist, shuffle });

  const css = h('style', null, `
  .trace { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: .93rem; }
  .trace-row { border-left: 3px solid; padding: 6px 10px; background: var(--paper); border-radius: 0 8px 8px 0; display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 8px; transition: opacity .3s; }
  .trace-k { font-family: var(--f-mono); font-size: .76rem; text-transform: uppercase; letter-spacing: .05em; padding-top: 3px; }
  .trace-t { min-width: 0; overflow-wrap: anywhere; }
  .dg-flow { stroke-dasharray: 6 5; animation: dgflow 1s linear 3; }
  @keyframes dgflow { to { stroke-dashoffset: -22; } }
  @media (max-width: 520px) { .trace-row { grid-template-columns: 1fr; gap: 2px; } }
  `);
  document.head.appendChild(css);
})();
