/* Real tokenizers and a real small language model, running in the browser.
   Nothing here loads until a reader presses a button:
   - tokenizers: tokenizer.json files fetched from the Hugging Face Hub, run by tokenizers.js
   - model: an ONNX file made by scripts/export_model.py (logits + attention weights), run by ONNX Runtime Web (wasm)
   Widgets: tokenizerWidget (Module 3), attentionWidget (Module 5), samplingWidget (Module 7), journeyWidget (Module 41). */
(function () {
  'use strict';
  const { h, s, svg, clear, slider, seg, widget, readout, tokColor, mix, probBars, matrixGrid, fmt } = LLM.util;

  const CFG = Object.assign({
    hub: 'https://huggingface.co',
    // Hugging Face model repo written by `python3 scripts/export_model.py --push USER/REPO`.
    // Leave empty to hide the three real-model widgets.
    modelRepo: '',
    // [label, Hub repo with tokenizer.json, family]. All four are public (no licence gate).
    tokenizers: [
      ['GPT-2', 'Xenova/gpt2', 'byte-level BPE'],
      ['GPT-4o', 'Xenova/gpt-4o', 'byte-level BPE'],
      ['BERT', 'Xenova/bert-base-uncased', 'WordPiece'],
      ['T5', 'Xenova/t5-small', 'Unigram (SentencePiece)'],
    ],
    tokLib: 'https://cdn.jsdelivr.net/npm/@huggingface/tokenizers@0.2.0/dist/tokenizers.min.mjs',
    ortLib: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/',
  }, window.LLM_REAL || {});
  const LIVE = 'https://llm-explained-lovat.vercel.app/';
  const BLOCKED = 'Could not download this here. The page may be running somewhere that blocks huggingface.co or the jsDelivr CDN (such as an embedded preview). Open the live site: ' + LIVE;

  /* ---------------- tokenizers ---------------- */
  // GPT-2 style byte-level BPE stores each byte as one printable character. This is the inverse table.
  const CHAR_TO_BYTE = (() => {
    const bs = []; for (let b = 33; b < 127; b++) bs.push(b); for (let b = 161; b < 173; b++) bs.push(b); for (let b = 174; b < 256; b++) bs.push(b);
    const cs = bs.slice(); let n = 0;
    for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
    return new Map(cs.map((c, i) => [String.fromCodePoint(c), bs[i]]));
  })();
  const utf8 = new TextDecoder('utf-8', { fatal: true });

  let tokLib = null; const tokCache = {};
  const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' → HTTP ' + r.status); return r.json(); });
  function loadTokenizer(repo) {
    if (tokCache[repo]) return tokCache[repo];
    const base = `${CFG.hub}/${repo}/resolve/main/`;
    tokCache[repo] = (async () => {
      tokLib = tokLib || import(CFG.tokLib);
      const [lib, tj, tc] = await Promise.all([tokLib, getJSON(base + 'tokenizer.json'), getJSON(base + 'tokenizer_config.json')]);
      const tk = new lib.Tokenizer(tj, tc);
      const byteLevel = /"type":"ByteLevel"/.test(JSON.stringify([tj.decoder || null, tj.pre_tokenizer || null]));
      const special = new Set((tj.added_tokens || []).filter((t) => t.special).map((t) => t.id));
      let vocab = 0; try { vocab = tk.get_vocab(true).size; } catch (e) { vocab = Object.keys((tj.model && tj.model.vocab) || {}).length; }
      // One display piece per token: readable text where the token is whole characters, hex bytes where it is not.
      function piece(id, raw) {
        if (special.has(id)) return { id, text: raw, kind: 'special' };
        if (byteLevel) {
          const b = [...raw].map((c) => CHAR_TO_BYTE.get(c));
          if (b.every((x) => x !== undefined)) {
            try { return { id, text: utf8.decode(new Uint8Array(b)), kind: 'text' }; }
            catch (e) { return { id, text: b.map((x) => x.toString(16).padStart(2, '0')).join(' '), kind: 'bytes' }; }
          }
        }
        return { id, text: raw, kind: 'text' };
      }
      return {
        repo, vocab, byteLevel,
        encode(text, addSpecial) { const e = tk.encode(text, { add_special_tokens: !!addSpecial }); return e.ids.map((id, i) => piece(id, e.tokens[i])); },
        piece(id) { return piece(id, tk.id_to_token(id) || '?'); },
      };
    })();
    tokCache[repo].catch(() => { delete tokCache[repo]; });
    return tokCache[repo];
  }

  const show = (t) => t.replace(/\n/g, '↵').replace(/ /g, '·');
  function chip(p, i, extra) {
    const st = { background: mix(tokColor(i), 18, 'var(--paper)'), borderColor: tokColor(i) };
    if (p.kind === 'special') Object.assign(st, { background: 'transparent', fontStyle: 'italic', borderBottomStyle: 'dashed' });
    if (p.kind === 'bytes') Object.assign(st, { fontSize: '.72rem', color: 'var(--muted)' });
    return h('span', { class: 'tok', title: 'id ' + p.id + (p.kind === 'bytes' ? ' · part of a character, shown as UTF-8 bytes' : p.kind === 'special' ? ' · special token' : ''), style: Object.assign(st, extra || {}) }, p.kind === 'bytes' ? p.text : show(p.text));
  }
  const chips = (pieces) => h('div', { class: 'tokbox' }, pieces.length ? pieces.map((p, i) => chip(p, i)) : h('span', { class: 'muted' }, '(no tokens)'));
  const label = (p) => { const t = p.kind === 'bytes' ? p.text : show(p.text); return t.length > 9 ? t.slice(0, 8) + '…' : t; };
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const SAMPLES = [['Leading space', 'hello Hello  hello HELLO'], ['Numbers', 'In 2026 the price rose from 1999.99 to 123456789.'], ['Spelling', 'How many r letters are in strawberry?'], ['Hindi', 'आज मौसम बहुत अच्छा है।'], ['Emoji', 'Tokenisers 🤝 emoji 🎉'], ['Code', 'def add(a, b):\n    return a + b']];

  function tokenizerWidget() {
    const w = widget('Real tokenizers', 'Try it', 'These are the production vocabularies, fetched from the Hugging Face Hub on first use (about 1–8 MB each) and run in your browser by tokenizers.js. Your text is not sent anywhere.');
    const ta = h('textarea', { rows: 3, 'aria-label': 'Text to tokenise' }, 'Tokenisation splits text into pieces. Unbelievable! 12345 + 67890 = 80235');
    let which = CFG.tokenizers[0][1], started = false, addSpecial = false, seq = 0;
    const out = h('div', null, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Press Tokenise to download the vocabulary and split the text.'));
    const ro = readout(); const status = h('span', { class: 'note-sim', 'aria-live': 'polite' }); const cmp = h('div');
    const info = (repo) => CFG.tokenizers.find((t) => t[1] === repo);
    async function draw() {
      if (!started) return;
      const my = ++seq, [name, , family] = info(which);
      let tk;
      try { if (!tokCache[which]) status.textContent = `Downloading the ${name} vocabulary…`; tk = await loadTokenizer(which); }
      catch (e) { if (my === seq) { status.textContent = ''; clear(out).appendChild(h('p', { class: 'note-sim' }, BLOCKED)); } return; }
      if (my !== seq) return;
      status.textContent = '';
      const ps = tk.encode(ta.value, addSpecial), nch = [...ta.value].length;
      clear(out).appendChild(chips(ps));
      ro.set([['tokenizer', `${name} · ${family}`], ['vocabulary', tk.vocab.toLocaleString('en')], ['tokens', ps.length], ['characters', nch], ['chars per token', (nch / Math.max(1, ps.length)).toFixed(2)], ['ids', ps.slice(0, 12).map((p) => p.id).join(' ') + (ps.length > 12 ? ' …' : '')]]);
      if (cmp.firstChild) compare();
    }
    async function compare() {
      started = true;
      const my = seq; status.textContent = 'Downloading the other vocabularies…';
      const rows = await Promise.all(CFG.tokenizers.map(async ([name, repo, family]) => { try { const tk = await loadTokenizer(repo); return [name, family, tk.vocab, tk.encode(ta.value, false).length]; } catch (e) { return [name, family, null, null]; } }));
      if (my !== seq) return;
      status.textContent = '';
      const nch = [...ta.value].length, best = Math.min(...rows.map((r) => r[3] == null ? Infinity : r[3]));
      clear(cmp).appendChild(h('div', { class: 'tbl-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Tokenizer'), h('th', null, 'Family'), h('th', { class: 'num' }, 'Vocabulary'), h('th', { class: 'num' }, 'Tokens'), h('th', { class: 'num' }, 'Chars per token'))),
        h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r[0]), h('td', null, r[1]), h('td', { class: 'num' }, r[2] == null ? '–' : r[2].toLocaleString('en')), h('td', { class: 'num', style: r[3] === best ? { fontWeight: 600 } : null }, r[3] == null ? 'unavailable' : r[3]), h('td', { class: 'num' }, r[3] == null ? '–' : (nch / Math.max(1, r[3])).toFixed(2))))))));
    }
    ta.addEventListener('input', debounce(draw, 120));
    const sg = seg(CFG.tokenizers.map((t) => [t[1], t[0]]), which, (v) => { which = v; draw(); }, 'Tokenizer');
    const sp = h('input', { type: 'checkbox', id: 'real-special', onchange: (e) => { addSpecial = e.target.checked; draw(); } });
    w.body.append(sg.el, ta,
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, SAMPLES.map(([l, t]) => h('button', { class: 'btn', type: 'button', onclick: () => { ta.value = t; draw(); } }, l))),
      h('div', { style: { display: 'flex', gap: '10px 14px', flexWrap: 'wrap', alignItems: 'center' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { started = true; draw(); } }, 'Tokenise'),
        h('button', { class: 'btn', type: 'button', onclick: compare }, 'Compare all ' + CFG.tokenizers.length),
        h('label', { for: 'real-special', style: { display: 'inline-flex', gap: '6px', alignItems: 'center', fontSize: '.9rem' } }, sp, 'add the model’s special tokens'), status),
      out, ro.el, cmp,
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'What to look for: “·” is a space and belongs to the token that follows it in GPT-style vocabularies. BERT marks word-internal pieces with ## and lowercases everything. T5 marks word starts with ▁. A small grey chip of hex digits is a token that holds only part of a character, which is how a byte-level vocabulary spells text it rarely saw. A dashed italic chip is a special token.'));
    return w.el;
  }

  /* ---------------- the model ---------------- */
  const hasModel = !!CFG.modelRepo;
  const modelBase = () => `${CFG.hub}/${CFG.modelRepo}/resolve/main/`;
  let metaP = null, modelP = null, modelNow = null;
  const getMeta = () => (metaP = metaP || getJSON(modelBase() + 'meta.json').catch((e) => { metaP = null; throw e; }));
  const mb = (n) => (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';

  async function download(url, total, say) {
    const key = url + '?b=' + total; let cache = null;
    try { cache = await caches.open('llmx-real-v1'); const hit = await cache.match(key); if (hit) { say('Reading the model from this browser’s cache…'); return new Uint8Array(await hit.arrayBuffer()); } } catch (e) { cache = null; }
    const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status);
    const len = +res.headers.get('content-length') || total || 0;
    let buf;
    if (res.body && res.body.getReader) {
      const rd = res.body.getReader(); const parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; say(`Downloading the model: ${mb(got)}${len ? ' of ' + mb(len) : ''}`); }
      buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    } else buf = new Uint8Array(await res.arrayBuffer());
    try { if (cache) await cache.put(key, new Response(buf.slice(), { headers: { 'content-type': 'application/octet-stream' } })); } catch (e) { /* storage full or disabled: just skip caching */ }
    return buf;
  }

  function loadModel(say) {
    if (modelP) return modelP;
    modelP = (async () => {
      const meta = await getMeta();
      const tok = await loadTokenizer(CFG.modelRepo);
      const data = await download(modelBase() + meta.file, meta.bytes, say);
      say('Starting the runtime…');
      const ort = await import(CFG.ortLib + 'ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths = CFG.ortLib;
      const session = await ort.InferenceSession.create(data, { executionProviders: ['wasm'] });
      let chain = Promise.resolve(); // one forward pass at a time
      function run(ids) {
        const job = chain.then(async () => {
          const t0 = performance.now();
          const o = await session.run({ input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, ids.length]) });
          const [L, H, n] = o.attn.dims.map(Number), a = o.attn.data;
          const head = (l, hd) => Array.from({ length: n }, (_, i) => Array.from(a.subarray(((l * H + hd) * n + i) * n, ((l * H + hd) * n + i + 1) * n)));
          const mean = (l) => { const m = Array.from({ length: n }, () => new Array(n).fill(0)); for (let hd = 0; hd < H; hd++) { const x = head(l, hd); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) m[i][j] += x[i][j] / H; } return m; };
          return { logits: o.logits.data, n, L, H, head, mean, ms: performance.now() - t0 };
        });
        chain = job.catch(() => {});
        return job;
      }
      modelNow = { meta, tok, run };
      return modelNow;
    })();
    modelP.catch(() => { modelP = null; });
    return modelP;
  }

  /* A widget body that shows a load button first, then calls build(model, body) once the model is ready.
     If the model was already loaded on this visit, it builds straight away. */
  function gated(w, build) {
    const body = h('div', { style: { display: 'grid', gap: '14px', minWidth: 0 } });
    w.body.appendChild(body);
    if (modelNow) { build(modelNow, body); return; }
    const status = h('span', { class: 'note-sim', 'aria-live': 'polite' });
    const btn = h('button', { class: 'btn primary', type: 'button' }, 'Load the real model');
    getMeta().then((m) => { btn.textContent = `Load ${m.name} (${mb(m.bytes)}, downloaded once)`; }).catch(() => {});
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { const m = await loadModel((t) => (status.textContent = t)); clear(body); build(m, body); }
      catch (e) { btn.disabled = false; status.textContent = BLOCKED; }
    });
    body.append(h('div', { style: { display: 'flex', gap: '10px 14px', flexWrap: 'wrap', alignItems: 'center' } }, btn, status),
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'The model and its runtime (about 4 MB more) run entirely in your browser; your text is not sent anywhere. Later visits reuse the cached copy.'));
  }
  const describe = (m) => `${m.name}: ${m.layers} layers × ${m.heads} heads, d_model ${m.d_model}, ${(m.params / 1e6).toFixed(0)}M parameters${m.quantized ? ', weights stored in 8 bits' : ''}. Prompts are cut to ${m.maxTokens} tokens.`;
  function promptBox(value, onchange) {
    const ta = h('textarea', { rows: 2, 'aria-label': 'Prompt' }, value);
    ta.addEventListener('input', debounce(onchange, 300));
    return ta;
  }
  const encodePrompt = (M, text) => { const ps = M.tok.encode(text, false); return ps.slice(0, M.meta.maxTokens); };

  /* softmax with temperature over the whole vocabulary, then top-k and top-p filtering */
  function distribution(logits, T, k, p) {
    const n = logits.length; let mx = -Infinity; for (let i = 0; i < n; i++) if (logits[i] > mx) mx = logits[i];
    const pr = new Float64Array(n); let Z = 0; for (let i = 0; i < n; i++) { pr[i] = Math.exp((logits[i] - mx) / T); Z += pr[i]; }
    for (let i = 0; i < n; i++) pr[i] /= Z;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => pr[b] - pr[a]);
    let keep = 0, cum = 0;
    for (let r = 0; r < n; r++) { if (r >= k) break; if (cum >= p && r > 0) break; keep++; cum += pr[order[r]]; }
    return { pr, order, keep, mass: cum };
  }
  function draw1(d, u) { let x = u * d.mass; for (let r = 0; r < d.keep; r++) { x -= d.pr[d.order[r]]; if (x <= 0) return d.order[r]; } return d.order[d.keep - 1]; }
  const entropy = (ps) => -ps.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);

  /* ----- Module 5: attention heatmap ----- */
  function attentionWidget() {
    const w = widget('Attention inside a real model', 'Try it');
    gated(w, (M, body) => {
      const { meta } = M; let mode = 'head', R = null, ps = [], seq = 0;
      const ta = promptBox('The animal didn\'t cross the street because it was too tired', run);
      const sl = slider({ label: 'layer', min: 1, max: meta.layers, value: Math.min(meta.layers, 4), oninput: draw });
      const sh = slider({ label: 'head', min: 1, max: meta.heads, value: 1, oninput: draw });
      const sr = slider({ label: 'query token (row)', min: 1, max: 2, value: 2, fmt: (v) => (ps[v - 1] ? `${v} · ${show(ps[v - 1].text)}` : v), oninput: draw });
      const sg = seg([['head', 'One head'], ['mean', 'Mean of all heads']], mode, (v) => { mode = v; sh.input.disabled = v === 'mean'; draw(); }, 'Heads');
      const grid = h('div', { style: { overflowX: 'auto' } }); const bars = probBars({ labelW: 96 }); const ro = readout(); const status = h('span', { class: 'note-sim', 'aria-live': 'polite' });
      async function run() {
        const my = ++seq; ps = encodePrompt(M, ta.value);
        if (!ps.length) { clear(grid); ro.set([['tokens', 0]]); return; }
        status.textContent = 'Running…';
        const r = await M.run(ps.map((p) => p.id)); if (my !== seq) return;
        R = r; status.textContent = `${r.ms.toFixed(0)} ms for one forward pass`;
        sr.input.max = ps.length; sr.set(sr._auto !== false || sr.value > ps.length ? ps.length : sr.value);
        draw();
      }
      sr.input.addEventListener('input', () => { sr._auto = false; });
      function draw() {
        if (!R) return;
        const n = R.n, l = sl.value - 1, A = mode === 'mean' ? R.mean(l) : R.head(l, sh.value - 1), row = Math.min(sr.value, n) - 1;
        const cell = Math.max(9, Math.min(30, Math.floor(540 / n))), ox = 92, oy = 70, fs = Math.max(7, Math.min(11, cell - 2));
        const g = svg(Math.max(560, ox + n * cell + 12), oy + n * cell + 12, { 'aria-label': `Attention weights, layer ${l + 1}${mode === 'mean' ? ', mean of heads' : ', head ' + sh.value}. Rows are the token that is looking; columns are the tokens it looks at.` });
        g.appendChild(matrixGrid(A, { x: ox, y: oy, cell, max: 1, color: 'var(--q)', numbers: n <= 9, fmt: (v) => v.toFixed(2), fs: 8.5, visible: (i, j) => j <= i }));
        g.appendChild(s('rect', { x: ox - 1.5, y: oy + row * cell - 1.5, width: n * cell + 1, height: cell + 1, rx: 4, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }));
        ps.forEach((p, i) => {
          g.appendChild(s('text', { x: ox - 6, y: oy + i * cell + cell / 2 + 3, 'text-anchor': 'end', 'font-size': fs, 'font-family': 'var(--f-mono)', style: i === row ? 'font-weight:700' : '', text: label(p) }));
          const cx = ox + i * cell + cell / 2;
          g.appendChild(s('text', { x: cx, y: oy - 6, 'font-size': fs, 'font-family': 'var(--f-mono)', transform: `rotate(-55 ${cx} ${oy - 6})`, text: label(p) }));
        });
        clear(grid).appendChild(g);
        const items = A[row].slice(0, row + 1).map((p, j) => ({ label: label(ps[j]), p, j })).sort((a, b) => b.p - a.p).slice(0, 8);
        bars.draw(items.map((d) => ({ label: d.label, p: d.p, color: tokColor(d.j) })), { scaleMax: 1, caption: `where “${show(ps[row].text)}” looks · top ${items.length} of ${row + 1} visible tokens` });
        ro.set([['tokens', n], ['layer', `${l + 1} of ${R.L}`], ['head', mode === 'mean' ? 'mean of ' + R.H : `${sh.value} of ${R.H}`], ['looks most at', `${show(ps[items[0].j].text)} (${(items[0].p * 100).toFixed(0)}%)`], ['entropy', fmt(entropy(A[row].slice(0, row + 1)), 2) + ' bits']]);
      }
      body.append(ta, h('div', { class: 'ctl-row' }, sl.el, sh.el, sr.el), h('div', { style: { display: 'flex', gap: '10px 14px', flexWrap: 'wrap', alignItems: 'center' } }, sg.el, status), grid, bars.el, ro.el,
        h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Each row sums to 100% and the upper triangle is empty: that is the causal mask from the animation above. Many heads put most of their weight on the first token, which acts as a resting place when a head has nothing useful to read (Module 10 calls these attention sinks). Step through layers and heads to find ones that track the previous token, or that link “it” back to a noun.'),
        h('p', { class: 'note-sim' }, describe(meta) + ' Attention weights show where information is read from, not why the model answers as it does.'));
      run();
    });
    return w.el;
  }

  /* ----- Module 7: real next-token distribution and sampling ----- */
  function samplingWidget() {
    const w = widget('Sampling from a real model', 'Try it');
    gated(w, (M, body) => {
      const { meta } = M; const SHOW = 12; let prompt = [], gen = [], R = null, seq = 0, busy = false;
      const ta = promptBox('The capital of France is', () => { gen = []; run(); });
      const st = { T: 1, k: 50, p: 1 };
      const sT = slider({ label: 'temperature', min: 0.1, max: 2.5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), oninput: (v) => { st.T = v; draw(); } });
      const sk = slider({ label: 'top-k', min: 1, max: 50, value: 50, oninput: (v) => { st.k = v; draw(); } });
      const sp = slider({ label: 'top-p (nucleus)', min: 0.05, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), oninput: (v) => { st.p = v; draw(); } });
      const bars = probBars({ labelW: 96 }); const ro = readout(); const text = h('div', { class: 'tokbox' }); const status = h('span', { class: 'note-sim', 'aria-live': 'polite' });
      const full = () => prompt.length + gen.length >= meta.maxTokens;
      async function run() {
        const my = ++seq; prompt = encodePrompt(M, ta.value);
        if (!prompt.length) { R = null; clear(text); return; }
        const r = await M.run(prompt.concat(gen).map((p) => p.id)); if (my !== seq) return;
        R = r; draw();
      }
      function draw() {
        clear(text).append(...prompt.map((p) => chip(p, 0, { background: 'transparent', borderColor: 'var(--rule)', color: 'var(--muted)' })), ...gen.map((p, i) => chip(p, i + 1)));
        if (!R) return;
        const d = distribution(R.logits, st.T, st.k, st.p);
        const items = d.order.slice(0, SHOW).map((id, r) => ({ label: label(M.tok.piece(id)), p: r < d.keep ? d.pr[id] / d.mass : 0, dim: r >= d.keep, ghost: d.pr[id], color: r === 0 ? 'var(--accent)' : 'var(--q)' }));
        bars.draw(items, { scaleMax: 1, caption: `top ${SHOW} of ${meta.vocab.toLocaleString('en')} tokens · kept ${d.keep} · tick = before filtering` });
        const kept = []; for (let r = 0; r < d.keep; r++) kept.push(d.pr[d.order[r]] / d.mass);
        ro.set([['most likely', `${show(M.tok.piece(d.order[0]).text)} (${(d.pr[d.order[0]] / d.mass * 100).toFixed(1)}%)`], ['entropy', fmt(entropy(kept), 2) + ' bits'], ['candidates kept', d.keep], ['sequence', `${prompt.length + gen.length} of ${meta.maxTokens} tokens`], ['last forward pass', R.ms.toFixed(0) + ' ms']]);
        status.textContent = full() ? `Reached the ${meta.maxTokens}-token limit for this demo. Press Reset.` : '';
        bOne.disabled = bMany.disabled = busy || full();
      }
      async function step(n) {
        if (busy) return; busy = true; draw();
        for (let i = 0; i < n && R && !full(); i++) {
          const d = distribution(R.logits, st.T, st.k, st.p);
          gen.push(M.tok.piece(draw1(d, Math.random())));
          await run();
        }
        busy = false; draw();
      }
      const bOne = h('button', { class: 'btn primary', type: 'button', onclick: () => step(1) }, 'Sample next token');
      const bMany = h('button', { class: 'btn', type: 'button', onclick: () => step(15) }, 'Generate 15 tokens');
      const bReset = h('button', { class: 'btn', type: 'button', onclick: () => { gen = []; run(); } }, 'Reset');
      body.append(ta, h('div', { class: 'ctl-row' }, sT.el, sk.el, sp.el), bars.el, ro.el, h('div', { style: { display: 'flex', gap: '8px 10px', flexWrap: 'wrap', alignItems: 'center' } }, bOne, bMany, bReset, status), text,
        h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'The bars are this model’s actual prediction for your prompt. Lower the temperature and the top bar takes over; lower top-k or top-p and the tail is cut before the rest is rescaled to 100%. Each new token here reruns the whole sequence from scratch, so the time per token grows with length. Saving that repeated work is the job of the KV cache.'),
        h('p', { class: 'note-sim' }, describe(meta) + ' It is a small model: fluent for a few words, often wrong on facts.'));
      run();
    });
    return w.el;
  }

  /* ----- Module 41: one prompt, end to end ----- */
  function journeyWidget() {
    const w = widget('Your prompt through a real model', 'Try it');
    gated(w, (M, body) => {
      const { meta } = M; let ps = [], R = null, seq = 0;
      const ta = promptBox('Once upon a time there was a', run);
      const t1 = h('div'), ro1 = readout(), ro2 = readout(), bA = probBars({ labelW: 96 }), bP = probBars({ labelW: 96 }), status = h('span', { class: 'note-sim', 'aria-live': 'polite' });
      const stage = (n, title, ...kids) => h('div', { style: { display: 'grid', gap: '8px', minWidth: 0 } }, h('div', { class: 'eyebrow' }, `${n} · ${title}`), kids);
      async function run() {
        const my = ++seq; ps = encodePrompt(M, ta.value);
        clear(t1).appendChild(chips(ps));
        ro1.set([['tokens', ps.length], ['ids', ps.slice(0, 14).map((p) => p.id).join(' ') + (ps.length > 14 ? ' …' : '')]]);
        if (!ps.length) return;
        const r = await M.run(ps.map((p) => p.id)); if (my !== seq) return;
        R = r; const n = r.n;
        ro2.set([['embeddings', `[${n}, ${meta.d_model}]`], ['blocks', `${meta.layers} × (attention with ${meta.heads} heads + MLP)`], ['attention maps', `[${r.L}, ${r.H}, ${n}, ${n}]`], ['forward pass', r.ms.toFixed(0) + ' ms']]);
        const last = r.mean(r.L - 1)[n - 1].map((p, j) => ({ label: label(ps[j]), p, j })).sort((a, b) => b.p - a.p).slice(0, 6);
        bA.draw(last.map((d) => ({ label: d.label, p: d.p, color: tokColor(d.j) })), { scaleMax: 1, caption: `where the last token “${show(ps[n - 1].text)}” reads from · final layer, mean of heads` });
        const d = distribution(r.logits, 1, meta.vocab, 1);
        bP.draw(d.order.slice(0, 6).map((id, k) => ({ label: label(M.tok.piece(id)), p: d.pr[id], color: k === 0 ? 'var(--accent)' : 'var(--q)' })), { scaleMax: 1, caption: `top 6 of ${meta.vocab.toLocaleString('en')} · temperature 1` });
        status.textContent = ps.length >= meta.maxTokens ? `Reached the ${meta.maxTokens}-token limit for this demo.` : '';
        bNext.disabled = ps.length >= meta.maxTokens;
        bNext._id = d.order[0];
      }
      const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (bNext._id == null) return; ta.value = ta.value + M.tok.piece(bNext._id).text; run(); } }, 'Append the top token and run again');
      body.append(ta,
        stage(1, 'Tokenise (Module 3)', t1, ro1.el),
        stage(2, 'Embed and run the blocks (Modules 4–5)', ro2.el),
        stage(3, 'Attention at the last position (Module 5)', bA.el),
        stage(4, 'Unembed and softmax (Module 7)', bP.el),
        stage(5, 'Pick, append, repeat (Module 7)', h('div', { style: { display: 'flex', gap: '10px 14px', flexWrap: 'wrap', alignItems: 'center' } }, bNext, status)),
        h('p', { class: 'note-sim' }, describe(meta) + ' Unlike the tiny model above, these weights are trained, so the predictions mean something.'));
      run();
    });
    return w.el;
  }

  LLM.real = { config: CFG, hasModel, loadTokenizer, loadModel, distribution, tokenizerWidget, attentionWidget, samplingWidget, journeyWidget };
})();
