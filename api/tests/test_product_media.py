import json

from app.importer import register_design_manifest, slugify
from app.product_media import build_blank_media_url, build_media_url


def test_build_media_url_uses_stable_semantic_path() -> None:
    assert (
        build_media_url(
            design_slug="rookie-dad-2024",
            catalog_slug="t-shirt",
            color_slug="black",
            style="women",
            placement="front",
        )
        == "/img/rookie-dad-2024/t-shirt-black-women-front.webp"
    )


def test_slugify_normalizes_a_design_filename() -> None:
    assert slugify("Rookie Dad 2024.png") == "rookie-dad-2024"


def test_blank_media_url_uses_the_original_base_view() -> None:
    assert (
        build_blank_media_url(
            catalog_slug="t-shirt",
            color_slug="black",
            style="women",
            placement="left-chest",
        )
        == "/img/blank/t-shirt-black-women-front.webp"
    )


def test_register_design_manifest_uses_paths_relative_to_design_directory(tmp_path) -> None:
    design_root = tmp_path / "public" / "design" / "ids" / "gmc"
    design_root.mkdir(parents=True)
    design_path = design_root / "new-design.png"
    design_path.write_bytes(b"image")

    manifest_path = register_design_manifest(
        design_root=design_root,
        design_path=design_path,
        slug="new-design",
    )

    assert json.loads(manifest_path.read_text()) == {"new-design": "ids/gmc/new-design.png"}
