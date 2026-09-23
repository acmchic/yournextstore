import argparse
import asyncio
import json
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from PIL import Image

from app import cli
from app.importer import import_design, prettify_product_title, product_name_from_filename


class MemoryDatabase:
    def __init__(self, *args):
        self.rows = []
        self.lastrowid = 1

    @asynccontextmanager
    async def transaction(self, **kwargs):
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
                "slug": "hello",
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


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("dont stop cant quit", "Don't Stop Can't Quit"),
        ("youre my sunshine", "You're My Sunshine"),
        ("welcome to nyc", "Welcome to NYC"),
    ],
)
def test_prettify_product_title_matches_import_and_retitle_titles(raw, expected):
    assert prettify_product_title(raw) == expected


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
    assert result.title == "1 Baby Love"
    assert result.source_path == original.name
    assert result.slug == "1-baby-love-t-shirt-3ec"
    assert original.read_bytes() == before
    assert json.loads((root / "manifest.json").read_text())[result.slug] == original.name
    assert list(root.glob("*.png")) == [original]
    with pytest.raises(ValueError, match="No meaningful product name"):
        product_name_from_filename("t-shirt-mug_3ec.png")


def test_duplicate_names_skip_across_batches_without_changing_images(tmp_path, monkeypatch, capsys):
    class ProductDatabase(MemoryDatabase):
        products = []

        async def execute(self, query, params):
            await super().execute(query, params)
            if 'insert into products(' in query:
                self.products.append(dict(slug=params[2], title=params[3], description=params[4],
                                          seo_title=params[7], seo_description=params[8]))

        async def fetchone(self):
            query, params = self.rows[-1]
            if 'where title=' in query:
                return next((p for p in self.products if p['title'].casefold() == params[0].casefold()), None)
            return None

    assets = tmp_path / 'public'
    folder = assets / 'design' / 'external' / 'gmc'
    folder.mkdir(parents=True)
    for suffix in ('4f9', 'cb5', 'd6f', 'ef1', 'f05'):
        Image.new('RGB', (2, 3)).save(folder / f'10th-mountain-division_{suffix}.png')
    before = {p.name: p.read_bytes() for p in folder.iterdir()}
    monkeypatch.setattr(cli, 'settings', SimpleNamespace(asset_root=assets))
    monkeypatch.setattr(cli, 'Database', ProductDatabase)
    args = argparse.Namespace(design_dir=str(folder), limit=2, offset=0, publish=True, dry_run=False)
    statuses = []
    for offset in (0, 2, 4):
        args.offset = offset
        asyncio.run(cli.run_import(args))
        statuses.extend(r['status'] for r in json.loads(capsys.readouterr().out)['results'])
    assert statuses == ['created', 'skipped', 'skipped', 'skipped', 'skipped']
    assert len(ProductDatabase.products) == 1
    product = ProductDatabase.products[0]
    assert product['title'] == product['seo_title'] == '10th Mountain Division'
    assert 'Original' not in product['description']
    assert product['seo_description'] == product['description']
    assert len(json.loads((assets / 'design' / 'manifest.json').read_text())) == 1
    assert before == {p.name: p.read_bytes() for p in folder.iterdir()}


def test_preview_duplicates_and_explicit_seo_copy(tmp_path):
    source = tmp_path / 'baby-love-t-shirt_3ec.png'
    Image.new('RGB', (2, 3)).save(source)
    source.with_suffix('.json').write_text(json.dumps({
        'description': 'A small reminder of a big love.',
        'seo_title': 'Baby love design',
        'seo_description': 'Find the baby love design at TeeBravo.',
    }))
    database = MemoryDatabase()
    names = set()
    async def exercise():
        args = dict(database=database, design_root=tmp_path, design_path=source,
                    publish=False, register_manifest=False, preview_names=names)
        assert (await import_design(**args, dry_run=True)).status == 'dry-run'
        assert (await import_design(**args, dry_run=True)).status == 'skipped'
        assert not any('insert ' in query for query, _ in database.rows)
        assert (await import_design(**args, dry_run=False)).status == 'created'
    asyncio.run(exercise())
    params = next(params for query, params in database.rows if 'insert into products(' in query)
    assert params[4] == 'A small reminder of a big love.'
    assert params[7:9] == ('Baby love design', 'Find the baby love design at TeeBravo.')


def test_import_lock_is_released_after_commit_or_rollback():
    from unittest.mock import AsyncMock
    from app.db import Database

    events = []

    class Cursor:
        async def execute(self, sql, params):
            events.append('lock' if 'get_lock' in sql else 'release')

        async def fetchone(self):
            return {'acquired': 1}

    class Connection:
        async def ping(self, **kwargs):
            pass

        @asynccontextmanager
        async def cursor(self):
            yield Cursor()

        async def begin(self):
            events.append('begin')

        async def commit(self):
            events.append('commit')

        async def rollback(self):
            events.append('rollback')

    class Pool:
        closed = False

        @asynccontextmanager
        async def acquire(self):
            yield Connection()

    database = Database(SimpleNamespace())
    database._pool = Pool()
    database.connect = AsyncMock()

    async def exercise():
        async with database.transaction(lock_name='import'):
            events.append('write')
        assert events == ['lock', 'begin', 'write', 'commit', 'release']
        events.clear()
        with pytest.raises(ValueError):
            async with database.transaction(lock_name='import'):
                raise ValueError('failed image')
        assert events == ['lock', 'begin', 'rollback', 'release']

    asyncio.run(exercise())
