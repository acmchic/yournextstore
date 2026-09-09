from app.catalog_assignment import _catalog_matches_group, choose_showcase_color


def test_unisex_catalog_is_not_seeded_again_as_women() -> None:
    departments = {"men", "women"}

    assert _catalog_matches_group(departments, "unisex")
    assert not _catalog_matches_group(departments, "women")


def test_showcase_color_uses_a_popular_color_that_exists() -> None:
    colors = [
        {"slug": "maroon", "name": "Maroon"},
        {"slug": "white", "name": "White"},
        {"slug": "black", "name": "Black"},
    ]

    assert choose_showcase_color(colors, start_index=0) == colors[2]
    assert choose_showcase_color(colors, start_index=1) == colors[1]


def test_showcase_color_falls_back_to_catalog_colors() -> None:
    colors = [{"slug": "ash", "name": "Ash"}]

    assert choose_showcase_color(colors) == colors[0]
    assert choose_showcase_color([]) is None
