"""Authoritative USD shipping rates and CMS substitutions."""

import json


DELIVERY_KEYS = (
    "processing_min_business_days",
    "processing_max_business_days",
    "standard_transit_min_business_days",
    "standard_transit_max_business_days",
    "express_transit_min_business_days",
    "express_transit_max_business_days",
)


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def shipping_options(config, quantity):
    if quantity < 1:
        return []
    return [
        {
            "id": method,
            "name": name,
            "amount_minor": config[f"{method}_first_minor"]
            + (quantity - 1) * config[f"{method}_additional_minor"],
        }
        for method, name in (("standard", "Standard"), ("express", "Express"))
    ]


def policy_values(config):
    values = {key: str(value or "") for key, value in decode(config["details_json"]).items()}
    for method in ("standard", "express"):
        for part in ("first", "additional"):
            values[f"{method}_{part}"] = f"${config[f'{method}_{part}_minor'] / 100:.2f}"
    values["processing_time"] = business_day_range(
        config.get("processing_min_business_days"),
        config.get("processing_max_business_days"),
    )
    values["standard_transit"] = business_day_range(
        config.get("standard_transit_min_business_days"),
        config.get("standard_transit_max_business_days"),
    )
    values["express_transit"] = business_day_range(
        config.get("express_transit_min_business_days"),
        config.get("express_transit_max_business_days"),
    )
    return values


def business_day_range(minimum, maximum):
    if minimum is None or maximum is None:
        return ""
    if minimum == maximum:
        return f"{minimum} business day" + ("s" if minimum != 1 else "")
    return f"{minimum}–{maximum} business days"


def delivery_settings(config):
    return {
        "enabled": bool(config.get("pdp_assurance_enabled"))
        and all(config.get(key) is not None for key in DELIVERY_KEYS),
        **{key: config.get(key) for key in DELIVERY_KEYS},
    }


def render_policy(content, config):
    for key, value in policy_values(config).items():
        content = content.replace("{{" + key + "}}", value)
    return content
