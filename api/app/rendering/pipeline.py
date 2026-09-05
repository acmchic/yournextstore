from __future__ import annotations

import math
from typing import cast

import numpy as np

from app.models import ImageFormat, RenderJob
from app.rendering.assets import load_asset_bytes, rasterize_svg_if_needed
from app.settings import Settings


def render_mockup(
    job: RenderJob,
    *,
    width: int,
    image_format: ImageFormat,
    settings: Settings,
) -> bytes:
    base = _decode_color(job.base_source, settings)
    if job.garment_color:
        base = _tint_catalog_base(base, job.garment_color)
    artwork = _decode_alpha(job.artwork_source, settings)

    base_height, base_width = base.shape[:2]
    prepared_artwork = _fit_artwork(artwork, job.print_area.dst_quad, job.print_area.artwork_fit)
    warped = _warp_artwork(prepared_artwork, job.print_area.dst_quad, base_width, base_height)

    auto_maps = _derive_surface_maps(base) if job.print_area.surface_mode == "auto" else None

    if job.displacement_source:
        displacement = _decode_gray(job.displacement_source, settings, (base_width, base_height))
        warped = _apply_displacement(warped, displacement, job.print_area.displacement_strength)
    elif auto_maps:
        warped = _apply_displacement(warped, auto_maps[0], job.print_area.displacement_strength)

    if job.mask_source:
        mask = _decode_gray(job.mask_source, settings, (base_width, base_height))
        warped[:, :, 3] = (
            warped[:, :, 3].astype(np.float32) * (mask.astype(np.float32) / 255.0)
        ).astype(np.uint8)

    artwork_rgb = warped[:, :, :3].astype(np.float32)

    if job.shadow_source:
        shadow = (
            _decode_gray(job.shadow_source, settings, (base_width, base_height)).astype(np.float32)
            / 255.0
        )
    elif auto_maps:
        shadow = auto_maps[1].astype(np.float32) / 255.0
    else:
        shadow = None

    if shadow is not None:
        shadow_factor = 1.0 - ((1.0 - shadow) * job.print_area.shadow_opacity)
        artwork_rgb *= shadow_factor[:, :, None]

    if job.highlight_source:
        highlight = (
            _decode_gray(job.highlight_source, settings, (base_width, base_height)).astype(
                np.float32
            )
            / 255.0
        )
    elif auto_maps:
        highlight = auto_maps[2].astype(np.float32) / 255.0
    else:
        highlight = None

    if highlight is not None:
        artwork_rgb = _screen(
            artwork_rgb, highlight[:, :, None] * 255.0, job.print_area.highlight_opacity
        )

    warped[:, :, :3] = np.clip(artwork_rgb, 0, 255).astype(np.uint8)
    composited = _alpha_composite(base, warped)
    output = _resize_to_width(composited, width)
    return _encode(output, image_format, settings)


def render_blank_mockup(
    base_source: str, *, width: int, image_format: ImageFormat, settings: Settings
) -> bytes:
    base = _decode_color(base_source, settings)
    return _encode(_resize_to_width(base, width), image_format, settings)


def _cv2():
    import cv2

    return cv2


def _decode_color(source: str, settings: Settings) -> np.ndarray:
    cv2 = _cv2()
    data = load_asset_bytes(source, settings)
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not decode image: {source}")
    return cast(np.ndarray, image)


