(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, mix, tokColor } = LLM.util;
  // 8x8 patch "photo": sky, sun, house, grass
  const IMG = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => {
    if (r <= 1 && c >= 5 && c <= 6) return 'var(--warn)';
    if (r >= 6) return 'var(--pass)';
    if (r >= 3 && r <= 5 && c >= 1 && c <= 4) return r === 3 ? 'var(--fail)' : c === 2 && r === 5 ? 'var(--ink)' : 'var(--k)';
    return 'var(--q)';
  }));
  const ATT = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r >= 3 && r <= 5 && c >= 1 && c <= 4 ? (r === 3 ? 0.9 : 0.6) : 0.04)));

  function heroInit(box) {
    const g = svg(560, 380, { 'aria-label': 'An image cut into patches that join the text token queue' }); box.appendChild(g);
    function draw(step) {
      clear(g);
      const cs = 24, ox = 14, oy = 40, gap = step >= 1 ? 3 : 0;
      g.appendChild(s('text', { x: ox, y: 24, 'font-size': 12.5, text: ['A 224 × 224 photo', 'Cut into 16 × 16-pixel patches (8 × 8 drawn)', 'Each patch → one vector (a token)', 'Image tokens join the text queue', 'The question attends to the patches it needs'][step], style: 'font-weight:600' }));
      IMG.forEach((row, r) => row.forEach((c, k) => { const a = step === 4 ? ATT[r][k] : 1; g.appendChild(s('rect', { x: ox + k * (cs + gap), y: oy + r * (cs + gap), width: cs, height: cs, fill: c, style: `opacity:${step === 4 ? 0.25 + a * 0.75 : 0.85}` })); if (step === 4 && a > 0.5) g.appendChild(s('rect', { x: ox + k * (cs + gap), y: oy + r * (cs + gap), width: cs, height: cs, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 })); }));
      if (step >= 2) {
        const qy = 300; g.appendChild(s('text', { x: ox, y: qy - 10, class: 'lbl', text: step >= 3 ? 'one sequence: [image tokens] + [text tokens]' : 'patch embeddings (linear projection of 768 pixel values)' }));
        for (let i = 0; i < 18; i++) { const r = Math.floor(i / 8), c = i % 8; g.appendChild(s('rect', { x: ox + i * 20, y: qy, width: 16, height: 22, rx: 3, fill: IMG[r][c], style: 'opacity:.85' })); }
        g.appendChild(s('text', { x: ox + 18 * 20 + 2, y: qy + 16, 'font-size': 12, text: '… 64' }));
        if (step >= 3) ['What', 'colour', 'is', 'the', 'roof', '?'].forEach((t, i) => { g.appendChild(s('rect', { x: ox + 410 + (i % 3) * 46, y: qy - 30 + Math.floor(i / 3) * 30, width: 42, height: 22, rx: 4, fill: mix(tokColor(i), 30), stroke: tokColor(i) })); g.appendChild(s('text', { x: ox + 431 + (i % 3) * 46, y: qy - 15 + Math.floor(i / 3) * 30, 'text-anchor': 'middle', 'font-size': 10, text: t })); });
        if (step >= 2 && step < 3) g.appendChild(s('text', { x: ox, y: qy + 46, class: 'lbl', text: '224/16 = 14, so a real ViT makes 14 × 14 = 196 tokens.' }));
      }
      if (step === 4) { g.appendChild(s('text', { x: 260, y: 90, 'font-size': 12, text: '“roof” → red patches: 0.9' })); g.appendChild(s('text', { x: 260, y: 110, 'font-size': 12, text: 'house walls: 0.6, sky: 0.04' })); g.appendChild(s('text', { x: 260, y: 130, class: 'lbl', text: 'illustrative attention weights' })); }
    }
    return { go: draw };
  }

  function tokenBudget() {
    const w = widget('Image-token budget', 'Try it');
    const st = { W: 1024, H: 768, p: 14, tile: 448, tiling: true, merge: 2 };
    const ro = readout(); const sl = {};
    const mk = (k, l, a, b, step) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], oninput: (v) => { st[k] = v; draw(); } }));
    mk('W', 'image width (px)', 224, 4096, 32); mk('H', 'image height (px)', 224, 4096, 32); mk('p', 'patch size (px)', 8, 32, 2); mk('tile', 'tile size (px)', 224, 1024, 32); mk('merge', 'merge patches k×k after encoder', 1, 4, 1);
    const tg = seg([[true, 'tiles + thumbnail'], [false, 'resize to one tile']], true, (v) => { st.tiling = v; draw(); }, 'High-res');
    function draw() {
      const per = Math.pow(Math.floor(st.tile / st.p) / st.merge, 2);
      const tiles = st.tiling ? Math.ceil(st.W / st.tile) * Math.ceil(st.H / st.tile) + 1 : 1;
      const tok = Math.round(per * tiles);
      ro.set([['tokens per tile', Math.round(per)], ['tiles', tiles + (st.tiling ? ' (incl. thumbnail)' : '')], ['image tokens', tok.toLocaleString()], ['≈ text-equivalent words', human(tok * 0.75)], ['images in a 128k context', Math.floor(128000 / tok)]]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el), h('div', { class: 'ctl' }, h('label', null, 'high resolution'), tg.el)), ro.el, h('p', { class: 'note-sim' }, 'Generic tiling scheme similar to LLaVA-NeXT-style “AnyRes”; each vendor counts image tokens differently, so check its documentation for billing.'));
    draw();
    return w.el;
  }

  function audio() {
    const w = widget('Waveform → spectrogram → audio tokens', 'Try it', 'Synthetic 1-second signal at 8 kHz: a rising chirp plus a steady 1 kHz tone. Spectrogram by short-time DFT in your browser (256-sample frames, hop 128).');
    const SR = 8000, N = SR; const sig = new Float32Array(N);
    for (let i = 0; i < N; i++) { const t = i / SR; sig[i] = 0.6 * Math.sin(2 * Math.PI * (300 * t + 1100 * t * t)) + 0.35 * Math.sin(2 * Math.PI * 1000 * t); }
    const F = 256, HOP = 128, frames = Math.floor((N - F) / HOP), bins = 48;
    const spec = []; for (let f = 0; f < frames; f++) { const row = []; for (let k = 0; k < bins; k++) { let re = 0, im = 0; for (let n = 0; n < F; n++) { const wv = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (F - 1)), x = sig[f * HOP + n] * wv, a = (2 * Math.PI * k * n) / F; re += x * Math.cos(a); im -= x * Math.sin(a); } row.push(Math.log10(1e-3 + Math.hypot(re, im))); } spec.push(row); }
    let view = 'wave'; const g = svg(560, 220); const ro = readout();
    function draw() {
      clear(g);
      if (view === 'wave') { let d = ''; for (let i = 0; i < 800; i++) d += (i ? 'L' : 'M') + (10 + i * 0.675) + ',' + (110 - sig[i * 2] * 80); g.appendChild(s('path', { d, fill: 'none', stroke: 'var(--q)', 'stroke-width': 1 })); g.appendChild(s('text', { x: 10, y: 214, class: 'lbl', text: 'first 0.2 s of waveform: 8,000 samples per second' })); }
      else { const mx = Math.max(...spec.flat()), mn = Math.min(...spec.flat()), cw = 540 / frames, chh = 190 / bins; spec.forEach((row, f) => row.forEach((v, k) => g.appendChild(s('rect', { x: 10 + f * cw, y: 195 - (k + 1) * chh, width: cw + 0.3, height: chh + 0.3, fill: mix('var(--t4)', ((v - mn) / (mx - mn)) * 100, 'var(--surface)') })))); g.appendChild(s('text', { x: 10, y: 214, class: 'lbl', text: 'time → (frames), frequency ↑ (0–1.5 kHz shown). The chirp rises; the 1 kHz tone is flat.' })); if (view === 'tokens') for (let f = 0; f < frames; f += 4) g.appendChild(s('rect', { x: 10 + f * (540 / frames), y: 2, width: (540 / frames) * 4 - 1, height: 10, rx: 2, fill: tokColor(f / 4) })); }
      ro.set(view === 'tokens' ? [['audio tokens (one per 4 frames, 1 codebook)', Math.ceil(frames / 4)], ['per second at this rate', Math.ceil(frames / 4)], ['typical neural codecs', '≈ 12–75 frames/s × several codebooks']] : [['samples', N.toLocaleString()], ['frames', frames], ['frequency bins shown', bins]]);
    }
    const sg = seg([['wave', 'Waveform'], ['spec', 'Spectrogram'], ['tokens', 'Audio tokens']], view, (v) => { view = v; draw(); }, 'View');
    w.body.append(sg.el, g, ro.el);
    draw();
    return w.el;
  }

  LLM.mod('19', {
    hook: 'How does a model that reads tokens look at a photo or listen to a voice?',
    intro: ['The trick is to turn every modality into tokens: vectors in the same sequence the transformer already processes. An image becomes a grid of patch vectors, audio becomes frames of a spectrogram or codes from a neural codec, and video becomes sampled frames. The language model then attends across all of them at once.'],
    hero: {
      steps: [
        { title: 'Pixels', text: 'An image is a grid of pixel values. Far too many to treat each as a token: 224 × 224 × 3 = 150,528 numbers.' },
        { title: 'Patches', text: 'A Vision Transformer cuts it into 16 × 16 patches. Each patch is flattened and linearly projected to one vector.', mech: 'Image [224, 224, 3] → [196 patches, 768 values] → [196, d_model].' },
        { title: 'Patch tokens', text: 'A vision encoder (CLIP, SigLIP) processes the patches with attention, then a projector maps them into the language model’s embedding space.' },
        { title: 'One queue', text: 'Image tokens and text tokens form one sequence. The LLM does not need to know which came from where; position embeddings mark 2-D layout.' },
        { title: 'Looking where it matters', text: 'When the question mentions the roof, attention from those text tokens concentrates on the roof patches.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'Three ways to join vision to a language model', body: [
        '<b>Projector (LLaVA-style).</b> A frozen vision encoder plus a small MLP that maps its outputs into the LLM’s token space. Cheap to train.',
        '<b>Cross-attention (Flamingo-style).</b> Extra cross-attention layers inside the LLM read image features; the text stream stays separate.',
        '<b>Native early fusion.</b> Train one model from the start on interleaved image and text tokens, sometimes with discrete image tokens so it can also generate images.',
        '<b>High resolution</b> needs many tokens, so models tile big images, add a low-res thumbnail and merge neighbouring patches. That makes documents, charts and screenshots readable without a separate OCR step.',
        '<b>Generation.</b> Diffusion models denoise images from noise conditioned on text (often via CLIP-like embeddings); autoregressive models predict discrete image tokens one by one. Multimodal benchmarks such as MMMU test reasoning across both.',
      ], widget: tokenBudget },
      { title: 'Audio and video', body: ['Speech encoders (Whisper) read log-mel spectrograms. Neural audio codecs compress sound into discrete codes at a few dozen frames per second, so speech-to-speech models can read and write audio tokens directly. Video is usually sampled frames, each tokenised like an image, which is why long videos are expensive.'], widget: audio },
    ],
    maths: [
      { note: '<b>Patch embedding</b>: image of H × W pixels with patch size p gives N tokens:', tex: 'N=\\frac{H}{p}\\cdot\\frac{W}{p},\\qquad z_i=W_E\\,\\mathrm{flatten}(x_{\\text{patch }i})+e^{\\text{pos}}_i' },
      { note: '<b>Short-time Fourier transform</b> for frame m with window w:', tex: 'X(m,k)=\\sum_{n=0}^{F-1}x[mH+n]\\,w[n]\\,e^{-2\\pi i kn/F}' },
    ],
    leaves: ['The 8 × 8 “photo” and its attention weights are drawn for illustration.', 'Vendors count image tokens with their own formulas.', 'Video models use temporal compression and frame sampling strategies not shown here.'],
    quiz: [
      { q: 'A 336 × 336 image with 14-pixel patches gives how many patch tokens?', opts: ['336', '576', '1,024', '24'], a: 1, why: '336/14 = 24, and 24 × 24 = 576.' },
      { q: 'In a LLaVA-style model, what does the projector do?', opts: ['Generates images', 'Maps vision-encoder outputs into the LLM’s embedding space', 'Compresses audio', 'Tokenises text'], a: 1, why: 'It is a small MLP bridging the two models’ vector spaces.' },
      { q: 'Why do high-resolution documents cost many tokens?', opts: ['Text is hard', 'Tiling multiplies patches: every tile adds hundreds of tokens', 'They are converted to audio', 'They need two models'], a: 1, why: 'Tokens scale with area divided by patch area, times the number of tiles.' },
    ],
  });
})();
