import math

from app.rendering.print_area import (
    PRINT_AREA_ASPECT_RATIO,
    fit_apparel_print_area,
    is_valid_print_area,
    normalize_provider_print_area,
    resolve_print_areas,
)


def test_fits_apparel_area_to_42_by_48_inside_original_bounds():
    area = {"x": 0.3, "y": 0.2, "width": 0.4, "height": 0.4}

    fitted = fit_apparel_print_area(
        area,
        product_type="kids-t-shirt",
        template_width=1000,
        template_height=1000,
    )

    assert fitted["x"] > area["x"]
    assert fitted["y"] == area["y"]
    assert fitted["width"] < area["width"]
    assert fitted["height"] == area["height"]
    assert fitted["width"] * 1000 / (fitted["height"] * 1000) == PRINT_AREA_ASPECT_RATIO
    assert fitted["x"] + fitted["width"] <= area["x"] + area["width"]


def test_fits_aspect_in_template_pixels_and_leaves_non_apparel_unchanged():
    area = {"x": 0.2, "y": 0.1, "width": 0.6, "height": 0.5}

    fitted = fit_apparel_print_area(
        area,
        product_type="hoodie",
        template_width=1200,
        template_height=1600,
    )
    unchanged = fit_apparel_print_area(
        area,
        product_type="tumbler",
        template_width=1200,
        template_height=1600,
    )

    assert fitted["width"] * 1200 / (fitted["height"] * 1600) == PRINT_AREA_ASPECT_RATIO
    assert unchanged == area


def test_normalizes_full_canvas_pixel_guides_to_safe_apparel_area():
    area = normalize_provider_print_area(
        {
            "canvasWidth": 600,
            "canvasHeight": 600,
            "designAreaX": 0,
            "designAreaY": 0,
            "designAreaWidth": 600,
            "designAreaHeight": 600,
        },
        product_type="long-sleeve",
        template_width=600,
        template_height=600,
    )

    assert is_valid_print_area(area)
    assert area["x"] > 0
    assert area["y"] > 0
    assert area["width"] < 1
    assert area["height"] < 1
    assert math.isclose(area["width"] / area["height"], PRINT_AREA_ASPECT_RATIO)


def test_rejects_oversized_saved_regions_before_they_reach_the_renderer():
    area, regions = resolve_print_areas(
        {"x": 0, "y": 0, "width": 6, "height": 6},
        [{"x": 0, "y": 0, "width": 6, "height": 6}],
        product_type="unisex-jersey-tank",
        template_width=1024,
        template_height=1024,
    )

    assert is_valid_print_area(area)
    assert all(is_valid_print_area(region) for region in regions)
    assert regions == [area]
    assert math.isclose(
        area["width"] * 1024 / (area["height"] * 1024),
        PRINT_AREA_ASPECT_RATIO,
    )
