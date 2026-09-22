import argparse
import asyncio
import json
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from PIL import Image

from app import cli
from app.importer import import_design, product_name_from_filename


class MemoryDatabase:
    def __init__(self, *args):
        self.rows = []
        self.lastrowid = 1

    @asynccontextmanager
    async def transaction(self):
        yield self

    async def execute(self, query, params):
        self.rows.append((query, params))

    async def fetchone(self):
        return None

    async def close(self):
        pass


def test_batch_limit_paths_manifest_and_render_read(tmp_path, monkeypatch, capsys):
    from app.rendering.assets import load_asset_bytes
    from app.settings import Settings

    assets = tmp_path / "public"
    root = assets / "design" / "external" / "ids" / "gmc"
    root.mkdir(parents=True)
    for index in range(101):
        Image.new("RGB", (2, 3)).save(root / f"Example {index:03}.png")
    monkeypatch.setattr(cli, "settings", SimpleNamespace(asset_root=assets))
    monkeypatch.setattr(cli, "Database", MemoryDatabase)
    args = argparse.Namespace(
        design_dir=str(root.parent), limit=100, offset=0, publish=False, dry_run=False
    )
    asyncio.run(cli.run_import(args))
    first = json.loads(capsys.readouterr().out)
    assert (first["count"], first["total"], first["next_offset"], first["done"]) == (
        100,
        101,
        100,
        False,
    )
    assert first["results"][0]["title"] == "Example 000"
    assert first["results"][0]["source_path"] == "external/ids/gmc/Example 000.png"
    manifest = json.loads((assets / "design" / "manifest.json").read_text())
    assert len(manifest) == 100
    assert (
        load_asset_bytes("design/" + manifest["example-000"], Settings(asset_root=assets))
        == (root / "Example 000.png").read_bytes()
    )
    args.offset = 100
    asyncio.run(cli.run_import(args))
    last = json.loads(capsys.readouterr().out)
    assert last["count"] == 1 and last["done"]
    assert len(json.loads((assets / "design" / "manifest.json").read_text())) == 101
    assert len(list(root.iterdir())) == 101


def test_bad_image_and_symlink_escape_do_not_abort_batch(tmp_path, monkeypatch, capsys):
    assets = tmp_path / "public"
    root = assets / "design" / "external"
    root.mkdir(parents=True)
    (root / "broken.png").write_text("not an image")
    outside = tmp_path / "outside.png"
    Image.new("RGB", (2, 3)).save(outside)
    (root / "escape.png").symlink_to(outside)
    Image.new("RGB", (2, 3)).save(root / "valid.png")
    monkeypatch.setattr(cli, "settings", SimpleNamespace(asset_root=assets))
    monkeypatch.setattr(cli, "Database", MemoryDatabase)
    asyncio.run(
        cli.run_import(
            argparse.Namespace(
                design_dir=str(root), limit=100, offset=0, publish=False, dry_run=False
            )
        )
    )
    results = json.loads(capsys.readouterr().out)["results"]
    assert [item["status"] for item in results] == ["error", "error", "created"]


def test_trial_preserves_published_status_and_rejects_slug_collision(tmp_path):
    root = tmp_path / "design"
    source = root / "external" / "hello.png"
    source.parent.mkdir(parents=True)
    Image.new("RGB", (2, 3)).save(source)

    class ExistingDatabase(MemoryDatabase):
        existing_path = "external/hello.png"

        async def fetchone(self):
            return {
                "id": 1,
                "public_id": "existing",
                "source_path": self.existing_path,
                "checksum": "old",
                "status": "active",
            }

    database = ExistingDatabase()
    result = asyncio.run(
        import_design(
            database=database,
            design_root=source.parent,
            design_path=source,
            publish=False,
            dry_run=False,
        )
    )
    assert result.source_path == "external/hello.png"
    updates = [params for query, params in database.rows if "update " in query]
    assert updates[0][-2] == "active"
    assert updates[1][3] == updates[1][-2] == "active"
    (root / "manifest.json").unlink()
    database.existing_path = "other/hello.png"
    with pytest.raises(ValueError, match="another image"):
        asyncio.run(
            import_design(
                database=database,
                design_root=source.parent,
                design_path=source,
                publish=False,
                dry_run=False,
            )
        )


