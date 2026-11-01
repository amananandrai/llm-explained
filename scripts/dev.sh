#!/usr/bin/env bash
# Wrap index.html in the same skeleton the Artifact host adds, for local viewing: http://localhost:8765/dev.html
cd "$(dirname "$0")/.."
{ echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; echo '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'; cat index.html; echo '</body></html>'; } > dev.html
