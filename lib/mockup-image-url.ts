type MockupImageParams = {
	productId: string;
	artworkId: string;
	templateId: string;
	variantId?: string | null;
	width?: number;
	format?: "webp" | "png" | "jpeg";
};

export function buildMockupImageUrl({
	productId,
	artworkId,
	templateId,
	variantId,
	width = 1200,
	format = "webp",
}: MockupImageParams) {
	const params = new URLSearchParams({
		product_id: productId,
		artwork_id: artworkId,
		template_id: templateId,
		width: String(width),
		format,
	});

	if (variantId) {
		params.set("variant_id", variantId);
	}

	return `/api/mockups/render?${params.toString()}`;
}
