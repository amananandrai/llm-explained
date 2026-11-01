"""Parse plan/build-plan.md into assets/data.js (curriculum, module outlines, papers).
Run: python3 scripts/build_data.py"""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
md = (root / "plan/build-plan.md").read_text()

def inline(s):
    s = s.replace("\\_", "_").replace("\\[", "[").replace("\\]", "]").replace("\\~", "~")
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    return s

def table(lines):
    rows = [[inline(c.strip()) for c in l.strip().strip("|").split("|")] for l in lines if not re.match(r"^\|\s*-", l)]
    return {"head": rows[0], "rows": rows[1:]}

part_re = re.compile(r"^### (Part (\d) · (.+)|Capstone)$")
mod_re = re.compile(r"^#### Module (\d+) · (.+)$")
parts, modules = [], []
cur_part = cur = None
lines = md.split("\n")
start = lines.index("## Module plan"); end = lines.index("## Visual language and animation system")
i = start
while i < end:
    l = lines[i]
    m = part_re.match(l)
    if m:
        cur_part = {"n": int(m.group(2)) if m.group(2) else 8, "title": m.group(3) or "Capstone", "modules": []}
        parts.append(cur_part); cur = None; i += 1; continue
    m = mod_re.match(l)
    if m:
        cur = {"id": m.group(1), "title": inline(m.group(2)), "part": cur_part["n"], "fields": [], "maths": [], "tables": [], "notes": [], "code": []}
        modules.append(cur); cur_part["modules"].append(cur["id"]); i += 1; continue
    if cur is None: i += 1; continue
    if l.startswith("```"):
        lang = l[3:].strip(); j = i + 1; buf = []
        while not lines[j].startswith("```"): buf.append(lines[j]); j += 1
        (cur["maths"] if lang == "latex" else cur["code"]).append("\n".join(buf)); i = j + 1; continue
    if l.startswith("|"):
        buf = []
        while i < end and lines[i].startswith("|"): buf.append(lines[i]); i += 1
        cur["tables"].append(table(buf)); continue
    if l.startswith("- "):
        fm = re.match(r"- \*\*([^*]+?):?\*\*:?\s*(.*)", l)
        item = {"label": fm.group(1).rstrip(":") if fm else "", "text": inline(fm.group(2) if fm else l[2:]), "sub": []}
        i += 1
        while i < end and re.match(r"^\s{2,}(- |\d+\. )", lines[i]):
            item["sub"].append(inline(re.sub(r"^\s+(- |\d+\. )", "", lines[i]))); i += 1
        cur["fields"].append(item); continue
    if re.match(r"^\d+\. ", l) and cur["fields"]:
        cur["fields"][-1]["sub"].append(inline(re.sub(r"^\d+\. ", "", l))); i += 1; continue
    if l.strip():
        cur["notes"].append(inline(l.strip()))
    i += 1

# papers table
pap = {}
pl = lines.index("**Primary papers per module** (titles from memory; verify and link each one when the module is written)")
j = pl + 2; buf = []
while lines[j].startswith("|"): buf.append(lines[j]); j += 1
for row in table(buf)["rows"]:
    key = re.match(r"([\d–]+)", row[0].replace("<strong>", "")).group(1)
    ids = key.split("–")
    rng = range(int(ids[0]), int(ids[-1]) + 1)
    for k in rng: pap.setdefault(str(k), []).append({"label": row[0], "refs": row[1]})

out = {"parts": parts, "modules": {m["id"]: m for m in modules}, "papers": pap}
(root / "assets/data.js").write_text("window.PLAN = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(len(parts), "parts,", len(modules), "modules,", len(pap), "paper rows")
