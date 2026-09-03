from __future__ import annotations

import argparse
import shutil
from dataclasses import replace
from pathlib import Path

import cv2

from app.models import PrintArea, RenderJob
from app.rendering.pipeline import render_mockup
from app.settings import Settings

SAMPLES = (
    {
        "name": "black-front",
        "base": "t-shirt/black-front.png",
        "artwork": "design/scooby-ghost_4c4.png",
        "quad": [(840, 650), (1560, 650), (1560, 1500), (840, 1500)],
    },
    {
        "name": "black-front-men",
        "base": "t-shirt/black-front-men.png",
        "artwork": "design/child-transparent.png",
        "quad": [(380, 355), (740, 355), (740, 835), (380, 835)],
    },
    {
        "name": "black-front-women",
        "base": "t-shirt/black-front-women.png",
        "artwork": "design/scooby-ghost_4c4.png",
        "quad": [(430, 345), (820, 345), (820, 775), (430, 775)],
    },
)


def generate_samples(source_root: Path, output_root: Path) -> list[Path]:
    asset_root = output_root / "assets"
    asset_root.mkdir(parents=True, exist_ok=True)
    settings = replace(Settings(), asset_root=asset_root, webp_quality=90)

    return [
        _generate_sample(
            sample, source_root=source_root, output_root=output_root, settings=settings
        )
        for sample in SAMPLES
    ]


def _generate_sample(
    sample: dict[str, object],
    *,
    source_root: Path,
    output_root: Path,
    settings: Settings,
) -> Path:
    name = str(sample["name"])
    base_source = Path(str(sample["base"]))
    artwork_source = Path(str(sample["artwork"]))
    base_target = Path("bases") / f"{name}{base_source.suffix}"
    artwork_target = Path("artwork") / f"{name}{artwork_source.suffix}"
    _copy_asset(source_root / base_source, settings.asset_root / base_target)
    _copy_asset(source_root / artwork_source, settings.asset_root / artwork_target)

    displacement_target, shadow_target, highlight_target = _make_surface_maps(
        settings.asset_root / base_target,
        settings.asset_root / "maps",
        name,
    )
    print_area = PrintArea(
        dst_quad=sample["quad"],
        displacement_strength=3.0,
        shadow_opacity=0.14,
        highlight_opacity=0.08,
        artwork_fit="contain",
    )
    job = RenderJob(
        product_id="sample",
        artwork_id=artwork_target.as_posix(),
        template_id=name,
        base_source=base_target.as_posix(),
        artwork_source=artwork_target.as_posix(),
        displacement_source=displacement_target.relative_to(settings.asset_root).as_posix(),
        shadow_source=shadow_target.relative_to(settings.asset_root).as_posix(),
        highlight_source=highlight_target.relative_to(settings.asset_root).as_posix(),
        print_area=print_area,
    )
    output_path = output_root / f"{name}.webp"
    output_path.write_bytes(render_mockup(job, width=1200, image_format="webp", settings=settings))
    return output_path


def _copy_asset(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def _make_surface_maps(base_path: Path, map_root: Path, name: str) -> tuple[Path, Path, Path]:
    map_root.mkdir(parents=True, exist_ok=True)
    base = cv2.imread(str(base_path), cv2.IMREAD_COLOR)
    if base is None:
        raise ValueError(f"Could not decode sample base: {base_path}")
    gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
    smooth = cv2.GaussianBlur(gray, (0, 0), sigmaX=2.4)
    local_detail = cv2.addWeighted(gray, 1.7, smooth, -0.7, 0)
    displacement = cv2.normalize(local_detail, None, 96, 160, cv2.NORM_MINMAX)
    shadow = cv2.normalize(smooth, None, 150, 255, cv2.NORM_MINMAX)
    highlight = cv2.normalize(smooth, None, 0, 150, cv2.NORM_MINMAX)

    paths = tuple(
        map_root / f"{name}-{suffix}.png" for suffix in ("displacement", "shadow", "highlight")
    )
    for path, image in zip(paths, (displacement, shadow, highlight), strict=True):
        if not cv2.imwrite(str(path), image):
            raise ValueError(f"Could not write sample map: {path}")
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local mockup quality samples")
    parser.add_argument("source_root", type=Path)
    parser.add_argument("output_root", type=Path)
    args = parser.parse_args()
    generated = generate_samples(args.source_root.resolve(), args.output_root.resolve())
    print("\n".join(str(path) for path in generated))


if __name__ == "__main__":
    main()
