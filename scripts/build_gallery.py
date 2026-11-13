"""Build assets/gallery.js from the public metadata snapshot of Sebastian Raschka's LLM Architecture Gallery.

Source: https://github.com/rasbt/llm-architecture-gallery (models.yml, Apache License 2.0, updated quarterly).
Only descriptive fields are kept; images and benchmark scores are not copied.

Run:  python3 scripts/build_gallery.py [path/to/models.yml] [--date YYYY-MM-DD]
With no path the file is downloaded from GitHub. Needs PyYAML (pip install pyyaml)."""
import json, pathlib, sys, urllib.request, datetime
import yaml

URL = "https://raw.githubusercontent.com/rasbt/llm-architecture-gallery/main/models.yml"
root = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
date = datetime.date.today().isoformat()
if "--date" in args:
    i = args.index("--date"); date = args[i + 1]; del args[i:i + 2]
text = pathlib.Path(args[0]).read_text() if args else urllib.request.urlopen(URL, timeout=30).read().decode()
data = yaml.safe_load(text)

def url(v):
    u = (v or {}).get("url") if isinstance(v, dict) else None
    return u if isinstance(u, str) and u.startswith("https://") else None

out = []
for name, m in data.items():
    out.append({
        "name": name, "org": m.get("company"), "date": str(m.get("date")), "scale": m.get("scale"),
        "type": m.get("decoder_type"), "attn": m.get("attention"), "mix": str(m.get("layer_mix") or ""),
        "kv": m.get("kv_cache_per_token_bf16"), "ctx": m.get("context_tokens"), "vocab": m.get("vocab_size"),
        "lic": m.get("license_name"), "sum": m.get("summary"), "hi": m.get("highlight"),
        "tags": m.get("related_concepts") or [], "cfg": url(m.get("config")), "rep": url(m.get("tech_report")),
    })
out.sort(key=lambda r: r["date"], reverse=True)
meta = {"source": "https://sebastianraschka.com/llm-architecture-gallery/", "repo": "https://github.com/rasbt/llm-architecture-gallery", "license": "Apache License 2.0", "snapshot": date, "count": len(out)}
(root / "assets/gallery.js").write_text("window.GALLERY = " + json.dumps({"meta": meta, "models": out}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(out), "architectures, newest", out[0]["date"], "->", "assets/gallery.js")
