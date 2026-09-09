from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = data.strip()
        if value:
            self.parts.append(value)


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None and data.strip():
            self._cell.append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._row is not None and self._cell is not None:
            self._row.append(" ".join(self._cell))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None


def _plain_text(value: str) -> str:
    parser = _TextParser()
    parser.feed(html.unescape(value))
    return "\n".join(parser.parts)


def _material_items(value: str) -> list[str]:
    items: list[str] = []
    for line in _plain_text(value).splitlines():
        normalized = re.sub(r"^\s*[•●▪*-]\s*", "", re.sub(r"\s+", " ", line)).strip()
        if normalized:
            items.append(normalized)
    return items


def _table(value: str) -> list[list[str]]:
    parser = _TableParser()
    normalized = html.unescape(value)
    parser.feed(normalized)
    if parser.rows:
        return parser.rows

    rows: list[list[str]] = []
    for line in normalized.splitlines():
        stripped = line.strip()
        if not stripped or "|" not in stripped:
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if cells and not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            rows.append(cells)
    return rows


def parse_product_page(source: str, source_url: str) -> dict[str, Any]:
    marker = "window.__remixContext = "
    start = source.find(marker)
    if start < 0:
        raise ValueError("Gearment page is missing Remix catalog data")
    context, _ = json.JSONDecoder().raw_decode(source[start + len(marker) :])
    loader_data = context.get("state", {}).get("loaderData", {})
    route = next(
        (
            value
            for key, value in loader_data.items()
            if key.endswith("catalog.product.$id") and isinstance(value, dict)
        ),
        None,
    )
    data = (route or {}).get("response", {}).get("data")
    if not isinstance(data, dict) or not data.get("productId"):
        raise ValueError("Gearment product page has no structured product payload")
    images = [item for item in data.get("images", []) if isinstance(item, dict) and item.get("url")]
    design_kits = [item for item in data.get("designKits", []) if isinstance(item, dict)]
    description = str(data.get("description") or "")
    return {
        "product_id": str(data["productId"]),
        "page_slug": str(
            data.get("shortUrl") or urllib.parse.urlparse(source_url).path.rsplit("/", 1)[-1]
        ),
        "name": str(data.get("name") or ""),
        "brand": str(data.get("name") or "").split(" - ", 1)[0] or None,
        "description": _plain_text(description),
        "material_details": {"items": _material_items(description)},
        "size_chart": {
            "note": "Actual size may differ by ±0.5 to 1.5 inches.",
            "unit": "in",
            "rows": _table(
                str(
                    data.get("sizeGuidelines")
                    or data.get("sizeGuideline")
                    or data.get("sizeGuide")
                    or ""
                )
            ),
        },
        "shipping_guideline": data.get("shippingPolicies") or [],
        "artwork_guideline": {
            "rows": _table(str(data.get("fileGuidelines") or "")),
            "design_kits": design_kits,
        },
        "images": images,
        "source_url": source_url,
        "raw": data,
    }


def fetch_product_page(url: str, timeout: float = 30) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"gearment.com", "www.gearment.com"}:
        raise ValueError("Catalog source URL must be an HTTPS gearment.com product page")
    request = urllib.request.Request(
        url,
        headers={"Accept": "text/html", "User-Agent": "TeeBravo-CatalogSync/1.0"},
    )
    last_error: urllib.error.HTTPError | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content_type = response.headers.get_content_type()
                if content_type != "text/html":
                    raise ValueError(f"Expected HTML catalog page, got {content_type}")
                source = response.read(5_000_001)
            break
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
            time.sleep(2**attempt)
    else:
        raise last_error or RuntimeError("Catalog page request failed")
    if len(source) > 5_000_000:
        raise ValueError("Gearment catalog page exceeds 5 MB")
    return parse_product_page(source.decode("utf-8"), url)


def taxonomy_from_category_url(url: str) -> tuple[str, str]:
    slug = urllib.parse.urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]
    prefixes = {
        "home-living-": "home-living",
        "accessories-": "accessories",
        "women-": "women",
        "kids-": "kids",
        "men-": "men",
    }
    for prefix, department in prefixes.items():
        if slug.startswith(prefix):
            return department, slug.removeprefix(prefix)
    if slug in {"men", "women", "kids", "accessories", "homeliving"}:
        return ("home-living" if slug == "homeliving" else slug), "all"
    if slug == "blanket":
        return "home-living", "blanket"
    raise ValueError(f"Unsupported Gearment category URL: {url}")


def find_template_urls(guideline_html: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"https://[^'&\"]+", html.unescape(guideline_html))))
