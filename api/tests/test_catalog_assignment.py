from app.catalog_assignment import stable_variant_id


def test_stable_variant_id_is_repeatable_and_bounded() -> None:
    first = stable_variant_id("prd_example", "gcv_example")
    second = stable_variant_id("prd_example", "gcv_example")

    assert first == second
    assert first.startswith("pv_")
    assert len(first) == 35


def test_stable_variant_id_changes_with_catalog_variant() -> None:
    assert stable_variant_id("prd_example", "gcv_a") != stable_variant_id(
        "prd_example", "gcv_b"
    )
