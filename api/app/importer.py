from __future__ import annotations

import fcntl
import hashlib
import html
import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image

from app.db import Database

SUPPORTED_EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg"}


@dataclass(frozen=True)
class ImportResult:
    slug: str
    status: str
    product_id: str | None
    warnings: tuple[str, ...] = ()
    title: str = ""
    source_path: str = ""


def slugify(value: str) -> str:
    stem = Path(value).stem
    normalized = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


_SMALL_WORDS = {
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "of", "on",
    "or", "the", "to", "with", "is", "it", "its", "my", "your",
}
_UNCAPPED = {"i", "i'm", "i'd", "i'll", "i've", "us", "usa", "nyc", "diy", "bff"}


def prettify_product_title(raw: str) -> str:
    """Convert a raw filename-derived title (all-lowercase, no punctuation)
    into a presentable Title Case headline, restoring common apostrophes."""
    name = raw.replace("dont", "don't").replace("cant ", "can't ").replace("wont ", "won't ")
    name = re.sub(r"\byoure\b", "you're", name, flags=re.IGNORECASE)
    name = re.sub(r"\byour\b(?= )", "your", name)
    name = re.sub(r"\bles\b(?=s? )", "Les", name, flags=re.IGNORECASE)
    words = name.split()
    out: list[str] = []
    for idx, word in enumerate(words):
        low = word.lower()
        if low in _UNCAPPED:
            out.append(low.upper() if len(low) <= 3 else word.upper())
            continue
        if idx not in (0, len(words) - 1) and low in _SMALL_WORDS:
            out.append(low)
            continue
        out.append(low.capitalize())
    return " ".join(out)


def product_name_exclusions() -> re.Pattern[str]:
    config = json.loads(Path(__file__).with_name("product-name-exclusions.json").read_text())
    if not isinstance(config, dict) or not all(
        isinstance(terms, list) and all(isinstance(term, str) and term.strip() for term in terms)
        for terms in config.values()
    ):
        raise ValueError("Product name exclusions must contain lists of nonempty phrases")
    phrases = {re.sub(r"[-_\s]+", " ", term).strip() for terms in config.values() for term in terms}
    if not phrases:
        return re.compile(r"(?!)")
    return re.compile(
        r"(?<!\w)(?:"
        + "|".join(re.escape(term) for term in sorted(phrases, key=len, reverse=True))
        + r")(?!\w)",
        re.IGNORECASE,
    )


def product_name_from_filename(filename: str) -> str:
    name = re.sub(r"_[a-z0-9]{3}$", "", Path(filename).stem, flags=re.IGNORECASE)
    name = html.unescape(name)
    name = re.sub(r"_quot_", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"[-_\s]+", " ", name)
    name = product_name_exclusions().sub(" ", name)
    name = re.sub(r"[^\w\s]", " ", name)
    name = " ".join(name.split())
    if not name:
        raise ValueError(
            f"No meaningful product name remains after removing product types: {filename}"
        )
    return name


