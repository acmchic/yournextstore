from __future__ import annotations

import json
from pathlib import Path
from typing import Literal, cast

import cv2

from app.models import PrintArea, RenderJob
from app.settings import Settings

Placement = Literal["front", "chest", "back"]
MockupStyle = Literal["flat", "men", "women"]
ImageFormat = Literal["webp", "png", "jpeg"]
SUPPORTED_DESIGN_EXTENSIONS = {".jpeg", ".jpg", ".png", ".svg", ".webp"}
CANONICAL_PLACEMENTS = {"front": "front", "left-chest": "chest", "back": "back"}


def parse_canonical_image_path(
    value: str, settings: Settings
) -> tuple[str, str, Placement, MockupStyle, ImageFormat]:
    design_slug, separator, filename = value.strip("/").partition("/")
    if not separator or not design_slug or "/" in filename:
        raise ValueError(
            "canonical image URL must be /img/{design-slug}/{catalog}-{placement}.webp"
        )

    suffix = Path(filename).suffix.lower()
    image_format = "jpeg" if suffix in {".jpg", ".jpeg"} else suffix.removeprefix(".")
    if image_format not in {"webp", "png", "jpeg"}:
        raise ValueError("output extension must be .webp, .png, .jpg, or .jpeg")

    stem = filename[: -len(suffix)]
    matched_placement = next(
        (
            (canonical_name, placement)
            for canonical_name, placement in CANONICAL_PLACEMENTS.items()
            if stem.endswith(f"-{canonical_name}")
        ),
        None,
    )
    if matched_placement:
        canonical_name, placement = matched_placement
        catalog_and_style = stem[: -(len(canonical_name) + 1)]
    else:
        placement = "front"
        catalog_and_style = stem

    style = next(
        (
            candidate
            for candidate in ("women", "men")
            if catalog_and_style.endswith(f"-{candidate}")
        ),
        "flat",
    )
    if style != "flat":
        catalog_and_style = catalog_and_style[: -(len(style) + 1)]
    elif not matched_placement:
        raise ValueError("image filename must end with -front, -left-chest, -back, -women, or -men")
    catalog = _validate_catalog(catalog_and_style)
    design_path = _load_design_manifest(settings).get(design_slug)
    if not design_path:
        raise FileNotFoundError(f"Design slug not found: {design_slug}")
    return (
        design_path,
        catalog,
        cast(Placement, placement),
        cast(MockupStyle, style),
        cast(ImageFormat, image_format),
    )


def parse_blank_image_path(value: str, settings: Settings) -> tuple[str, ImageFormat]:
    filename = value.strip("/")
    if not filename or "/" in filename:
        raise ValueError("blank image URL must contain one semantic filename")

    suffix = Path(filename).suffix.lower()
    image_format = "jpeg" if suffix in {".jpg", ".jpeg"} else suffix.removeprefix(".")
    if image_format not in {"webp", "png", "jpeg"}:
        raise ValueError("output extension must be .webp, .png, .jpg, or .jpeg")

    stem = filename[: -len(suffix)]
    canonical_name = next(
        (candidate for candidate in ("front", "back") if stem.endswith(f"-{candidate}")),
        None,
    )
    if canonical_name is None:
        raise ValueError("blank image filename must end with -front or -back")
    catalog_and_style = stem[: -(len(canonical_name) + 1)]
    style = next(
        (
            candidate
            for candidate in ("women", "men")
            if catalog_and_style.endswith(f"-{candidate}")
        ),
        "flat",
    )
    if style != "flat":
        catalog_and_style = catalog_and_style[: -(len(style) + 1)]

    catalog = _validate_catalog(catalog_and_style)
    product_type, color = catalog.rsplit("-", 1)
    style_suffix = f"-{style}" if style != "flat" else ""
    base_relative = Path("mockup") / product_type / f"{color}-{canonical_name}{style_suffix}.png"
    base = _safe_asset(settings.asset_root, base_relative.as_posix())
    if not base.is_file():
        raise FileNotFoundError(f"Blank mockup not found: {catalog} ({canonical_name}, {style})")
    return base_relative.as_posix(), cast(ImageFormat, image_format)


def canonical_image_path(
    *,
    design_path: str,
    catalog: str,
    placement: Placement,
    style: MockupStyle = "flat",
    image_format: ImageFormat,
    settings: Settings,
) -> str | None:
    design_slug = next(
        (slug for slug, source in _load_design_manifest(settings).items() if source == design_path),
        None,
    )
    if not design_slug:
        return None
    canonical_placement = "left-chest" if placement == "chest" else placement
    style_segment = f"-{style}" if style != "flat" else ""
    extension = "jpg" if image_format == "jpeg" else image_format
    return f"/img/{design_slug}/{catalog}{style_segment}-{canonical_placement}.{extension}"


