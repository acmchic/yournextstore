from __future__ import annotations

import hashlib
from typing import Literal
from urllib.parse import quote

MockupStyle = Literal["flat", "men", "women"]
Placement = Literal["front", "chest", "left-chest", "back"]
CatalogPlacement = Literal["front", "chest", "back"]


def parse_catalog_mockup_view(view: str) -> tuple[MockupStyle, CatalogPlacement, bool]:
    """Resolve a compact public mockup view segment into renderer options."""
    parts = view.lower().split("-")
    if not 1 <= len(parts) <= 2:
        raise ValueError("invalid mockup view")
    if parts[0] == "blank":
        placement = parts[1] if len(parts) == 2 else "front"
        if placement not in {"front", "chest", "back"}:
            raise ValueError("invalid mockup placement")
        return "flat", placement, True
    if len(parts) == 1 and parts[0] in {"front", "chest", "back"}:
        return "flat", parts[0], False
    style = parts[0]
    placement = parts[1] if len(parts) == 2 else "front"
    if style not in {"flat", "men", "women"}:
        raise ValueError("invalid mockup style")
    if placement not in {"front", "chest", "back"}:
        raise ValueError("invalid mockup placement")
    return style, placement, False


def build_media_url(
    *,
    design_slug: str,
    catalog_slug: str,
    color_slug: str,
    style: MockupStyle,
    placement: Placement,
) -> str:
    style_segment = "" if style == "flat" else f"-{style}"
    return f"/img/{design_slug}/{catalog_slug}-{color_slug}{style_segment}-{placement}.webp"


def build_blank_media_url(
    *, catalog_slug: str, color_slug: str, style: MockupStyle, placement: Placement
) -> str:
    style_segment = "" if style == "flat" else f"-{style}"
    blank_view = "back" if placement == "back" else "front"
    return f"/img/blank/{catalog_slug}-{color_slug}{style_segment}-{blank_view}.webp"


def build_catalog_mockup_url(
    *,
    product_ref: str,
    catalog_slug: str,
    color_slug: str,
    placement: Placement = "front",
    style: MockupStyle = "flat",
    version: str | None = None,
) -> str:
    resolved_placement: CatalogPlacement = "chest" if placement == "left-chest" else placement
    view = "" if style == "flat" and resolved_placement == "front" else (
        style if resolved_placement == "front" else f"{style}-{resolved_placement}"
    )
    path = "/".join(
        [
            "",
            quote(product_ref, safe=""),
            quote(catalog_slug, safe=""),
            quote(color_slug, safe=""),
            *([view] if view else []),
        ]
    ) + ".webp"
    if not version:
        return path
    cache_version = hashlib.sha256(version.encode()).hexdigest()[:12]
    return f"{path}?v={cache_version}"


def build_catalog_blank_url(*, product_ref: str, catalog_slug: str, color_slug: str, placement: Placement) -> str:
    blank_view = "blank-back" if placement == "back" else "blank"
    return "/".join(
        [
            "",
            quote(product_ref, safe=""),
            quote(catalog_slug, safe=""),
            quote(color_slug, safe=""),
            blank_view,
        ]
    ) + ".webp"