def load_sidecar(design_path: Path) -> dict[str, Any]:
    sidecar = design_path.with_suffix(".json")
    if not sidecar.is_file():
        return {}
    value = json.loads(sidecar.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TypeError(f"Sidecar must contain an object: {sidecar}")
    return value


def register_design_manifest(*, design_root: Path, design_path: Path, slug: str) -> Path:
    design_directory = next(
        (
            path
            for path in (design_root.resolve(), *design_root.resolve().parents)
            if path.name == "design"
        ),
        None,
    )
    if design_directory is None:
        raise ValueError("Design directory must be inside a directory named 'design'")

    return register_design_manifests(
        design_directory,
        {slug: design_path.resolve().relative_to(design_directory).as_posix()},
    )


def register_design_manifests(design_directory: Path, entries: dict[str, str]) -> Path:
    manifest_path = design_directory / "manifest.json"
    with (design_directory / ".manifest.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
        if not isinstance(manifest, dict):
            raise TypeError("design/manifest.json must contain an object")
        manifest.update(entries)
        temporary = manifest_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(manifest, ensure_ascii=False) + "\n")
        temporary.replace(manifest_path)
    return manifest_path


async def import_design(
    *,
    database: Database,
    design_root: Path,
    design_path: Path,
    publish: bool,
    dry_run: bool,
    manifest_root: Path | None = None,
    register_manifest: bool = True,
    preview_names: set[str] | None = None,
) -> ImportResult:
    root = design_root.resolve()
    source = design_path.resolve()
    if not source.is_relative_to(root):
        raise ValueError("Design path must stay inside the configured design directory")
    if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported design type: {source.suffix}")
    if not source.is_file():
        raise FileNotFoundError(source)

    metadata = load_sidecar(source)
    slug = str(metadata.get("slug") or slugify(source.name))
    if not slug:
        raise ValueError(f"Could not derive a slug for {source.name}")
    title = str(metadata.get("title") or product_name_from_filename(source.name))
    title = " ".join(unicodedata.normalize("NFKC", title).split())
    if metadata.get("title") is None:
        title = prettify_product_title(title)
    if not title or len(title) > 255:
        raise ValueError("Product name must contain between 1 and 255 characters")
    description = str(
        metadata.get("description")
        or f"{title[:1].upper()}{title[1:]} graphic design. Choose an available style, color and size, then preview your selection."
    )
    seo_title = str(metadata.get("seo_title") or title)
    seo_description = str(metadata.get("seo_description") or (
        description if len(description) <= 500 else description[:497].rsplit(" ", 1)[0] + "…"
    ))
    if len(seo_title) > 255 or len(seo_description) > 500:
        raise ValueError("SEO title must be at most 255 characters; SEO description at most 500")
    alt_text = str(metadata.get("alt_text") or f"{title} product design")
    license_status = str(metadata.get("license_status") or "owned")
    with source.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    with Image.open(source) as image:
        width, height = image.size
    storage_root = (
        manifest_root.resolve()
        if manifest_root
        else next((path for path in (root, *root.parents) if path.name == "design"), root)
    )
    relative_source = source.relative_to(storage_root).as_posix()
    public_design_id = f"des_{uuid.uuid4().hex[:22]}"
    public_product_id = f"prd_{uuid.uuid4().hex[:22]}"
    status = "active" if publish else "draft"
    warnings: list[str] = []

    # ponytail: serialize imports across processes; per-name locks if throughput requires it.
    async with database.transaction(lock_name="teebravo:product-import") as cursor:
        await cursor.execute(
            "select slug from products where title=%s order by id limit 1 for update",
            (title,),
        )
        duplicate = await cursor.fetchone()
        name_key = title.casefold()
        if (duplicate and duplicate["slug"] != slug) or (
            dry_run and preview_names is not None and name_key in preview_names
        ):
            return ImportResult(
                slug=slug, status="skipped", product_id=None, title=title,
                source_path=relative_source,
                warnings=("Product name already exists; duplicate image skipped.",),
            )
        if dry_run:
            if preview_names is not None:
                preview_names.add(name_key)
            return ImportResult(
                slug=slug, status="dry-run", product_id=None, title=title, source_path=relative_source
            )

        await cursor.execute(
            "select id, public_id, checksum, source_path, status from designs where slug=%s for update",
            (slug,),
        )
        existing_design = await cursor.fetchone()
        if existing_design:
            existing_source = existing_design["source_path"]
            if existing_source != relative_source:
                manifest_path = storage_root / "manifest.json"
                manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
                if manifest.get(slug) != relative_source:
                    raise ValueError(f"Slug already belongs to another image: {slug}")
            design_id = existing_design["id"]
            design_status = status if publish else existing_design["status"]
            await cursor.execute(
                """
                update designs set name=%s, source_path=%s, checksum=%s, width=%s, height=%s,
                  license_status=%s, alt_text=%s, metadata_json=%s, status=%s
                where id=%s
                """,
                (
                    title,
                    relative_source,
                    checksum,
                    width,
                    height,
                    license_status,
                    alt_text,
                    json.dumps(metadata),
                    design_status,
                    design_id,
                ),
            )
            result_status = "unchanged" if existing_design["checksum"] == checksum else "updated"
        else:
            await cursor.execute(
                """
                insert into designs(public_id, slug, name, source_path, checksum, width, height,
                  license_status, alt_text, metadata_json, status)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    public_design_id,
                    slug,
                    title,
                    relative_source,
                    checksum,
                    width,
                    height,
                    license_status,
                    alt_text,
                    json.dumps(metadata),
                    status,
                ),
            )
            design_id = cursor.lastrowid
            result_status = "created"

        await cursor.execute(
            "select id, public_id, status, title, description, seo_title, seo_description from products where slug=%s for update", (slug,)
        )
        product = await cursor.fetchone()
        if product:
            # Preserve edited copy; only replace the previous generated boilerplate.
            old_description = f"Original {product.get('title', title)} design prepared for made-to-order products."
            if not metadata.get("description") and product.get("description") not in (None, "", old_description):
                description = product["description"]
            if not metadata.get("seo_title") and product.get("seo_title") not in (None, "", product.get("title")):
                seo_title = product["seo_title"]
            if not metadata.get("seo_description") and product.get("seo_description") not in (None, "", old_description[:500]):
                seo_description = product["seo_description"]
            product_id = product["id"]
            product_status = status if publish else product["status"]
            product_public_id = product["public_id"]
            await cursor.execute(
                """
                update products set design_id=%s, title=%s, description=%s, status=%s,
                  seo_title=%s, seo_description=%s,
                  published_at=if(%s='active', coalesce(published_at, current_timestamp(6)), null)
                where id=%s
                """,
                (
                    design_id,
                    title,
                    description,
                    product_status,
                    seo_title,
                    seo_description,
                    product_status,
                    product_id,
                ),
            )
        else:
            product_public_id = public_product_id
            await cursor.execute(
                """
                insert into products(public_id, design_id, slug, title, description, status, brand,
                  seo_title, seo_description, published_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,if(%s='active',current_timestamp(6),null))
                """,
                (
                    product_public_id,
                    design_id,
                    slug,
                    title,
                    description,
                    status,
                    str(metadata.get("brand") or "TeeBravo"),
                    seo_title,
                    seo_description,
                    status,
                ),
            )
            product_id = cursor.lastrowid

        for collection_slug in metadata.get("collections", []):
            await cursor.execute(
                """
                insert ignore into collection_products(collection_id, product_id)
                select id, %s from collections where slug=%s and status='active'
                """,
                (product_id, collection_slug),
            )

        await cursor.execute(
            "insert into outbox_events(event_type, aggregate_type, aggregate_id, payload_json) values ('product.changed','product',%s,%s)",
            (product_public_id, json.dumps({"slug": slug})),
        )

    if register_manifest:
        register_design_manifests(storage_root, {slug: relative_source})

    return ImportResult(
        slug=slug,
        status=result_status,
        product_id=product_public_id,
        warnings=tuple(warnings),
        title=title,
        source_path=relative_source,
    )
