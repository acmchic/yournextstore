import type { APIProductGetByIdResult } from "commerce-kit";

export function productDisplayName(product: { name: string; category?: { name: string } | null }) {
	return product.category?.name ? `${product.name} - ${product.category.name}` : product.name;
}

export function merchantVariants(
	product: NonNullable<APIProductGetByIdResult>,
	baseUrl: string,
	currency: string,
) {
	return product.variants.map((variant) => {
		const options = Object.fromEntries(
			variant.combinations.map((item) => [item.variantValue.variantType.label, item.variantValue.value]),
		);
		const path = `/product/${product.slug}${product.category?.slug ? `/${product.category.slug}` : ""}`;
		return {
			id: variant.id,
			groupId: `${product.id}:${product.category?.slug ?? "default"}`,
			title: productDisplayName(product),
			description: product.summary ?? product.name,
			sku: variant.sku ?? variant.id,
			image: variant.images[0] ?? product.images[0],
			link: `${baseUrl}${path}?${new URLSearchParams(options)}`,
			color: options.Color,
			size: options.Size,
			price: (Number(variant.price) / 100).toFixed(2),
			currency: currency.toUpperCase(),
			availability: variant.stock === null || variant.stock > 0 ? "in_stock" : "out_of_stock",
		};
	});
}

export function escapeXml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
