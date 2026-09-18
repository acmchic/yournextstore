"""Canonical, bounded print-area geometry shared by analysis and rendering."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any

PRINT_AREA_ASPECT_RATIO = 42 / 48
_APPAREL_TYPE_MARKERS = (
    "apparel",
    "shirt",
    "tee",
    "hoodie",
    "sweatshirt",
    "tank",
    "crewneck",
    "long-sleeve",
)
_HOODIE_TYPE_MARKERS = ("hoodie", "sweatshirt")
_RECTANGLE_KEYS = ("x", "y", "width", "height")


def is_apparel_product_type(product_type: str | None) -> bool:
    normalized = (product_type or "").strip().lower().replace("_", "-")
    return any(marker in normalized for marker in _APPAREL_TYPE_MARKERS)


def default_print_area(product_type: str | None) -> dict[str, float]:
    """Return a conservative front-print rectangle when a guide is unavailable."""
    normalized = (product_type or "").strip().lower().replace("_", "-")
    if any(marker in normalized for marker in _HOODIE_TYPE_MARKERS):
        # Keep the design above a hoodie's pocket.
        return {"x": 0.30, "y": 0.16, "width": 0.40, "height": 0.28}
    return {"x": 0.30, "y": 0.25, "width": 0.40, "height": 0.40}


def is_valid_print_area(area: Mapping[str, Any] | None) -> bool:
    """Check that a rectangle is normalized and contained within its template."""
    return _normalized_rectangle(area) is not None


def fit_apparel_print_area(
    area: Mapping[str, Any],
    *,
    product_type: str | None,
    template_width: int,
    template_height: int,
) -> dict[str, float]:
    """Fit a valid apparel rectangle to 42:48 without leaving its current bounds."""
    rectangle = _normalized_rectangle(area)
    if rectangle is None:
        return {}
    if not is_apparel_product_type(product_type) or template_width < 1 or template_height < 1:
        return rectangle

    x, y, width, height = (rectangle[key] for key in _RECTANGLE_KEYS)
    current_ratio = width * template_width / (height * template_height)
    if math.isclose(current_ratio, PRINT_AREA_ASPECT_RATIO, rel_tol=0, abs_tol=1e-6):
        return rectangle

    if current_ratio > PRINT_AREA_ASPECT_RATIO:
        fitted_width = height * template_height * PRINT_AREA_ASPECT_RATIO / template_width
        return {**rectangle, "x": x + (width - fitted_width) / 2, "width": fitted_width}

    fitted_height = width * template_width / PRINT_AREA_ASPECT_RATIO / template_height
    return {**rectangle, "y": y + (height - fitted_height) / 2, "height": fitted_height}


def resolve_print_area(
    area: Mapping[str, Any] | None,
    *,
    product_type: str | None,
    template_width: int,
    template_height: int,
    fallback: Mapping[str, Any] | None = None,
) -> dict[str, float]:
    """Return one safe normalized rectangle, falling back for invalid provider data.

    Stored analysis metadata is normalized. Values such as ``6`` therefore cannot
    mean six percent: they are malformed and must never reach the renderer as a
    600% print area.
    """
    fallback_area = _normalized_rectangle(fallback) or default_print_area(product_type)
    candidate = _normalized_rectangle(area)
    if candidate is None or (is_apparel_product_type(product_type) and _is_full_canvas(candidate)):
        candidate = fallback_area

    fitted = fit_apparel_print_area(
        candidate,
        product_type=product_type,
        template_width=template_width,
        template_height=template_height,
    )
    return _normalized_rectangle(fitted) or fallback_area


def resolve_print_areas(
    area: Mapping[str, Any] | None,
    regions: Iterable[Mapping[str, Any]] | None,
    *,
    product_type: str | None,
    template_width: int,
    template_height: int,
    fallback: Mapping[str, Any] | None = None,
) -> tuple[dict[str, float], list[dict[str, float]]]:
    """Resolve a primary area and all repeated regions to safe bounded geometry."""
    primary = resolve_print_area(
        area,
        product_type=product_type,
        template_width=template_width,
        template_height=template_height,
        fallback=fallback,
    )
    resolved_regions = [
        fit_apparel_print_area(
            region,
            product_type=product_type,
            template_width=template_width,
            template_height=template_height,
        )
        for region in (regions or [])
        if _normalized_rectangle(region) is not None
        and not (is_apparel_product_type(product_type) and _is_full_canvas(region))
    ]
    safe_regions = [
        rectangle for rectangle in resolved_regions if _normalized_rectangle(rectangle) is not None
    ]
    return primary, safe_regions or [primary]


def normalize_provider_print_area(
    design_kit: Mapping[str, Any] | None,
    *,
    product_type: str | None,
    template_width: int,
    template_height: int,
    fallback: Mapping[str, Any] | None = None,
) -> dict[str, float]:
    """Normalize provider ratios, percentages, or canvas-pixel guides safely."""
    fallback_area = _normalized_rectangle(fallback) or default_print_area(product_type)
    kit = design_kit if isinstance(design_kit, Mapping) else {}
    values = {
        "x": _number(kit.get("designAreaX")),
        "y": _number(kit.get("designAreaY")),
        "width": _number(kit.get("designAreaWidth")),
        "height": _number(kit.get("designAreaHeight")),
    }
    if any(value is None for value in values.values()):
        return resolve_print_area(
            None,
            product_type=product_type,
            template_width=template_width,
            template_height=template_height,
            fallback=fallback_area,
        )

    numeric_values = {key: float(value) for key, value in values.items() if value is not None}
    canvas_width = _number(kit.get("canvasWidth"))
    canvas_height = _number(kit.get("canvasHeight"))
    largest_value = max(abs(value) for value in numeric_values.values())
    if canvas_width and canvas_height and largest_value > 100:
        candidate = {
            "x": numeric_values["x"] / canvas_width,
            "y": numeric_values["y"] / canvas_height,
            "width": numeric_values["width"] / canvas_width,
            "height": numeric_values["height"] / canvas_height,
        }
    elif largest_value > 1:
        candidate = {key: value / 100 for key, value in numeric_values.items()}
    else:
        candidate = numeric_values

    return resolve_print_area(
        candidate,
        product_type=product_type,
        template_width=template_width,
        template_height=template_height,
        fallback=fallback_area,
    )


def _normalized_rectangle(area: Mapping[str, Any] | None) -> dict[str, float] | None:
    if not isinstance(area, Mapping):
        return None
    values = {key: _number(area.get(key)) for key in _RECTANGLE_KEYS}
    if any(value is None for value in values.values()):
        return None
    rectangle = {key: float(value) for key, value in values.items() if value is not None}
    if (
        rectangle["x"] < 0
        or rectangle["y"] < 0
        or rectangle["width"] <= 0
        or rectangle["height"] <= 0
        or rectangle["x"] + rectangle["width"] > 1
        or rectangle["y"] + rectangle["height"] > 1
    ):
        return None
    return rectangle


def _is_full_canvas(area: Mapping[str, Any]) -> bool:
    rectangle = _normalized_rectangle(area)
    return rectangle is not None and (
        rectangle["x"] <= 0.001
        and rectangle["y"] <= 0.001
        and rectangle["width"] >= 0.999
        and rectangle["height"] >= 0.999
    )


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None
