from __future__ import annotations

import hashlib
import hmac
import string
from dataclasses import dataclass

ALPHABET = string.digits + string.ascii_lowercase + string.ascii_uppercase


@dataclass(frozen=True)
class ProductRef:
    slug_ref: str | None
    public_id: str | None


def public_slug(slug: str, max_words: int = 5) -> str:
    parts = [part for part in slug.strip().lower().split("-") if part]
    return "-".join(parts[:max_words]) or "product"


def parse_product_ref(value: str | None) -> ProductRef:
    if not value:
        return ProductRef(slug_ref=None, public_id=None)

    normalized = value.strip().strip("/")
    if not normalized:
        return ProductRef(slug_ref=None, public_id=None)

    slug_ref, separator, public_id = normalized.rpartition("-")
    if separator and len(public_id) == 3 and public_id.isalnum():
        return ProductRef(slug_ref=slug_ref, public_id=public_id)

    return ProductRef(slug_ref=normalized, public_id=None)


def build_product_ref(*, secret: str, product_id: str, slug: str) -> str:
    return (
        f"{public_slug(slug)}-{product_public_id(secret=secret, product_id=product_id, slug=slug)}"
    )


def product_public_id(*, secret: str, product_id: str, slug: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"), f"{product_id}:{slug}".encode(), hashlib.sha256
    ).digest()
    value = int.from_bytes(digest[:6], "big")
    return _base62(value)[:3]


def _base62(value: int) -> str:
    if value == 0:
        return ALPHABET[0]

    chars: list[str] = []
    base = len(ALPHABET)
    while value:
        value, remainder = divmod(value, base)
        chars.append(ALPHABET[remainder])
    return "".join(reversed(chars))