def split_design_and_catalog(value: str, catalog: str | None) -> tuple[str, str]:
    cleaned = value.strip("/")
    if catalog:
        return cleaned, _validate_catalog(catalog)
    design_path, separator, catalog_from_path = cleaned.rpartition("/")
    if not separator or not design_path:
        raise ValueError("catalog is required, for example ?catalog=t-shirt-black")
    return design_path, _validate_catalog(catalog_from_path)


def build_catalog_render_job(
    *,
    design_path: str,
    catalog: str,
    placement: Placement,
    style: MockupStyle = "flat",
    settings: Settings,
) -> RenderJob:
    design = _safe_asset(settings.asset_root / "design", design_path)
    if design.suffix.lower() not in SUPPORTED_DESIGN_EXTENSIONS:
        raise ValueError("design must be PNG, WebP, JPG, JPEG, or SVG")
    if not design.is_file():
        raise FileNotFoundError(f"Design not found: {design_path}")

    product_type, color = catalog.rsplit("-", 1)
    base_placement = "back" if placement == "back" else "front"
    style_suffix = f"-{style}" if style != "flat" else ""
    base_relative = Path("mockup") / product_type / f"{color}-{base_placement}{style_suffix}.png"
    base = _safe_asset(settings.asset_root, base_relative.as_posix())
    if not base.is_file():
        raise FileNotFoundError(f"Mockup catalog not found: {catalog} ({base_placement})")

    image = cv2.imread(str(base), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not decode mockup: {catalog}")
    height, width = image.shape[:2]
    print_area = PrintArea(
        dst_quad=_placement_quad(width, height, placement, style),
        displacement_strength=0,
        shadow_opacity=0,
        highlight_opacity=0,
        artwork_fit="contain",
        surface_mode="none",
    )
    version = f"{design.stat().st_mtime_ns}:{base.stat().st_mtime_ns}:v3-sharp"
    return RenderJob(
        product_id=f"file:{design.relative_to(settings.asset_root)}",
        artwork_id=design.relative_to(settings.asset_root).as_posix(),
        template_id=f"{catalog}-{style}-{placement}",
        variant_id=f"{color}-{style}-{placement}",
        base_source=base_relative.as_posix(),
        artwork_source=design.relative_to(settings.asset_root).as_posix(),
        print_area=print_area,
        version=version,
    )


def parse_placement(value: str) -> Placement:
    if value not in {"front", "chest", "back"}:
        raise ValueError("pos must be front, chest, or back")
    return cast(Placement, value)


def _placement_quad(
    width: int, height: int, placement: Placement, style: MockupStyle
) -> list[tuple[float, float]]:
    flat_ratios = {
        "front": (0.35, 0.27, 0.65, 0.625),
        "back": (0.34, 0.26, 0.66, 0.63),
        # Wearer's left chest, which appears on the right side of the image.
        "chest": (0.52, 0.29, 0.67, 0.44),
    }
    model_ratios = {
        "women": {
            "front": (0.343, 0.275, 0.654, 0.618),
            "chest": (0.52, 0.29, 0.66, 0.43),
        },
        "men": {
            "front": (0.372, 0.348, 0.725, 0.818),
            "chest": (0.54, 0.37, 0.68, 0.51),
        },
    }
    if style != "flat" and placement == "back":
        raise FileNotFoundError(f"Back mockup is not available for style: {style}")
    ratios = flat_ratios if style == "flat" else model_ratios[style]
    left, top, right, bottom = ratios[placement]
    return [
        (width * left, height * top),
        (width * right, height * top),
        (width * right, height * bottom),
        (width * left, height * bottom),
    ]


def _safe_asset(root: Path, relative_path: str) -> Path:
    resolved_root = root.resolve()
    resolved = (resolved_root / relative_path).resolve()
    if not resolved.is_relative_to(resolved_root):
        raise ValueError("asset path must stay inside the configured public directory")
    return resolved


def _validate_catalog(value: str) -> str:
    catalog = value.strip().lower()
    if not catalog or any(
        character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in catalog
    ):
        raise ValueError("catalog may contain only lowercase letters, numbers, and hyphens")
    if "-" not in catalog:
        raise ValueError("catalog must include product and color, for example t-shirt-black")
    return catalog


def _load_design_manifest(settings: Settings) -> dict[str, str]:
    manifest_path = settings.asset_root / "design" / "manifest.json"
    if not manifest_path.is_file():
        return {}
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or not all(
        isinstance(slug, str) and isinstance(source, str) for slug, source in manifest.items()
    ):
        raise ValueError("design/manifest.json must contain a string-to-string object")
    return manifest
