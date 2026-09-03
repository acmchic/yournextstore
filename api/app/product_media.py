from __future__ import annotations

from typing import Literal

MockupStyle = Literal["flat", "men", "women"]
Placement = Literal["front", "left-chest", "back"]


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
