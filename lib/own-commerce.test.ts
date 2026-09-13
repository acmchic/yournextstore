import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ownCommerce, productGetByCatalog, resolveStoreConfig } from "@/lib/own-commerce";
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

test("read requests retry transient store API responses", async () => {
	const originalFetch = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = (async () => {
		calls += 1;
		return calls === 1 ? new Response(null, { status: 503 }) : Response.json({ data: [] });
	}) as typeof fetch;
	try {
		assert.deepEqual((await ownCommerce.legalPageBrowse()).data, []);
		assert.equal(calls, 2);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("read requests retry network failures before succeeding", async () => {
	const originalFetch = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = (async () => {
		calls += 1;
		if (calls === 1) throw new TypeError("fetch failed");
		return Response.json({ data: [] });
	}) as typeof fetch;
	try {
		assert.deepEqual((await ownCommerce.legalPageBrowse()).data, []);
		assert.equal(calls, 2);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("store metadata falls back to the configured storefront when the API is unavailable", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
	try {
		const result = await ownCommerce.meGet();
		assert.equal(result.store.name, storefront.brandName);
		assert.equal(result.store.currency, "usd");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("catalog media keeps blank placement images alongside variant images", async () => {
	const originalFetch = globalThis.fetch;
	const front = "/design/classic-t-shirt_color-navy.webp?placement=front&v=10";
	const back = "/design/classic-t-shirt_color-navy.webp?placement=back&v=10";
	const blankBack = "/design/classic-t-shirt_color-navy.webp?placement=back&blank=1&v=11";
	globalThis.fetch = (async () =>
		Response.json({
			id: "product-1",
			slug: "design",
			title: "Design",
			description: null,
			brand: "TeeBravo",
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
			seo: { title: "Design", description: null, canonical: "/product/design" },
			design: { slug: "design", alt_text: "Design", checksum: "checksum" },
			default_catalog: "classic-t-shirt",
			default_color: "navy",
			default_color_name: "Navy",
			variants: [
				{
					id: "variant-1",
					sku: "DESIGN-NAVY-S",
					price_minor: 2299,
					compare_at_minor: null,
					currency: "USD",
					catalog: "classic-t-shirt",
					catalog_name: "Classic T-Shirt",
					color: "navy",
					color_name: "Navy",
					color_hex: "#202a44",
					size: "S",
					size_label: "S",
					stock: 1,
					images: [front, back],
				},
			],
			media: [
				{
					catalog: "classic-t-shirt",
					color: "navy",
					style: "flat",
					placement: "back",
					url: front,
					blank_url: blankBack,
				},
			],
		})) as typeof fetch;
	try {
		const product = await productGetByCatalog("design", "classic-t-shirt");
		assert.ok(product?.variants[0]?.images.some((image) => image.endsWith(blankBack)));
	} finally {
		globalThis.fetch = originalFetch;
	}
});