def _tint_catalog_base(base: np.ndarray, color_hex: str) -> np.ndarray:
    """Recolor the largest non-white object while retaining the source texture."""
    normalized = color_hex.strip().lstrip("#")
    if len(normalized) != 6 or any(value not in "0123456789abcdefABCDEF" for value in normalized):
        raise ValueError(f"Invalid garment color: {color_hex}")

    cv2 = _cv2()
    gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
    distance_from_white = 255 - base.min(axis=2)
    foreground = ((gray < 248) | (distance_from_white > 10)).astype(np.uint8) * 255
    foreground = cv2.morphologyEx(
        foreground,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
    )
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground)
    if component_count <= 1:
        return base.copy()
    largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    garment_mask = (labels == largest_label).astype(np.uint8) * 255
    garment_mask = cv2.GaussianBlur(garment_mask, (0, 0), sigmaX=0.8)

    solid_pixels = gray[garment_mask > 220]
    reference = max(20.0, float(np.median(solid_pixels))) if solid_pixels.size else 128.0
    red, green, blue = (int(normalized[index : index + 2], 16) for index in (0, 2, 4))
    target = np.array([blue, green, red], dtype=np.float32)
    # Provider templates are usually photographed in black. Multiplying a white
    # target by gray/reference clips most of that source to pure white and turns
    # fabric texture into harsh black noise. Shift the source luminance around a
    # display-safe target instead, preserving folds without blowing highlights.
    target_luma = float(target.mean()) / 255.0
    display_target = 8.0 + target * 0.86
    contrast = 0.38 + 0.25 * (1.0 - target_luma)
    luminance_delta = (gray.astype(np.float32) - reference) * contrast
    tinted = np.clip(display_target[None, None, :] + luminance_delta[:, :, None], 0, 255)
    alpha = garment_mask.astype(np.float32)[:, :, None] / 255.0
    return np.clip(tinted * alpha + base.astype(np.float32) * (1.0 - alpha), 0, 255).astype(
        np.uint8
    )


def _decode_alpha(source: str, settings: Settings) -> np.ndarray:
    cv2 = _cv2()
    data = rasterize_svg_if_needed(source, load_asset_bytes(source, settings))
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"Could not decode artwork: {source}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    if image.shape[2] == 3:
        alpha = np.full(image.shape[:2], 255, dtype=np.uint8)
        image = np.dstack([image, alpha])
    return cast(np.ndarray, image)


def _decode_gray(source: str, settings: Settings, size: tuple[int, int]) -> np.ndarray:
    cv2 = _cv2()
    data = load_asset_bytes(source, settings)
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"Could not decode grayscale image: {source}")
    return cast(np.ndarray, cv2.resize(image, size, interpolation=cv2.INTER_LINEAR))


def _warp_artwork(
    artwork: np.ndarray,
    dst_quad: list[tuple[float, float]],
    base_width: int,
    base_height: int,
) -> np.ndarray:
    cv2 = _cv2()
    src_height, src_width = artwork.shape[:2]
    src = np.float32([[0, 0], [src_width, 0], [src_width, src_height], [0, src_height]])
    dst = np.float32(dst_quad)
    matrix = cv2.getPerspectiveTransform(src, dst)
    return cast(
        np.ndarray,
        cv2.warpPerspective(
            artwork,
            matrix,
            (base_width, base_height),
            flags=cv2.INTER_LANCZOS4,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0, 0),
        ),
    )