def test_imported_external_image_renders_storefront_webp(tmp_path, monkeypatch):
    import hashlib
    import io
    import os
    from unittest.mock import AsyncMock

    import numpy as np

    from app import main, repository
    from app.cache import FileCache
    from app.product_media import build_catalog_mockup_url
    from app.settings import Settings

    # Model a read-only bind mount with two paths to the same inode, without Docker.
    original = tmp_path / "host-images" / "Red Artwork.png"
    original.parent.mkdir()
    Image.new("RGBA", (80, 80), (255, 0, 0, 255)).save(original)
    original.chmod(0o444)
    original_bytes = original.read_bytes()
    assets = tmp_path / "runtime" / "public"
    mounted = assets / "design" / "external" / "gmc" / original.name
    mounted.parent.mkdir(parents=True)
    os.link(original, mounted)
    (assets / "mockup").mkdir()
    Image.new("RGB", (200, 200), "white").save(assets / "mockup" / "tee.png")
    settings = Settings(asset_root=assets, cache_dir=tmp_path / "cache", max_width=200)
    monkeypatch.setattr(main, "settings", settings)
    monkeypatch.setattr(repository, "settings", settings)
    monkeypatch.setattr(main, "cache", FileCache(settings.cache_dir))
    monkeypatch.setattr(main, "render_locks", [asyncio.Lock() for _ in range(64)])

    async def exercise():
        imported = await import_design(
            database=MemoryDatabase(),
            design_root=mounted.parent,
            design_path=mounted,
            publish=True,
            dry_run=False,
        )
        database = AsyncMock()
        variant = {
            "product_id": imported.product_id,
            "product_slug": imported.slug,
            "artwork_id": "des-test",
            "artwork_slug": imported.slug,
            "artwork_checksum": hashlib.sha256(original_bytes).hexdigest(),
            "catalog_variant_public_id": "cv-test",
            "catalog_id": 1,
            "catalog_slug": "tee",
            "artwork_guideline_json": {},
            "product_type": "t-shirt",
            "color_id": 1,
            "color_slug": "white",
            "garment_color": "#ffffff",
        }
        asset = {"local_path": "mockup/tee.png", "checksum": "base", "width": 200, "height": 200}
        database.fetch_one.side_effect = [variant, None, asset, variant, None, asset]
        repo = repository.CatalogRepository(database)
        url = build_catalog_mockup_url(
            product_ref=imported.slug,
            catalog_slug="tee",
            color_slug="white",
        )
        assert url == "/red-artwork/tee/white.webp"
        first = await main.render_simple_product_image(
            product_slug=imported.slug,
            catalog_slug="tee",
            color="white",
            repo=repo,
        )
        second = await main.render_simple_product_image(
            product_slug=imported.slug,
            catalog_slug="tee",
            color="white",
            repo=repo,
        )
        assert first.status_code == second.status_code == 200
        assert first.headers["content-type"] == "image/webp"
        assert first.headers["x-mockup-cache"] == "miss"
        assert second.headers["x-mockup-cache"] == "hit"
        assert second.path.read_bytes() == first.body
        with Image.open(io.BytesIO(first.body)) as rendered:
            assert rendered.format == "WEBP" and rendered.size == (200, 200)
            pixels = np.asarray(rendered.convert("RGB")).astype(int)
            assert ((pixels[:, :, 0] > 180) & (pixels[:, :, 1] < 80)).sum() > 100
        assert original.samefile(mounted)
        assert original.read_bytes() == original_bytes

    asyncio.run(exercise())


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("1-baby-love-t-shirt_3ec.png", "1 baby love"),
        ("1-baby-love-mug_abc.png", "1 baby love"),
        ("1-baby-love-tank-top_abc.png", "1 baby love"),
        ("My-Love-T-SHIRT_ABC.PNG", "My Love"),
        ("best-dad-coffee-mug-colored_3ec.png", "best dad"),
        ("mugshot-hatred-captain_3ec.png", "mugshot hatred captain"),
        ("love_tank_top_3ec.png", "love"),
        ("love-t-shirt.png", "love"),
        ("family_photo_2024.png", "family photo 2024"),
        ("_quot_sloths-are-my-spirit-animal_quot__6ac.png", "sloths are my spirit animal"),
        ("love-quotations-t-shirt_3ec.png", "love quotations"),
    ],
)
def test_product_name_excludes_types_without_partial_word_matches(filename, expected):
    assert product_name_from_filename(filename) == expected


def test_clean_name_import_preserves_original_filename_and_bytes(tmp_path):
    root = tmp_path / "design"
    root.mkdir()
    original = root / "1-baby-love-t-shirt_3ec.png"
    Image.new("RGBA", (20, 20), "red").save(original)
    original.chmod(0o444)
    before = original.read_bytes()
    result = asyncio.run(
        import_design(
            database=MemoryDatabase(),
            design_root=root,
            design_path=original,
            publish=False,
            dry_run=False,
        )
    )
    assert result.title == "1 baby love"
    assert result.source_path == original.name
    assert result.slug == "1-baby-love-t-shirt-3ec"
    assert original.read_bytes() == before
    assert json.loads((root / "manifest.json").read_text())[result.slug] == original.name
    assert list(root.glob("*.png")) == [original]
    with pytest.raises(ValueError, match="No meaningful product name"):
        product_name_from_filename("t-shirt-mug_3ec.png")
