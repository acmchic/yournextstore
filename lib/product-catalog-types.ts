import type { ApiCatalog } from "@/lib/own-commerce";

export const productCatalogTypes = ["unisex", "women", "youth", "kids"] as const;

export type ProductCatalogType = (typeof productCatalogTypes)[number];

export type ProductCatalogStyle = {
	slug: string;
	name: string;
};

export type ProductCatalogTypeOptions = Record<ProductCatalogType, ProductCatalogStyle[]>;

function getProductCatalogType(catalog: ApiCatalog): ProductCatalogType | null {
	const departments = new Set(catalog.taxonomy.map(({ department }) => department));

	if (departments.has("unisex")) {
		return "unisex";
	}
	if (departments.has("women")) {
		return "women";
	}
	if (departments.has("kids")) {
		return /\b(youth|junior)\b/i.test(`${catalog.slug} ${catalog.name}`) ? "youth" : "kids";
	}

	return null;
}

export function getProductCatalogTypeOptions(
	catalogs: ApiCatalog[],
	currentCatalog?: ApiCatalog,
): ProductCatalogTypeOptions {
	const emptyOptions: ProductCatalogTypeOptions = {
		unisex: [],
		women: [],
		youth: [],
		kids: [],
	};

	if (!currentCatalog) {
		return emptyOptions;
	}

	const typeSlugs = new Set(currentCatalog.taxonomy.map(({ type_slug }) => type_slug));
	const sameFamily = (candidate: ApiCatalog) =>
		typeSlugs.size > 0
			? candidate.taxonomy.some(({ type_slug }) => typeSlugs.has(type_slug))
			: candidate.product_type === currentCatalog.product_type;
	const familyCatalogs = catalogs.filter(sameFamily);

	return Object.fromEntries(
		productCatalogTypes.map((type) => [
			type,
			familyCatalogs
				.filter((catalog) => getProductCatalogType(catalog) === type)
				.map(({ slug, name }) => ({ slug, name })),
		]),
	) as ProductCatalogTypeOptions;
}
