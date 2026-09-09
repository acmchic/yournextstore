import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ownCommerce, resolveStoreConfig } from "@/lib/own-commerce";
import { storefront } from "@/lib/storefront-config";

describe("resolveStoreConfig", () => {
	test("uses storefront defaults when the store endpoint returns null", () => {
		assert.deepEqual(resolveStoreConfig(null), {
			name: storefront.brandName,
			currency: "usd",
			locale: "en-US",
		});
	});

	test("keeps the configured brand while normalizing store currency and locale", () => {
		assert.deepEqual(resolveStoreConfig({ name: "POD Store", currency: "EUR", locale: "de-DE" }), {
			name: storefront.brandName,
			currency: "eur",
			locale: "de-DE",
		});
	});
});

test("policy adapter escapes executable HTML and returns null for unpublished or unknown pages", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async () =>
		Response.json({
			data: [
				{
					slug: "shipping-policy",
					title: "Shipping",
					content: '<script>alert("x")</script>\nDelivery & handling',
					updated_at: "2026-09-08T00:00:00Z",
				},
			],
		})) as typeof fetch;
	try {
		const page = await ownCommerce.legalPageGet("shipping-policy");
		assert.ok(page?.contentHtml.includes("&lt;script&gt;"));
		assert.ok(!page?.contentHtml.includes("<script>"));
		assert.equal(page?.href, "/shipping-policy");
		assert.equal(await ownCommerce.legalPageGet("draft-policy"), null);
		assert.equal((await ownCommerce.legalPageBrowse()).data[0]?.updatedAt, "2026-09-08T00:00:00Z");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
