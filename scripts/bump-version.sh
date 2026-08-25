#!/usr/bin/env bash
#
# Bump the ?v= stamp on every CSS/JS reference in the HTML pages.
#
# Browsers cache config.js, store.js and friends aggressively, and a page that
# loads a new stats.js beside a cached store.js breaks in confusing ways. Run
# this after changing any CSS or JS, before committing, so returning visitors
# fetch the new files instead of a half-old mixture.

set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import pathlib, re

pages = ['index.html', 'stats.html']
current = max(
    (int(m) for p in pages for m in re.findall(r'\?v=(\d+)"', pathlib.Path(p).read_text())),
    default=1,
)
new = current + 1

for name in pages:
    p = pathlib.Path(name)
    s = p.read_text()
    s = re.sub(r'(href|src)="([^"]+?)(\?v=\d+)?"', lambda m: (
        f'{m.group(1)}="{m.group(2)}?v={new}"'
        if m.group(2).endswith(('.css', '.js')) else m.group(0)
    ), s)
    p.write_text(s)

print(f'asset version {current} -> {new}')
PY
