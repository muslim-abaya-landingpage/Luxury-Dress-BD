#!/usr/bin/env python3
"""Check live Open Graph/Twitter tags for every URL in a sitemap.

This validates what Facebook's crawler can read from the HTML. It does not
press Facebook Sharing Debugger's "Scrape Again" button; that action requires
Facebook's authenticated debugger UI or a Graph API access token.
"""
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from typing import Dict, List, Tuple

DEFAULT_SITEMAP = "https://muslimabaya.com/sitemap.xml"
TIMEOUT = 25


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: List[str] = []
        self.in_title = False
        self.meta: Dict[Tuple[str, str], str] = {}
        self.canonical = ""

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str | None]]) -> None:
        data = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            if data.get("property"):
                self.meta[("property", data["property"].lower())] = data.get("content", "").strip()
            if data.get("name"):
                self.meta[("name", data["name"].lower())] = data.get("content", "").strip()
        elif tag == "link" and data.get("rel", "").lower() == "canonical":
            self.canonical = data.get("href", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    def get(self, kind: str, key: str) -> str:
        return self.meta.get((kind, key.lower()), "")


def fetch(url: str) -> Tuple[int, str, bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MuslimAbaya-SocialPreviewAudit/1.0 (+https://muslimabaya.com/)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.status, response.headers.get_content_type(), response.read(), response.geturl()


def sitemap_urls(sitemap_url: str) -> List[str]:
    status, content_type, body, final_url = fetch(sitemap_url)
    if status != 200:
        raise RuntimeError(f"Sitemap returned HTTP {status}: {sitemap_url}")
    root = ET.fromstring(body)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.text.strip() for node in root.findall("sm:url/sm:loc", ns) if node.text and node.text.strip()]
    if not urls:
        raise RuntimeError(f"No <loc> URLs found in sitemap: {final_url}")
    return urls


def check_image(url: str) -> Tuple[bool, str]:
    if not url:
        return False, "missing"
    try:
        status, content_type, body, final_url = fetch(url)
        ok = status == 200 and content_type.startswith("image/")
        return ok, f"HTTP {status}, {content_type}, {len(body)} bytes"
    except Exception as exc:  # noqa: BLE001 - report per-image failure and continue
        return False, str(exc)


def audit_page(url: str) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    try:
        status, content_type, body, final_url = fetch(url)
    except Exception as exc:  # noqa: BLE001 - report per-page failure and continue
        return False, [f"fetch failed: {exc}"]

    if status != 200:
        errors.append(f"page HTTP {status}")
    if "html" not in content_type:
        errors.append(f"content type is {content_type}")

    parser = MetaParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    title = "".join(parser.title_parts).strip()
    og_title = parser.get("property", "og:title")
    og_description = parser.get("property", "og:description")
    og_image = parser.get("property", "og:image")
    og_type = parser.get("property", "og:type")
    og_url = parser.get("property", "og:url")
    og_site_name = parser.get("property", "og:site_name")
    twitter_card = parser.get("name", "twitter:card")

    for label, value in {
        "title": title,
        "og:title": og_title,
        "og:description": og_description,
        "og:image": og_image,
        "og:type": og_type,
        "og:url": og_url,
        "og:site_name": og_site_name,
        "twitter:card": twitter_card,
        "canonical": parser.canonical,
    }.items():
        if not value:
            errors.append(f"missing {label}")

    if "muslim abaya" not in f"{title} {og_title} {og_site_name}".lower():
        errors.append("Muslim Abaya brand missing from title/OG")

    def normalize(value: str) -> str:
        parsed = urllib.parse.urlsplit(value)
        path = parsed.path.rstrip("/") or "/"
        return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))

    if parser.canonical and og_url and normalize(parser.canonical) != normalize(og_url):
        errors.append(f"canonical != og:url ({parser.canonical} vs {og_url})")

    if parser.canonical and normalize(parser.canonical) != normalize(url):
        errors.append(f"canonical differs from sitemap URL ({parser.canonical} vs {url})")

    image_ok, image_detail = check_image(og_image)
    if not image_ok:
        errors.append(f"og:image invalid: {image_detail}")

    return not errors, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sitemap", default=DEFAULT_SITEMAP)
    parser.add_argument("--url", action="append", help="Audit one URL instead of reading the sitemap; repeatable")
    args = parser.parse_args()

    try:
        urls = args.url or sitemap_urls(args.sitemap)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    passed = failed = 0
    print(f"Auditing {len(urls)} URL(s)\n")
    for url in urls:
        ok, errors = audit_page(url)
        if ok:
            passed += 1
            print(f"PASS  {url}")
        else:
            failed += 1
            print(f"FAIL  {url}")
            for error in errors:
                print(f"      - {error}")

    print(f"\nSummary: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
