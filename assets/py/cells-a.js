/* Python cells, Parts 1–2 (Modules 0–9). Each reproduces a figure from its module. */
(window.PY_CELLS = window.PY_CELLS || {}), Object.assign(window.PY_CELLS, {
'0': { title: 'Dot products, cosine and softmax', note: 'The primer’s three workhorses. Change the vectors or the temperature and run again.', code:
`import numpy as np
import viz

a = np.array([2.0, 1.0])
b = np.array([1.0, 2.0])
cos = a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
print(f"a · b = {a @ b:.2f}   cos θ = {cos:.3f}   θ = {np.degrees(np.arccos(cos)):.1f}°")

def softmax(z, T=1.0):
    e = np.exp((z - z.max()) / T)        # subtract the max for numerical stability
    return e / e.sum()

z = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
for T in (0.5, 1.0, 2.0):
    print(f"T = {T}:", softmax(z, T).round(3))

viz.bars(["Paris", "Lyon", "France", "the", "banana"], softmax(z, 1.0), title="softmax(z) at T = 1")` },

'0-kl': { title: 'Fit one Gaussian to two humps, both ways', note: 'Grid-searches the mean and width of Q that minimise forward and reverse KL, exactly like the widget.', code:
`import numpy as np
import viz

x = np.linspace(-6, 6, 241); dx = x[1] - x[0]
gauss = lambda m, s: np.exp(-0.5 * ((x - m) / s) ** 2) / (s * np.sqrt(2 * np.pi))
P = 0.5 * gauss(-2.6, 0.7) + 0.5 * gauss(2.4, 0.8)

def kl(p, q):
    mask = p > 1e-10
    return np.sum(p[mask] * np.log((p[mask] + 1e-12) / (q[mask] + 1e-12))) * dx

fits = {}
for name, f in [("forward KL(P||Q)", lambda q: kl(P, q)), ("reverse KL(Q||P)", lambda q: kl(q, P))]:
    fits[name] = min((f(gauss(m, s)), m, s) for m in np.arange(-4, 4.01, 0.1) for s in np.arange(0.3, 4.01, 0.1))
    v, m, s = fits[name]
    print(f"{name}: mean {m:+.1f}, width {s:.1f}, KL = {v:.3f}")

(_, mf, sf), (_, mr, sr) = fits.values()
viz.line(x, P, gauss(mf, sf), gauss(mr, sr), labels=["P", "forward fit (covers both)", "reverse fit (picks one)"], title="P and the two best Gaussians")` },

'1': { title: 'Gradient descent from scratch', note: 'Fits y = w·x + b with hand-written gradients. Try lr = 1.2 to watch it diverge.', code:
`import numpy as np
import viz

rng = np.random.default_rng(0)
X = rng.uniform(-1, 1, 200)
y = 3.0 * X + 0.5 + rng.normal(0, 0.1, 200)

w, b, lr = 0.0, 0.0, 0.5
losses = []
for step in range(60):
    err = (w * X + b) - y
    losses.append(np.mean(err ** 2))
    dw = 2 * np.mean(err * X)            # dL/dw by the chain rule
    db = 2 * np.mean(err)                # dL/db
    w, b = w - lr * dw, b - lr * db

print(f"learned w = {w:.3f} (true 3.0), b = {b:.3f} (true 0.5), final loss {losses[-1]:.4f}")
steps = 60 * int(np.ceil(len(X) / 32))
print(f"with mini-batches of 32 over 60 epochs that would be {steps} optimiser steps")
viz.line(range(60), losses, labels=["mean squared error"], title="loss per step", logy=True, xlabel="step")` },

'2': { title: 'Vanishing gradients in a real RNN', note: 'Multiplies the actual Jacobians of a random tanh RNN through time and compares with 0.9^t.', code:
`import numpy as np
import viz

rng = np.random.default_rng(1)
d, T = 16, 60
W = rng.normal(0, 1, (d, d))
W *= 0.9 / np.max(np.abs(np.linalg.eigvals(W)))    # spectral radius 0.9

h, J, norms = np.zeros(d), np.eye(d), []
for t in range(T):
    h = np.tanh(W @ h + rng.normal(0, 1, d))
    J = np.diag(1 - h ** 2) @ W @ J                 # d h_t / d h_0
    norms.append(np.linalg.norm(J, 2))

print("gradient size after 10, 30, 60 steps:", [f"{norms[i]:.1e}" for i in (9, 29, 59)])
t = np.arange(1, T + 1)
viz.line(t, norms, 0.9 ** t, labels=["‖∂h_t/∂h_0‖ (measured)", "0.9^t"], title="gradient through time", logy=True, xlabel="steps back")` },

'3': { title: 'Train BPE on a tiny corpus', note: 'The classic low / lower / newest / widest example, in plain Python.', code:
`from collections import Counter

corpus = {"low": 5, "lower": 2, "newest": 6, "widest": 3}
words = {tuple(w) + ("_",): f for w, f in corpus.items()}

def pair_counts(words):
    c = Counter()
    for w, f in words.items():
        for a, b in zip(w, w[1:]):
            c[a, b] += f
    return c

def merge(words, pair):
    out = {}
    for w, f in words.items():
        i, new = 0, []
        while i < len(w):
            if i < len(w) - 1 and (w[i], w[i + 1]) == pair:
                new.append(w[i] + w[i + 1]); i += 2
            else:
                new.append(w[i]); i += 1
        out[tuple(new)] = f
    return out

for step in range(1, 8):
    counts = pair_counts(words)
    best = max(counts, key=lambda p: (counts[p], [-ord(ch) for ch in p[0] + p[1]]))
    words = merge(words, best)
    print(f"merge {step}: {best[0]!r} + {best[1]!r} (x{counts[best]}) ->", [" ".join(w) for w in words])` },

'4': { title: 'Analogies and the RoPE invariance', note: 'Toy 4-D vectors (royal, female, finance, nature), then a numeric check that RoPE scores depend only on m − n.', code:
`import numpy as np
import viz

E = {"king": [.9, -.8, .1, 0], "queen": [.9, .8, .1, 0], "man": [.1, -.8, 0, .1], "woman": [.1, .8, 0, .1],
     "prince": [.7, -.75, .05, 0], "girl": [0, .7, 0, .1], "money": [0, 0, .9, -.1], "river": [0, 0, -.1, .9]}
E = {k: np.array(v) for k, v in E.items()}
cos = lambda a, b: a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
target = E["king"] - E["man"] + E["woman"]
ranked = sorted(((cos(target, v), w) for w, v in E.items() if w not in ("king", "man", "woman")), reverse=True)
print("king - man + woman ≈", ranked[0][1], f"(cos {ranked[0][0]:.3f})")

def rope(v, pos, base=10000.0):
    out = v.copy()
    for i in range(0, len(v), 2):
        th = pos * base ** (-i / len(v))
        out[i], out[i + 1] = v[i] * np.cos(th) - v[i + 1] * np.sin(th), v[i] * np.sin(th) + v[i + 1] * np.cos(th)
    return out

rng = np.random.default_rng(0); q, k = rng.normal(size=8), rng.normal(size=8)
for shift in (0, 7, 100):
    print(f"q at {5 + shift}, k at {2 + shift}:  score = {rope(q, 5 + shift) @ rope(k, 2 + shift):.6f}")
viz.bars(*zip(*[(w, s) for s, w in ranked]), title="cosine to king − man + woman")` },

'5': { title: 'Scaled dot-product attention, by hand', note: 'Five tokens, d = 4, causal mask. Prints every intermediate shape and draws the attention matrix.', code:
`import numpy as np
import viz

rng = np.random.default_rng(5)
toks = ["the", "cat", "sat", "on", "mat"]
X = rng.normal(0, 0.6, (5, 4))                       # [seq, d_model]
Wq, Wk, Wv = (rng.normal(0, 0.9, (4, 4)) for _ in range(3))
Q, K, V = X @ Wq, X @ Wk, X @ Wv
scores = Q @ K.T / np.sqrt(4)                        # [5, 5]
scores[np.triu_indices(5, k=1)] = -np.inf             # causal mask
A = np.exp(scores - scores.max(1, keepdims=True))
A /= A.sum(1, keepdims=True)                          # softmax per row
out = A @ V                                           # [5, 4]
print("X", X.shape, "-> Q,K,V", Q.shape, "-> scores", scores.shape, "-> out", out.shape)
print("rows sum to", A.sum(1).round(6))

d, L = 768, 12
print(f"GPT-2 small blocks: 12·d²·L = {12 * d * d * L / 1e6:.1f}M parameters")
viz.heatmap(A.round(2), rows=toks, cols=toks, title="attention weights (row = query)")` },

'6': { title: 'Three attention masks', note: 'Builds the encoder, decoder and prefix-LM masks and counts who can see whom.', code:
`import numpy as np
import viz

n = 6
bidirectional = np.ones((n, n), dtype=int)
causal = np.tril(np.ones((n, n), dtype=int))
prefix = causal.copy(); prefix[:, :3] = 1                # first 3 tokens fully visible

for name, M in [("encoder (bidirectional)", bidirectional), ("decoder (causal)", causal), ("prefix LM", prefix)]:
    future = int(np.triu(M, 1).sum())
    print(f"{name:24s} visible pairs {M.sum():2d}/36, future peeks {future}")

viz.heatmap(causal, rows=range(1, n + 1), cols=range(1, n + 1), title="causal mask: 1 = may attend")` },

'7': { title: 'Sampling, scaling laws and the KV cache', note: 'Temperature and top-p on a next-token distribution, the Chinchilla loss fit, and KV-cache bytes.', code:
`import numpy as np
import viz

toks = ["Paris", "a", "the", "located", "known", "Lyon", "one"]
logits = np.array([6.2, 3.9, 3.5, 3.1, 2.3, 2.0, 1.8])

def sample_dist(logits, T=1.0, top_p=1.0):
    p = np.exp((logits - logits.max()) / T); p /= p.sum()
    order = np.argsort(-p); keep = order[: np.searchsorted(np.cumsum(p[order]), top_p) + 1]
    q = np.zeros_like(p); q[keep] = p[keep]
    return q / q.sum()

print("T=1:        ", sample_dist(logits).round(3))
print("T=1, p=0.9: ", sample_dist(logits, top_p=0.9).round(3))

L = lambda N, D: 1.69 + 406.4 / N ** 0.34 + 410.7 / D ** 0.28    # Hoffmann et al. 2022 fit
N = 7e9
print(f"7B on 140B tokens: loss {L(N, 140e9):.3f}, compute {6 * N * 140e9:.2e} FLOPs")
kv = 2 * 32 * 8 * 128 * 2                                           # Llama-3-8B-shaped, BF16
print(f"KV cache: {kv / 1024:.0f} KB per token, {kv * 32768 / 2**30:.1f} GiB for 32k tokens")

D = np.logspace(9, 13.5, 40)
viz.line(np.log10(D), L(N, D), labels=["predicted loss, N = 7B"], title="Chinchilla fit", xlabel="log10(training tokens)")` },

'8': { title: 'The KL-regularised RLHF optimum', note: 'Computes π* ∝ π_ref · exp(r/β) exactly and shows reward hacking as β shrinks.', code:
`import numpy as np
import viz

types = ["helpful", "curt", "rambling", "continues text", "confident wrong", "flattering"]
ref   = np.array([.38, .18, .14, .05, .12, .13])        # SFT reference policy
r_rm  = np.array([2.0, 1.0, 0.7, -2.0, -0.4, 1.7])      # learned reward (over-rates flattery)
r_true= np.array([2.0, 1.0, 0.2, -2.0, -1.8, -0.6])     # what we actually wanted

def optimum(beta):
    u = ref * np.exp(r_rm / beta); return u / u.sum()

betas = np.logspace(-1.3, 1, 50)
proxy = [optimum(b) @ r_rm for b in betas]
true  = [optimum(b) @ r_true for b in betas]
for b in (2.0, 0.3, 0.05):
    p = optimum(b); kl = np.sum(p * np.log(p / ref))
    print(f"beta {b:<5} KL {kl:5.2f}  proxy {p @ r_rm:5.2f}  true {p @ r_true:5.2f}  P(flattering) {p[5]:.2f}")

# DPO loss for one preference pair, policy vs reference log-probs
lw, ll, rw, rl, beta = -12.0, -15.0, -13.0, -14.0, 0.1
print("DPO loss:", round(float(-np.log(1 / (1 + np.exp(-beta * ((lw - rw) - (ll - rl)))))), 4))
viz.line(np.log10(betas), proxy, true, labels=["proxy reward", "true quality"], title="reward vs leash strength", xlabel="log10(β)")` },

'9': { title: 'Why self-consistency helps', note: 'If one reasoning sample is right with probability p, how often is the majority of k samples right?', code:
`import numpy as np
from math import comb
import viz

def majority_acc(p, k):
    # probability that more than half of k independent samples are correct (k odd)
    return sum(comb(k, j) * p**j * (1 - p)**(k - j) for j in range(k // 2 + 1, k + 1))

ks = [1, 3, 5, 9, 15, 25, 41]
for p in (0.45, 0.6, 0.75):
    print(f"p = {p}:", [round(majority_acc(p, k), 3) for k in ks])

viz.line(ks, [majority_acc(0.6, k) for k in ks], [majority_acc(0.45, k) for k in ks],
         labels=["single-sample accuracy 0.60", "single-sample accuracy 0.45"], title="majority-vote accuracy", xlabel="samples k")
print("Voting amplifies: it helps when p > 0.5 and hurts when p < 0.5 (with independent errors).")` },
});
