from __future__ import annotations

import io
import urllib.request
from pathlib import Path

from app.settings import Settings


def load_asset_bytes(source: str, settings: Settings) -> bytes:
    errors: list[Exception] = []
    for candidate in _candidate_sources(source):
        try:
            return _load_single_asset_bytes(candidate, settings)
        except (OSError, ValueError, TimeoutError) as error:
            errors.append(error)

    if errors:
        raise errors[-1]
    raise ValueError("Asset source is empty")


def _candidate_sources(source: str) -> list[str]:
    return [candidate.strip() for candidate in source.split("|") if candidate.strip()]


def _load_single_asset_bytes(source: str, settings: Settings) -> bytes:
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=15) as response:
            return response.read()

    path = Path(source)
    if not path.is_absolute():
        path = settings.asset_root / path
    path = path.resolve()

    if not _is_relative_to(path, settings.asset_root):
        raise ValueError(f"Asset path is outside MOCKUP_ASSET_ROOT: {source}")
    return path.read_bytes()


def rasterize_svg_if_needed(source: str, data: bytes) -> bytes:
    if not source.lower().endswith(".svg"):
        return data
    import cairosvg

    return cairosvg.svg2png(bytestring=data)


def bytes_to_buffer(data: bytes) -> io.BytesIO:
    return io.BytesIO(data)


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False
