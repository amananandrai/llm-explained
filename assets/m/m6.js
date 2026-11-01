(function () {
  const { h, s, svg, clear, seg, widget, readout, tokColor, mix } = LLM.util;
  const src = ['I', 'love', 'cats'], tgt = ['J’', 'aime', 'les', 'chats'];

  function maskGrid(g, x, y, n, fn, cs, color, labels) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const on = fn(i, j);
      g.appendChild(s('rect', { x: x + j * cs, y: y + i * cs, width: cs - 2, height: cs - 2, rx: 2, fill: on ? color : 'var(--sunk)', style: on ? 'opacity:.8' : '' }));
    }
    if (labels) labels.forEach((t, i) => { g.appendChild(s('text', { x: x - 4, y: y + i * cs + cs * 0.65, 'text-anchor': 'end', 'font-size': 9.5, text: t, style: `fill:${tokColor(i)}` })); });
  }
  function tower(g, x, label, sub, color) {
    for (let i = 0; i < 4; i++) g.appendChild(s('rect', { x, y: 70 + i * 28, width: 140, height: 22, rx: 5, fill: mix(color, 25), stroke: color }));
    g.appendChild(s('text', { x: x + 70, y: 52, 'text-anchor': 'middle', 'font-size': 13, text: label, style: 'font-weight:600' }));
    g.appendChild(s('text', { x: x + 70, y: 196, 'text-anchor': 'middle', class: 'lbl', text: sub }));
  }

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'Three transformer shapes and their attention masks' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const show = (k) => step === 0 || step === k || step === 4;
      const cols = [[10, 'Encoder-only', 'BERT: masked LM', 'var(--q)', 0], [200, 'Decoder-only', 'GPT: causal LM', 'var(--k)', 1], [390, 'Encoder–decoder', 'T5, BART: seq2seq', 'var(--v)', 2]];
      cols.forEach(([x, l, sub, c, k]) => {
        const op = show(k + 1) ? 1 : 0.18;
        const gg = s('g', { style: `opacity:${op};transition:opacity .4s` }); g.appendChild(gg);
        const g2 = { appendChild: (e) => gg.appendChild(e) };
        tower(g2, x + 10, l, sub, c);
        if (k === 0) maskGrid(g2, x + 45, 220, 5, () => true, 18, c);
        if (k === 1) maskGrid(g2, x + 45, 220, 5, (i, j) => j <= i, 18, c);
        if (k === 2) { maskGrid(g2, x + 10, 220, 3, () => true, 18, 'var(--q)'); maskGrid(g2, x + 80, 220, 4, (i, j) => j <= i, 18, 'var(--k)'); gg.appendChild(s('path', { d: `M${x + 66},250 C${x + 74},236 ${x + 74},236 ${x + 82},240`, stroke: 'var(--v)', fill: 'none', 'stroke-width': 3 })); gg.appendChild(s('text', { x: x + 10, y: 314, class: 'lbl', text: 'encoder: full · decoder: causal' })); gg.appendChild(s('text', { x: x + 10, y: 328, class: 'lbl', text: '+ cross-attention bridge' })); }
        if (k < 2) gg.appendChild(s('text', { x: x + 45, y: 328, class: 'lbl', text: k === 0 ? 'full square: see everything' : 'lower triangle: see the past' }));
      });
      const msg = ['Three ways to wire attention. The difference is mostly the mask: who may look at whom.', 'Encoder-only: every token sees every other. Trained by hiding 15% of tokens and predicting them.', 'Decoder-only: each token sees only earlier tokens. Trained to predict every next token.', 'Encoder–decoder: a bidirectional encoder reads the input; a causal decoder writes the output and looks across.', 'Decoder-only won for general LLMs: one simple objective on all text, every token gives a training signal.'];
      g.appendChild(s('text', { x: 10, y: 362, 'font-size': 12, text: msg[step] }));
    }
    return { go: draw };
  }

  function maskPainter() {
    const w = widget('Mask painter', 'Try it');
    const toks = ['<s>', 'The', 'cat', 'sat', 'on', 'mat'], n = 6;
    let M = toks.map((_, i) => toks.map((_, j) => j <= i));
    let sel = 3;
    const g = svg(560, 260); const ro = readout();
    const presets = { Bidirectional: () => true, Causal: (i, j) => j <= i, 'Prefix LM (first 3 full)': (i, j) => j < 3 || j <= i, 'Sliding window (3)': (i, j) => j <= i && i - j < 3, 'Diagonal only': (i, j) => i === j };
    function draw() {
      clear(g);
      const cs = 32, ox = 70, oy = 40;
      toks.forEach((t, j) => g.appendChild(s('text', { x: ox + j * cs + cs / 2 - 1, y: oy - 8, 'text-anchor': 'middle', 'font-size': 11, text: t, style: `fill:${tokColor(j)}` })));
      g.appendChild(s('text', { x: ox, y: 16, class: 'lbl', text: 'click cells to allow / block · rows = query, columns = key' }));
      toks.forEach((t, i) => {
        g.appendChild(s('text', { x: ox - 8, y: oy + i * cs + 20, 'text-anchor': 'end', 'font-size': 11, text: t, style: `fill:${tokColor(i)};${i === sel ? 'font-weight:700' : ''}` }));
        toks.forEach((_, j) => { const r = s('rect', { x: ox + j * cs, y: oy + i * cs, width: cs - 3, height: cs - 3, rx: 4, fill: M[i][j] ? mix('var(--q)', 75) : 'var(--sunk)', stroke: i === sel ? 'var(--ink)' : 'none', style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': `${t} sees ${toks[j]}: ${M[i][j] ? 'allowed' : 'blocked'}` }); const tog = () => { M[i][j] = !M[i][j]; sel = i; draw(); }; r.addEventListener('click', tog); r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }); g.appendChild(r); });
      });
      const px = 300; g.appendChild(s('text', { x: px, y: 50, 'font-size': 12, text: `“${toks[sel]}” can see:`, style: 'font-weight:600' }));
      toks.forEach((t, j) => { g.appendChild(s('rect', { x: px, y: 62 + j * 26, width: 70, height: 20, rx: 4, fill: M[sel][j] ? mix(tokColor(j), 35) : 'var(--sunk)', stroke: M[sel][j] ? tokColor(j) : 'none' })); g.appendChild(s('text', { x: px + 35, y: 76 + j * 26, 'text-anchor': 'middle', 'font-size': 11, text: t, style: M[sel][j] ? '' : 'opacity:.35' })); });
      const causal = M.every((r, i) => r.every((v, j) => (j > i ? !v : true)));
      const leaks = M.reduce((a, r, i) => a + r.filter((v, j) => v && j > i).length, 0);
      ro.set([['allowed pairs', M.flat().filter(Boolean).length + ' / 36'], ['future peeks', leaks, leaks ? 'var(--fail)' : 'var(--pass)'], ['usable for next-token training?', causal ? 'yes' : 'no: it can see the answer', causal ? 'var(--pass)' : 'var(--fail)']]);
    }
    const sg = seg(Object.keys(presets), 'Causal', (k) => { M = toks.map((_, i) => toks.map((_, j) => presets[k](i, j))); draw(); }, 'Mask presets');
    w.body.append(sg.el, g, ro.el);
    draw();
    return w.el;
  }

  function taskPicker() {
    const w = widget('Task picker', 'Try it');
    const tasks = {
      'Classify a review as positive or negative': ['Encoder-only', 'Reads the whole review at once in both directions; a small head on top gives the label. Cheap and accurate. A decoder-only LLM also works by prompting, at higher cost.'],
      'Translate English to French': ['Encoder–decoder', 'Input and output are different sequences; the encoder reads the full source, the decoder writes the target with cross-attention. Large decoder-only models now translate well too.'],
      'Write a story from a prompt': ['Decoder-only', 'Open-ended generation one token at a time is exactly what causal LM training teaches.'],
      'Find named entities in a document': ['Encoder-only', 'Needs a label for every token, using context on both sides.'],
      'Summarise a long article': ['Encoder–decoder', 'Classic seq2seq task (BART, T5 were built for it); decoder-only LLMs now dominate in practice because of scale.'],
      'Embed passages for search': ['Encoder-only', 'Bidirectional encoders pooled into one vector are the classic choice (Module 21), though many top embedding models are now decoder-based.'],
      'Chat assistant that also writes code': ['Decoder-only', 'One general model, one objective, any task phrased as text.'],
    };
    const out = h('div', { class: 'prose' });
    let cur = Object.keys(tasks)[0];
    function draw() { const [arch, why] = tasks[cur]; clear(out).append(h('p', null, h('span', { class: 'badge live', style: { marginRight: '8px' } }, arch), why)); }
    const sel = h('select', { id: 'task-pick', onchange: (e) => { cur = e.target.value; draw(); } }, Object.keys(tasks).map((t) => h('option', { value: t }, t)));
    w.body.append(h('div', { class: 'ctl' }, h('label', { for: 'task-pick' }, 'task'), sel), out);
    draw();
    return w.el;
  }

  LLM.mod('6', {
    hook: 'Should every word see every other word? It depends on the job.',
    intro: ['The 2017 transformer had two halves: an encoder that reads the input and a decoder that writes the output. Later models kept one half, the other, or both. The main difference between them is the attention mask, and the training objective that mask makes possible.'],
    hero: {
      steps: [
        { title: 'Three shapes', text: 'The original paper used both halves for translation. BERT kept only the encoder; GPT kept only the decoder; T5 and BART kept both.' },
        { title: 'Encoder-only (BERT)', text: 'The mask is a full square: every token sees every other, left and right. To train it, hide about 15% of tokens and predict them from both sides: masked language modelling.', mech: 'Loss is computed only at masked positions. Good for understanding tasks; cannot generate text left to right.' },
        { title: 'Decoder-only (GPT)', text: 'The mask is the lower triangle: each token sees itself and the past. Training predicts every next token, so every position gives a learning signal.', mech: 'Loss at all T positions in one forward pass, thanks to the mask.' },
        { title: 'Encoder–decoder (T5, BART)', text: 'The encoder reads “I love cats” with a full mask. The decoder writes “J’aime les chats” with a causal mask, and cross-attention lets each output token query the encoder’s states.', mech: 'Cross-attention: Q from the decoder, K and V from the encoder output. T5 trains with span corruption: replace spans with sentinels and generate them.' },
        { title: 'Why decoder-only won', text: 'For general-purpose LLMs: one objective works on any text, every token trains the model, any task can be phrased as “continue this text”, and the KV cache makes generation efficient. Encoders remain strong for classification and search.' },
      ],
      init: heroInit,
    },
    maths: [
      { note: '<b>Masked LM</b> loss over the set of masked positions 𝓜, conditioning on the whole corrupted input:', tex: '\\mathcal{L}_{\\text{MLM}}=-\\sum_{i\\in\\mathcal{M}}\\log P\\big(x_i\\mid \\tilde{x}\\big)' },
      { note: '<b>Causal LM</b> loss over every position, conditioning only on the past:', tex: '\\mathcal{L}_{\\text{CLM}}=-\\sum_{t=1}^{T}\\log P\\big(x_t\\mid x_{<t}\\big)' },
      { note: '<b>Cross-attention</b> in the decoder, with decoder states H_d and encoder output H_e:', tex: '\\mathrm{softmax}\\!\\Big(\\frac{(H_dW_Q)(H_eW_K)^\\top}{\\sqrt{d_k}}\\Big)(H_eW_V)' },
    ],
    tryit: [maskPainter, taskPicker],
    leaves: ['Many hybrids exist: prefix-LMs, UL2’s mixture of objectives, encoder models trained with replaced-token detection (ELECTRA).', 'The “which shape for which task” advice is about cost and fit; scale lets a large decoder-only model do all of these tasks.', 'Cross-attention also connects images to text in some multimodal models (Module 19).'],
    quiz: [
      { q: 'Which mask lets you train on all T next-token predictions in one forward pass?', opts: ['Full (bidirectional)', 'Causal (lower triangle)', 'Diagonal', 'No mask'], a: 1, why: 'Each position sees only the past, so predicting its next token is not cheating, and all positions train at once.' },
      { q: 'In cross-attention, where do the keys and values come from?', opts: ['The decoder', 'The encoder output', 'The embedding table', 'The previous layer of the decoder only'], a: 1, why: 'Queries come from the decoder; keys and values come from the encoder’s final states.' },
      { q: 'BERT computes its MLM loss at…', opts: ['every token', 'only the masked positions', 'only the [CLS] token', 'only the last token'], a: 1, why: 'Unmasked tokens are visible in the input, so predicting them is trivial; loss is taken at the ≈15% masked positions.' },
    ],
  });
})();
