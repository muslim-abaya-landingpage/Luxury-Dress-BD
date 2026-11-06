#!/usr/bin/env python3
"""Create the smaller copies of product photos that phones load instead of the full photo.

For every local product photo (category-products.js and product-links-data.js), make
  images/card/<photo path>.webp      480 px wide WebP  (product cards and product-page thumbnails)
  images/card-avif/<photo path>.avif the same in AVIF  (phones that support it load this on cards)
  images/m900/<photo path>.webp      900 px wide WebP  (main photo on the product page on phones)
Only missing files are created; existing ones and the original photos are never changed.
Without these, phones download full photos (often 1000-1450 px, up to 300 KB each) — slower
loading and heavier image decoding while scrolling. GitHub runs this automatically on every push
that changes photos or the catalog (.github/workflows/phone-images.yml).

Run after adding photos to the repository:  python3 scripts/build-card-thumbs.py
The check `node --test scripts/test-mobile-scroll.mjs` fails when a card photo is missing.
"""
import json
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIDTH = 480


SKIP = re.compile(r'^images/(card|card-avif|m900|hero-banner)/')


def card_sources():
    """Card main photos (must have card copies; uploads carry their own imageCard)."""
    js = ("global.window=global;require('./category-products.js');const out=new Set();"
          "for(const k in window.CATEGORY_PRODUCTS)for(const p of window.CATEGORY_PRODUCTS[k]){"
          "const i=String(p.image||'').replace(/^\\.?\\//,'');"
          "if(i.startsWith('images/')&&!/^images\\/(card|card-avif|hero-banner|uploads)\\//.test(i)&&!/[?#]/.test(i))out.add(i);}"
          "console.log(JSON.stringify([...out]))")
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True))


def all_photos():
    """Every local photo path written in the catalog files."""
    out = set()
    for name in ('category-products.js', 'product-links-data.js'):
        text = (ROOT / name).read_text(encoding='utf8')
        for m in re.findall(r'["\'](/?images/[^"\'?#]+)["\']', text):
            rel = m.lstrip('/')
            if not SKIP.match(rel) and (ROOT / rel).is_file():
                out.add(rel)
    return sorted(out)


def save_resized(im, width, target, fmt, **opts):
    if target.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    small = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS) if im.width > width else im
    small.save(target, fmt, **opts)
    return True


def main():
    made = missing_src = 0
    for rel in card_sources():
        if not (ROOT / rel).exists():
            print('source photo missing:', rel)
            missing_src += 1
    for rel in all_photos():
        targets = [
            (WIDTH, ROOT / 'images' / 'card' / (rel + '.webp'), 'WEBP', {'quality': 80, 'method': 6}),
            (WIDTH, ROOT / 'images' / 'card-avif' / (rel + '.avif'), 'AVIF', {'quality': 55, 'speed': 6}),
            (900, ROOT / 'images' / 'm900' / (rel + '.webp'), 'WEBP', {'quality': 78, 'method': 6}),
        ]
        if all(t[1].exists() for t in targets):
            continue
        with Image.open(ROOT / rel) as im:
            im.load()
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA' if 'transparency' in im.info else 'RGB')
            for width, target, fmt, opts in targets:
                if save_resized(im, width, target, fmt, **opts):
                    made += 1
                    print('made', target.relative_to(ROOT), f'{target.stat().st_size // 1024} KB')
    print(f'done: {made} files made, {missing_src} source photos missing')
    return 1 if missing_src else 0


if __name__ == '__main__':
    sys.exit(main())
