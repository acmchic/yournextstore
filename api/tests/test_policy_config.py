import json
from pathlib import Path

import pytest

from app.policy_config import check_publish, merge_settings, validate
from app.shipping import render_policy


def template():
    return json.loads((Path(__file__).parents[1] / "policies.json").read_text())


def config():
    return {
        "details_json": {"support_email": "owner@example.com"},
        "standard_first_minor": 500,
        "standard_additional_minor": 300,
        "express_first_minor": 1100,
        "express_additional_minor": 400,
    }


def test_template_has_seven_drafts_and_preserves_owner_facts():
    data = validate(template())
    assert len(data["pages"]) == 7
    assert all(not page["published"] for page in data["pages"])
    merged = merge_settings(config(), data)
    assert json.loads(merged["details_json"])["support_email"] == "owner@example.com"
    assert merged["standard_first_minor"] == 500


def test_incomplete_policy_cannot_publish():
    page = {**template()["pages"][2], "published": True}
    with pytest.raises(ValueError, match="missing facts"):
        check_publish(page, config())


def test_unknown_tokens_cannot_publish():
    with pytest.raises(ValueError, match="unknown_fact"):
        check_publish({"slug": "test", "published": True, "content": "{{unknown_fact}}"}, config())


def test_rates_and_origin_render_from_shared_settings():
    text = render_policy("{{standard_first}} {{storefront_url}}", config())
    from app.settings import settings

    assert text == "$5.00 " + settings.storefront_public_url


def test_rejects_duplicate_slugs_and_invalid_delivery_ranges():
    data = template()
    data["pages"].append(data["pages"][0])
    with pytest.raises(ValueError, match="duplicate"):
        validate(data)
    with pytest.raises(ValueError, match="range"):
        merge_settings(
            config(),
            {"delivery": {"processing_min_business_days": 5, "processing_max_business_days": 2}},
        )
