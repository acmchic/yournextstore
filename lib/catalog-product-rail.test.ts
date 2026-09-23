import assert from "node:assert/strict";
import { test } from "node:test";
import { getListingColorName, selectListingColor } from "@/lib/catalog-product-rail";

const variant = (color: string, stock = 10) => ({
	stock,
	combinations: [
		{
			variantValue: {
				value: color,
				variantType: { label: "Color" },
			},
		},
	],
});

test("catalog rail rotates in-stock colors using the listing position", () => {
	const variants = [variant("Black"), variant("Natural"), variant("Red"), variant("Black")];

	const selected = Array.from({ length: 6 }, (_, position) =>
		getListingColorName(selectListingColor(variants, position) ?? variants[0]),
	);

	assert.deepEqual(selected, ["Black", "Natural", "Red", "Black", "Natural", "Red"]);
});

test("catalog rail never selects an out-of-stock color", () => {
	const selected = selectListingColor([variant("Black", 0), variant("Natural"), variant("Red")], 0);

	assert.equal(getListingColorName(selected ?? variant("Fallback")), "Natural");
});

test("catalog rail skips white while another in-stock color is available", () => {
	const variants = [variant("White"), variant("Black"), variant("Red")];
	const selected = Array.from({ length: 4 }, (_, position) =>
		getListingColorName(selectListingColor(variants, position) ?? variants[0]),
	);

	assert.deepEqual(selected, ["Black", "Red", "Black", "Red"]);
});

test("catalog rail falls back to white when no other color is available", () => {
	const selected = selectListingColor([variant("White"), variant("Black", 0)], 0);

	assert.equal(getListingColorName(selected ?? variant("Fallback")), "White");
});
