from pathlib import Path

from app.rendering.print_regions import detect_repeated_print_regions


def test_detects_two_tumbler_print_regions() -> None:
    image = Path("public/mockup/home-living/20oz-curved-ss-tumbler/gallery-3.png")
    fallback = {"x": 0.2, "y": 0.17, "width": 0.63, "height": 0.83}

    regions = detect_repeated_print_regions(image, fallback)

    assert len(regions) == 2
    assert regions[0]["x"] < 0.5 < regions[1]["x"]
    assert all(0 < region["width"] < 0.35 for region in regions)


def test_keeps_provider_region_for_single_apparel_item() -> None:
    image = Path("public/mockup/other/authentic-short-5250/gallery-2.png")
    fallback = {"x": 0.31, "y": 0.19, "width": 0.38, "height": 0.38}

    assert detect_repeated_print_regions(image, fallback) == [fallback]
