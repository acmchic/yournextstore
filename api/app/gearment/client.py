from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class GearmentError(RuntimeError):
    pass


@dataclass(frozen=True)
class GearmentClient:
    base_url: str
    client_key: str
    client_secret: str
    timeout: float = 30
    max_retries: int = 3

    def _request(self, path: str, params: list[tuple[str, str]]) -> dict[str, Any]:
        if not self.client_key or not self.client_secret:
            raise GearmentError(
                "Missing GEARMENT_CLIENT_KEY/GEARMENT_CLIENT_SECRET (API aliases are supported)"
            )
        url = f"{self.base_url}{path}?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "YourNextStore-CatalogSync/1.0",
                "X-Gearment-Client-Key": self.client_key,
                "X-Gearment-Client-Secret": self.client_secret,
            },
        )
        for attempt in range(self.max_retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    payload = json.load(response)
                if not isinstance(payload, dict):
                    raise GearmentError("Gearment response must be a JSON object")
                return payload
            except urllib.error.HTTPError as error:
                if error.code not in {429, 500, 502, 503, 504} or attempt == self.max_retries:
                    request_id = error.headers.get("request_id", "unknown")
                    raise GearmentError(
                        f"Gearment request failed ({error.code}, request_id={request_id})"
                    ) from error
                retry_after = error.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else min(2**attempt, 8)
                time.sleep(delay)
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == self.max_retries:
                    raise GearmentError("Gearment request failed after retries") from error
                time.sleep(min(2**attempt, 8))
        raise GearmentError("Gearment request retry loop exhausted")

    def list_catalog(self, product_ids: list[str]) -> list[dict[str, Any]]:
        page = 1
        rows: list[dict[str, Any]] = []
        while True:
            params = [("paging.page", str(page)), ("paging.limit", "100")]
            params.extend(("filter.product_ids", product_id) for product_id in product_ids)
            payload = self._request("/api/v3/catalog", params)
            data = payload.get("data")
            if not isinstance(data, list):
                raise GearmentError("Gearment catalog response is missing data[]")
            rows.extend(row for row in data if isinstance(row, dict))
            paging = payload.get("paging") or {}
            total_pages = int(paging.get("total_page") or paging.get("totalPage") or page)
            if page >= total_pages or not data:
                break
            page += 1
        return rows
