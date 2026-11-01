(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, tokColor, mix, human, lineChart } = LLM.util;

  /* ---------- hero: classic character BPE on a tiny corpus ---------- */
  const corpus = { low: 5, lower: 2, newest: 6, widest: 3 };
  function bpeTrace(n) {
    let words = Object.entries(corpus).map(([w, f]) => [w.split('').concat('_'), f]);
    const trace = [{ words: words.map(([w, f]) => [w.slice(), f]), pairs: countPairs(words), merged: null }];
    for (let k = 0; k < n; k++) {
      const pairs = countPairs(words); const best = pairs[0]; if (!best) break;
      const [a, b] = best[0].split('\u0001');
      words = words.map(([w, f]) => { const o = []; for (let i = 0; i < w.length; i++) { if (i < w.length - 1 && w[i] === a && w[i + 1] === b) { o.push(a + b); i++; } else o.push(w[i]); } return [o, f]; });
      trace.push({ words: words.map(([w, f]) => [w.slice(), f]), pairs: countPairs(words), merged: [a, b, best[1]] });
    }
    return trace;
  }
  function countPairs(words) { const m = new Map(); words.forEach(([w, f]) => { for (let i = 0; i < w.length - 1; i++) { const k = w[i] + '\u0001' + w[i + 1]; m.set(k, (m.get(k) || 0) + f); } }); return [...m.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)); }
  const TRACE = bpeTrace(7);

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Byte pair encoding merges the most frequent adjacent pair, step by step' }); box.appendChild(g);
    const vocabAt = (k) => { const v = new Set(); TRACE[k].words.forEach(([w]) => w.forEach((t) => v.add(t))); return v; };
    const tokId = new Map(); let nid = 0; TRACE.forEach((t) => t.words.forEach(([w]) => w.forEach((x) => { if (!tokId.has(x)) tokId.set(x, nid++); })));
    function draw(step) {
      clear(g);
      const k = Math.min(step, TRACE.length - 1), st = TRACE[k];
      g.appendChild(s('text', { x: 16, y: 22, 'font-size': 13, text: k === 0 ? 'Start: every word split into characters (_ marks word end)' : `Merge ${k}: “${st.merged[0]}” + “${st.merged[1]}” → “${st.merged[0] + st.merged[1]}”  (seen ${st.merged[2]}×)`, style: 'font-weight:600' }));
      st.words.forEach(([w, f], r) => {
        const y = 48 + r * 52; let x = 16;
        g.appendChild(s('text', { x: 16, y: y + 34, class: 'lbl', text: '×' + f }));
        x = 46;
        w.forEach((t) => { const wd = 10 + t.length * 11; const isNew = st.merged && t === st.merged[0] + st.merged[1]; g.appendChild(s('rect', { x, y: y + 14, width: wd, height: 26, rx: 5, fill: mix(tokColor(tokId.get(t)), 30), stroke: isNew ? 'var(--ink)' : tokColor(tokId.get(t)), 'stroke-width': isNew ? 2.2 : 1.2 })); g.appendChild(s('text', { x: x + wd / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 12.5, text: t })); x += wd + 4; });
      });
      // pair table
      const px = 330; g.appendChild(s('text', { x: px, y: 60, class: 'lbl', text: 'pair counts (top = next merge)' }));
      st.pairs.slice(0, 8).forEach(([p, c], i) => { const [a, b] = p.split('\u0001'); const y = 70 + i * 24; g.appendChild(s('rect', { x: px, y, width: 210, height: 20, rx: 3, fill: i === 0 ? mix('var(--accent)', 18) : 'var(--sunk)' })); g.appendChild(s('text', { x: px + 8, y: y + 14, 'font-size': 11.5, text: `${a} + ${b}` })); g.appendChild(s('text', { x: px + 200, y: y + 14, 'text-anchor': 'end', 'font-size': 11.5, text: c })); });
      const total = st.words.reduce((a, [w, f]) => a + w.length * f, 0);
      g.appendChild(s('text', { x: 16, y: 300, 'font-size': 12, text: `vocabulary: ${vocabAt(k).size} symbols   ·   corpus length: ${total} tokens` }));
      g.appendChild(s('text', { x: 16, y: 322, class: 'lbl', text: 'Each merge adds one token to the vocabulary and shortens the corpus.' }));
    }
    const MAP = [0, 1, 3, 5, 5, 7];
    return { go: (i) => draw(MAP[i]) };
  }

  /* ---------- byte-level BPE trained in the browser ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
  const PRE = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
  const PY = `def add(a, b):\n    return a + b\n\nfor i in range(10):\n    print(i, add(i, i))\n\nclass Model:\n    def __init__(self, d_model=512):\n        self.d_model = d_model\n\nimport numpy as np\nx = np.zeros((4, 4))\nreturn self.layers[i](x)\n`;
  let BPE = null;
  function trainBPE(maxMerges) {
    const text = Object.values(window.PLAN.modules).map((m) => [m.title].concat(m.fields.map((f) => f.text + ' ' + f.sub.join(' '))).join(' ')).join(' ').replace(/<[^>]+>/g, '') + ' ' + PY.repeat(3);
    const freq = new Map(); (text.match(PRE) || []).forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
    let words = [...freq.entries()].map(([w, f]) => [Array.from(enc.encode(w)), f]);
    const vocab = Array.from({ length: 256 }, (_, i) => [i]); const ranks = new Map();
    for (let k = 0; k < maxMerges; k++) {
      const pc = new Map();
      for (const [w, f] of words) for (let i = 0; i < w.length - 1; i++) { const key = w[i] * 65536 + w[i + 1]; pc.set(key, (pc.get(key) || 0) + f); }
      let best = -1, bc = 1; for (const [key, c] of pc) if (c > bc) { bc = c; best = key; }
      if (best < 0) break;
      const a = Math.floor(best / 65536), b = best % 65536, id = vocab.length;
      vocab.push(vocab[a].concat(vocab[b])); ranks.set(best, id);
      for (const wf of words) { const w = wf[0]; if (w.length < 2) continue; const o = []; for (let i = 0; i < w.length; i++) { if (i < w.length - 1 && w[i] === a && w[i + 1] === b) { o.push(id); i++; } else o.push(w[i]); } wf[0] = o; }
    }
    return { vocab, ranks, text };
  }
  function encodeBPE(text, nMerges) {
    const out = [];
    (text.match(PRE) || []).forEach((wd) => {
      let w = Array.from(enc.encode(wd));
      while (w.length > 1) {
        let bi = -1, br = Infinity;
        for (let i = 0; i < w.length - 1; i++) { const r = BPE.ranks.get(w[i] * 65536 + w[i + 1]); if (r != null && r < 256 + nMerges && r < br) { br = r; bi = i; } }
        if (bi < 0) break; w.splice(bi, 2, br);
      }
      out.push(...w);
    });
    return out;
  }
  function show(id) { const b = new Uint8Array(BPE.vocab[id]); try { return dec.decode(b); } catch (e) { return Array.from(b).map((x) => '<' + x.toString(16) + '>').join(''); } }
  const TOKENIZERS = {
    'UTF-8 bytes': (t) => Array.from(enc.encode(t)).map((b) => [b, show(b)]),
    'Whitespace words': (t) => (t.match(/\S+|\s+/g) || []).filter((x) => x.trim()).map((w) => [hash(w), w]),
    'Toy byte-BPE': (t, n) => encodeBPE(t, n).map((id) => [id, show(id)]),
  };
  function hash(w) { let x = 0; for (const c of w) x = (x * 31 + c.codePointAt(0)) % 50000; return x; }
  const MAXM = 1500;
  const ensure = () => { if (!BPE) BPE = trainBPE(MAXM); };

  function tokView(toks) {
    const box = h('div', { class: 'tokbox' });
    toks.forEach(([id, str], i) => box.appendChild(h('span', { class: 'tok', title: 'id ' + id, style: { background: mix(tokColor(i), 18, 'var(--paper)'), borderColor: tokColor(i) } }, str.replace(/\n/g, '↵').replace(/ /g, '·'))));
    return box;
  }

  function playground() {
    ensure();
    const w = widget('Tokenizer playground', 'Try it', `The toy BPE is trained in your browser on this site’s own curriculum text plus a little Python (${human(BPE.text.length)} characters, ${MAXM} merges). It is a real byte-level BPE, but tiny; production tokenizers train on terabytes and have 50k–200k tokens.`);
    const ta = h('textarea', { id: 'tok-in', rows: 3 }, 'Tokenisation splits text into pieces. Unbelievable! 12345 + 67890 = 80235');
    let which = 'Toy byte-BPE';
    const out = h('div'); const ro = readout();
    const nm = slider({ label: 'BPE merges used', min: 0, max: MAXM, step: 10, value: MAXM, oninput: draw });
    function draw() {
      const toks = TOKENIZERS[which](ta.value, nm.value);
      clear(out).appendChild(tokView(toks));
      ro.set([['tokens', toks.length], ['characters', [...ta.value].length], ['chars per token', (([...ta.value].length) / Math.max(1, toks.length)).toFixed(2)], ['ids', toks.slice(0, 12).map((t) => t[0]).join(' ') + (toks.length > 12 ? ' …' : '')]]);
    }
    ta.addEventListener('input', draw);
    const sg = seg(Object.keys(TOKENIZERS), which, (v) => { which = v; draw(); }, 'Tokenizer');
    const ex = [['Leading space', 'hello Hello  hello HELLO'], ['Numbers', 'In 2026 the price rose from 1999.99 to 123456789.'], ['Spelling', 'How many r letters are in strawberry?'], ['Hindi', 'आज मौसम बहुत अच्छा है।'], ['Code', 'def add(a, b):\n    return a + b']];
    w.body.append(sg.el, ta, h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, ex.map(([l, t]) => h('button', { class: 'btn', type: 'button', onclick: () => { ta.value = t; draw(); } }, l))), nm.el, out, ro.el);
    draw();
    return w.el;
  }

  function languages() {
    ensure();
    const w = widget('Same meaning, different token bills', 'Try it');
    const samples = [['English', 'The weather is very nice today.'], ['Hindi', 'आज मौसम बहुत अच्छा है।'], ['Python', 'def is_nice(weather):\n    return weather == "nice"']];
    const tbl = h('div', { class: 'tbl-wrap' });
    const rows = samples.map(([l, t]) => [l, t, TOKENIZERS['UTF-8 bytes'](t).length, TOKENIZERS['Whitespace words'](t).length, TOKENIZERS['Toy byte-BPE'](t, MAXM).length]);
    tbl.appendChild(h('table', null, h('thead', null, h('tr', null, h('th', null, 'Language'), h('th', null, 'Text'), h('th', { class: 'num' }, 'Bytes'), h('th', { class: 'num' }, 'Words'), h('th', { class: 'num' }, 'Toy BPE'))), h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r[0]), h('td', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, r[1]), h('td', { class: 'num' }, r[2]), h('td', { class: 'num' }, r[3]), h('td', { class: 'num' }, r[4]))))));
    w.body.append(tbl, h('div', null, samples.map(([l, t]) => h('div', { style: { marginTop: '8px' } }, h('div', { class: 'eyebrow' }, l), tokView(TOKENIZERS['Toy byte-BPE'](t, MAXM))))),
      h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Each Devanagari character is 3 bytes in UTF-8, and this toy BPE never saw Hindi, so it falls back to raw bytes. Real multilingual tokenizers narrow the gap but rarely close it: the same sentence can cost several times more tokens, which means more money and less context.'));
    return w.el;
  }

  function vocabTradeoff() {
    ensure();
    const w = widget('Vocabulary size trade-off', 'Mechanics');
    const ch = lineChart({ w: 560, h: 220 }); const ro = readout();
    const d = slider({ label: 'd_model', min: 256, max: 8192, step: 256, value: 4096, oninput: draw });
    const sample = BPE.text.slice(0, 6000);
    const pts = [0, 50, 100, 200, 400, 700, 1000, 1500].map((n) => [256 + n, encodeBPE(sample, n).length / [...sample].length]);
    function draw() {
      ch.draw([{ pts, color: 'var(--q)', dots: pts }], { xlabel: 'vocabulary size', ylabel: 'tokens per character', ymin: 0 });
      ro.set([['at 1,756 tokens', pts[pts.length - 1][1].toFixed(2) + ' tok/char'], ['embedding table, 50k vocab', human(50000 * d.value) + ' params'], ['embedding table, 200k vocab', human(200000 * d.value) + ' params']]);
    }
    w.body.append(d.el, ch.el, ro.el, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Measured on the first 6,000 characters of the training text, so it is optimistic. More merges mean shorter sequences (cheaper attention, more text per context window) but a bigger embedding and output layer, and rarer tokens that get fewer training updates.'));
    draw();
    return w.el;
  }

  LLM.mod('3', {
    hook: 'A model never sees letters. So what does it see?',
    intro: ['Models work on integers, so text must first be cut into pieces called tokens, each with an ID. Characters make sequences too long; whole words make the vocabulary too big and cannot handle new words. Modern tokenizers learn subword pieces from data.'],
    hero: {
      steps: [
        { title: 'Start from characters', text: 'Take a tiny corpus: “low” ×5, “lower” ×2, “newest” ×6, “widest” ×3. Split every word into characters and count each adjacent pair, weighted by word frequency.' },
        { title: 'Merge the most frequent pair', text: 'BPE (byte pair encoding) greedily glues the top pair into one new token. Every occurrence is replaced.' },
        { title: 'Count again, merge again', text: 'The counts change after every merge, so recount and repeat.' },
        { title: 'Common words become one token', text: 'Frequent strings collapse into single tokens; rare words stay in pieces. The list of merges, in order, is the tokenizer.', mech: 'To tokenise new text, apply the merges in the order they were learned.' },
        { title: 'Suffixes emerge', text: '“est_” is shared by “newest” and “widest”, so it becomes a reusable piece. An unseen word like “lowest” would still tokenise as “low” + “est_”.' },
        { title: 'Stop at a vocabulary size', text: 'Real tokenizers stop at 32k to 200k tokens. Byte-level BPE starts from the 256 possible bytes instead of characters, so it can encode any text, even emoji, without an “unknown” token.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Other tokenizer families', depth: 'mechanics', body: [
        '<b>WordPiece</b> (BERT) merges the pair that most increases training-data likelihood rather than raw count, and marks word-internal pieces with ##.',
        '<b>Unigram</b> (SentencePiece) starts from a big vocabulary and prunes it. It keeps a probability per token and picks the segmentation that maximises the sum of log probabilities.',
        '<b>SentencePiece</b> treats the input as a raw stream including spaces (shown as ▁), so it needs no language-specific pre-splitting.',
        '<b>Special tokens</b> such as <code>&lt;|endoftext|&gt;</code>, <code>[CLS]</code> or chat-role markers are reserved IDs the model learns to treat as structure.',
        '<b>Failure cases.</b> Numbers split inconsistently (“1999” vs “19” + “99”), so arithmetic suffers. Letter-counting is hard because the model sees “straw” + “berry”, not letters. “hello” and “ hello” are different tokens. Glitch tokens are vocabulary entries that almost never appeared in training, so their embeddings are untrained.',
      ], widget: vocabTradeoff },
    ],
    maths: [
      { note: '<b>BPE</b> repeatedly merges the most frequent adjacent pair:', tex: '(a^*,b^*)=\\arg\\max_{(a,b)}\\;\\sum_{w\\in\\text{corpus}} f(w)\\cdot \\#_{w}(a,b)' },
      { note: '<b>Unigram</b> picks the segmentation x of a string that maximises total log probability, found with the Viterbi algorithm:', tex: 'x^*=\\arg\\max_{x\\in S(\\text{text})}\\sum_{i}\\log p(x_i)' },
    ],
    tryit: [playground, languages],
    leaves: ['The toy BPE has a tiny vocabulary and narrow training text, so it fragments more than GPT-style tokenizers.', 'Real tokenizers add rules for digits, whitespace runs and special tokens that this page skips.', 'Comparing with real GPT or Llama tokenizers needs their vocab files; the build plan loads them with transformers.js in a later phase.'],
    quiz: [
      { q: 'Why does byte-level BPE never need an “unknown” token?', opts: ['Its vocabulary includes every word', 'Any text is a sequence of the 256 possible bytes, which are all in the base vocabulary', 'It deletes characters it does not know', 'It uses a larger embedding'], a: 1, why: 'The base vocabulary covers every byte value, so anything can fall back to bytes.' },
      { q: 'Doubling vocabulary size from 50k to 100k with d_model = 4096 adds how many embedding parameters?', opts: ['≈ 4M', '≈ 205M', '≈ 50k', '≈ 2B'], a: 1, why: '50,000 extra rows × 4,096 = 204.8M (and as many again if the output layer is not tied).' },
      { q: 'Why do LLMs struggle to count the r’s in “strawberry”?', opts: ['They cannot count', 'They see subword tokens, not individual letters', 'The word is too long', 'It is a special token'], a: 1, why: 'The model receives a few token IDs; the letters inside each token are not directly visible.' },
    ],
  });
})();
