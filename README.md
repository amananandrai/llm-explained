# LLM Explained

A scroll-driven, interactive course on how large language models work, built from `plan/build-plan.md`.

## What is here

- **Interactive beta (Parts 1–2):** Modules 0 (with the KL sub-page) to 9. Each page follows the plan's template: hook, scroll-driven hero animation with play/step/scrub controls and a text transcript, the Intuition / Mechanics / Maths depth switch, colour-linked KaTeX maths, widgets, "what this picture leaves out", a 3-question quiz and further reading.
- **Outline pages (Modules 10–41):** generated from the build plan by `scripts/build_data.py`, showing each module's coverage, planned hero animation and widgets, tables, core maths and reading list.

## Run locally

```bash
./scripts/dev.sh                    # wraps index.html into dev.html
python3 -m http.server 8765         # then open http://localhost:8765/dev.html
```

Edit the plan and regenerate the data with `python3 scripts/build_data.py`.

## Layout

```
index.html              page shell (no build step)
assets/style.css        design tokens (light + dark), layout, components
assets/core.js          component library: router, depth switch, ScrollyStage, sliders, ProbabilityBars,
                        MatrixGrid, line charts, Quiz, MathBlock (colour-linked KaTeX), outline renderer
assets/data.js          generated from the plan
assets/m/m<id>.js       one file per interactive module, lazy-loaded on navigation
assets/katex/           vendored KaTeX 0.16.11
```

## Deviations from the plan

- Plain JS + static files instead of Astro + MDX + React, so it runs with no build step. The component split
  matches the plan's library, so porting to Astro islands later is mechanical.
- No real-model tokenizers, recorded agent traces or Pyodide cells yet; widgets that would need them use
  in-browser computation (a byte-level BPE trained on the site's own text, closed-form RLHF optimum, numerical KL)
  or clearly labelled illustrative numbers.
