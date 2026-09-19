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
