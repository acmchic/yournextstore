import assert from "node:assert/strict";
import { test } from "node:test";
import type { APIProductGetByIdResult } from "commerce-kit";
import { escapeXml, merchantVariants } from "@/lib/merchant";

test("merchant variant URL selects the exact color and size and uses actual stock", () => {
	const product = {
		id: "design-1",
		slug: "graphic",
		name: "Graphic hoodie",
		summary: "Design & clothing",
		category: { slug: "hoodie", name: "Premium Hoodie" },
		images: [],
		variants: [
			{
				id: "variant-1",
				sku: "SKU-1",
				price: "2999",
				stock: 0,
				images: ["https://teebravo.com/img/hoodie.webp"],
				combinations: [
					{ variantValue: { value: "Navy Blue", variantType: { label: "Color" } } },
					{ variantValue: { value: "XL", variantType: { label: "Size" } } },
				],
			},
		],
	} as unknown as NonNullable<APIProductGetByIdResult>;
	const [item] = merchantVariants(product, "https://teebravo.com", "USD");
	assert.equal(item.groupId, "design-1:hoodie");
	assert.equal(item.title, "Graphic hoodie — Premium Hoodie");
	assert.equal(new URL(item.link).searchParams.get("Color"), "Navy Blue");
	assert.equal(new URL(item.link).searchParams.get("Size"), "XL");
	assert.equal(item.price, "29.99");
	assert.equal(item.availability, "out_of_stock");
	assert.equal(escapeXml(item.description), "Design &amp; clothing");
});
