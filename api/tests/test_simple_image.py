from __future__ import annotations

import asyncio

import cv2
import httpx
import numpy as np
from fastapi.testclient import TestClient

from app import main
from app.cache import FileCache
from app.models import PrintArea, RenderJob
from app.rendering.pipeline import render_mockup
from app.settings import Settings


def test_simple_image_contract_and_shared_cache(tmp_path, monkeypatch):
    calls = []
    renders = []
    job = RenderJob(
        product_id="p",
        artwork_id="a",
        template_id="t",
        base_source="base.png",
        artwork_source="art.png",
        print_area=PrintArea(dst_quad=[(0, 0)] * 4),
    )

    class Repository:
        async def get_catalog_render_job(self, **kwargs):
            calls.append(kwargs)
            return None if kwargs["color"] == "missing" else job

    def render(job, **kwargs):
        renders.append(kwargs)
        return b"webp-test"

    monkeypatch.setattr(main, "cache", FileCache(tmp_path))
    monkeypatch.setattr(main, "render_mockup", render)
    main.app.dependency_overrides[main.get_repository] = Repository
    try:
        with TestClient(main.app) as client:
            path = "/acacac2/classic-t-shirt_color-black.webp"
            first = client.get(path)
            second = client.get(path)
            assert first.status_code == 200
            assert first.headers["content-type"] == "image/webp"
            assert first.headers["x-mockup-cache"] == "miss"
            assert second.headers["x-mockup-cache"] == "hit"
            assert "immutable" not in second.headers["cache-control"]
            assert len(renders) == 1
            assert renders[0]["width"] == min(1500, main.settings.max_width)
            assert renders[0]["image_format"] == "webp"
            assert calls[0] == {
                "product_slug": "acacac2",
                "catalog_slug": "classic-t-shirt",
                "color": "black",
                "size": None,
                "placement": "front",
            }
            assert client.get("/acacac2/classic-t-shirt_color-missing.webp").status_code == 404
            assert client.get("/acacac2/classic-t-shirt_color-black.png").status_code == 404
            assert client.get("/health").status_code == 200
    finally:
        main.app.dependency_overrides.clear()


def test_delivery_resolution_preserves_fine_artwork(tmp_path):
    base = np.full((100, 100, 3), 255, np.uint8)
    art = np.full((200, 200, 4), 255, np.uint8)
    art[:, ::2, :3] = 0
    cv2.imwrite(str(tmp_path / "base.png"), base)
    cv2.imwrite(str(tmp_path / "art.png"), art)
    job = RenderJob(
        product_id="p",
        artwork_id="a",
        template_id="t",
        base_source="base.png",
        artwork_source="art.png",
        print_area=PrintArea(
            dst_quad=[(25, 25), (75, 25), (75, 75), (25, 75)], surface_mode="none"
        ),
    )
    output = render_mockup(
        job, width=400, image_format="png", settings=Settings(asset_root=tmp_path)
    )
    decoded = cv2.imdecode(np.frombuffer(output, np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape == (400, 400, 3)
    # A native-template composite reduces these alternating lines to flat gray.
    assert decoded[150:250, 150:250].std() > 100


def test_concurrent_misses_render_once(tmp_path, monkeypatch):
    import time

    renders = []
    job = RenderJob(
        product_id="p",
        artwork_id="a",
        template_id="t",
        base_source="base.png",
        artwork_source="art.png",
        print_area=PrintArea(dst_quad=[(0, 0)] * 4),
    )

    class Repository:
        async def get_catalog_render_job(self, **kwargs):
            return job

    def render(job, **kwargs):
        renders.append(job)
        time.sleep(0.03)
        return b"complete-image"

    monkeypatch.setattr(main, "cache", FileCache(tmp_path))
    monkeypatch.setattr(main, "render_mockup", render)
    monkeypatch.setattr(main, "render_locks", [asyncio.Lock() for _ in range(64)])
    main.app.dependency_overrides[main.get_repository] = Repository

    async def request_images():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app), base_url="http://test"
        ) as client:
            return await asyncio.gather(
                *[client.get("/acacac2/classic-t-shirt_color-black.webp") for _ in range(8)]
            )

    try:
        responses = asyncio.run(request_images())
        assert len(renders) == 1
        assert all(response.content == b"complete-image" for response in responses)
    finally:
        main.app.dependency_overrides.clear()
