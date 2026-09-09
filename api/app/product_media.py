from __future__ import annotations

from typing import Literal
from urllib.parse import quote

MockupStyle = Literal["flat", "men", "women"]
Placement = Literal["front", "chest", "left-chest", "back"]


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
    *, product_ref: str, catalog_slug: str, color_slug: str, placement: Placement = "front"
) -> str:
    return "/{}/{}_color-{}.webp".format(
        quote(product_ref, safe=""), quote(catalog_slug, safe=""), quote(color_slug, safe="")
    ) + f"?placement={quote(placement, safe='')}&v=10"


def build_catalog_blank_url(*, product_ref: str, catalog_slug: str, color_slug: str, placement: Placement) -> str:
    return f"/{quote(product_ref, safe='')}/{quote(catalog_slug, safe='')}_color-{quote(color_slug, safe='')}.webp?placement={quote(placement, safe='')}&blank=1&v=11"