def _fit_artwork(
    artwork: np.ndarray,
    dst_quad: list[tuple[float, float]],
    fit: str,
) -> np.ndarray:
    """Fit artwork to the print area's aspect ratio without stretching it."""
    cv2 = _cv2()
    target_width, target_height = _quad_size(dst_quad)
    source_height, source_width = artwork.shape[:2]
    scale_x = target_width / source_width
    scale_y = target_height / source_height
    scale = max(scale_x, scale_y) if fit == "cover" else min(scale_x, scale_y)
    resized_width = max(1, round(source_width * scale))
    resized_height = max(1, round(source_height * scale))
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_LANCZOS4
    resized = cv2.resize(artwork, (resized_width, resized_height), interpolation=interpolation)

    if fit == "cover":
        left = max(0, (resized_width - target_width) // 2)
        top = max(0, (resized_height - target_height) // 2)
        return cast(np.ndarray, resized[top : top + target_height, left : left + target_width])

    canvas = np.zeros((target_height, target_width, 4), dtype=np.uint8)
    left = (target_width - resized_width) // 2
    top = (target_height - resized_height) // 2
    canvas[top : top + resized_height, left : left + resized_width] = resized
    return canvas


def _quad_size(dst_quad: list[tuple[float, float]]) -> tuple[int, int]:
    top_left, top_right, bottom_right, bottom_left = dst_quad
    top_width = math.dist(top_left, top_right)
    bottom_width = math.dist(bottom_left, bottom_right)
    left_height = math.dist(top_left, bottom_left)
    right_height = math.dist(top_right, bottom_right)
    return max(1, round((top_width + bottom_width) / 2)), max(
        1, round((left_height + right_height) / 2)
    )


def _apply_displacement(layer: np.ndarray, displacement: np.ndarray, strength: float) -> np.ndarray:
    cv2 = _cv2()
    height_map = displacement.astype(np.float32) / 255.0
    grad_x = cv2.Sobel(height_map, cv2.CV_32F, 1, 0, ksize=5)
    grad_y = cv2.Sobel(height_map, cv2.CV_32F, 0, 1, ksize=5)
    height, width = displacement.shape[:2]
    grid_x, grid_y = np.meshgrid(
        np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32)
    )
    map_x = grid_x + grad_x * strength
    map_y = grid_y + grad_y * strength
    return cast(
        np.ndarray,
        cv2.remap(
            layer, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_TRANSPARENT
        ),
    )


def _derive_surface_maps(base: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    cv2 = _cv2()
    gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
    smooth = cv2.GaussianBlur(gray, (0, 0), sigmaX=2.4)
    local_detail = cv2.addWeighted(gray, 1.7, smooth, -0.7, 0)
    displacement = cv2.normalize(local_detail, None, 96, 160, cv2.NORM_MINMAX)
    shadow = cv2.normalize(smooth, None, 150, 255, cv2.NORM_MINMAX)
    highlight = cv2.normalize(smooth, None, 0, 150, cv2.NORM_MINMAX)
    return displacement, shadow, highlight


def _screen(base_rgb: np.ndarray, blend_rgb: np.ndarray, opacity: float) -> np.ndarray:
    screened = 255.0 - ((255.0 - base_rgb) * (255.0 - blend_rgb) / 255.0)
    return (screened * opacity) + (base_rgb * (1.0 - opacity))


def _alpha_composite(base_bgr: np.ndarray, overlay_bgra: np.ndarray) -> np.ndarray:
    base = base_bgr.astype(np.float32)
    overlay_rgb = overlay_bgra[:, :, :3].astype(np.float32)
    alpha = overlay_bgra[:, :, 3].astype(np.float32)[:, :, None] / 255.0
    return np.clip((overlay_rgb * alpha) + (base * (1.0 - alpha)), 0, 255).astype(np.uint8)


def _resize_to_width(image: np.ndarray, width: int) -> np.ndarray:
    cv2 = _cv2()
    height, current_width = image.shape[:2]
    if current_width == width:
        return image
    next_height = int(height * (width / current_width))
    return cast(np.ndarray, cv2.resize(image, (width, next_height), interpolation=cv2.INTER_AREA))


def _encode(image: np.ndarray, image_format: ImageFormat, settings: Settings) -> bytes:
    cv2 = _cv2()
    if image_format == "webp":
        extension = ".webp"
        params = [cv2.IMWRITE_WEBP_QUALITY, settings.webp_quality]
    elif image_format == "jpeg":
        extension = ".jpg"
        params = [cv2.IMWRITE_JPEG_QUALITY, settings.jpeg_quality]
    else:
        extension = ".png"
        params = [cv2.IMWRITE_PNG_COMPRESSION, 6]

    ok, buffer = cv2.imencode(extension, image, params)
    if not ok:
        raise ValueError(f"Could not encode output as {image_format}")
    return cast(bytes, buffer.tobytes())
