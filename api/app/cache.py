from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.models import ImageFormat, RenderJob


class FileCache:
    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def key_for(self, job: RenderJob, *, width: int, image_format: ImageFormat) -> str:
        payload = {
            "product_id": job.product_id,
            "variant_id": job.variant_id,
            "artwork_id": job.artwork_id,
            "template_id": job.template_id,
            "version": job.version,
            "width": width,
            "format": image_format,
        }
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def path_for(self, key: str, image_format: ImageFormat) -> Path:
        return self._cache_dir / f"{key}.{image_format}"
