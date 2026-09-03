import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveStoreConfig } from "@/lib/own-commerce";
import { storefront } from "@/lib/storefront-config";

describe("resolveStoreConfig", () => {
	test("uses storefront defaults when the store endpoint returns null", () => {
		assert.deepEqual(resolveStoreConfig(null), {
			name: storefront.brandName,
			currency: "usd",
			locale: "en-US",
		});
	});

	test("normalizes values returned by the store endpoint", () => {
		assert.deepEqual(resolveStoreConfig({ name: "POD Store", currency: "EUR", locale: "de-DE" }), {
			name: "POD Store",
			currency: "eur",
			locale: "de-DE",
		});
	});
});
