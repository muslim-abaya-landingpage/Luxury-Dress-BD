#!/usr/bin/env python3
"""Build non-destructive AVIF alternatives for product-card thumbnails.

Existing WebP files remain the fallback for browsers without AVIF support and
for desktop widths. Source photographs and current WebP card assets are never
modified. Outputs are loaded only by a mobile-only <picture> source.

Run from anywhere: python3 scripts/build-mobile-card-avif.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CARD_SOURCE = ROOT / "images" / "card"
CARD_OUTPUT = ROOT / "images" / "card-avif"
UPLOAD_DIR = ROOT / "images" / "uploads"
QUALITY = 55
SPEED = 6


def encode(source: Path, target: Path) -> tuple[int, int]:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.load()
        options = {"quality": QUALITY, "speed": SPEED}
        icc = image.info.get("icc_profile")
        if icc:
            options["icc_profile"] = icc
        image.save(target, format="AVIF", **options)
    return source.stat().st_size, target.stat().st_size


def main() -> None:
    sources = sorted(p for p in CARD_SOURCE.rglob("*") if p.is_file() and p.suffix.lower() == ".webp")
    sources += sorted(p for p in UPLOAD_DIR.glob("*-card.webp") if p.is_file())
    old_total = new_total = 0
    completed = 0
    for source in sources:
        if source.is_relative_to(CARD_SOURCE):
            target = CARD_OUTPUT / source.relative_to(CARD_SOURCE).with_suffix(".avif")
        else:
            target = source.with_suffix(".avif")
        old_bytes, new_bytes = encode(source, target)
        old_total += old_bytes
        new_total += new_bytes
        completed += 1
        if completed % 25 == 0:
            print(f"Encoded {completed}/{len(sources)} card images")
    saved = (old_total - new_total) / old_total * 100 if old_total else 0
    print(
        f"Generated {completed} AVIF variants at quality {QUALITY}; "
        f"{old_total / 1048576:.2f} MiB WebP -> {new_total / 1048576:.2f} MiB AVIF "
        f"({saved:.1f}% smaller). Originals preserved."
    )


if __name__ == "__main__":
    main()
