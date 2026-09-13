import { getCanonicalUrl } from "@/lib/commerce";
import { escapeXml, merchantVariants } from "@/lib/merchant";
import { catalogBrowse, shopBrowse } from "@/lib/own-commerce";
import { storefront } from "@/lib/storefront-config";

// Enable only after the business has verified payment, policies, images and rights.
export async function GET(request: Request) {
	if (process.env.MERCHANT_FEED_ENABLED !== "true")
		return Response.json({ error: "Merchant feed is not enabled for launch." }, { status: 503 });
	const query = new URL(request.url).searchParams;
	const department = query.get("department") ?? "unisex";
	const page = Number(query.get("page") ?? 1);
	if (!["unisex", "women", "kids"].includes(department) || !Number.isSafeInteger(page) || page < 1)
		return Response.json({ error: "Invalid feed page or department" }, { status: 400 });
	const [products, catalogs] = await Promise.all([
		shopBrowse({ department, limit: 12, offset: (page - 1) * 12 }),
		catalogBrowse(),
	]);
	if (page > 1 && !products.data.length) return new Response(null, { status: 404 });
	const base = getCanonicalUrl();
	const variants = products.data.flatMap((product) =>
		merchantVariants(product, base, "USD").map((variant) => ({
			...variant,
			catalog: catalogs.data.find((c) => c.slug === product.category?.slug),
		})),
	);
	if (
		!base.startsWith("https://") ||
		variants.some(
			(item) => !item.image?.startsWith("https://") || !item.color || !item.size || Number(item.price) <= 0,
		)
	)
		return Response.json(
			{ error: "Feed contains items missing a public HTTPS image, color, size or positive price." },
			{ status: 422 },
		);
	const tag = (name: string, value: string) => `<g:${name}>${escapeXml(value)}</g:${name}>`;
	const items = variants
		.map(
			(item) =>
				`<item>${tag("id", item.id)}${tag("item_group_id", item.groupId)}${tag("title", item.title)}${tag("description", item.description)}${tag("link", item.link)}${tag("image_link", item.image)}${tag("price", `${item.price} ${item.currency}`)}${tag("availability", item.availability)}${tag("condition", "new")}${tag("brand", storefront.brandName)}${tag("mpn", item.sku)}${tag("color", item.color)}${tag("size", item.size)}${tag("gender", department === "women" ? "female" : "unisex")}${tag("age_group", department === "kids" ? "kids" : "adult")}${tag("product_type", item.catalog?.name ?? "Clothing")}</item>`,
		)
		.join("");
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${escapeXml(storefront.brandName)}</title><link>${escapeXml(base)}</link><description>Clothing</description>${items}</channel></rss>`,
		{
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "no-store",
				"X-Feed-Pages": String(Math.ceil(products.meta.count / 12)),
			},
		},
	);
}
