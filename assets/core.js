/* LLM Explained — shared component library (Phase 0).
   Plain JS, no build step. Modules register with LLM.mod(id, def) and are lazy-loaded per route. */
(function () {
  'use strict';
  const LLM = (window.LLM = { modules: {}, util: {} });
  const PLAN = window.PLAN;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Which modules have a full interactive build (the beta: Parts 1–2).
  LLM.LIVE = ['0', '0-kl'].concat(Array.from({ length: 41 }, (_, i) => String(i + 1)));
  LLM.EMERGING = ['10', '11', '15', '17', '18'];
  LLM.ORDER = ['0', '0-kl'].concat(Array.from({ length: 41 }, (_, i) => String(i + 1)));
  LLM.TITLES = { '0-kl': 'KL divergence: forward vs reverse' };
  const title = (id) => LLM.TITLES[id] || (PLAN.modules[id] && PLAN.modules[id].title.replace(/<[^>]+>/g, '')) || id;
  LLM.title = title;

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs && attrs.style) el.setAttribute('style', attrs.style);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false || k === 'style') continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else if (typeof v === 'string' && v.includes('var(') && k !== 'style') el.style.setProperty(k, v);
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  }
  function svg(w, hgt, attrs) { return s('svg', Object.assign({ viewBox: `0 0 ${w} ${hgt}`, role: 'img' }, attrs || {})); }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  Object.assign(LLM.util, { h, s, svg, clear, append, reduced });

  /* ---------------- maths ---------------- */
  const MACROS = {
    '\\Q': '\\htmlClass{cq}{#1}', '\\K': '\\htmlClass{ck}{#1}', '\\V': '\\htmlClass{cv}{#1}', '\\G': '\\htmlClass{cg}{#1}',
    '\\R': '\\htmlClass{cr}{#1}', '\\A': '\\htmlClass{ca}{#1}', '\\P': '\\htmlClass{cpd}{#1}', '\\Qd': '\\htmlClass{cqd}{#1}', '\\F': '\\htmlClass{cf}{#1}',
  };
  function tex(src, display = true) {
    const span = h(display ? 'div' : 'span', { class: display ? 'mathblock' : '' });
    try {
      span.innerHTML = katex.renderToString(src, { displayMode: display, throwOnError: false, trust: true, strict: false, macros: Object.assign({}, MACROS) });
    } catch (e) { span.textContent = src; }
    return span;
  }
  LLM.util.tex = tex;
  // inline tex inside html strings: $...$
  function rich(html) {
    const d = h('div');
    d.innerHTML = html.replace(/\$([^$]+)\$/g, (_, t) => {
      try { return katex.renderToString(t, { throwOnError: false, trust: true, strict: false, macros: Object.assign({}, MACROS) }); } catch (e) { return t; }
    });
    return Array.from(d.childNodes);
  }
  LLM.util.rich = rich;

  /* ---------------- maths utils ---------------- */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function randn(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function softmax(z, T = 1) { const m = Math.max(...z.map((x) => x / T)); const e = z.map((x) => Math.exp(x / T - m)); const S = e.reduce((a, b) => a + b, 0); return e.map((x) => x / S); }
  const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);
  const matmul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((acc, x, k) => acc + x * B[k][j], 0)));
  const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const fmt = (x, d = 2) => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(d);
  function human(n, unit = '') {
    const a = Math.abs(n); const u = [['', 1], ['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e12], ['P', 1e15], ['E', 1e18], ['Z', 1e21]];
    let i = 0; while (i < u.length - 1 && a >= u[i + 1][1]) i++;
    const v = n / u[i][1]; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + u[i][0] + unit;
  }
  function bytes(n) { const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' ' + u[i]; }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  Object.assign(LLM.util, { rng, randn, softmax, dot, matmul, T, fmt, human, bytes, clamp, lerp });

  const tokColor = (i) => `var(--t${((i % 8) + 8) % 8})`;
  const mix = (cssVar, pct, base = 'var(--surface)') => `color-mix(in srgb, ${cssVar} ${clamp(pct, 0, 100).toFixed(0)}%, ${base})`;
  Object.assign(LLM.util, { tokColor, mix });

  function tween(dur, fn, done) {
    if (reduced() || dur <= 0) { fn(1); done && done(); return () => {}; }
    let raf, t0 = performance.now(), stop = false;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const tick = (now) => { if (stop) return; const t = Math.min(1, (now - t0) / dur); fn(ease(t)); if (t < 1) raf = requestAnimationFrame(tick); else done && done(); };
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }
  LLM.util.tween = tween;
  function flash(el) { if (!el || reduced()) return; el.classList.remove('flash'); void el.getBoundingClientRect(); el.classList.add('flash'); }
  LLM.util.flash = flash;

  /* ---------------- controls ---------------- */
  let uid = 0;
  function slider(o) {
    const id = o.id || 'sl' + ++uid;
    const out = h('output', { for: id });
    const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
    const show = () => { out.textContent = o.fmt ? o.fmt(+inp.value) : inp.value; };
    inp.addEventListener('input', () => { show(); o.oninput && o.oninput(+inp.value); });
    show();
    const el = h('div', { class: 'ctl' }, h('label', { for: id }, h('span', null, o.label), out), inp);
    return { el, input: inp, get value() { return +inp.value; }, set(v) { inp.value = v; show(); } };
  }
  function seg(options, value, onchange, label) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || 'Options' });
    const btns = options.map((o) => {
      const [val, text] = Array.isArray(o) ? o : [o, o];
      const b = h('button', { type: 'button', 'aria-pressed': String(val === value), onclick: () => set(val, true) }, text);
      b._v = val; return b;
    });
    function set(v, fire) { value = v; btns.forEach((b) => b.setAttribute('aria-pressed', String(b._v === v))); fire && onchange && onchange(v); }
    append(wrap, btns);
    return { el: wrap, set, get value() { return value; } };
  }
  function widget(titleText, tag, note) {
    const body = h('div', { class: 'wbody', style: { display: 'grid', gap: '14px', minWidth: 0 } });
    const el = h('section', { class: 'widget' }, h('header', null, h('h3', null, titleText), tag ? h('span', { class: 'eyebrow' }, tag) : null), body, note ? h('p', { class: 'note-sim' }, note) : null);
    return { el, body };
  }
  function readout() {
    const el = h('div', { class: 'readout', 'aria-live': 'polite' });
    return { el, set(pairs) { clear(el); pairs.forEach(([k, v, color]) => el.appendChild(h('span', null, k + ' ', h('b', { style: color ? { color } : null }, v)))); } };
  }
  Object.assign(LLM.util, { slider, seg, widget, readout });

  /* probability bars: always visibly sum to 100% */
  function probBars(o) {
    const W = o.width || 520, rowH = o.rowH || 22, labelW = o.labelW || 90;
    const g = svg(W, 10);
    function draw(items, opts = {}) {
      clear(g);
      const n = items.length, H = n * rowH + 24;
      g.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const max = opts.scaleMax || Math.max(...items.map((d) => d.p), 1e-9);
      const bw = W - labelW - 60;
      items.forEach((d, i) => {
        const y = i * rowH;
        g.appendChild(s('text', { x: labelW - 8, y: y + rowH * 0.68, 'text-anchor': 'end', 'font-size': 12, text: d.label, style: d.dim ? 'opacity:.4' : '' }));
        g.appendChild(s('rect', { x: labelW, y: y + 3, width: bw, height: rowH - 6, rx: 3, fill: 'var(--sunk)' }));
        g.appendChild(s('rect', { x: labelW, y: y + 3, width: Math.max(0, (d.p / max) * bw), height: rowH - 6, rx: 3, fill: d.color || 'var(--q)', style: (d.dim ? 'opacity:.25;' : '') + 'transition: width var(--step) ease-in-out' }));
        if (d.ghost != null) g.appendChild(s('rect', { x: labelW + (d.ghost / max) * bw - 1, y: y + 1, width: 2, height: rowH - 2, fill: 'var(--ink)' }));
        g.appendChild(s('text', { x: labelW + bw + 6, y: y + rowH * 0.68, 'font-size': 11.5, class: 'tabular', text: (d.p * 100).toFixed(1) + '%', style: d.dim ? 'opacity:.4' : '' }));
      });
      const sum = items.reduce((a, d) => a + d.p, 0);
      g.appendChild(s('text', { x: labelW, y: n * rowH + 17, class: 'lbl', text: opts.caption || `sum = ${(sum * 100).toFixed(1)}%` }));
    }
    return { el: g, draw };
  }
  LLM.util.probBars = probBars;

  /* matrix grid in SVG. vals: 2D array. returns group */
  function matrixGrid(vals, o = {}) {
    const cs = o.cell || 30, g = s('g', { transform: `translate(${o.x || 0},${o.y || 0})` });
    const max = o.max || Math.max(...vals.flat().map(Math.abs), 1e-9);
    vals.forEach((row, i) => row.forEach((v, j) => {
      const color = typeof o.color === 'function' ? o.color(v, i, j) : o.color || 'var(--q)';
      const hide = o.visible && !o.visible(i, j);
      const r = s('rect', { x: j * cs, y: i * cs, width: cs - 2, height: cs - 2, rx: 3, fill: hide ? 'var(--sunk)' : mix(color, (Math.abs(v) / max) * 85 + 6), stroke: o.hl && o.hl(i, j) ? 'var(--ink)' : 'none', 'stroke-width': 2 });
      g.appendChild(r);
      if (o.numbers !== false && !hide && v !== null) g.appendChild(s('text', { x: j * cs + cs / 2 - 1, y: i * cs + cs / 2 + 3.5, 'text-anchor': 'middle', 'font-size': o.fs || 9.5, text: o.fmt ? o.fmt(v) : fmt(v, 1) }));
    }));
    if (o.label) g.appendChild(s('text', { x: 0, y: -6, class: 'lbl', text: o.label }));
    return g;
  }
  LLM.util.matrixGrid = matrixGrid;

  /* simple line chart */
  function lineChart(o) {
    const W = o.w || 520, H = o.h || 220, m = { l: 46, r: 14, t: 24, b: 30 };
    const g = svg(W, H);
    function draw(series, opt = {}) {
      clear(g);
      const xs = series.flatMap((sr) => sr.pts.map((p) => p[0])), ys = series.flatMap((sr) => sr.pts.map((p) => p[1]));
      let x0 = opt.xmin ?? Math.min(...xs), x1 = opt.xmax ?? Math.max(...xs);
      let y0 = opt.ymin ?? Math.min(...ys), y1 = opt.ymax ?? Math.max(...ys);
      if (x1 === x0) { x1 = x0 + 1; }
      if (y1 === y0) y1 = y0 + 1;
      const logx = opt.logx, logy = opt.logy;
      const fx = (x) => m.l + ((logx ? Math.log10(x) - Math.log10(x0) : x - x0) / (logx ? Math.log10(x1) - Math.log10(x0) : x1 - x0)) * (W - m.l - m.r);
      const fy = (y) => H - m.b - ((logy ? Math.log10(y) - Math.log10(y0) : y - y0) / (logy ? Math.log10(y1) - Math.log10(y0) : y1 - y0)) * (H - m.t - m.b);
      const ticks = (a, b, log, n = 5) => { if (log) { const r = []; for (let e = Math.ceil(Math.log10(a)); e <= Math.floor(Math.log10(b)); e++) r.push(Math.pow(10, e)); return r; } const st = (b - a) / n; return Array.from({ length: n + 1 }, (_, i) => a + i * st); };
      ticks(y0, y1, logy, 4).forEach((t) => { g.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: fy(t), y2: fy(t), stroke: 'var(--rule)' })); g.appendChild(s('text', { x: m.l - 6, y: fy(t) + 4, 'text-anchor': 'end', class: 'lbl', text: opt.yfmt ? opt.yfmt(t) : +t.toPrecision(3) })); });
      ticks(x0, x1, logx, 5).forEach((t) => g.appendChild(s('text', { x: fx(t), y: H - m.b + 16, 'text-anchor': 'middle', class: 'lbl', text: opt.xfmt ? opt.xfmt(t) : +t.toPrecision(3) })));
      g.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: 'var(--muted)' }));
      if (opt.xlabel) g.appendChild(s('text', { x: W - m.r, y: H - 2, 'text-anchor': 'end', class: 'lbl', text: opt.xlabel }));
      if (opt.ylabel) g.appendChild(s('text', { x: 4, y: 10, class: 'lbl', text: opt.ylabel }));
      series.forEach((sr) => {
        const d = sr.pts.filter((p) => isFinite(p[1]) && (!logy || p[1] > 0)).map((p, i) => (i ? 'L' : 'M') + fx(p[0]).toFixed(1) + ',' + fy(clamp(p[1], y0, y1)).toFixed(1)).join('');
        if (sr.area) g.appendChild(s('path', { d: d + `L${fx(sr.pts[sr.pts.length - 1][0])},${fy(y0)}L${fx(sr.pts[0][0])},${fy(y0)}Z`, fill: sr.color, style: 'opacity:.12' }));
        g.appendChild(s('path', { d, fill: 'none', stroke: sr.color || 'var(--q)', 'stroke-width': sr.width || 2, 'stroke-dasharray': sr.dash || null }));
        (sr.dots || []).forEach((p) => g.appendChild(s('circle', { cx: fx(p[0]), cy: fy(p[1]), r: 4.5, fill: sr.color })));
      });
      (opt.marks || []).forEach((mk) => { g.appendChild(s('line', { x1: fx(mk.x), x2: fx(mk.x), y1: m.t, y2: H - m.b, stroke: mk.color || 'var(--accent)', 'stroke-dasharray': '4 3' })); if (mk.label) g.appendChild(s('text', { x: fx(mk.x) + 4, y: m.t + 10, class: 'lbl', text: mk.label })); });
      return { fx, fy };
    }
    return { el: g, draw };
  }
  LLM.util.lineChart = lineChart;

  /* ---------------- scrollytelling stage ---------------- */
  function scrolly(steps, init) {
    const stepEls = steps.map((st, i) => h('div', { class: 'step', 'data-i': i },
      h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, `Step ${i + 1} of ${steps.length}`), h('h3', null, st.title), ...[].concat(st.text).map((t) => h('p', null, rich(t))),
        st.mech ? h('p', { class: 'd-mech' }, h('span', { class: 'depth-tag' }, 'Mechanics'), h('br'), rich(st.mech)) : null,
        st.maths ? h('div', { class: 'd-maths' }, h('span', { class: 'depth-tag' }, 'Maths'), tex(st.maths)) : null)));
    const box = h('div', { class: 'stage-box' });
    const scrub = h('input', { type: 'range', min: 0, max: steps.length - 1, value: 0, 'aria-label': 'Animation step' });
    const count = h('span', { class: 'count' });
    const playBtn = h('button', { class: 'btn iconbtn', type: 'button', 'aria-label': 'Play' }, '▶');
    const back = h('button', { class: 'btn iconbtn', type: 'button', 'aria-label': 'Step back' }, '‹');
    const fwd = h('button', { class: 'btn iconbtn', type: 'button', 'aria-label': 'Step forward' }, '›');
    const player = h('div', { class: 'player' }, back, playBtn, fwd, scrub, count);
    const transcript = h('details', { class: 'transcript' }, h('summary', null, 'Text transcript of this animation'), h('ol', null, steps.map((st) => h('li', null, st.alt || (st.title + '. ' + [].concat(st.text).join(' ').replace(/\$[^$]*\$/g, '').replace(/<[^>]+>/g, ''))))));
    const stage = h('div', { class: 'stage' }, box, player, transcript);
    const el = h('div', { class: 'scrolly' }, h('div', { class: 'steps' }, stepEls), h('div', { class: 'stage-col' }, stage));
    const ctl = init(box);
    let cur = -1, timer = null, lock = 0;
    function go(i, from) {
      i = clamp(i, 0, steps.length - 1);
      if (i === cur) return;
      const prev = cur; cur = i;
      stepEls.forEach((e, k) => e.classList.toggle('on', k === i));
      scrub.value = i; count.textContent = `${i + 1} / ${steps.length}`;
      back.disabled = i === 0; fwd.disabled = i === steps.length - 1;
      ctl.go(i, prev);
      if (from === 'button') { lock = Date.now(); const r = stepEls[i].getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * 0.7) stepEls[i].scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }
    }
    function stopPlay() { clearInterval(timer); timer = null; playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); }
    playBtn.onclick = () => {
      if (timer) return stopPlay();
      if (cur === steps.length - 1) go(0, 'button');
      playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause');
      timer = setInterval(() => { if (cur >= steps.length - 1) return stopPlay(); go(cur + 1, 'button'); }, 2200);
    };
    back.onclick = () => { stopPlay(); go(cur - 1, 'button'); };
    fwd.onclick = () => { stopPlay(); go(cur + 1, 'button'); };
    scrub.oninput = () => { stopPlay(); go(+scrub.value, 'button'); };
    el.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') { fwd.click(); e.preventDefault(); } if (e.key === 'ArrowLeft') { back.click(); e.preventDefault(); } });
    const io = new IntersectionObserver((ents) => {
      if (Date.now() - lock < 900 || timer) return;
      ents.forEach((en) => { if (en.isIntersecting) go(+en.target.dataset.i, 'scroll'); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    stepEls.forEach((e) => io.observe(e));
    go(0);
    el._cleanup = () => { io.disconnect(); stopPlay(); };
    return el;
  }
  LLM.util.scrolly = scrolly;

  /* ---------------- quiz ---------------- */
  function quiz(items) {
    return h('div', { class: 'quiz' }, items.map((q, qi) => {
      const why = h('p', { class: 'why', hidden: true }, rich(q.why));
      const btns = q.opts.map((o, oi) => h('button', { type: 'button', onclick: () => {
        btns.forEach((b, bi) => { b.disabled = true; if (bi === q.a) b.classList.add('right'); });
        if (oi !== q.a) btns[oi].classList.add('wrong');
        btns[q.a].querySelector('.mk').textContent = '✓'; if (oi !== q.a) btns[oi].querySelector('.mk').textContent = '✗';
        why.hidden = false;
      } }, h('span', { class: 'mk' }, String.fromCharCode(65 + oi)), h('span', null, rich(o))));
      return h('fieldset', null, h('legend', null, `Q${qi + 1}`), h('p', null, rich(q.q)), h('div', { class: 'opts' }, btns), why);
    }));
  }
  LLM.util.quiz = quiz;

  /* ---------------- depth switch ---------------- */
  const DEPTHS = [['intuition', 'Intuition'], ['mechanics', 'Mechanics'], ['maths', 'Maths']];
  let depth = 'mechanics';
  try { depth = localStorage.getItem('llmx-depth') || depth; } catch (e) {}
  function setDepth(d) {
    depth = d; document.body.dataset.depth = d;
    try { localStorage.setItem('llmx-depth', d); } catch (e) {}
    document.querySelectorAll('.depth-seg').forEach((el) => el._seg && el._seg.set(d));
    document.querySelectorAll('details.maths-more').forEach((dt) => { dt.open = d === 'maths'; });
  }
  function depthSwitch() {
    const sg = seg(DEPTHS, depth, setDepth, 'Reading depth');
    sg.el.classList.add('depth-seg'); sg.el._seg = sg;
    return sg.el;
  }
  const depthStyle = h('style', null, `body[data-depth="intuition"] .d-mech, body[data-depth="intuition"] .d-maths, body[data-depth="mechanics"] .d-maths { display: none !important; }
  .cq{color:var(--q)} .ck{color:var(--k)} .cv{color:var(--v)} .cg{color:var(--grad)} .cr{color:var(--res)} .ca{color:var(--accent)} .cpd{color:var(--pdist)} .cqd{color:var(--qdist)} .cf{color:var(--fwd)}`);
  document.head.appendChild(depthStyle);

  /* ---------------- page pieces ---------------- */
  function papersFor(id) {
    const base = id.split('-')[0];
    return (PLAN.papers[base] || []);
  }
  function readingList(id, extra) {
    const rows = papersFor(id);
    const ul = h('ul', { class: 'reading' });
    rows.forEach((r) => r.refs.split(/;\s*/).forEach((ref) => ul.appendChild(h('li', { html: '· ' + ref }))));
    (extra || []).forEach((x) => ul.appendChild(h('li', { html: '· ' + x })));
    return ul;
  }
  function pager(id) {
    const i = LLM.ORDER.indexOf(id);
    const prev = LLM.ORDER[i - 1], next = LLM.ORDER[i + 1];
    const lab = (x) => (x === '0-kl' ? 'Module 0 sub-page' : 'Module ' + x);
    return h('nav', { class: 'pager', 'aria-label': 'Module navigation' },
      prev ? h('a', { href: '#m' + prev }, h('span', null, '← ' + lab(prev)), h('b', null, title(prev))) : h('span'),
      next ? h('a', { class: 'next', href: '#m' + next }, h('span', null, lab(next) + ' →'), h('b', null, title(next))) : h('span'));
  }
  function partOf(id) { const m = PLAN.modules[id.split('-')[0]]; return PLAN.parts.find((p) => p.n === m.part); }
  function crumbs(id) {
    const p = partOf(id);
    return h('div', { class: 'crumbs' }, h('a', { href: '#map' }, 'Curriculum'), '/', h('span', null, p.n === 8 ? 'Capstone' : `Part ${p.n} · ${p.title}`));
  }
  function block(titleText, sub, kids, cls) {
    return h('section', { class: 'block ' + (cls || '') }, h('h2', null, titleText), sub ? h('p', { class: 'sub' }, rich(sub)) : null, kids);
  }

  /* "On this page" jump row: one chip per h2 section of a page */
  function onPage(root) {
    const secs = [...root.querySelectorAll('section.block')].map((el) => { const h2 = el.querySelector(':scope > h2'); const lab = h2 ? h2.textContent : el.dataset.nav; return lab ? [el, lab] : null; }).filter(Boolean);
    if (secs.length < 3) return null;
    return h('nav', { class: 'onpage', 'aria-label': 'On this page' }, h('span', { class: 'eyebrow' }, 'On this page'),
      secs.map(([el, lab]) => h('button', { type: 'button', class: (el.className.match(/d-(mech|maths)/) || [''])[0], onclick: () => el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }) }, lab.replace(/^\d+ · /, ''))));
  }
  LLM.util.onPage = onPage;

  /* full module page from a definition */
  function modulePage(id, def) {
    const root = h('article', { class: 'wrap' });
    const lab = id === '0-kl' ? 'Module 0 · sub-page' : 'Module ' + id;
    root.appendChild(h('header', { class: 'mod-head' }, crumbs(id), h('div', { class: 'eyebrow' }, lab, LLM.EMERGING.includes(id) ? '  ·  emerging' : ''), h('h1', null, title(id)), h('p', { class: 'hook' }, def.hook),
      h('div', { class: 'mod-tools' }, depthSwitch(),
        window.PY_CELLS && window.PY_CELLS[id] ? h('button', { type: 'button', class: 'btn run-jump', onclick: () => { const el = document.getElementById('run-python'); if (el) { el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); const ta = el.querySelector('textarea'); if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 500); } } }, '▶ Run the Python') : null,
        h('span', { class: 'depth-note' }, 'Intuition: pictures only · Mechanics: tensor shapes · Maths: derivations'))));
    if (def.intro) root.appendChild(h('div', { class: 'prose' }, def.intro.map((p) => h('p', null, rich(p)))));
    if (def.hero) root.appendChild(h('section', { class: 'block', 'data-nav': 'Animation', style: { borderTop: '0' } }, h('span', { class: 'depth-tag' }, 'Intuition · scroll or use the player'), scrolly(def.hero.steps, def.hero.init)));
    (def.sections || []).forEach((sec) => {
      const kids = [];
      if (sec.depth) kids.push(h('span', { class: 'depth-tag' }, sec.depth === 'maths' ? 'Maths' : 'Mechanics'));
      if (sec.body) kids.push(h('div', { class: 'prose' }, [].concat(sec.body).map((p) => (typeof p === 'string' ? h('p', null, rich(p)) : p))));
      if (sec.widget) kids.push(sec.widget());
      const b = block(sec.title, sec.sub, kids, sec.depth === 'mechanics' ? 'd-mech' : sec.depth === 'maths' ? 'd-maths' : '');
      root.appendChild(b);
    });
    if (def.maths && def.maths.length) {
      const det = h('details', { class: 'maths-more', open: depth === 'maths' }, h('summary', null, 'Show the maths'),
        def.maths.map((m) => h('div', { style: { marginTop: '14px' } }, m.note ? h('p', { style: { maxWidth: '46em' } }, rich(m.note)) : null, m.tex ? tex(m.tex) : null, m.after ? h('p', { class: 'muted', style: { marginTop: '8px', maxWidth: '46em' } }, rich(m.after)) : null)));
      root.appendChild(block('Maths', 'Colours match the pictures: ' + (def.mathsLegend || 'each symbol uses the colour of the thing it computes.'), det));
    }
    if (def.tryit && def.tryit.length) root.appendChild(block('Try it', def.tryitSub || 'Every widget computes its numbers live in your browser.', def.tryit.map((f) => f())));
    const cells = window.PY_CELLS && window.PY_CELLS[id];
    if (cells && LLM.util.pyCell) root.appendChild(Object.assign(block('Run it yourself', 'Real Python with NumPy, running in your browser. Edit the code and press Run (or Ctrl+Enter). The first run downloads Python, about 10 MB, and later runs reuse it.', [].concat(cells).map(LLM.util.pyCell)), { id: 'run-python' }));
    if (def.leaves) root.appendChild(h('section', { class: 'block' }, h('div', { class: 'leaves' }, h('h3', null, 'What this picture leaves out'), h('ul', null, def.leaves.map((l) => h('li', null, rich(l)))))));
    if (def.quiz) root.appendChild(block('Check yourself', 'Three questions. Pick an answer to see why.', quiz(def.quiz)));
    root.appendChild(block('Further reading', 'Primary sources for this module, from the build plan’s reference list. Links checked November 2026.', readingList(id, def.reading)));
    root.appendChild(pager(id));
    const op = onPage(root); if (op) root.querySelector('.mod-head').appendChild(op);
    return root;
  }

  /* outline page for modules still in the build queue */
  function outlinePage(id) {
    const m = PLAN.modules[id];
    const root = h('article', { class: 'wrap' });
    const covers = m.fields.find((f) => f.label === 'Covers');
    root.appendChild(h('header', { class: 'mod-head' }, crumbs(id), h('div', { class: 'eyebrow' }, 'Module ' + id, LLM.EMERGING.includes(id) ? '  ·  emerging' : ''), h('h1', { html: m.title })));
    const out = h('div', { class: 'outline' });
    out.appendChild(h('div', { class: 'status-box' }, h('span', { class: 'badge queued' }, 'Outline'), h('span', null, 'This module’s interactive build is queued. Below is its full plan: what it will cover, the hero animation and the widgets.'),
      LLM.EMERGING.includes(id) ? h('span', { class: 'muted', style: { fontSize: '.88rem' } }, 'Includes 2026 techniques that are not yet widely replicated; claims are quoted as the authors’ own.') : null));
    m.fields.forEach((f) => {
      const t = f.label || 'Notes';
      out.appendChild(h('section', { class: 'field' }, h('h3', null, t === 'Hero animation' ? 'Planned hero animation' : t === 'Interactives' ? 'Planned interactives' : t),
        f.text ? h('p', { html: f.text }) : null, f.sub.length ? h('ul', null, f.sub.map((x) => h('li', { html: x }))) : null));
    });
    m.notes.forEach((n) => out.appendChild(h('p', { html: n })));
    m.tables.forEach((t) => out.appendChild(h('div', { class: 'tbl-wrap' }, h('table', null, h('thead', null, h('tr', null, t.head.map((c) => h('th', { html: c })))), h('tbody', null, t.rows.map((r) => h('tr', null, r.map((c) => h('td', { html: c })))))))));
    m.code.forEach((c) => out.appendChild(h('pre', { class: 'code' }, c)));
    if (m.maths.length) out.appendChild(h('section', { class: 'field' }, h('h3', null, 'Core maths'), m.maths.map((x) => tex(x))));
    root.appendChild(out);
    root.appendChild(block('Further reading', 'Primary sources from the build plan’s reference list. Links checked November 2026.', readingList(id)));
    root.appendChild(pager(id));
    return root;
  }

  /* ---------------- home ---------------- */
  const PART_NOTES = { 1: 'Strict sequence', 2: 'Strict sequence', 3: 'Any order', 4: 'Any order', 5: 'Pipeline order', 6: 'Start with Module 27', 7: 'Any order', 8: 'Reuses every earlier component' };
  function modCard(id) {
    const live = LLM.LIVE.includes(id);
    return h('a', { class: 'mod-card', href: '#m' + id },
      h('span', { class: 'num' }, h('span', null, id === '0-kl' ? 'M0 · sub-page' : 'M' + id), LLM.EMERGING.includes(id) ? h('span', { class: 'badge emerging' }, 'Emerging') : live ? h('span', { class: 'badge live' }, 'Interactive') : h('span', { class: 'badge queued' }, 'Outline')),
      h('span', { class: 't' }, title(id)), h('span', { class: 'lbl muted', style: { fontSize: '.8rem', fontFamily: 'var(--f-mono)' } }, live ? 'Animation · widgets · Python · quiz' : 'Plan, maths & reading list'));
  }
  function curriculum() {
    return h('div', { class: 'parts' }, PLAN.parts.map((p) => {
      const ids = p.n === 1 ? ['0', '0-kl'].concat(p.modules.slice(1)) : p.modules;
      return h('section', null, h('div', { class: 'part-head' }, h('span', { class: 'eyebrow' }, p.n === 8 ? 'Capstone' : 'Part ' + p.n), h('h3', null, p.title), h('span', { class: 'note' }, '· ' + PART_NOTES[p.n])), h('div', { class: 'mod-grid' }, ids.map(modCard)));
    }).concat(h('section', null, h('div', { class: 'part-head' }, h('span', { class: 'eyebrow' }, 'Reference'), h('h3', null, 'Look things up'), h('span', { class: 'note' }, '· Any time')),
      h('div', { class: 'mod-grid' }, h('a', { class: 'mod-card', href: '#arch' }, h('span', { class: 'num' }, h('span', null, 'Atlas'), h('span', { class: 'badge live' }, 'Interactive')), h('span', { class: 't' }, 'Architecture atlas'), h('span', { class: 'lbl muted', style: { fontSize: '.8rem', fontFamily: 'var(--f-mono)' } }, 'Transformer + 14 open models'))))));
  }
  const LEGEND = [['var(--fwd)', 'Forward pass (solid arrows)'], ['var(--grad)', 'Gradients (dashed, amber)'], ['var(--q)', 'Query · Q'], ['var(--k)', 'Key · K'], ['var(--v)', 'Value · V'], ['var(--res)', 'Residual stream'], ['var(--qdist)', 'Distribution Q in KL (filled violet)'], ['var(--kv)', 'KV cache blocks'], ['var(--pass)', 'Pass'], ['var(--warn)', 'Needs review'], ['var(--fail)', 'Fail']];
  function heroAttention() {
    const toks = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
    // weights: illustrative causal attention pattern for the last-hovered token
    const W = [[1], [.35, .65], [.12, .62, .26], [.08, .18, .5, .24], [.3, .08, .12, .2, .3], [.06, .34, .22, .14, .1, .14]];
    const g = svg(420, 300, { 'aria-label': 'Causal attention weights for the sentence The cat sat on the mat' });
    const cs = 38, ox = 70, oy = 54;
    let sel = 5;
    function draw() {
      clear(g);
      toks.forEach((t, j) => { g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1, y: oy - 12, 'text-anchor': 'middle', 'font-size': 12, text: t, style: `fill:${tokColor(j)}` })); });
      g.appendChild(s('text', { x: ox, y: 18, class: 'lbl', text: 'keys →  (what each token looks at)' }));
      toks.forEach((t, i) => {
        const on = i === sel;
        g.appendChild(s('text', { x: ox - 10, y: oy + i * cs + cs / 2 + 4, 'text-anchor': 'end', 'font-size': 12, 'font-weight': on ? 700 : 400, text: t, style: `fill:${tokColor(i)}` }));
        toks.forEach((_, j) => {
          const v = j <= i ? W[i][j] : null;
          const r = s('rect', { x: ox + j * cs, y: oy + i * cs, width: cs - 3, height: cs - 3, rx: 4, fill: v == null ? 'var(--sunk)' : mix('var(--q)', v * 100 + 6), stroke: on && v != null ? 'var(--ink)' : 'none', 'stroke-width': 1.5, style: 'cursor:pointer', tabindex: j === 0 ? 0 : null });
          r.addEventListener('mouseenter', () => { sel = i; draw(); });
          r.addEventListener('focus', () => { sel = i; draw(); });
          g.appendChild(r);
          if (v != null) g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1.5, y: oy + i * cs + cs / 2 + 3, 'text-anchor': 'middle', 'font-size': 10, text: v.toFixed(2), style: `pointer-events:none;fill:${v > .45 ? 'var(--surface)' : 'var(--ink)'}` }));
        });
      });
      g.appendChild(s('text', { x: ox, y: oy + 6 * cs + 18, class: 'lbl', text: `row “${toks[sel]}”: weights sum to ${W[sel].reduce((a, b) => a + b, 0).toFixed(2)} · grey = masked future` }));
    }
    draw();
    return h('figure', { class: 'hero-viz', style: { margin: 0 } }, g, h('figcaption', null, 'Hover a row: each token’s attention over the tokens before it. Module 5 builds this matrix from real numbers, one cell at a time.'));
  }
  const WAYS = [
    ['#m0', 'New to this', 'Start from zero', 'Vectors, training, tokens and embeddings. No background assumed.', 'Modules 0–4'],
    ['#m5', 'Know some ML', 'Go straight to the transformer', 'Attention, the block, the three shapes and how a GPT generates text.', 'Modules 5–9'],
    ['#arch', 'Want the big picture', 'See real models as diagrams', 'The transformer block by block, then DeepSeek, Qwen, Mistral, Llama and others drawn from their configs.', 'Architecture atlas'],
    ['#m21', 'Building products', 'Retrieval, agents and production', 'RAG pipelines, agent harnesses, evaluation and safety.', 'Modules 21–40'],
  ];
  function homePage() {
    const root = h('div');
    const liveCount = LLM.LIVE.length;
    const last = lastVisited();
    root.appendChild(h('section', { class: 'wrap hero' },
      h('div', null, h('span', { class: 'eyebrow' }, '42 modules · 7 parts · free'), h('h1', null, 'See how a language model works, one picture at a time.'),
        h('p', { class: 'lede' }, 'From why RNNs hit a wall to how a production agent retrieves, reasons, acts and is evaluated. Every concept appears as an interactive picture before its equation, at toy scale: 4‑dimensional embeddings and five‑token sentences, so every number fits on screen.'),
        h('div', { class: 'cta' }, last ? h('a', { class: 'btn primary', href: '#m' + last }, 'Resume Module ' + last.split('-')[0]) : h('a', { class: 'btn primary', href: '#m0' }, 'Start with Module 0'), h('a', { class: 'btn', href: '#map' }, 'Browse the curriculum'))),
      heroAttention()));
    root.appendChild(h('section', { class: 'wrap section' }, h('h2', null, 'Where to start'), h('p', null, 'Four ways in, depending on what you already know.'),
      h('div', { class: 'ways' }, WAYS.map(([href, who, t2, d, where]) => h('a', { class: 'way', href }, h('span', { class: 'eyebrow' }, who), h('b', null, t2), h('span', { class: 'd' }, d), h('span', { class: 'go' }, where + ' →'))))));
    root.appendChild(h('section', { class: 'wrap section', id: 'curriculum' }, h('h2', null, 'Curriculum'), h('p', null, `Parts 1 and 2 are a strict sequence and everything after builds on Module 5. All ${liveCount} pages are interactive: each has a scroll-driven hero animation, widgets you control and a three-question check.`), curriculum()));
    root.appendChild(h('section', { class: 'wrap section' }, h('h2', null, 'How every page works'), h('p', null, 'Each module follows one template: a hook question, a scroll-driven picture, the mechanics, the maths, a widget you control, an honest note on what the picture leaves out, and a three-question check.'),
      h('ol', { class: 'principles' }, [['Picture first, symbol second', 'Equations sit beside the animation that computes them, in matching colours.'], ['One idea per scroll step', 'Animations advance with you and never autoplay past you.'], ['Real numbers at toy scale', 'Small vectors and short sentences, so every value fits on screen.'], ['Touch the knob', 'Every module has at least one widget you control.'], ['Run it yourself', 'Every module ends with editable Python and NumPy that runs in your browser.'], ['Three depths', 'Switch between Intuition, Mechanics and Maths on any page.'], ['Honest limits', 'Each module ends with what its picture leaves out.']].map(([b2, t2], i) => h('li', null, h('span', { class: 'n' }, String(i + 1)), h('span', null, h('b', null, b2), '. ', t2))))));
    root.appendChild(legendSection());
    return root;
  }
  function legendSection() {
    return h('section', { class: 'wrap section' }, h('h2', null, 'Visual language'), h('p', null, 'One colour grammar runs through every module, so the blue you learn as “query” in Module 5 still means query in the capstone. Colour never carries meaning alone: shapes and labels repeat it.'),
      h('div', { class: 'legend' }, LEGEND.map(([c, t]) => h('div', null, h('i', { style: { background: c } }), t)), h('div', null, h('span', { style: { display: 'flex', gap: '2px' } }, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h('i', { style: { background: tokColor(i), width: '8px' } }))), 'Tokens: 8-hue cycling palette')));
  }
  function mapPage() {
    return h('div', { class: 'wrap' }, h('header', { class: 'mod-head' }, h('span', { class: 'eyebrow' }, 'Curriculum map'), h('h1', null, '42 modules in seven parts'), h('p', { class: 'hook', style: { fontStyle: 'normal' } }, 'Read top to bottom. Parts 3, 4 and 7 can be read in any order within the part, Part 5 runs in pipeline order, and Part 6 starts with Module 27.')), curriculum(), h('div', { style: { height: '40px' } }));
  }


  /* ---------------- linkify citations and module cross-references ---------------- */
  const EXTRA_CITES = { 'Lu et al. 2022': 'https://arxiv.org/abs/2104.08786' };
  function citeMaps() {
    if (LLM._cites) return LLM._cites;
    const parse = (html) => { const d = document.createElement('div'); d.innerHTML = html; return [...d.querySelectorAll('a')].map((a) => [a.textContent.replace(/\s*\(.*\)\s*$/, '').trim(), a.href]); };
    const per = {}, global = {}, conflict = new Set();
    Object.entries(PLAN.papers).forEach(([k, rows]) => { per[k] = {}; rows.forEach((r) => parse(r.refs).forEach(([lab, url]) => {
      // a label like "Bricken et al. 2023 and Templeton et al. 2024" or "Radford et al. 2018" -> keys per citation
      (lab.match(/[A-Z][\wÀ-ſ'’-]+(?:,? [A-Z][\wÀ-ſ'’-]+)*(?: et al\.| & [A-Z][\wÀ-ſ'’-]+)? \d{4}/g) || [lab]).forEach((key) => {
        per[k][key] = url; if (global[key] && global[key] !== url) conflict.add(key); else global[key] = url; });
    })); });
    conflict.forEach((c) => delete global[c]);
    Object.assign(global, EXTRA_CITES);
    return (LLM._cites = { per, global });
  }
  const CITE_RE = /\b([A-Z][\wÀ-ſ'’-]+(?:,? [A-Z][\wÀ-ſ'’-]+)*(?: et al\.| & [A-Z][\wÀ-ſ'’-]+)? (?:19|20)\d{2})\b|\b(Modules?) (\d{1,2})(?:(–|-| and | or |, )(\d{1,2}))?\b/g;
  const CITE_TEST = new RegExp(CITE_RE.source);
  function linkify(root, id) {
    const { per, global } = citeMaps(), local = per[(id || '').split('-')[0]] || {};
    const skip = (n) => n.parentElement && n.parentElement.closest('a, svg, code, pre, .katex, button, label, select, option, textarea, .reading, .crumbs, .pager, .eyebrow, script, style');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (skip(n) || !CITE_TEST.test(n.textContent) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const ext = (url, text) => h('a', { href: url, target: '_blank', rel: 'noopener', class: 'cite' }, text);
    const mod = (n, text) => (PLAN.modules[n] && n !== (id || '').split('-')[0] ? h('a', { href: '#m' + n, class: 'xref', title: LLM.title(n) }, text) : document.createTextNode(text));
    nodes.forEach((node) => {
      const s2 = node.textContent, frag = document.createDocumentFragment(); let last = 0, m; CITE_RE.lastIndex = 0;
      while ((m = CITE_RE.exec(s2))) {
        let parts = null;
        if (m[1]) { const url = local[m[1]] || global[m[1]]; if (url) parts = [ext(url, m[1])]; }
        else { const a = String(+m[3]); parts = [document.createTextNode(m[2] + ' '), mod(a, m[3])]; if (m[5]) { const b = String(+m[5]); if (m[4] === '–' || m[4] === '-') parts.push(document.createTextNode(m[4]), mod(b, m[5])); else parts.push(document.createTextNode(m[4]), mod(b, m[5])); } }
        if (!parts) continue;
        frag.appendChild(document.createTextNode(s2.slice(last, m.index))); parts.forEach((p) => frag.appendChild(p)); last = m.index + m[0].length;
      }
      if (last === 0) return;
      frag.appendChild(document.createTextNode(s2.slice(last))); node.parentNode.replaceChild(frag, node);
    });
  }
  LLM.util.linkify = linkify;

  /* ---------------- top bar: two destinations, a module menu and one forward action ---------------- */
  function lastVisited() { try { const v = localStorage.getItem('llmx-last'); return v && LLM.ORDER.includes(v) ? v : null; } catch (e) { return null; } }
  const bar = {};
  function buildTopbar() {
    const nav = document.getElementById('nav'), panel = document.getElementById('menu');
    if (!nav || !panel) return;
    const close = () => { panel.hidden = true; bar.btn.setAttribute('aria-expanded', 'false'); };
    const toggle = () => { const open = panel.hidden; panel.hidden = !open; bar.btn.setAttribute('aria-expanded', String(open)); if (open) { const cur = panel.querySelector('[aria-current]'); if (cur) cur.scrollIntoView({ block: 'nearest' }); } };
    bar.close = close;
    bar.links = [h('a', { class: 'nav-link', href: '#map' }, 'Curriculum'), h('a', { class: 'nav-link', href: '#arch' }, 'Architectures')];
    bar.label = h('span', null, 'Modules');
    bar.btn = h('button', { type: 'button', class: 'nav-menu', 'aria-expanded': 'false', 'aria-controls': 'menu', onclick: toggle }, bar.label, h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'));
    bar.go = h('a', { class: 'btn primary nav-go' });
    append(nav, [bar.links, bar.btn, bar.go]);
    const link = (href, text, n) => h('a', { href }, n != null ? h('span', { class: 'n' }, n) : null, h('span', null, text));
    panel.appendChild(h('div', { class: 'menu-in' },
      h('div', { class: 'menu-top' }, link('#', 'Home'), link('#map', 'Curriculum'), link('#arch', 'Architecture atlas')),
      h('div', { class: 'menu-grid' }, PLAN.parts.map((p) => {
        const ids = p.n === 1 ? ['0', '0-kl'].concat(p.modules.slice(1)) : p.modules;
        return h('section', null, h('div', { class: 'eyebrow' }, p.n === 8 ? 'Capstone' : 'Part ' + p.n), h('h4', null, p.title), ids.map((id) => link('#m' + id, title(id), id === '0-kl' ? '0b' : id)));
      }), h('section', null, h('div', { class: 'eyebrow' }, 'Reference'), h('h4', null, 'Look things up'), link('#arch', 'Architecture atlas', '◆'), link('#map', 'Curriculum map', '◆')))));
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); bar.btn.focus(); } });
    document.addEventListener('click', (e) => { if (!panel.hidden && !e.target.closest('.topbar')) close(); });
  }
  function updateTopbar(raw) {
    if (!bar.btn) return;
    bar.close();
    const m = raw.match(/^m(\d+(?:-kl)?)$/), id = m && LLM.ORDER.includes(m[1]) ? m[1] : null;
    bar.links.forEach((a) => (a.getAttribute('href') === '#' + raw ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.querySelectorAll('#menu a').forEach((a) => (raw && a.getAttribute('href') === '#' + raw ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    bar.label.textContent = id ? (id === '0-kl' ? 'Module 0 · KL' : 'Module ' + id) : 'Modules';
    bar.btn.classList.toggle('on', !!id);
    if (id) { try { localStorage.setItem('llmx-last', id); } catch (e) {} }
    const next = id ? LLM.ORDER[LLM.ORDER.indexOf(id) + 1] : null, last = lastVisited();
    const [href, text, short] = id ? (next ? ['#m' + next, 'Next: Module ' + next.split('-')[0] + (next === '0-kl' ? ' · KL' : '') + ' →', 'Next →'] : ['#map', 'Back to the curriculum', 'Curriculum']) : last ? ['#m' + last, 'Resume Module ' + last.split('-')[0], 'Resume'] : ['#m0', 'Start learning', 'Start'];
    bar.go.setAttribute('href', href); bar.go.setAttribute('aria-label', text);
    clear(bar.go).append(h('span', { class: 'long' }, text), h('span', { class: 'short' }, short));
  }

  /* ---------------- router ---------------- */
  const app = () => document.getElementById('app');
  const loaded = {};
  function loadScriptOnce(file) {
    if (!loaded[file]) loaded[file] = new Promise((res, rej) => { const sc = h('script', { src: file }); sc.onload = res; sc.onerror = rej; document.body.appendChild(sc); });
    return loaded[file];
  }
  function cellFile(id) { const n = parseInt(id, 10); return 'assets/py/cells-' + (n <= 9 ? 'a' : n <= 20 ? 'b' : 'c') + '.js'; }
  function loadModule(id) {
    const py = Promise.all([loadScriptOnce('assets/pycell.js'), loadScriptOnce(cellFile(id))]).catch(() => null); // optional extras
    return Promise.all([loadScriptOnce('assets/m/m' + id + '.js'), py]).then(() => LLM.modules[id]);
  }
  LLM.mod = (id, def) => { LLM.modules[id] = def; };
  let current = null;
  function render() {
    const raw = location.hash.replace(/^#/, '');
    const el = app();
    if (current && current._cleanup) current._cleanup();
    el.querySelectorAll('.scrolly').forEach((sc) => sc._cleanup && sc._cleanup());
    updateTopbar(raw);
    let view;
    const m = raw.match(/^m(\d+(?:-kl)?)$/);
    if (m && (PLAN.modules[m[1]] || m[1] === '0-kl')) {
      const id = m[1];
      document.title = 'LLM Explained · ' + title(id);
      if (LLM.LIVE.includes(id)) {
        clear(el).appendChild(h('div', { class: 'wrap', style: { padding: '60px 0' } }, h('p', { class: 'muted' }, 'Loading module…')));
        loadModule(id).then((def) => { if (location.hash.replace(/^#/, '') !== raw) return; const page = modulePage(id, def); clear(el).appendChild(page); linkify(page, id); setDepth(depth); window.scrollTo(0, 0); })
          .catch(() => { clear(el).appendChild(outlinePage(id.split('-')[0])); });
        return;
      }
      view = outlinePage(id);
    } else if (raw === 'arch' && LLM.arch) { view = LLM.arch.page(); linkify(view); document.title = 'LLM Explained · Architecture atlas'; }
    else if (raw === 'map') { view = mapPage(); document.title = 'LLM Explained · Curriculum'; }
    else { view = homePage(); document.title = 'LLM Explained'; }
    clear(el).appendChild(view);
    setDepth(depth);
    window.scrollTo(0, 0);
  }
  LLM.start = () => { document.body.dataset.depth = depth; buildTopbar(); window.addEventListener('hashchange', render); render(); };
})();
