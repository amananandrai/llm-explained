(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, bytes, mix, rng, randn } = LLM.util;
  const r0 = rng(15);
  const Wt = Array.from({ length: 8 }, () => Array.from({ length: 14 }, () => randn(r0) * 0.5));
  const quant = (x, bits, lo, hi) => { const n = 2 ** bits - 1, sc = (hi - lo) / n; return Math.round((Math.min(hi, Math.max(lo, x)) - lo) / sc) * sc + lo; };
  const errColor = (e, m) => mix('var(--fail)', Math.min(100, (Math.abs(e) / m) * 100));

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'A weight matrix snapping to fewer levels as bit width drops, with an error map' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const bits = [16, 8, 4, 2, 4][step], outlier = step === 4;
      const M = Wt.map((r) => r.slice()); if (outlier) M[3][5] = 8;
      const flat = M.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
      const Q = M.map((r) => r.map((x) => (bits >= 16 ? x : quant(x, bits, lo, hi))));
      const cs = 18;
      const shade = (v) => (v >= 0 ? mix('var(--q)', Math.min(100, v * 70) + 4) : mix('var(--k)', Math.min(100, -v * 70) + 4));
      g.appendChild(s('text', { x: 14, y: 22, 'font-size': 13, text: outlier ? 'One outlier (8.0) stretches the range: 4 bits, same scale for everything' : `${bits === 16 ? 'BF16: effectively continuous' : `${bits}-bit: ${2 ** bits} levels across [${fmt(lo, 2)}, ${fmt(hi, 2)}]`}`, style: 'font-weight:600' }));
      g.appendChild(s('text', { x: 14, y: 46, class: 'lbl', text: 'quantised weights' })); g.appendChild(s('text', { x: 290, y: 46, class: 'lbl', text: 'error |w − ŵ|' }));
      const em = 0.5;
      M.forEach((row, i) => row.forEach((v, j) => {
        g.appendChild(s('rect', { x: 14 + j * cs, y: 54 + i * cs, width: cs - 2, height: cs - 2, rx: 2, fill: outlier && i === 3 && j === 5 ? 'var(--ink)' : shade(Q[i][j]) }));
        g.appendChild(s('rect', { x: 290 + j * cs, y: 54 + i * cs, width: cs - 2, height: cs - 2, rx: 2, fill: errColor(v - Q[i][j], em) }));
      }));
      const nonOut = flat.map((v, k) => [v, Q.flat()[k]]).filter((_, k) => !(outlier && k === 3 * 14 + 5));
      const mse = nonOut.reduce((a, [v, q]) => a + (v - q) ** 2, 0) / nonOut.length;
      const distinct = new Set(Q.flat().filter((_, k) => !(outlier && k === 3 * 14 + 5)).map((x) => x.toFixed(4))).size;
      g.appendChild(s('text', { x: 14, y: 226, 'font-size': 12, text: `mean squared error ${mse.toExponential(2)}   ·   distinct values used by normal weights: ${distinct}` }));
      g.appendChild(s('text', { x: 14, y: 248, 'font-size': 12, text: `memory for a 7B model: ${bytes(7e9 * bits / 8)}` }));
      if (outlier) g.appendChild(s('text', { x: 14, y: 276, 'font-size': 12, text: 'Almost every normal weight now rounds to one or two levels. This is why LLMs resist naive quantisation.', style: 'fill:var(--fail)' }));
      g.appendChild(s('text', { x: 14, y: 340, class: 'lbl', text: 'Per-tensor affine quantisation of 112 random weights. Error colour: amber → red.' }));
    }
    return { go: draw };
  }

  /* ---- minifloat formats ---- */
  const FORMATS = { FP32: [8, 23, 'ieee'], FP16: [5, 10, 'ieee'], BF16: [8, 7, 'ieee'], 'FP8 E4M3': [4, 3, 'e4m3'], 'FP8 E5M2': [5, 2, 'ieee'], 'FP4 E2M1': [2, 1, 'fp4'] };
  function decode(code, E, M, kind) {
    const bias = 2 ** (E - 1) - 1, sgn = code >> (E + M) & 1, e = (code >> M) & (2 ** E - 1), m = code & (2 ** M - 1);
    if (kind === 'ieee' && e === 2 ** E - 1) return m ? NaN : sgn ? -Infinity : Infinity;
    if (kind === 'e4m3' && e === 15 && m === 7) return NaN;
    const v = e === 0 ? (m / 2 ** M) * 2 ** (1 - bias) : (1 + m / 2 ** M) * 2 ** (e - bias);
    return sgn ? -v : v;
  }
  const tables = {};
  function table(name) {
    if (tables[name]) return tables[name];
    const [E, M, kind] = FORMATS[name]; const n = 2 ** (1 + E + M); const arr = [];
    for (let c = 0; c < n; c++) { const v = decode(c, E, M, kind); if (isFinite(v)) arr.push([v, c]); }
    return (tables[name] = arr);
  }
  function encode(name, x) {
    if (name === 'FP32') { const f = new Float32Array([x]); const u = new Uint32Array(f.buffer)[0]; return [f[0], u]; }
    let best = null; for (const [v, c] of table(name)) if (!best || Math.abs(v - x) < Math.abs(best[0] - x)) best = [v, c];
    return best;
  }
  function bitExplorer() {
    const w = widget('Bit-layout explorer', 'Try it');
    let name = 'BF16'; const inp = h('input', { type: 'text', id: 'bit-in', value: '3.14159' });
    const out = h('div'); const ro = readout();
    function draw() {
      const x = parseFloat(inp.value); if (!isFinite(x)) return;
      const [E, M] = FORMATS[name]; const [v, code] = encode(name, x);
      const bits = (code >>> 0).toString(2).padStart(1 + E + M, '0');
      const g = svg(560, 70); const cw = Math.min(26, 540 / bits.length);
      bits.split('').forEach((b, i) => { const role = i === 0 ? 'var(--fail)' : i <= E ? 'var(--q)' : 'var(--v)'; g.appendChild(s('rect', { x: 4 + i * cw, y: 8, width: cw - 2, height: 30, rx: 3, fill: mix(role, b === '1' ? 70 : 15) })); g.appendChild(s('text', { x: 4 + i * cw + cw / 2 - 1, y: 28, 'text-anchor': 'middle', 'font-size': cw > 16 ? 12 : 8, text: b })); });
      g.appendChild(s('text', { x: 4, y: 58, class: 'lbl', text: `sign (red) · ${E} exponent bits (blue) · ${M} mantissa bits (green)` }));
      clear(out).appendChild(g);
      const fin = name === 'FP32' ? null : table(name).map((t) => t[0]);
      ro.set([['stored value', String(+v.toPrecision(8))], ['error', (v - x).toExponential(2), Math.abs(v - x) / Math.abs(x || 1) > 0.05 ? 'var(--fail)' : 'var(--ink)'], ['relative error', ((Math.abs(v - x) / Math.abs(x || 1)) * 100).toFixed(3) + '%'], ['largest finite', fin ? String(Math.max(...fin)) : '3.4e38'], ['distinct finite values', fin ? fin.length : '≈ 4.3 billion']]);
    }
    inp.addEventListener('input', draw);
    const sg = seg(Object.keys(FORMATS), name, (v) => { name = v; draw(); }, 'Format');
    w.body.append(sg.el, h('div', { class: 'ctl' }, h('label', { for: 'bit-in' }, 'number to store'), inp), out, ro.el, h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, ['0.1', '3.14159', '65504', '70000', '448', '0.0001', '-2.5'].map((v) => h('button', { class: 'btn', type: 'button', onclick: () => { inp.value = v; draw(); } }, v))), h('p', { class: 'note-sim' }, 'FP8 E4M3 follows the OCP convention (no infinities, max 448). FP4 E2M1 is the element type inside MXFP4 and NVFP4, which add a shared scale per block of 32 or 16 values.'));
    draw();
    return w.el;
  }

  function quantLab() {
    const w = widget('Quantise-a-tensor lab', 'Try it', 'A 64×128 matrix of Gaussian weights with a few channels scaled up 20×, the outlier pattern seen in LLM activations and some weights.');
    const r = rng(5), rows = 64, cols = 128;
    const T = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => randn(r) * 0.02 * ([7, 41, 90].includes(j) ? 20 : 1)));
    const st = { bits: 4, gran: 'group', gs: 64, sym: true };
    const ro = readout();
    function q(vals) {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      if (st.sym) { const a = Math.max(Math.abs(lo), Math.abs(hi)), n = 2 ** (st.bits - 1) - 1, sc = a / n || 1; return vals.map((x) => Math.round(x / sc) * sc); }
      const n = 2 ** st.bits - 1, sc = (hi - lo) / n || 1, z = Math.round(-lo / sc); return vals.map((x) => (Math.min(n, Math.max(0, Math.round(x / sc) + z)) - z) * sc);
    }
    function draw() {
      let err = 0, sig = 0, groups = 0;
      if (st.gran === 'tensor') { const f = T.flat(), qq = q(f); f.forEach((x, k) => { err += (x - qq[k]) ** 2; sig += x * x; }); groups = 1; }
      else if (st.gran === 'channel') { for (let j = 0; j < cols; j++) { const c = T.map((rw) => rw[j]), qq = q(c); c.forEach((x, k) => { err += (x - qq[k]) ** 2; sig += x * x; }); groups++; } }
      else for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j += st.gs) { const c = T[i].slice(j, j + st.gs), qq = q(c); c.forEach((x, k) => { err += (x - qq[k]) ** 2; sig += x * x; }); groups++; }
      const snr = 10 * Math.log10(sig / err);
      const bitsPer = st.bits + (groups * 16 * (st.sym ? 1 : 2)) / (rows * cols);
      ro.set([['SNR', fmt(snr, 1) + ' dB', snr > 20 ? 'var(--pass)' : snr > 10 ? 'var(--warn)' : 'var(--fail)'], ['scales stored', groups], ['effective bits per weight', fmt(bitsPer, 2)], ['7B model at this rate', bytes(7e9 * bitsPer / 8)]]);
    }
    const sb = slider({ label: 'bits', min: 2, max: 8, value: st.bits, oninput: (v) => { st.bits = v; draw(); } });
    const sgs = slider({ label: 'group size', min: 16, max: 128, step: 16, value: st.gs, oninput: (v) => { st.gs = v; draw(); } });
    const sg = seg([['tensor', 'per-tensor'], ['channel', 'per-channel'], ['group', 'per-group']], st.gran, (v) => { st.gran = v; draw(); }, 'Granularity');
    const sy = seg([[true, 'symmetric absmax'], [false, 'affine zero-point']], true, (v) => { st.sym = v; draw(); }, 'Scheme');
    w.body.append(h('div', { class: 'ctl-row' }, sb.el, sgs.el), sg.el, sy.el, ro.el);
    draw();
    return w.el;
  }

  function vram() {
    const w = widget('Will it fit on my GPU?', 'Mechanics');
    const st = { P: 70, bits: 4, ctx: 8192, gpu: 24, L: 80, kvh: 8 };
    const ro = readout(); const sl = {};
    const mk = (k, l, a, b, step, f) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('P', 'parameters (B)', 1, 405, 1); mk('bits', 'weight bits', 2, 16, 0.5); mk('ctx', 'context tokens', 512, 131072, 512, human); mk('L', 'layers', 8, 128, 1); mk('kvh', 'KV heads', 1, 64, 1); mk('gpu', 'GPU memory (GB)', 8, 192, 8);
    function draw() { const wB = st.P * 1e9 * st.bits / 8, kv = 2 * st.L * st.kvh * 128 * 2 * st.ctx, tot = (wB + kv) * 1.1; ro.set([['weights', bytes(wB)], ['KV cache (BF16)', bytes(kv)], ['total with 10% overhead', bytes(tot)], ['fits?', tot < st.gpu * 2 ** 30 ? 'yes' : 'no', tot < st.gpu * 2 ** 30 ? 'var(--pass)' : 'var(--fail)']]); }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), ro.el);
    draw();
    return w.el;
  }

  LLM.mod('15', {
    hook: 'A 70B model needs 140 GB in 16-bit. How does it run on one gaming GPU?',
    intro: ['Quantisation stores numbers in fewer bits: each weight snaps to the nearest of a small set of levels, with a scale (and sometimes a zero-point) to map back. Memory drops by 2–8×. The hard part is keeping quality when a few outlier values stretch the range.'],
    hero: {
      steps: [
        { title: '16 bits', text: 'A small weight matrix in BF16: positive in blue, negative in orange. The error map is empty.' },
        { title: '8 bits: 256 levels', text: 'INT8 maps the range onto 256 evenly spaced levels. The error is tiny and spread evenly.', maths: 'q=\\mathrm{round}(x/s)+z,\\qquad \\hat x=s\\,(q-z)' },
        { title: '4 bits: 16 levels', text: 'Patterns are still visible, but neighbouring weights start to merge. Error is bounded by half a step, s/2.' },
        { title: '2 bits: 4 levels', text: 'Most structure is gone. Naive 2-bit quantisation destroys an LLM; methods that work at this level need special training or codebooks.' },
        { title: 'The outlier problem', text: 'One weight of 8.0 sets the scale. At 4 bits the step is now about 0.6, so nearly every normal weight rounds to zero. LLMs have such outliers in specific channels.', mech: 'Fixes: smaller groups with their own scale, keeping outliers in 16-bit (LLM.int8()), moving them into the weights (SmoothQuant), protecting salient weights (AWQ), or rotating to spread them out (QuaRot, PolarQuant in TurboQuant).' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Number formats', body: ['Floating-point formats split bits between exponent (range) and mantissa (precision). BF16 keeps FP32’s 8 exponent bits, so it rarely overflows; FP16 has more precision but a max of 65,504. FP8 comes in E4M3 (more precision, for weights and activations) and E5M2 (more range, for gradients). Integer formats (INT8, INT4) have even spacing; NF4 places its 16 levels at the quantiles of a normal distribution, matching how weights are spread.'], widget: bitExplorer },
      { title: 'Granularity and outliers', depth: 'mechanics', widget: quantLab },
      { title: 'The method zoo', depth: 'mechanics', body: [
        '<b>Post-training quantisation (PTQ)</b> converts a trained model with a little calibration data. <b>Quantisation-aware training (QAT)</b> simulates rounding during training so the model adapts.',
        '<b>GPTQ</b> quantises one column at a time and updates the remaining columns to cancel the error, using second-order information. <b>AWQ</b> scales up the small set of weights that see large activations before rounding. <b>SmoothQuant</b> migrates activation outliers into weights so both quantise to INT8. <b>LLM.int8()</b> keeps outlier feature dimensions in 16-bit.',
        '<b>GGUF k-quants</b> (llama.cpp) use nested blocks with quantised scales for 2–6 bit CPU-friendly files. <b>QLoRA</b> fine-tunes adapters on top of a frozen NF4 base (Module 20).',
        '<b>KV-cache quantisation</b> shrinks the cache instead of the weights. TurboQuant (Google Research, 2026) reports about 3 bits per value without retraining by rotating vectors (PolarQuant) and adding a 1-bit residual correction (QJL).',
      ], widget: vram },
    ],
    maths: [
      { note: 'Affine quantisation to b bits with scale s and zero-point z:', tex: 'q=\\mathrm{clamp}\\!\\Big(\\mathrm{round}\\big(\\tfrac{x}{s}\\big)+z,\\;0,\\;2^{b}-1\\Big),\\qquad \\hat{x}=s\\,(q-z),\\qquad s=\\frac{x_{\\max}-x_{\\min}}{2^{b}-1}' },
      { note: 'Rounding error per value is at most half a step; weight memory is:', tex: '|x-\\hat x|\\le \\frac{s}{2},\\qquad \\text{bytes}\\approx N_{\\text{params}}\\times\\frac{b}{8}' },
      { note: 'Symmetric (absmax) quantisation uses z = 0:', tex: 's=\\frac{\\max|x|}{2^{b-1}-1}' },
    ],
    leaves: ['The lab measures reconstruction error, not model quality; small errors in the wrong place can still break a model.', 'Speed depends on hardware support for the format; 4-bit weights save memory but may need dequantising to compute.', 'Activation quantisation (W8A8, W4A4) is harder than weight-only quantisation.'],
    quiz: [
      { q: 'A 70B model in 4-bit weights needs roughly how much memory for weights?', opts: ['140 GB', '70 GB', '35 GB', '9 GB'], a: 2, why: '70e9 × 4 / 8 = 35e9 bytes, plus a little for scales.' },
      { q: 'Why does per-group quantisation help with outliers?', opts: ['It uses more bits', 'Each small group gets its own scale, so one outlier only stretches its own group', 'It removes outliers', 'It is lossless'], a: 1, why: 'The outlier’s range affects 64 values instead of the whole tensor.' },
      { q: 'BF16 vs FP16: which has the larger range?', opts: ['FP16', 'BF16', 'They are equal', 'Neither has a range'], a: 1, why: 'BF16 has 8 exponent bits like FP32 (max ≈ 3.4e38); FP16 has 5 (max 65,504).' },
    ],
  });
})();
