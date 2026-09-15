"""Portable CMS policies: python -m app.policy_config import|export [file]."""

import argparse
import asyncio
import json
import re
from pathlib import Path

from app.db import Database
from app.settings import settings
from app.shipping import DELIVERY_KEYS, decode, policy_values

DETAIL_KEYS = frozenset(
    [
        "business_name",
        "business_address",
        "support_email",
        "about_story",
        "restrictions",
        "returns_eligibility",
        "returns_window",
        "returns_method",
        "returns_fees",
        "refund_timing",
        "privacy_details",
        "terms_conditions",
    ]
)
RATE_KEYS = tuple(
    f"{method}_{part}_minor"
    for method in ("standard", "express")
    for part in ("first", "additional")
)


def validate(payload):
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise ValueError("Expected policy config version 1")
    details = payload.get("details", {})
    if not isinstance(details, dict) or set(details) - DETAIL_KEYS:
        raise ValueError("Unknown business detail fields")
    if any(not isinstance(v, str) or len(v) > 5000 for v in details.values()):
        raise ValueError("Business details must be strings of at most 5000 characters")
    for group, allowed in (("delivery", DELIVERY_KEYS), ("rates", RATE_KEYS)):
        values = payload.get(group, {})
        if not isinstance(values, dict) or set(values) - set(allowed):
            raise ValueError(f"Unknown {group} fields")
        for value in values.values():
            if value is not None and (
                type(value) is not int or not 0 <= value <= (60 if group == "delivery" else 100000)
            ):
                raise ValueError(f"Invalid {group} value")
    pages = payload.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("Expected nonempty pages list")
    seen = set()
    for page in pages:
        if not isinstance(page, dict) or set(page) != {"slug", "title", "content", "published"}:
            raise ValueError("Each page needs slug, title, content and published")
        slug = page["slug"]
        if (
            not isinstance(slug, str)
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug)
            or len(slug) > 120
            or slug in seen
        ):
            raise ValueError("Invalid or duplicate policy slug")
        seen.add(slug)
        if any(not isinstance(page[k], str) or not page[k].strip() for k in ("title", "content")):
            raise ValueError("Policy title and content cannot be blank")
        if len(page["title"]) > 200 or type(page["published"]) is not bool:
            raise ValueError("Invalid title or publication flag")
    return payload


def merge_settings(current, payload):
    # Empty template values never erase owner-entered business facts.
    details = {
        **decode(current["details_json"]),
        **{key: value for key, value in payload.get("details", {}).items() if value.strip()},
    }
    merged = {**current, "details_json": json.dumps(details)}
    merged.update(
        {
            key: value
            for group in ("delivery", "rates")
            for key, value in payload.get(group, {}).items()
            if value is not None
        }
    )
    for prefix in ("processing", "standard_transit", "express_transit"):
        minimum, maximum = (merged.get(f"{prefix}_{part}_business_days") for part in ("min", "max"))
        if (minimum is None) != (maximum is None) or (minimum is not None and minimum > maximum):
            raise ValueError(f"Invalid {prefix} range")
    return merged


def check_publish(page, config):
    if not page["published"]:
        return
    values = policy_values(config)
    missing = [
        key
        for key in re.findall(r"\{\{([^{}]+)\}\}", page["content"])
        if not values.get(key, "").strip()
    ]
    if missing:
        raise ValueError(f"{page['slug']}: missing facts: {', '.join(sorted(set(missing)))}")


async def import_config(database, payload, overwrite=False, dry_run=False):
    validate(payload)
    async with database.transaction() as cursor:
        await cursor.execute("select * from checkout_settings where id=1 for update")
        current = await cursor.fetchone()
        if not current:
            raise ValueError("Run checkout migrations before importing policies")
        config = merge_settings(current, payload)
        await cursor.execute("select slug,title,content,published from legal_pages for update")
        existing = {page["slug"]: page for page in await cursor.fetchall()}
        selected = [page for page in payload["pages"] if overwrite or page["slug"] not in existing]
        final = {**existing, **{page["slug"]: page for page in selected}}
        for page in final.values():
            check_publish(page, config)
        report = {
            "write": [p["slug"] for p in selected],
            "preserved": [p["slug"] for p in payload["pages"] if p not in selected],
            "dry_run": dry_run,
        }
        if dry_run:
            return report
        fields = ("details_json", *DELIVERY_KEYS, *RATE_KEYS)
        await cursor.execute(
            "update checkout_settings set "
            + ",".join(f"{key}=%s" for key in fields)
            + ",updated_at=current_timestamp(6) where id=1",
            tuple(config.get(key) for key in fields),
        )
        for page in selected:
            await cursor.execute(
                "insert into legal_pages(slug,title,content,published,created_at,updated_at) "
                "values(%s,%s,%s,%s,current_timestamp,current_timestamp) "
                "on duplicate key update title=values(title),content=values(content),"
                "published=values(published),updated_at=current_timestamp",
                tuple(page[key] for key in ("slug", "title", "content", "published")),
            )
        return report


async def run(args):
    database = Database(settings)
    try:
        if args.mode == "import":
            payload = json.loads(args.file.read_text())
            print(
                json.dumps(
                    await import_config(database, payload, args.overwrite, args.dry_run), indent=2
                )
            )
        else:
            async with database.transaction() as cursor:
                await cursor.execute("select * from checkout_settings where id=1 for update")
                config = await cursor.fetchone()
                await cursor.execute(
                    "select slug,title,content,published from legal_pages order by slug"
                )
                pages = await cursor.fetchall()
            payload = {
                "version": 1,
                "details": {
                    key: value or "" for key, value in decode(config["details_json"]).items()
                },
                "delivery": {key: config.get(key) for key in DELIVERY_KEYS},
                "rates": {key: config[key] for key in RATE_KEYS},
                "pages": [{**page, "published": bool(page["published"])} for page in pages],
            }
            validate(payload)
            # Refuse accidental replacement of an existing export/template.
            with args.file.open("x", encoding="utf-8") as output:
                output.write(json.dumps(payload, indent=2) + "\n")
            print(f"Exported {len(pages)} policies to {args.file}")
    finally:
        await database.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("import", "export"))
    parser.add_argument("file", type=Path)
    parser.add_argument(
        "--overwrite", action="store_true", help="Replace existing policies from JSON"
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate against DB without writes")
    asyncio.run(run(parser.parse_args()))
