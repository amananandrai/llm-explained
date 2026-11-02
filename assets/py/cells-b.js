/* Python cells, Parts 3–4 (Modules 10–20). */
(window.PY_CELLS = window.PY_CELLS || {}), Object.assign(window.PY_CELLS, {
'10': { title: 'KV cache by method, and the MLA fold', note: 'Cache size per method, then a numeric check that RoPE breaks MLA’s matrix absorption.', code:
`import numpy as np
import viz

L, H, dh, G, lat, rope_d, r = 60, 128, 128, 8, 512, 64, 16
per = {"MHA": 2 * H * dh, "GQA": 2 * G * dh, "MQA": 2 * dh, "MLA": lat + rope_d, "LRKV": 2 * (dh + H * r)}
ctx, bf16 = 32768, 2
for k, v in per.items():
    print(f"{k:5s} {v:6d} values/token/layer  ->  {v * L * ctx * bf16 / 2**30:6.2f} GiB per 32k-token sequence")

rng = np.random.default_rng(0)
W_uq, W_uk = rng.normal(size=(2, 2)), rng.normal(size=(2, 2))
R = lambda a: np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
fold = lambda n: W_uq.T @ R(5 * 0.6).T @ R(n * 0.6) @ W_uk     # query at 5, key at n
print("folded matrix changes with key position?", not np.allclose(fold(1), fold(9)))
print("without RoPE on the content key it is constant:", W_uq.T @ W_uk)
viz.bars(list(per), list(per.values()), title="values cached per token per layer")` },

'11': { title: 'Speculative decoding and paged memory', note: 'Expected tokens per target pass, and how much memory contiguous vs paged allocation wastes.', code:
`import numpy as np
import viz

def speedup(alpha, k, c):
    expected = (1 - alpha ** (k + 1)) / (1 - alpha)
    return expected / (k * c + 1), expected

for a in (0.6, 0.8, 0.9):
    best = max(range(1, 13), key=lambda k: speedup(a, k, 0.05)[0])
    s, e = speedup(a, best, 0.05)
    print(f"alpha {a}: best k = {best}, {e:.2f} tokens per pass, {s:.2f}x faster")

rng = np.random.default_rng(1)
lengths = rng.integers(200, 8192, 100)          # 100 conversations
max_ctx, block = 8192, 16
contiguous = 100 * max_ctx
paged = int(np.sum(np.ceil(lengths / block) * block))
print(f"tokens used {lengths.sum():,}; reserved contiguous {contiguous:,}; paged {paged:,}")
print(f"waste: contiguous {1 - lengths.sum() / contiguous:.0%}, paged {1 - lengths.sum() / paged:.1%}")
ks = range(1, 13)
viz.line(list(ks), [speedup(0.8, k, 0.05)[0] for k in ks], labels=["alpha = 0.8, draft cost 5%"], title="speed-up vs draft length", xlabel="k")` },

'12': { title: 'Top-k routing and the balance loss', note: 'Routes 4,096 tokens to 8 experts with a biased router, then evens the load with a per-expert bias.', code:
`import numpy as np
import viz

rng = np.random.default_rng(2)
N, E, k = 4096, 8, 2
logits = rng.normal(size=(N, E)) + np.r_[1.5, 1.5, np.zeros(E - 2)]   # router favours experts 0 and 1

def route(bias):
    top = np.argsort(-(logits + bias), axis=1)[:, :k]
    return np.bincount(top.ravel(), minlength=E)

def balance_loss(load):
    probs = np.exp(logits); probs /= probs.sum(1, keepdims=True)
    f, P = load / (N * k), probs.mean(0)
    return E * np.sum(f * P)

bias = np.zeros(E)
print("load before:", route(bias), " balance loss", round(balance_loss(route(bias)), 3))
for _ in range(100):                                   # auxiliary-loss-free balancing
    bias -= 0.05 * (route(bias) - N * k / E) / (N * k / E)
print("load after: ", route(bias), " (ideal", N * k // E, "each)")
viz.bars([f"E{i+1}" for i in range(E)], route(bias), title="tokens per expert after balancing")` },

'13': { title: 'ZeRO memory and the pipeline bubble', note: 'Bytes per GPU for each ZeRO stage, and the idle fraction of a GPipe schedule.', code:
`import numpy as np
import viz

def zero(psi, n):
    return {"none": 16 * psi, "ZeRO-1": 4 * psi + 12 * psi / n, "ZeRO-2": 2 * psi + 14 * psi / n, "ZeRO-3": 16 * psi / n}

for stage, b in zero(70e9, 64).items():
    print(f"{stage:7s} {b / 2**30:8.1f} GiB per GPU for a 70B model on 64 GPUs")

bubble = lambda p, m: (p - 1) / (m + p - 1)
ms = np.arange(1, 33)
for p in (4, 8):
    print(f"p = {p}: bubble with m = 4 -> {bubble(p, 4):.0%}, m = 32 -> {bubble(p, 32):.0%}")
viz.line(ms, bubble(4, ms), bubble(8, ms), labels=["4 stages", "8 stages"], title="pipeline bubble fraction", xlabel="micro-batches m")` },

'14': { title: 'Distil a teacher into a student', note: 'Gradient descent on T²·KL(teacher‖student) with temperature-softened targets.', code:
`import numpy as np
import viz

labels = ["cat", "kitten", "dog", "tiger", "car", "spoon"]
teacher = np.array([6.0, 4.6, 2.4, 2.9, -1.0, -2.5])
softmax = lambda z, T=1: (lambda e: e / e.sum())(np.exp((z - z.max()) / T))

for T in (1, 4):
    print(f"teacher at T={T}:", softmax(teacher, T).round(3))

T, z = 4.0, np.zeros(6)
for step in range(300):
    z -= 0.25 * T * (softmax(z, T) - softmax(teacher, T))   # grad of T^2 KL wrt student logits
p_t, p_s = softmax(teacher, T), softmax(z, T)
print("KL after training:", round(float(np.sum(p_t * np.log(p_t / p_s))), 6))
viz.bars(labels, softmax(z, 1), title="student at T = 1 after distillation")` },

'15': { title: 'Quantise a tensor with outliers', note: '4-bit symmetric quantisation per tensor vs per group of 64, on weights with three outlier channels.', code:
`import numpy as np
import viz

rng = np.random.default_rng(5)
W = rng.normal(0, 0.02, (64, 128)); W[:, [7, 41, 90]] *= 20          # outlier channels

def quantise(x, bits):
    n = 2 ** (bits - 1) - 1
    s = np.abs(x).max() / n
    return np.round(x / s) * s

def snr_db(x, xq):
    return 10 * np.log10(np.sum(x ** 2) / np.sum((x - xq) ** 2))

rows = []
for bits in (8, 6, 4, 3):
    per_tensor = quantise(W, bits)
    per_group = np.concatenate([quantise(W[:, j:j + 64], bits) for j in range(0, 128, 64)], axis=1)
    rows.append((bits, snr_db(W, per_tensor), snr_db(W, per_group)))
    print(f"{bits}-bit: per-tensor SNR {rows[-1][1]:5.1f} dB, per-group(64) {rows[-1][2]:5.1f} dB")
print(f"70B model at 4 bits: {70e9 * 4 / 8 / 2**30:.1f} GiB of weights")
viz.line([r[0] for r in rows], [r[1] for r in rows], [r[2] for r in rows], labels=["per tensor", "per group of 64"], title="signal-to-noise ratio (dB)", xlabel="bits")` },

'16': { title: 'Parameter counts from configs', note: 'Reproduces published sizes from config values (embeddings + layers × (attention + MLP × experts)).', code:
`import viz

configs = {
    "Llama 3 8B":   dict(V=128256, d=4096, L=32, H=32, KV=8, dh=128, ff=14336, E=1, k=1, tied=False),
    "Mistral 7B":   dict(V=32000,  d=4096, L=32, H=32, KV=8, dh=128, ff=14336, E=1, k=1, tied=False),
    "Mixtral 8x7B": dict(V=32000,  d=4096, L=32, H=32, KV=8, dh=128, ff=14336, E=8, k=2, tied=False),
    "Qwen2.5 7B":   dict(V=152064, d=3584, L=28, H=28, KV=4, dh=128, ff=18944, E=1, k=1, tied=False),
    "Gemma 2 9B":   dict(V=256000, d=3584, L=42, H=16, KV=8, dh=256, ff=14336, E=1, k=1, tied=True),
}

def count(c, active=False):
    emb = c["V"] * c["d"] * (1 if c["tied"] else 2)
    attn = 2 * c["d"] * c["H"] * c["dh"] + 2 * c["d"] * c["KV"] * c["dh"]
    mlp = 3 * c["d"] * c["ff"] * (c["k"] if active else c["E"])
    router = c["d"] * c["E"] if c["E"] > 1 else 0
    return emb + c["L"] * (attn + mlp + router + 2 * c["d"]) + c["d"]

for name, c in configs.items():
    print(f"{name:13s} total {count(c) / 1e9:6.2f}B   active {count(c, True) / 1e9:6.2f}B")
viz.bars(list(configs), [count(c) / 1e9 for c in configs.values()], title="total parameters (billions)")` },

'17': { title: 'Residual dilution with depth', note: 'Standard residuals sum unit-norm updates; a softmax mix over depth keeps the norm bounded.', code:
`import numpy as np
import viz

rng = np.random.default_rng(3)
L, d = 64, 64
v = rng.normal(size=(L, d)); v /= np.linalg.norm(v, axis=1, keepdims=True)

std_norm = np.linalg.norm(np.cumsum(v, axis=0), axis=1)      # h_l = sum of updates
att_norm = []
for l in range(1, L + 1):
    logits = -0.35 * (l - 1 - np.arange(l)); logits[0] += 2.0   # toy weights: embedding + recent layers
    a = np.exp(logits - logits.max()); a /= a.sum()
    att_norm.append(np.linalg.norm(a @ v[:l]))
print(f"after {L} layers: standard norm {std_norm[-1]:.2f} (√L = {np.sqrt(L):.2f}), softmax-mix norm {att_norm[-1]:.2f}")
print(f"layer 1's share of the standard sum: {1 / L:.1%}")
viz.line(range(1, L + 1), std_norm, att_norm, labels=["standard residual", "softmax over depth (toy weights)"], title="hidden-state norm", xlabel="layer")` },

'18': { title: 'Calibrating a decision model', note: 'A typed decision is only useful if its probabilities are honest. Temperature scaling fixes an overconfident classifier.', code:
`import numpy as np
import viz

rng = np.random.default_rng(18)
n, C = 3000, 3
true = rng.integers(0, C, n)
logits = rng.normal(0, 1, (n, C)); logits[np.arange(n), true] += 1.2
logits *= 3.0                                    # make it overconfident

def probs(z, T):
    e = np.exp((z - z.max(1, keepdims=True)) / T); return e / e.sum(1, keepdims=True)

def ece(p, y, bins=10):
    conf, pred = p.max(1), p.argmax(1); total = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        m = (conf > lo) & (conf <= lo + 1 / bins)
        if m.any(): total += m.mean() * abs((pred[m] == y[m]).mean() - conf[m].mean())
    return total

nll = lambda T: -np.mean(np.log(probs(logits, T)[np.arange(n), true]))
Ts = np.linspace(0.5, 6, 56); best = Ts[np.argmin([nll(T) for T in Ts])]
print(f"accuracy {np.mean(logits.argmax(1) == true):.3f}")
print(f"ECE at T=1: {ece(probs(logits, 1), true):.3f}   best T = {best:.2f}: ECE {ece(probs(logits, best), true):.3f}")
viz.line(Ts, [nll(T) for T in Ts], labels=["negative log-likelihood"], title="fitting the temperature", xlabel="T")` },

'19': { title: 'Patches and a spectrogram', note: 'Cuts an image array into ViT patches with one reshape, then computes a real spectrogram with the FFT.', code:
`import numpy as np
import viz

img = np.random.default_rng(0).random((224, 224, 3))
p = 16
patches = img.reshape(224 // p, p, 224 // p, p, 3).transpose(0, 2, 1, 3, 4).reshape(-1, p * p * 3)
print("image", img.shape, "-> patches", patches.shape, "(tokens, values per patch)")

sr = 8000; t = np.arange(sr) / sr
sig = 0.6 * np.sin(2 * np.pi * (300 * t + 1100 * t * t)) + 0.35 * np.sin(2 * np.pi * 1000 * t)
F, hop = 256, 128
frames = np.stack([sig[i:i + F] * np.hanning(F) for i in range(0, len(sig) - F, hop)])
spec = np.log10(np.abs(np.fft.rfft(frames, axis=1))[:, :48] + 1e-3)
print("spectrogram", spec.shape, "(frames, frequency bins up to 1.5 kHz)")
viz.heatmap(spec.T[::-1][::2, ::2], title="spectrogram (time →, frequency ↑)", numbers=False)` },

'20': { title: 'LoRA: low-rank updates', note: 'The best rank-r approximation (SVD) of a fine-tuning update, and the parameter savings.', code:
`import numpy as np
import viz

rng = np.random.default_rng(2)
d = 256
U, V = rng.normal(size=(d, 6)), rng.normal(size=(6, d))
delta_W = U @ np.diag([8, 5, 3, 2, 1, .5]) @ V / d + rng.normal(0, 0.01, (d, d))   # mostly low-rank

u, s, vt = np.linalg.svd(delta_W)
total = np.sum(s ** 2)
ranks = list(range(1, 13))
explained = [np.sum(s[:r] ** 2) / total for r in ranks]
for r in (1, 4, 8):
    print(f"rank {r}: explains {explained[r - 1]:.1%} of the update with {r * 2 * d:,} params (full: {d * d:,})")

B, A = u[:, :4] * s[:4], vt[:4]          # LoRA factors B (d×r) and A (r×d)
print("reconstruction error at r=4:", round(float(np.linalg.norm(delta_W - B @ A) / np.linalg.norm(delta_W)), 4))
viz.line(ranks, explained, labels=["share of update explained"], title="SVD energy by rank", xlabel="rank r")` },
});
