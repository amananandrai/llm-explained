(function () {
  const { h, s, svg, clear, slider, widget, readout, fmt, tokColor, lineChart, tween } = LLM.util;
  const words = ['The', 'keys', 'to', 'the', 'old', 'cabinet', 'are', 'on', 'the', 'table'];

  function heroInit(box) {
    const g = svg(560, 360, { 'aria-label': 'An RNN reads words one at a time while early words fade, then a transformer reads them all at once' }); box.appendChild(g);
    let stop = () => {};
    function rnn(k, decay = 0.72) {
      clear(g);
      g.appendChild(s('text', { x: 20, y: 26, 'font-size': 13, text: 'RNN: one word per time step, one memory vector h', style: 'font-weight:600' }));
      words.forEach((w, i) => {
        const x = 20 + i * 53, on = i <= k;
        g.appendChild(s('rect', { x, y: 50, width: 48, height: 26, rx: 5, fill: on ? tokColor(i) : 'var(--sunk)', style: on ? 'opacity:.9' : '' }));
        g.appendChild(s('text', { x: x + 24, y: 67, 'text-anchor': 'middle', 'font-size': 10.5, text: w, style: on ? 'fill:var(--surface);font-weight:600' : 'fill:var(--muted)' }));
        if (on) {
          const share = Math.pow(decay, k - i);
          g.appendChild(s('rect', { x, y: 110 + (1 - share) * 120, width: 48, height: share * 120, rx: 3, fill: tokColor(i), style: 'opacity:.75' }));
        }
        g.appendChild(s('rect', { x, y: 110, width: 48, height: 120, rx: 3, fill: 'none', stroke: 'var(--rule)' }));
      });
      g.appendChild(s('text', { x: 20, y: 100, class: 'lbl', text: 'how much of each word still survives in h' }));
      if (k >= 0) { const hx = 20 + k * 53; g.appendChild(s('rect', { x: hx - 3, y: 240, width: 54, height: 30, rx: 6, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2 })); g.appendChild(s('text', { x: hx + 24, y: 259, 'text-anchor': 'middle', 'font-size': 12, text: 'h' + (k + 1) })); }
      g.appendChild(s('text', { x: 20, y: 300, 'font-size': 12, text: k >= 9 ? `Predicting the verb after “table” needs “keys” (plural). Only ${(Math.pow(decay, 8) * 100).toFixed(0)}% of it is left.` : `Step ${k + 1}: h${k + 1} = f(h${k}, “${words[Math.max(0, k)]}”)` }));
      g.appendChild(s('text', { x: 20, y: 320, class: 'lbl', text: `Illustrative decay of ${decay} per step. Each step must wait for the one before it.` }));
    }
    function tf(t) {
      clear(g);
      g.appendChild(s('text', { x: 20, y: 26, 'font-size': 13, text: 'Transformer: every word at once, direct lines between any two', style: 'font-weight:600' }));
      words.forEach((w, i) => { const x = 20 + i * 53; g.appendChild(s('rect', { x, y: 230, width: 48, height: 26, rx: 5, fill: tokColor(i), style: `opacity:${0.25 + 0.65 * t}` })); g.appendChild(s('text', { x: x + 24, y: 247, 'text-anchor': 'middle', 'font-size': 10.5, text: w, style: 'fill:var(--surface);font-weight:600' })); });
      const from = 6; // "are"
      [[1, 0.62], [5, 0.12], [9, 0.08], [0, 0.05], [3, 0.03], [8, 0.04], [2, 0.03], [4, 0.03]].forEach(([j, wgt]) => {
        const x1 = 44 + from * 53, x2 = 44 + j * 53, my = 230 - 40 - Math.abs(from - j) * 14;
        g.appendChild(s('path', { d: `M${x1},228 Q${(x1 + x2) / 2},${my - 60} ${x2},228`, fill: 'none', stroke: 'var(--q)', 'stroke-width': 1 + wgt * 9 * t, style: `opacity:${(0.25 + wgt) * t}` }));
      });
      g.appendChild(s('text', { x: 20, y: 290, 'font-size': 12, text: '“are” looks straight back at “keys”: one hop, no fading, whatever the distance.' }));
      g.appendChild(s('text', { x: 20, y: 310, class: 'lbl', text: 'All ten positions are computed in parallel on the GPU. Line widths are illustrative.' }));
    }
    function bottleneck() {
      clear(g);
      g.appendChild(s('text', { x: 20, y: 26, 'font-size': 13, text: 'Seq2seq: the whole sentence squeezed into one vector', style: 'font-weight:600' }));
      words.forEach((w, i) => { const x = 20 + i * 36; g.appendChild(s('rect', { x, y: 60, width: 33, height: 22, rx: 4, fill: tokColor(i), style: 'opacity:.85' })); g.appendChild(s('line', { x1: x + 16, y1: 82, x2: 280, y2: 150, stroke: 'var(--rule)' })); });
      g.appendChild(s('rect', { x: 262, y: 150, width: 36, height: 60, rx: 6, fill: 'var(--res)' }));
      g.appendChild(s('text', { x: 310, y: 185, 'font-size': 12, text: 'one fixed-size context vector c' }));
      ['Les', 'clés', 'du', 'vieux', 'meuble', 'sont', '…'].forEach((w, i) => { const x = 20 + i * 70; g.appendChild(s('line', { x1: 280, y1: 210, x2: x + 30, y2: 268, stroke: 'var(--rule)' })); g.appendChild(s('rect', { x, y: 270, width: 62, height: 22, rx: 4, fill: 'var(--sunk)' })); g.appendChild(s('text', { x: x + 31, y: 285, 'text-anchor': 'middle', 'font-size': 10.5, text: w })); });
      g.appendChild(s('text', { x: 20, y: 325, class: 'lbl', text: 'A 10-word or a 100-word sentence gets the same size c. Bahdanau attention (2014) let the decoder look back at every h.' }));
    }
    return {
      go(i) {
        stop();
        if (i === 0) rnn(0);
        if (i === 1) { let k = 0; rnn(0); const id = setInterval(() => { k++; rnn(k); if (k >= 9) clearInterval(id); }, LLM.util.reduced() ? 0 : 380); if (LLM.util.reduced()) rnn(9); stop = () => clearInterval(id); }
        if (i === 2) rnn(9);
        if (i === 3) bottleneck();
        if (i === 4) stop = tween(900, tf);
      },
    };
  }

  function gradDecay() {
    const w = widget('How fast gradients vanish', 'Try it');
    const ch = lineChart({ w: 560, h: 240 }); const ro = readout();
    const f = slider({ label: 'factor per step |∂hₜ/∂hₜ₋₁|', min: 0.5, max: 1.2, step: 0.01, value: 0.9, fmt: (v) => v.toFixed(2), oninput: draw });
    const T = slider({ label: 'sequence length T', min: 5, max: 200, value: 50, oninput: draw });
    function draw() {
      const pts = Array.from({ length: T.value }, (_, t) => [t + 1, Math.pow(f.value, t + 1)]);
      ch.draw([{ pts, color: f.value > 1 ? 'var(--fail)' : 'var(--grad)', area: true }], { logy: true, ymin: Math.min(1e-8, pts[pts.length - 1][1]), ymax: Math.max(10, pts[pts.length - 1][1]), xlabel: 'steps back in time', ylabel: 'gradient size (log scale)', yfmt: (v) => v.toExponential(0) });
      const last = Math.pow(f.value, T.value);
      ro.set([['gradient after T steps', last.toExponential(2), last < 1e-3 ? 'var(--fail)' : last > 1e3 ? 'var(--fail)' : 'var(--pass)'], ['verdict', last < 1e-3 ? 'vanished' : last > 1e3 ? 'exploded' : 'usable']]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, f.el, T.el), ch.el, ro.el, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, '0.9⁵⁰ ≈ 0.005; 0.9²⁰⁰ ≈ 7 × 10⁻¹⁰. Push the factor above 1 and it explodes instead. LSTMs add a gated cell that keeps the factor near 1 for longer, but not forever.'));
    draw();
    return w.el;
  }

  function gpuTimeline() {
    const w = widget('GPU timeline: sequential vs parallel', 'Try it', 'Simplified: one unit of work per token per layer; ignores memory bandwidth and the n² cost of attention.');
    const g = svg(560, 200); const ro = readout();
    const n = slider({ label: 'tokens', min: 4, max: 32, value: 12, oninput: () => { draw(1); } });
    let stop = () => {};
    function draw(t) {
      clear(g);
      const N = n.value, cw = Math.min(30, 500 / N);
      g.appendChild(s('text', { x: 10, y: 40, 'font-size': 12, text: 'RNN' })); g.appendChild(s('text', { x: 10, y: 130, 'font-size': 12, text: 'Transformer' }));
      for (let i = 0; i < N; i++) {
        const done = Math.min(1, Math.max(0, t * N - i));
        g.appendChild(s('rect', { x: 50 + i * cw, y: 24, width: (cw - 2) * done, height: 24, rx: 3, fill: tokColor(i) }));
        g.appendChild(s('rect', { x: 50, y: 70 + i * (60 / N), width: Math.max(0, (cw - 2) * Math.min(1, t * N)), height: Math.max(1, 60 / N - 1), rx: 1, fill: tokColor(i), transform: 'translate(0,40)' }));
      }
      g.appendChild(s('line', { x1: 50, x2: 50 + N * cw, y1: 180, y2: 180, stroke: 'var(--muted)' }));
      g.appendChild(s('text', { x: 50, y: 196, class: 'lbl', text: 'time →' }));
      ro.set([['RNN time steps', N], ['transformer time steps', 1], ['speed-up (ideal)', N + '×']]);
    }
    const btn = h('button', { class: 'btn primary', type: 'button', onclick: () => { stop(); stop = LLM.util.tween(2400, (t) => draw(t)); } }, 'Run both');
    w.body.append(h('div', { class: 'ctl-row' }, n.el), btn, g, ro.el);
    draw(1);
    return w.el;
  }

  LLM.mod('2', {
    hook: 'Recurrent networks read language for decades. What stopped them scaling?',
    intro: ['A language model predicts the next word from the words before it. Before 2017 the best way to do that was a recurrent network that reads one word at a time and carries a memory vector forward. It hit three walls. Transformers removed all three.'],
    hero: {
      steps: [
        { title: 'Reading one word at a time', text: 'An RNN keeps a single memory vector h. Each new word updates it: new h from old h plus the word.', maths: 'h_t=\\tanh(W_h h_{t-1}+W_x x_t+b)' },
        { title: 'Memory fades', text: 'Watch the bars. Every update squeezes the old memory through the same matrix and tanh, so earlier words lose their share of h step by step.' },
        { title: 'Wall 1 and 2: slow, and forgetful', text: 'Step 10 cannot start until step 9 is done, so the GPU sits mostly idle. And the gradient that would teach the model to remember “keys” must travel back through every step, shrinking or growing each time.', mech: 'The gradient is a product of T − 1 Jacobians. If their size is below 1 it vanishes; above 1 it explodes.', maths: '\\frac{\\partial h_T}{\\partial h_1}=\\prod_{t=2}^{T}\\frac{\\partial h_t}{\\partial h_{t-1}}' },
        { title: 'Wall 3: the bottleneck', text: 'For translation, seq2seq encoded the whole sentence into one vector, then decoded from it. Long sentences overflowed it. Bahdanau attention was the bridge: let the decoder look back at every encoder state.' },
        { title: 'The transformer fix', text: 'Drop recurrence entirely. Every word looks directly at every other word through attention: one hop at any distance, and all positions computed in parallel.', mech: 'Path length between any two tokens is 1 instead of T. Compute per layer is parallel across the sequence; the price is an n × n attention matrix.' },
      ],
      init: heroInit,
    },
    sections: [
      { title: 'From n-grams to LSTMs', body: [
        '<b>N-grams</b> count how often each word follows the previous n − 1 words. They are fast and transparent, but the table explodes with n and cannot generalise: “the cat sat” teaches nothing about “the dog sat”.',
        '<b>RNNs</b> replace the table with a learned function and a dense memory vector, so similar words share what they learn.',
        '<b>LSTMs</b> (1997) add a separate cell state with forget, input and output gates. The cell is updated by addition rather than repeated multiplication, so gradients survive far longer. They powered machine translation until 2017.',
        '<b>Seq2seq with attention</b> (2014) kept the LSTMs but let the decoder compute a weighted average over all encoder states at every step. The transformer asked: what if attention is all you need?',
      ] },
    ],
    maths: [
      { note: 'The RNN update and the gradient through time:', tex: 'h_t=\\tanh(W_h h_{t-1}+W_x x_t+b),\\qquad \\frac{\\partial h_T}{\\partial h_1}=\\prod_{t=2}^{T}\\frac{\\partial h_t}{\\partial h_{t-1}}=\\prod_{t=2}^{T}\\mathrm{diag}\\big(1-h_t^2\\big)\\,W_h' },
      { note: 'Its size is bounded by the largest singular value of W_h, since |tanh′| ≤ 1:', tex: '\\Big\\|\\frac{\\partial h_T}{\\partial h_1}\\Big\\|\\le\\|W_h\\|^{T-1}\\;\\to\\;0 \\quad\\text{if }\\|W_h\\|<1' },
    ],
    tryit: [gradDecay, gpuTimeline],
    leaves: ['The fading bars use a fixed 0.72 decay for illustration. Real RNN memory is a learned, input-dependent vector, and LSTMs can hold some information for hundreds of steps.', 'Transformers pay for parallelism with attention cost that grows with n²; Modules 10–11 cover how that is tamed.', 'State-space models (Mamba, Module 17) revisit recurrence with a design that trains in parallel.'],
    quiz: [
      { q: 'Which RNN limitation does running on a bigger GPU NOT fix?', opts: ['Sequential dependence across time steps', 'Memory size', 'Vocabulary size', 'None, a bigger GPU fixes all of them'], a: 0, why: 'Step t needs h_{t−1}, so the steps cannot run in parallel no matter how many cores you have.' },
      { q: 'With a per-step gradient factor of 0.9, roughly what fraction survives 50 steps?', opts: ['45%', '10%', '0.5%', '0.0001%'], a: 2, why: '0.9⁵⁰ ≈ 0.0052.' },
      { q: 'What did Bahdanau attention fix in seq2seq?', opts: ['Slow training', 'The single fixed-size context vector', 'Tokenisation', 'Exploding gradients'], a: 1, why: 'It let the decoder read a weighted mix of all encoder states instead of one summary vector.' },
    ],
  });
})();
