#!/usr/bin/env bash
# Build a standalone static site in dist/ (used by Vercel and any static host).
# index.html is authored as a page fragment; this wraps it in a full HTML document.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  echo '</head>'
  echo '<body>'
  cat index.html
  echo '</body>'
  echo '</html>'
} > dist/index.html
cp -r assets dist/assets
echo "Built dist/ ($(find dist -type f | wc -l) files)"
