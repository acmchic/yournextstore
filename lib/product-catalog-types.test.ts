import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiCatalog } from "@/lib/own-commerce";
import { getProductCatalogTypeOptions } from "@/lib/product-catalog-types";

function catalog(
	slug: string,
	name: string,
	department: ApiCatalog["taxonomy"][number]["department"],
	typeSlug: string,
) {
	return {
		id: slug,
		slug,
		name,
		product_type: "t-shirt",
		material: null,
		brand: null,
		product_count: 1,
		taxonomy: [{ department, type_slug: typeSlug, type_label: "T-Shirts", sort_order: 0 }],
		colors: [],
		sizes: [],
	} satisfies ApiCatalog;
}

test("catalog type options stay within the current product family and separate youth from kids", () => {
	const unisex = catalog("classic-t-shirt", "Classic T-Shirt", "unisex", "t-shirts");
	const catalogs = [
		unisex,
		catalog("women-slim-fit-tee", "Women's Slim Fit Tee", "women", "t-shirts"),
		catalog("youth-lightweight-tee", "Youth Lightweight Tee", "kids", "t-shirts"),
		catalog("kids-classic-tee", "Kids Classic Tee", "kids", "t-shirts"),
		catalog("unisex-hoodie", "Unisex Hoodie", "unisex", "hoodies"),
	];

	assert.deepEqual(getProductCatalogTypeOptions(catalogs, unisex), {
		unisex: [{ slug: "classic-t-shirt", name: "Classic T-Shirt" }],
		women: [{ slug: "women-slim-fit-tee", name: "Women's Slim Fit Tee" }],
		youth: [{ slug: "youth-lightweight-tee", name: "Youth Lightweight Tee" }],
		kids: [{ slug: "kids-classic-tee", name: "Kids Classic Tee" }],
	});
});
