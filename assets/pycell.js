/* TryItCell: editable Python (Pyodide + NumPy) that runs in the browser and draws with the site's chart components.
   Pyodide is loaded from the CDN only when a reader first presses Run. */
(function () {
  'use strict';
  const { h, s, svg, clear, mix, tokColor, lineChart, probBars, matrixGrid, fmt } = LLM.util;
  const PY_URL = window.LLM_PYODIDE_URL || 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const LIVE = 'https://llm-explained-lovat.vercel.app/';
  let loading = null, target = null;

  const VIZ_PY = `
import json, _vizjs
def _l(x):
    try:
        return x.tolist()
    except AttributeError:
        return [(_l(v) if hasattr(v, '__len__') and not isinstance(v, str) else v) for v in x]
def bars(labels, values, title=""):
    """Horizontal bars, one per label."""
    _vizjs.bars(json.dumps({"labels": [str(l) for l in labels], "values": [float(v) for v in _l(values)], "title": title}))
def line(x, *ys, labels=None, title="", logy=False, xlabel="", ylabel=""):
    """One or more lines over the same x values."""
    _vizjs.line(json.dumps({"x": [float(v) for v in _l(x)], "ys": [[float(v) for v in _l(y)] for y in ys], "labels": labels or [], "title": title, "logy": bool(logy), "xlabel": xlabel, "ylabel": ylabel}))
def heatmap(m, rows=None, cols=None, title="", numbers=True):
    """A matrix as a grid of shaded cells."""
    m = [[float(v) for v in r] for r in _l(m)]
    _vizjs.heat(json.dumps({"m": m, "rows": [str(r) for r in (rows or [])], "cols": [str(c) for c in (cols or [])], "title": title, "numbers": bool(numbers)}))
`;

  const SERIES = ['var(--q)', 'var(--k)', 'var(--v)', 'var(--t4)', 'var(--accent)', 'var(--t5)'];
  const VIZ = {
    bars(js) {
      const o = JSON.parse(js); const max = Math.max(...o.values.map(Math.abs), 1e-12);
      const pb = probBars({ labelW: 96 });
      pb.draw(o.labels.map((l, i) => ({ label: l, p: Math.abs(o.values[i]) / max, color: o.values[i] < 0 ? 'var(--k)' : tokColor(i) })), { scaleMax: 1, caption: o.title || ' ' });
      // show actual values instead of percentages
      [...pb.el.querySelectorAll('text')].filter((t) => /%$/.test(t.textContent)).forEach((t, i) => (t.textContent = +o.values[i].toPrecision(4)));
      put(pb.el);
    },
    line(js) {
      const o = JSON.parse(js); const ch = lineChart({ w: 560, h: 230 });
      const series = o.ys.map((y, i) => ({ pts: o.x.map((x, k) => [x, y[k]]).filter((p) => isFinite(p[1]) && (!o.logy || p[1] > 0)), color: SERIES[i % SERIES.length] }));
      ch.draw(series, { logy: o.logy, xlabel: o.xlabel, ylabel: o.ylabel || o.title });
      const wrap = h('div');
      if (o.title) wrap.appendChild(h('div', { class: 'eyebrow' }, o.title));
      wrap.appendChild(ch.el);
      if (o.labels.length) wrap.appendChild(h('div', { class: 'readout' }, o.labels.map((l, i) => h('span', null, h('b', { style: { color: SERIES[i % SERIES.length] } }, '━ '), l))));
      put(wrap);
    },
    heat(js) {
      const o = JSON.parse(js); const R = o.m.length, C = o.m[0].length;
      const cell = Math.max(10, Math.min(34, 480 / C)), ox = o.rows.length ? 60 : 8, oy = o.cols.length ? 40 : 22;
      const g = svg(Math.max(560, ox + C * cell + 10), oy + R * cell + 10);
      g.appendChild(matrixGrid(o.m, { x: ox, y: oy, cell, color: (v) => (v >= 0 ? 'var(--q)' : 'var(--k)'), numbers: o.numbers && cell >= 22, fs: cell > 28 ? 9 : 7.5 }));
      o.rows.forEach((r, i) => g.appendChild(s('text', { x: ox - 6, y: oy + i * cell + cell / 2 + 3, 'text-anchor': 'end', 'font-size': 10, text: r })));
      o.cols.forEach((c, j) => g.appendChild(s('text', { x: ox + j * cell + cell / 2, y: oy - 6, 'text-anchor': 'middle', 'font-size': 10, text: c })));
      if (o.title) g.appendChild(s('text', { x: 8, y: 12, class: 'lbl', text: o.title }));
      put(g);
    },
  };
  function put(el) { if (target) target.appendChild(h('div', { class: 'py-fig' }, el)); }

  function loadScript(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('blocked')); document.head.appendChild(sc); }); }
  function getPy(status) {
    if (loading) return loading;
    loading = (async () => {
      status('Downloading Python (about 10 MB, first run only)…');
      await loadScript(PY_URL + 'pyodide.js');
      const py = await window.loadPyodide({ indexURL: PY_URL });
      py.registerJsModule('_vizjs', VIZ);
      py.FS.writeFile('/home/pyodide/viz.py', VIZ_PY);
      return py;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  function cell(c) {
    const id = 'py-' + Math.random().toString(36).slice(2, 8);
    const ta = h('textarea', { id, class: 'py-code', rows: Math.min(26, c.code.split('\n').length + 1), spellcheck: 'false', 'aria-label': 'Python code' });
    ta.value = c.code;
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); const a = ta.selectionStart; ta.value = ta.value.slice(0, a) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = a + 4; }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
    const out = h('pre', { class: 'py-out', 'aria-live': 'polite', hidden: true });
    const figs = h('div', { class: 'py-figs' });
    const status = h('span', { class: 'note-sim' });
    const runBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => run() }, '▶ Run');
    const reset = h('button', { class: 'btn', type: 'button', onclick: () => { ta.value = c.code; clear(figs); out.hidden = true; status.textContent = ''; } }, 'Reset code');
    async function run() {
      runBtn.disabled = true; clear(figs); out.textContent = ''; out.hidden = true;
      const say = (t) => (status.textContent = t);
      let py;
      try { py = await getPy(say); }
      catch (e) { runBtn.disabled = false; say(''); out.hidden = false; out.classList.add('err'); out.textContent = 'Python could not be downloaded here. This page may be running somewhere that blocks the Pyodide CDN (such as an embedded preview).\nOpen the live site to run it: ' + LIVE; return; }
      const lines = [];
      py.setStdout({ batched: (t) => lines.push(t) }); py.setStderr({ batched: (t) => lines.push(t) });
      target = figs; say('Running…'); const t0 = performance.now();
      try {
        await py.loadPackagesFromImports(ta.value, { messageCallback: (m) => /Loading/.test(m) && say(m.replace(/Loading /, 'Loading package ')), errorCallback: () => {} });
        await py.runPythonAsync(ta.value);
        out.classList.remove('err'); say(`Done in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
      } catch (e) {
        const msg = String(e.message || e).trim().split('\n'); const i = msg.findIndex((l) => /File "<exec>"/.test(l));
        lines.push((i >= 0 ? msg.slice(i) : msg.slice(-6)).join('\n')); out.classList.add('err'); say('Error');
      }
      target = null; runBtn.disabled = false;
      if (lines.length) { out.hidden = false; out.textContent = lines.join('\n'); }
    }
    return h('section', { class: 'widget py-cell' }, h('header', null, h('h3', null, c.title), h('span', { class: 'eyebrow' }, 'Python · NumPy')), c.note ? h('p', { class: 'muted', style: { fontSize: '.93rem' } }, c.note) : null,
      ta, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, runBtn, reset, status), out, figs);
  }
  LLM.util.pyCell = cell;

  const css = h('style', null, `
  .py-code { font-family: var(--f-mono); font-size: .84rem; line-height: 1.55; background: var(--sunk); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; white-space: pre; overflow: auto; tab-size: 4; }
  .py-out { font-family: var(--f-mono); font-size: .82rem; background: var(--paper); border: 1px solid var(--rule); border-left: 3px solid var(--pass); border-radius: 8px; padding: 10px 12px; margin: 0; white-space: pre-wrap; overflow-x: auto; max-height: 320px; }
  .py-out.err { border-left-color: var(--fail); }
  .py-figs { display: grid; gap: 12px; } .py-fig { min-width: 0; overflow-x: auto; }
  .py-fig svg { max-width: 680px; }
  `);
  document.head.appendChild(css);
})();
