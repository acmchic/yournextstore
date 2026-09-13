import { Suspense } from "react";
import { type Product, ProductGrid } from "@/components/sections/product-grid";
import { shopBrowse } from "@/lib/own-commerce";

export function RelatedProducts(props: { productId: string; categorySlug?: string }) {
	return (
		<Suspense>
			<RelatedProductsContent {...props} />
		</Suspense>
	);
}

/**
 * Pick recommendations from design/catalog pairs while keeping the section
 * visually varied. The shop endpoint can return the same design for multiple
 * catalogs, so we prefer other catalogs and then de-duplicate by design.
 */
export function selectRelatedProducts(
	products: Product[],
	currentProductId: string,
	currentCatalogSlug?: string,
	limit = 6,
) {
	const candidates = products.filter((product) => product.id !== currentProductId);
	const preferred = candidates.filter((product) => product.category?.slug !== currentCatalogSlug);
	const source = [
		...preferred,
		...candidates.filter((product) => product.category?.slug === currentCatalogSlug),
	];
	const catalogGroups = [...new Set(source.map((product) => product.category?.slug ?? "default"))].map(
		(catalogSlug) => source.filter((product) => (product.category?.slug ?? "default") === catalogSlug),
	);
	const interleaved = Array.from({
		length: Math.max(0, ...catalogGroups.map((group) => group.length)),
	}).flatMap((_, index) =>
		catalogGroups.map((group) => group[index]).filter((product): product is Product => Boolean(product)),
	);

	return interleaved.reduce<Product[]>((selected, product) => {
		if (selected.length >= limit || selected.some((item) => item.id === product.id)) return selected;
		selected.push(product);
		return selected;
	}, []);
}

async function RelatedProductsContent({
	productId,
	categorySlug,
}: {
	productId: string;
	categorySlug?: string;
}) {
	// A small over-fetch leaves room to remove the current design while keeping
	// the streamed PDP payload light; selection below returns six cards.
	const result = await shopBrowse({ limit: 18 });
	const related = selectRelatedProducts(result.data, productId, categorySlug);

	if (related.length === 0) return null;

	return (
		<ProductGrid
			title="You might also like"
			description="Fresh designs, fits, and colors to explore"
			products={related}
			showCatalogMeta
			showViewAll={false}
		/>
	);
}
