from dataclasses import replace

from PIL import Image

from scripts import analyze_catalog_mockups


def test_candidate_images_includes_folder_images_except_avatar(tmp_path, monkeypatch):
    monkeypatch.setattr(
        analyze_catalog_mockups,
        "settings",
        replace(analyze_catalog_mockups.settings, asset_root=tmp_path),
    )
    catalog_dir = tmp_path / "mockup" / "unisex" / "demo-catalog"
    catalog_dir.mkdir(parents=True)
    for filename in ("avatar-1.png", "front.png", "women_black_front.png"):
        Image.new("RGB", (10, 12), "black").save(catalog_dir / filename)

    candidates = analyze_catalog_mockups._candidate_images(
        "demo-catalog",
        [{"id": 7, "placement": "front", "local_path": "mockup/unisex/demo-catalog/front.png"}],
    )

    paths = {candidate["source_path"] for candidate in candidates}
    assert "mockup/unisex/demo-catalog/avatar-1.png" not in paths
    assert paths == {
        "mockup/unisex/demo-catalog/front.png",
        "mockup/unisex/demo-catalog/women_black_front.png",
    }
    assert {candidate["placement"] for candidate in candidates} == {
        "front",
        analyze_catalog_mockups._image_key("mockup/unisex/demo-catalog/women_black_front.png"),
    }
    assert analyze_catalog_mockups._image_key("women_black_front.png").startswith("image-")
