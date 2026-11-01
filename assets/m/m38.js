(function () {
  const { h, s, svg, clear, slider, seg, widget, readout, fmt, human, mix, diagram, tokColor } = LLM.util;

  function heroInit(box) {
    const nodes = [
      { id: 'u', x: 6, y: 120, w: 70, h: 40, label: 'request', color: 'var(--res)', shape: 'pill' },
      { id: 'gw', x: 96, y: 120, w: 76, h: 40, label: 'gateway', sub: 'auth, limits', color: 'var(--q)' },
      { id: 'c', x: 192, y: 120, w: 76, h: 40, label: 'cache', sub: 'prompt / semantic', color: 'var(--kv)' },
      { id: 'r', x: 288, y: 120, w: 76, h: 40, label: 'router', sub: 'model choice', color: 'var(--t4)' },
      { id: 'm1', x: 384, y: 70, w: 84, h: 40, label: 'small model', color: 'var(--accent)' },
      { id: 'm2', x: 384, y: 170, w: 84, h: 40, label: 'large model', sub: 'vLLM / SGLang', color: 'var(--accent)' },
      { id: 'log', x: 488, y: 120, w: 66, h: 40, label: 'logger', sub: 'traces', color: 'var(--res)' },
    ];
    const d = diagram(560, 300, nodes, [['u', 'gw'], ['gw', 'c'], ['c', 'r'], ['r', 'm1'], ['r', 'm2'], ['m1', 'log'], ['m2', 'log']], 'Request path through an LLM serving stack');
    box.appendChild(d.el);
    const S = [
      { flow: [['u', 'gw']], hot: ['gw'], ttft: 4, cost: 0, note: 'Gateway: authenticate, apply rate limits and budgets, redact secrets.' },
      { flow: [['gw', 'c']], hot: ['c'], ttft: 6, cost: 0, note: 'Cache: prompt-prefix cache cuts prefill; a semantic cache can return a stored answer.' },
      { flow: [['c', 'r']], hot: ['r'], ttft: 9, cost: 0, note: 'Router: easy request → small model; fall back to another provider on errors.' },
      { flow: [['r', 'm2']], hot: ['m2'], ttft: 380, cost: 0.0042, note: 'Model server: continuous batching; TTFT = queue + prefill, then tokens stream.' },
      { flow: [['m2', 'log']], hot: ['log'], ttft: 380, cost: 0.0042, note: 'Logger: trace spans, token counts and cost go to dashboards and online evals.' },
    ];
    return { go(i) { const st = S[i]; d.draw({ flow: st.flow, hot: st.hot, notes: [[10, 30, st.note, 'font-weight:600'], [10, 250, `TTFT so far ${st.ttft} ms`, ''], [200, 250, `tokens in/out 1,240 / ${i >= 3 ? 310 : 0}`, ''], [420, 250, `cost $${st.cost.toFixed(4)}`, '']] }); } };
  }

  function servingSim() {
    const w = widget('Serving simulator', 'Try it', 'Roofline-style estimate: decode is memory-bound (each step reads all weights plus the batch’s KV cache), prefill is compute-bound at the MFU you set. Real servers lose time to scheduling, kernels and queueing.');
    const st = { P: 8, bits: 16, B: 32, inT: 1500, outT: 300, bw: 3.35, tflops: 990, mfu: 0.45, price: 4 };
    const sl = {}; const ro = readout();
    const mk = (k, l, a, b, step, f) => (sl[k] = slider({ label: l, min: a, max: b, step, value: st[k], fmt: f, oninput: (v) => { st[k] = v; draw(); } }));
    mk('P', 'model params (B)', 1, 405, 1); mk('bits', 'weight bits', 4, 16, 4); mk('B', 'concurrent requests (batch)', 1, 256, 1); mk('inT', 'input tokens', 50, 32000, 50, human); mk('outT', 'output tokens', 10, 4000, 10); mk('bw', 'memory bandwidth (TB/s)', 0.5, 8, 0.05, (v) => v.toFixed(2)); mk('tflops', 'peak dense TFLOP/s', 100, 2500, 10); mk('mfu', 'prefill MFU', 0.1, 0.7, 0.05, (v) => v.toFixed(2)); mk('price', 'GPU $/hour', 0.5, 12, 0.25, (v) => '$' + v.toFixed(2));
    function draw() {
      const W = st.P * 1e9 * st.bits / 8, kvPerTok = 2 * 32 * 8 * 128 * 2 * (st.P / 8) ** 0.5;
      const ctx = st.inT + st.outT / 2;
      const tpot = (W + st.B * ctx * kvPerTok) / (st.bw * 1e12);
      const prefill = (2 * st.P * 1e9 * st.inT) / (st.tflops * 1e12 * st.mfu);
      const reqTime = prefill * st.B + st.outT * tpot; // batch prefills sequentially, then decodes together
      const thr = (st.B * st.outT) / reqTime;
      const cost1k = (st.price / 3600) * (reqTime / st.B) * 1000;
      ro.set([['time to first token', fmt(prefill * 1000, 0) + ' ms (alone)'], ['time per output token', fmt(tpot * 1000, 1) + ' ms'], ['output tokens/s per GPU', Math.round(thr).toLocaleString()], ['cost per 1k requests', '$' + cost1k.toFixed(2)]]);
    }
    w.body.append(h('div', { class: 'ctl-row' }, Object.values(sl).map((x) => x.el)), ro.el, h('p', { class: 'muted', style: { fontSize: '.92rem' } }, 'Try raising the batch: time per token barely moves (weights are read once per step for everyone) while throughput and cost per request improve, until the KV cache traffic starts to dominate.'));
    draw();
    return w.el;
  }

  function traceExplorer() {
    const w = widget('Trace explorer', 'Try it', 'A written example trace for one request through an agent with retrieval and a tool call.');
    const spans = [['gateway', 0, 6, 0], ['cache lookup', 6, 9, 0], ['retrieve (vector + BM25)', 9, 120, 1], ['rerank', 120, 210, 1], ['LLM call 1 (plan + tool call)', 210, 1290, 2], ['tool: get_order', 1290, 1450, 3], ['LLM call 2 (answer, streamed)', 1450, 3380, 2], ['online eval: faithfulness', 3380, 3900, 4]];
    const details = { 'LLM call 1 (plan + tool call)': 'model: large · in 3,812 tok (2,950 cached) · out 64 tok · TTFT 410 ms · $0.0031', 'LLM call 2 (answer, streamed)': 'model: large · in 4,020 tok (3,812 cached) · out 286 tok · TTFT 220 ms · $0.0049', 'tool: get_order': 'status 200 · 160 ms · 1.2 KB result trimmed to 340 tokens', 'retrieve (vector + BM25)': '40 + 40 candidates, fused to 50', 'rerank': 'cross-encoder, 50 pairs, top 6 kept', 'online eval: faithfulness': 'LLM judge score 0.92 (async, not on the user’s path)' };
    const g = svg(560, 230); const det = h('p', { class: 'mono', style: { fontSize: '.85rem' } }, 'Click a span.');
    const T = 3900, fx = (t) => 160 + (t / T) * 390;
    spans.forEach(([n, a, b, c], i) => { const y = 10 + i * 26; g.appendChild(s('text', { x: 154, y: y + 14, 'text-anchor': 'end', 'font-size': 10.5, text: n })); const r = s('rect', { x: fx(a), y: y + 2, width: Math.max(3, fx(b) - fx(a)), height: 18, rx: 3, fill: tokColor(c), style: 'cursor:pointer', tabindex: 0 }); const show = () => (det.textContent = `${n}: ${b - a} ms. ${details[n] || ''}`); r.addEventListener('click', show); r.addEventListener('focus', show); g.appendChild(r); });
    g.appendChild(s('text', { x: 160, y: 226, class: 'lbl', text: '0 ms' })); g.appendChild(s('text', { x: 550, y: 226, 'text-anchor': 'end', class: 'lbl', text: '3.9 s' }));
    w.body.append(g, det);
    return w.el;
  }

  LLM.mod('38', {
    hook: 'The prototype works. What does it take to serve it to a million users?',
    intro: ['LLMOps is the lifecycle from prototype to production: versioning prompts and configs, serving models efficiently, routing between them, caching, observing every request, evaluating quality online, and controlling cost. Most of it is ordinary operations practice, adapted to systems whose outputs are probabilistic and whose cost scales with tokens.'],
    hero: { steps: [
      { title: 'Gateway', text: 'One entry point for authentication, rate limits, per-team budgets and redaction.' },
      { title: 'Cache', text: 'Prompt caching reuses the KV cache for a repeated prefix; semantic caching returns a stored answer for a near-duplicate question.' },
      { title: 'Router', text: 'Send easy requests to a cheaper model, hard ones to a stronger one, and fail over when a provider errors.' },
      { title: 'Model server', text: 'Engines such as vLLM, SGLang, TGI and llama.cpp batch requests continuously. Latency splits into time to first token and time per output token.' },
      { title: 'Logging', text: 'Every request leaves a trace: spans, tokens, cost, latency and evaluation scores.' },
    ], init: heroInit },
    sections: [
      { title: 'Latency and cost', body: ['<b>TTFT</b> (time to first token) is dominated by queueing and prefill; <b>TPOT</b> (time per output token) by memory bandwidth during decode; <b>throughput</b> is total tokens per second across users. Batching trades a little latency for much more throughput.'], widget: servingSim },
      { title: 'Observability', widget: traceExplorer },
      { title: 'The lifecycle', body: ['<b>Versioning</b>: prompts, tools, models and retrieval configs are versioned together, with experiment tracking and a model registry. <b>CI for prompts and agents</b>: run the eval set on every change. <b>Online evals and feedback</b>: sample live traffic for LLM-judge scoring and collect thumbs up/down. <b>Drift and regression detection</b>: watch score distributions, refusal rates and cost per request; provider model updates can shift behaviour. <b>Cost control</b>: caching, routing, shorter prompts, output limits and batch APIs for offline work.'] },
    ],
    maths: [
      { note: 'Roofline estimates for decode and prefill with N parameters, b bytes per weight, bandwidth BW and compute F at utilisation u:', tex: '\\mathrm{TPOT}\\approx\\frac{N\\,b+B\\cdot\\text{KV bytes}}{BW},\\qquad \\mathrm{TTFT}_{\\text{prefill}}\\approx\\frac{2N\\cdot n_{in}}{F\\cdot u}' },
      { note: 'Throughput and cost per request:', tex: '\\text{tokens/s}=\\frac{B}{\\mathrm{TPOT}},\\qquad \\text{cost}=\\frac{\\text{price/hour}}{3600}\\times\\frac{\\text{request time}}{B}' },
    ],
    leaves: ['The simulator ignores queueing, scheduling overhead, speculative decoding and tensor parallelism.', 'The trace is written for illustration.', 'API pricing for hosted models follows the provider’s per-token rates, not GPU hours.'],
    quiz: [
      { q: 'Why does decode speed depend mostly on memory bandwidth?', opts: ['Decoding uses no compute', 'Each step reads all weights to produce one token per sequence', 'Tokens are large', 'Bandwidth sets the vocabulary'], a: 1, why: 'Low arithmetic per byte read makes decode memory-bound; batching shares each read across users.' },
      { q: 'Which metric does a long prompt hurt most?', opts: ['TPOT', 'TTFT', 'Vocabulary size', 'None'], a: 1, why: 'Prefill grows with input length; prompt caching helps.' },
      { q: 'What does a semantic cache do?', opts: ['Caches weights', 'Returns a stored answer for a sufficiently similar earlier request', 'Caches the KV cache only', 'Speeds up training'], a: 1, why: 'Embedding similarity matches near-duplicates; tune the threshold carefully.' },
    ],
  });
})();
