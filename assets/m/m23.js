(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, mix, tokColor, barRows } = LLM.util;
  const DOC = `# Returns policy

## Time limits
You can return most items within 30 days of delivery. Opened items can be returned within 14 days, as long as all parts are included. Final-sale items cannot be returned.

## How to start a return
Go to Orders, choose the item and select Return. Print the label we email you. Drop the parcel at any partner location within 5 days of creating the label.

## Refunds
Refunds go back to the original payment method. Card refunds take 3 to 5 business days after we receive the parcel. Store credit is issued immediately.

## Damaged items
If an item arrives damaged, report it within 48 hours with a photo. We will send a replacement at no cost. You do not need to return the damaged item.`;
  const QUERY = 'How long do I have to return an opened item?';
  const ANSWER = ['Opened items can be returned within 14 days', 'as long as all parts are included'];

  const sentences = (t) => t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  function chunk(text, strat, size, overlap) {
    if (strat === 'fixed') { const out = []; for (let i = 0; i < text.length; i += Math.max(1, size - overlap)) { out.push(text.slice(i, i + size)); if (i + size >= text.length) break; } return out; }
    if (strat === 'sentence') { const ss = sentences(text), out = []; let cur = ''; ss.forEach((x) => { if ((cur + ' ' + x).length > size && cur) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; }); if (cur) out.push(cur); return out; }
    if (strat === 'recursive') { const seps = ['\n\n', '\n', '. ', ' ']; const split = (t, k) => { if (t.length <= size || k >= seps.length) return [t]; const parts = t.split(seps[k]); const out = []; let cur = ''; parts.forEach((p, i) => { const piece = p + (i < parts.length - 1 ? seps[k] : ''); if ((cur + piece).length > size && cur) { out.push(cur); cur = ''; } if (piece.length > size) out.push(...split(piece, k + 1)); else cur += piece; }); if (cur) out.push(cur); return out; }; return split(text, 0).map((x) => x.trim()).filter(Boolean); }
    if (strat === 'structure') { const secs = text.split(/\n(?=## )/); const title = (text.match(/^# (.*)/) || [, ''])[1]; return secs.map((x) => x.trim()).filter((x) => !/^# [^\n]*$/.test(x)).map((x) => (x.startsWith('## ') ? `[${title} › ${x.split('\n')[0].slice(3)}] ` + x.split('\n').slice(1).join(' ') : x)); }
    if (strat === 'semantic') {
      const ss = sentences(text).filter((x) => !x.startsWith('#')); const bow = (x) => { const m = new Map(); (x.toLowerCase().match(/[a-z]+/g) || []).forEach((w) => { if (w.length > 3) m.set(w.slice(0, 5), (m.get(w.slice(0, 5)) || 0) + 1); }); return m; };
      const cos = (a, b) => { let d = 0; a.forEach((v, k) => (d += v * (b.get(k) || 0))); const n = (m) => Math.sqrt([...m.values()].reduce((x, y) => x + y * y, 0)); return d / (n(a) * n(b) || 1); };
      const out = []; let cur = [ss[0]];
      for (let i = 1; i < ss.length; i++) { const sim = cos(bow(cur.join(' ')), bow(ss[i])); if (sim < 0.12 || cur.join(' ').length + ss[i].length > size * 1.5) { out.push(cur.join(' ')); cur = [ss[i]]; } else cur.push(ss[i]); }
      out.push(cur.join(' ')); return out;
    }
    return [text];
  }
  // keyword score stands in for an embedding retriever
  const terms = (x) => (x.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !['how', 'long', 'do', 'i', 'have', 'to', 'an', 'the', 'a', 'can', 'be', 'of', 'you'].includes(w)).map((w) => w.replace(/(ed|s)$/, ''));
  function retrieve(chunks, q) { const qt = terms(q); const sc = chunks.map((c) => { const ct = terms(c); return qt.reduce((a, t) => a + (ct.includes(t) ? 1 : 0), 0) / Math.sqrt(ct.length + 5); }); return sc.indexOf(Math.max(...sc)); }
  const hasAnswer = (c) => ANSWER.every((a) => c.replace(/\s+/g, ' ').includes(a));
  const STRATS = [['fixed', 'Fixed size + overlap'], ['recursive', 'Recursive separators'], ['sentence', 'Sentence packing'], ['structure', 'Structure-aware'], ['semantic', 'Semantic breakpoints']];

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'One document chunked five ways, with the retrieved chunk highlighted' }); box.appendChild(g);
    const plain = DOC;
    function draw(step) {
      clear(g);
      g.appendChild(s('text', { x: 14, y: 20, 'font-size': 12, text: `Query: “${QUERY}”`, style: 'font-weight:600' }));
      const list = step === 5 ? STRATS : [STRATS[step]];
      list.forEach(([k, name], li) => {
        const chunks = chunk(plain, k, 180, 40), hit = retrieve(chunks, QUERY);
        const y0 = step === 5 ? 40 + li * 64 : 50, W = 530, total = chunks.reduce((a, c) => a + c.length, 0);
        g.appendChild(s('text', { x: 14, y: y0 + 10, 'font-size': 11.5, text: `${name}: ${chunks.length} chunks`, style: 'font-weight:600' }));
        let x = 14, row = 0; const rowW = W;
        chunks.forEach((c, i) => {
          let len = (c.length / total) * rowW * (step === 5 ? 1 : 3);
          while (len > 0) { const take = Math.min(len, 14 + rowW - x); g.appendChild(s('rect', { x, y: y0 + 18 + row * 22, width: Math.max(2, take - 2), height: 16, rx: 3, fill: i === hit ? (hasAnswer(c) ? 'var(--pass)' : 'var(--fail)') : mix(tokColor(i), 30), stroke: i === hit ? 'var(--ink)' : 'none' })); len -= take; x += take; if (x >= 14 + rowW - 1) { x = 14; row++; } }
        });
        if (step < 5) {
          const c = chunks[hit];
          g.appendChild(s('text', { x: 14, y: 200, 'font-size': 11.5, text: 'retrieved chunk:', style: 'font-weight:600' }));
          const words = c.replace(/\n/g, ' ').split(' '); let line = '', ly = 220;
          words.forEach((wd) => { if ((line + wd).length > 78) { g.appendChild(s('text', { x: 14, y: ly, 'font-size': 10.5, text: line })); ly += 15; line = ''; } line += wd + ' '; }); if (line && ly < 330) g.appendChild(s('text', { x: 14, y: ly, 'font-size': 10.5, text: line }));
          g.appendChild(s('text', { x: 14, y: 360, 'font-size': 12, text: hasAnswer(c) ? '✓ contains the full answer (14 days, all parts included)' : '✗ answer is cut or missing', style: `fill:${hasAnswer(c) ? 'var(--pass)' : 'var(--fail)'};font-weight:600` }));
        }
      });
    }
    return { go: draw };
  }

  function lab() {
    const w = widget('Chunk lab', 'Try it', 'Retrieval here uses keyword overlap as a stand-in for embedding search, and the semantic splitter uses word-overlap similarity between adjacent sentences instead of embeddings.');
    const ta = h('textarea', { id: 'chunk-in', rows: 8 }, DOC);
    const st = { strat: 'recursive', size: 200, overlap: 40 };
    const out = h('div', { class: 'tokbox', style: { whiteSpace: 'pre-wrap', lineHeight: 1.6 } }); const ro = readout();
    function draw() {
      const chunks = chunk(ta.value, st.strat, st.size, st.overlap);
      clear(out); chunks.forEach((c, i) => out.appendChild(h('span', { style: { background: mix(tokColor(i), 18, 'var(--paper)'), borderBottom: `2px solid ${tokColor(i)}`, marginRight: '4px', padding: '1px 2px', fontSize: '.86rem' } }, c)));
      const hit = retrieve(chunks, QUERY); const avg = chunks.reduce((a, c) => a + c.length, 0) / chunks.length;
      ro.set([['chunks', chunks.length], ['average length', Math.round(avg) + ' chars'], ['retrieved for the sample query', '#' + (hit + 1)], ['full answer inside?', hasAnswer(chunks[hit]) ? 'yes' : 'no', hasAnswer(chunks[hit]) ? 'var(--pass)' : 'var(--fail)']]);
    }
    ta.addEventListener('input', draw);
    const sg = seg(STRATS, st.strat, (v) => { st.strat = v; draw(); }, 'Strategy');
    const ss = slider({ label: 'target size (chars)', min: 60, max: 600, step: 20, value: st.size, oninput: (v) => { st.size = v; draw(); } });
    const so = slider({ label: 'overlap (fixed only)', min: 0, max: 200, step: 10, value: st.overlap, oninput: (v) => { st.overlap = v; draw(); } });
    w.body.append(sg.el, h('div', { class: 'ctl-row' }, ss.el, so.el), ta, out, ro.el);
    draw();
    return w.el;
  }

  function sweep() {
    const w = widget('Hit rate across strategies and sizes', 'Mechanics', 'For each strategy and size, does the top chunk for the sample query contain the whole answer? One document and one query: a demonstration of the trade-off, not a benchmark.');
    const sizes = [80, 120, 180, 260, 400];
    const g = svg(560, 200);
    STRATS.forEach(([k, n], i) => { g.appendChild(s('text', { x: 150, y: 40 + i * 30, 'text-anchor': 'end', 'font-size': 11.5, text: n })); sizes.forEach((sz, j) => { const ch = chunk(DOC, k, sz, Math.round(sz / 5)); const c = ch[retrieve(ch, QUERY)]; const ok = hasAnswer(c); g.appendChild(s('rect', { x: 160 + j * 76, y: 26 + i * 30, width: 70, height: 22, rx: 4, fill: ok ? mix('var(--pass)', 45) : mix('var(--fail)', 30) })); g.appendChild(s('text', { x: 195 + j * 76, y: 41 + i * 30, 'text-anchor': 'middle', 'font-size': 10.5, text: (ok ? '✓ ' : '✗ ') + Math.round(c.length) + 'ch' })); }); });
    sizes.forEach((sz, j) => g.appendChild(s('text', { x: 195 + j * 76, y: 16, 'text-anchor': 'middle', class: 'lbl', text: 'size ' + sz })));
    w.body.append(g);
    return w.el;
  }

  LLM.mod('23', {
    hook: 'The answer is in the document. Why did retrieval miss it?',
    intro: ['Retrieval works on chunks, not whole documents: embedding models have length limits, a whole document’s vector blurs every topic together, and the context window has a budget. How you cut the document decides whether the right chunk contains the whole answer, half of it, or none.'],
    hero: {
      steps: [
        { title: 'Fixed size with overlap', text: 'Cut every 180 characters with 40 characters of overlap. Simple and predictable, but cuts fall mid-sentence, so the answer can be split across two chunks.' },
        { title: 'Recursive separators', text: 'Try to split on blank lines first, then newlines, then sentences, then spaces, only going finer when a piece is still too big. Chunks follow the document’s natural breaks.' },
        { title: 'Sentence packing', text: 'Never split a sentence; pack whole sentences until the size limit.' },
        { title: 'Structure-aware', text: 'Split on Markdown headings and prepend the document and section title to each chunk, so “14 days” arrives with its context: “Returns policy › Time limits”.' },
        { title: 'Semantic breakpoints', text: 'Embed each sentence and cut where adjacent sentences stop being similar, so each chunk is about one thing.' },
        { title: 'Side by side', text: 'Green: the retrieved chunk holds the full answer. Red: retrieval found the right area but the chunk is incomplete or wrong.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Cut it yourself', widget: lab },
      { title: 'The trade-off', body: ['Small chunks match precisely but lose surrounding context. Large chunks keep context but their vector averages several topics, so they match less sharply, and they spend more of the context budget.', '<b>Parent–child (small-to-big)</b>: index small chunks for matching, then return their larger parent section. <b>Late chunking</b>: embed the whole document with a long-context model first, then pool token vectors per chunk so each chunk vector carries document context. <b>Contextual chunk headers</b>: prepend titles or an LLM-written one-line summary of where the chunk sits. Always carry metadata (source, section, page, date) with each chunk for filtering and citation.', 'Keep tables whole, split code by function or class, and strip navigation boilerplate from HTML.'], widget: sweep },
    ],
    maths: [
      { note: 'Fixed-size chunk count for a document of length n with size c and overlap o:', tex: 'N_{\\text{chunks}}=\\Big\\lceil\\frac{n-o}{c-o}\\Big\\rceil' },
      { note: 'Semantic breakpoint between sentences i and i+1 when similarity drops below a threshold θ (often a percentile of all adjacent similarities):', tex: '\\text{cut if}\\ \\cos(e_i,e_{i+1})<\\theta' },
    ],
    leaves: ['One short document and one question cannot rank strategies in general; measure hit rate on your own corpus and questions.', 'Keyword scoring stands in for an embedding model here.', 'Token counts, not characters, set real limits.'],
    quiz: [
      { q: 'Why add a section title to each chunk?', opts: ['To make chunks longer', 'So a chunk carries the context it needs to match and be understood on its own', 'It is required by vector databases', 'To reduce storage'], a: 1, why: '“14 days” means little alone; “Returns policy › Time limits” makes it findable and interpretable.' },
      { q: 'A 2,000-character document, chunk size 500, overlap 100. How many fixed-size chunks?', opts: ['4', '5', '6', '20'], a: 1, why: '⌈(2000 − 100)/(500 − 100)⌉ = ⌈4.75⌉ = 5.' },
      { q: 'What does small-to-big retrieval do?', opts: ['Uses bigger embeddings', 'Matches on small chunks, then returns their larger parent for context', 'Splits big documents into tiny ones only', 'Retrieves more chunks'], a: 1, why: 'Precision from the small chunk, context from the parent.' },
    ],
  });
})();
