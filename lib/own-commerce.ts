import type {
	APICartCreateResult,
	APICartGetResult,
	APICategoriesBrowseResult,
	APICategoryGetByIdResult,
	APICollectionGetByIdResult,
	APICollectionsBrowseResult,
	APIMeGetResult,
	APIProductGetByIdResult,
	APIProductsBrowseResult,
	Commerce,
} from "commerce-kit";
import { storefront } from "@/lib/storefront-config";

const API_URL = process.env.STORE_API_URL || "http://localhost:8000";
const now = () => new Date().toISOString();

function resolveMediaUrl(url: string): string {
	if (url.startsWith("/") && /^\/[^/]+\/[^/]+_color-[^/]+\.webp(?:\?.*)?$/.test(url)) {
		return `${API_URL}${url}`;
	}
	return url;
}

type CommerceClient = ReturnType<typeof Commerce>;
type OwnCommerceClient = Pick<
	CommerceClient,
	| "meGet"
	| "productBrowse"
	| "productGet"
	| "productFilters"
	| "cartGet"
	| "cartUpsert"
	| "collectionBrowse"
	| "collectionGet"
	| "categoriesBrowse"
	| "categoryGet"
	| "postBrowse"
	| "postGet"
	| "search"
	| "contactMessageCreate"
	| "subscriberCreate"
	| "productReviewsBrowse"
	| "productReviewCreate"
	| "orderGet"
> & {
	legalPageBrowse: () => Promise<{
		data: LegalPage[];
		meta: { count: number; offset: number; limit: number };
	}>;
	legalPageGet: (slug: string) => Promise<LegalPage | null>;
};

type LegalPage = { label: string; href: string; contentHtml: string; updatedAt: string };
type ApiLegalPage = { slug: string; title: string; content: string; updated_at: string };

function mapLegalPage(page: ApiLegalPage): LegalPage {
	const escaped = page.content
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
	return {
		label: page.title,
		href: `/${page.slug}`,
		updatedAt: page.updated_at,
		contentHtml: `<div style="white-space:pre-wrap">${escaped}</div>`,
	};
}

type ApiVariant = {
	id: string;
	sku: string;
	price_minor: number;
	compare_at_minor: number | null;
	currency: string;
	catalog: string;
	catalog_name: string;
	color: string;
	color_name: string;
	color_hex: string | null;
	size: string;
	size_label: string;
	stock: number;
	images?: string[];
};

type ApiMedia = {
	catalog: string;
	color: string;
	style: "flat" | "men" | "women";
	placement: "front" | "left-chest" | "back";
	url: string;
	blank_url: string;
};

type ApiProduct = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	brand: string;
	created_at: string;
	updated_at: string;
	seo: { title: string; description: string | null; canonical: string };
	design: { slug: string; alt_text: string; checksum: string };
	variants: ApiVariant[];
	media: ApiMedia[];
	default_catalog?: string | null;
	default_color?: string | null;
	default_color_name?: string | null;
};

type ApiBrowse = { data: ApiProduct[]; meta: { count: number; limit: number; offset: number } };
export type ApiCatalog = {
	id: string;
	slug: string;
	name: string;
	product_type: string;
	material: string | null;
	brand: string | null;
	description?: string | null;
	material_details?: { items?: string[] } | null;
	size_chart?: { unit?: string; note?: string; rows?: string[][] } | null;
	product_count: number;
	taxonomy: Array<{
		department: "men" | "women" | "kids" | "home-living" | "accessories";
		type_slug: string;
		type_label: string;
		sort_order: number;
	}>;
	colors: Array<{ slug: string; name: string; hex: string | null }>;
	sizes: Array<{ code: string; label: string }>;
};
type ApiCollection = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	image_url: string | null;
	indexable: boolean;
	created_at: string;
	updated_at: string;
	products?: ApiProduct[];
};
type ApiStore = {
	name?: string | null;
	currency?: string | null;
	locale?: string | null;
};
type ApiCart = {
	id: string;
	currency: string;
	created_at: string;
	updated_at: string;
	items: Array<{
		quantity: number;
		variant_id: string;
		sku: string;
		price_minor: number;
		product_id: string;
		product_slug: string;
		product_title: string;
		color: string;
		color_name: string;
		size: string;
		image: string;
	}>;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		...init,
		headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		if (response.status === 404) return null as T;
		throw new Error(`Store API ${response.status}: ${path}`);
	}
	return response.json() as Promise<T>;
}

export function resolveStoreConfig(store: ApiStore | null) {
	return {
		name: storefront.brandName,
		currency: (store?.currency || "USD").toLowerCase(),
		locale: store?.locale || "en-US",
	};
}

const categoryShape = (catalog: ApiCatalog) => ({
	id: catalog.id,
	name: catalog.name,
	slug: catalog.slug,
	image: null,
	createdAt: now(),
	updatedAt: now(),
	active: true,
	storeId: "own-store",
	description: null,
	position: "0",
	seo: { title: catalog.name, description: `Shop ${catalog.name}.`, canonical: `/category/${catalog.slug}` },
	longDescription: null,
	parentId: null,
});

function mapProduct(product: ApiProduct): NonNullable<APIProductGetByIdResult> {
	const defaultCatalog = product.default_catalog ?? product.variants[0]?.catalog ?? null;
	const defaultColorSlug =
		product.default_color ??
		product.variants.find((variant) => variant.catalog === defaultCatalog)?.color ??
		null;
	const defaultColorName =
		product.default_color_name ??
		product.variants.find(
			(variant) => variant.catalog === defaultCatalog && variant.color === defaultColorSlug,
		)?.color_name ??
		product.variants[0]?.color_name ??
		null;
	const selectedVariant = product.variants.find((variant) => variant.catalog === defaultCatalog);
	const preferredMedia = product.media.filter(
		(media) =>
			(!defaultCatalog || media.catalog === defaultCatalog) &&
			(!defaultColorSlug || media.color === defaultColorSlug),
	);
	const displayMedia = preferredMedia.length > 0 ? preferredMedia : product.media;
	const images = displayMedia.flatMap((item) =>
		[item.url, item.blank_url].filter(Boolean).map(resolveMediaUrl),
	);
	const catalogName = selectedVariant?.catalog_name ?? product.variants[0]?.catalog_name ?? "Products";
	const catalogSlug = defaultCatalog ?? product.variants[0]?.catalog ?? "products";
	const variants = product.variants.map((variant) => {
		const variantImages =
			variant.images?.map(resolveMediaUrl) ??
			product.media
				.filter((media) => media.catalog === variant.catalog && media.color === variant.color)
				.flatMap((media) => [media.url, media.blank_url].filter(Boolean).map(resolveMediaUrl));
		return {
			id: variant.id,
			createdAt: product.created_at,
			updatedAt: product.updated_at,
			storeId: "own-store",
			description: null,
			price: String(variant.price_minor),
			originalPrice: String(variant.compare_at_minor ?? variant.price_minor),
			images: variantImages,
			sku: variant.sku,
			barcode: null,
			calculatedPrice: null,
			stock: variant.stock,
			depth: null,
			width: null,
			height: null,
			weight: null,
			digital: null,
			shippable: true,
			externalId: null,
			productId: product.id,
			attributes: {},
			prices: [],
			prePromotionPrice: null,
			omnibusPrice: null,
			combinations: [
				{
					productVariantId: variant.id,
					variantValueId: `size-${variant.size}`,
					createdAt: product.created_at,
					updatedAt: product.updated_at,
					variantValue: {
						id: `size-${variant.size}`,
						value: variant.size,
						position: 0,
						colorValue: null,
						variantType: { id: "size", type: "string", label: "Size" },
					},
				},
				{
					productVariantId: variant.id,
					variantValueId: `color-${variant.color}`,
					createdAt: product.created_at,
					updatedAt: product.updated_at,
					variantValue: {
						id: `color-${variant.color}`,
						value: variant.color_name,
						position: 0,
						colorValue: variant.color_hex,
						variantType: { id: "color", type: "color", label: "Color" },
					},
				},
			],
		};
	});
	return {
		id: product.id,
		name: product.title,
		createdAt: product.created_at,
		updatedAt: product.updated_at,
		type: "product",
		slug: product.slug,
		status: "published",
		flags: null,
		storeId: "own-store",
		summary: product.description,
		content: null,
		images,
		defaultCatalog,
		defaultColor: defaultColorName,
		badge: null,
		bundleDiscountPercentage: null,
		bundlePriceMode: "fixed",
		bundleFixedPriceAmount: null,
		bundleAmountOffAmount: null,
		seo: product.seo,
		stripeTaxCode: null,
		categoryId: `cat-${catalogSlug}`,
		brandId: null,
		category: {
			id: `cat-${catalogSlug}`,
			name: catalogName,
			slug: catalogSlug,
			image: images[0] ?? null,
			createdAt: product.created_at,
			updatedAt: product.updated_at,
			active: true,
			storeId: "own-store",
			description: null,
			position: "0",
			seo: null,
			longDescription: null,
			parentId: null,
		},
		productTaxRate: null,
		productCollections: [],
		bundleProducts: [],
		variantsTypes: [],
		variants,
		volumePricingTiers: [],
	} as unknown as NonNullable<APIProductGetByIdResult>;
}

export async function productGetByCatalog(slug: string, catalog: string) {
	const search = new URLSearchParams({ catalog });
	const product = await apiFetch<ApiProduct | null>(
		`/v1/products/${encodeURIComponent(slug)}?${search.toString()}`,
	);
	return product ? mapProduct(product) : null;
}

export async function catalogBrowse() {
	return apiFetch<{ data: ApiCatalog[] }>("/v1/catalogs");
}

export async function shopBrowse({
	department,
	type,
	collection,
	limit = 24,
	offset = 0,
}: {
	department?: string;
	type?: string;
	collection?: string;
	limit?: number;
	offset?: number;
}) {
	const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
	if (department) query.set("department", department);
	if (type) query.set("product_type", type);
	if (collection) query.set("collection", collection);
	const result = await apiFetch<ApiBrowse>(`/v1/shop?${query}`);
	return { data: result.data.map(mapProduct), meta: result.meta };
}

export async function storefrontCollections() {
	return apiFetch<{ data: (ApiCollection & { featured: boolean; indexable: boolean })[] }>("/v1/collections");
}

function mapCart(cart: ApiCart | null): APICartGetResult {
	if (!cart) return null;
	return {
		id: cart.id,
		lineItems: cart.items.map((item) => ({
			id: `line-${item.variant_id}`,
			createdAt: cart.created_at,
			updatedAt: cart.updated_at,
			cartId: cart.id,
			quantity: item.quantity,
			productVariantId: item.variant_id,
			productVariant: {
				id: item.variant_id,
				price: String(item.price_minor),
				images: [item.image],
				sku: item.sku,
				product: {
					id: item.product_id,
					name: item.product_title,
					slug: item.product_slug,
					images: [item.image],
				},
			},
		})),
		currency: cart.currency,
		storeId: "own-store",
		createdAt: cart.created_at,
		updatedAt: cart.updated_at,
	} as unknown as APICartGetResult;
}

export const ownCommerce: OwnCommerceClient = {
	async meGet(): Promise<APIMeGetResult> {
		const store = resolveStoreConfig(await apiFetch<ApiStore | null>("/v1/store"));
		return {
			store: {
				id: "own-store",
				name: store.name,
				currency: store.currency,
				settings: {
					storeName: store.name,
					storeDescription: storefront.description,
					logo: "/logo.svg",
					ogimage: "/brand/og.png",
					defaultLanguage: store.locale,
					enabledTools: { blog: false, contactForm: true, reviews: false, newsletter: false },
				},
			},
			publicUrl: process.env.NEXT_PUBLIC_URL || storefront.url,
		} as APIMeGetResult;
	},
	async productBrowse(params) {
		const search = new URLSearchParams({
			limit: String(params.limit ?? 20),
			offset: String(params.offset ?? 0),
		});
		if (params.query) search.set("q", params.query);
		if (params.category) search.set("catalog", String(params.category));
		if (params.collection) search.set("collection", String(params.collection));
		const result = await apiFetch<ApiBrowse>(`/v1/products?${search}`);
		return {
			data: result.data.map(mapProduct),
			meta: {
				count: result.meta.count,
				countPublished: result.meta.count,
				countDraft: 0,
				countHidden: 0,
				nextCursor: undefined,
			},
		} as unknown as APIProductsBrowseResult;
	},
	async productGet({ idOrSlug }) {
		const product = await apiFetch<ApiProduct | null>(`/v1/products/${encodeURIComponent(String(idOrSlug))}`);
		return product ? mapProduct(product) : null;
	},
	async productFilters() {
		const [{ data: catalogs }, { data: collections }] = await Promise.all([
			apiFetch<{ data: ApiCatalog[] }>("/v1/catalogs"),
			apiFetch<{ data: ApiCollection[] }>("/v1/collections"),
		]);
		return {
			priceBounds: { min: 0, max: 0 },
			brands: [],
			categories: catalogs.map(({ name, slug }) => ({ name, slug })),
			collections: collections.map(({ title: name, slug }) => ({ name, slug })),
			variantTypes: [
				{ label: "Size", values: [...new Set(catalogs.flatMap((c) => c.sizes.map((s) => s.code)))] },
				{ label: "Color", values: [...new Set(catalogs.flatMap((c) => c.colors.map((x) => x.name)))] },
			],
		};
	},
	async cartGet({ cartId }): Promise<APICartGetResult> {
		return mapCart(await apiFetch<ApiCart | null>(`/v1/carts/${encodeURIComponent(cartId)}`));
	},
	async cartUpsert(body): Promise<APICartCreateResult> {
		if (!body.variantId) return null;
		const cart = await apiFetch<ApiCart>(`/v1/carts/${body.cartId ?? "new"}/items`, {
			method: "PUT",
			body: JSON.stringify({
				variant_id: body.variantId,
				quantity: body.quantity ?? 1,
				mode: body.mode ?? "add",
			}),
		});
		return mapCart(cart) as APICartCreateResult;
	},
	async categoriesBrowse(params): Promise<APICategoriesBrowseResult> {
		const { data } = await apiFetch<{ data: ApiCatalog[] }>("/v1/catalogs");
		const sliced = data.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? data.length));
		return { data: sliced.map(categoryShape), meta: { count: data.length } } as APICategoriesBrowseResult;
	},
	async categoryGet({ idOrSlug }) {
		const { data } = await apiFetch<{ data: ApiCatalog[] }>("/v1/catalogs");
		const catalog = data.find((item) => item.slug === idOrSlug || item.id === idOrSlug);
		if (!catalog) return null;
		const products = await apiFetch<ApiBrowse>(
			`/v1/products?catalog=${encodeURIComponent(catalog.slug)}&limit=100`,
		);
		return {
			...categoryShape(catalog),
			products: products.data.map(mapProduct),
			parent: null,
			children: [],
		} as unknown as APICategoryGetByIdResult;
	},
	async collectionBrowse(params): Promise<APICollectionsBrowseResult> {
		const { data } = await apiFetch<{ data: ApiCollection[] }>("/v1/collections");
		const sliced = data.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? data.length));
		return {
			data: sliced.map((item) => ({
				id: item.id,
				name: item.title,
				slug: item.slug,
				image: item.image_url,
				createdAt: item.created_at,
				active: true,
				description: item.description,
				group: null,
				productCollections: [],
				tr: [],
			})),
			meta: { count: data.length },
		} as APICollectionsBrowseResult;
	},
	async collectionGet({ idOrSlug }) {
		const item = await apiFetch<ApiCollection | null>(
			`/v1/collections/${encodeURIComponent(String(idOrSlug))}`,
		);
		if (!item) return null;
		return {
			id: item.id,
			name: item.title,
			slug: item.slug,
			image: item.image_url,
			description: item.description,
			createdAt: item.created_at,
			updatedAt: item.updated_at,
			active: true,
			storeId: "own-store",
			filter: { type: "manual" },
			kind: "product",
			group: null,
			longDescription: item.description,
			seo: { title: item.title, description: item.description, canonical: `/collection/${item.slug}` },
			productCollections: (item.products ?? []).map((product, position) => ({
				position: String(position),
				productId: product.id,
				collectionId: item.id,
				product: mapProduct(product),
			})),
		} as unknown as APICollectionGetByIdResult;
	},
	async search(params) {
		const result = await apiFetch<ApiBrowse>(
			`/v1/products?q=${encodeURIComponent(params.query)}&limit=${params.limit ?? 6}&offset=${params.offset ?? 0}`,
		);
		return {
			items: result.data.map((p) => ({
				type: "product",
				id: p.id,
				name: p.title,
				slug: p.slug,
				image: p.media[0]?.url ?? null,
				summary: p.description,
				relevance: 1,
			})),
			pagination: {
				total: result.meta.count,
				offset: result.meta.offset,
				limit: result.meta.limit,
				hasMore: result.meta.count > result.meta.offset + result.meta.limit,
			},
		};
	},
	async postBrowse() {
		return { data: [], meta: { count: 0, offset: 0, limit: 20 } };
	},
	async postGet() {
		return null;
	},
	async legalPageBrowse() {
		const { data } = await apiFetch<{ data: ApiLegalPage[] }>("/v1/legal-pages");
		return { data: data.map(mapLegalPage), meta: { count: data.length, offset: 0, limit: data.length } };
	},
	async legalPageGet(slug) {
		const { data } = await apiFetch<{ data: ApiLegalPage[] }>("/v1/legal-pages");
		const page = data.find((page) => page.slug === String(slug).replace(/^\//, ""));
		if (!page) return null;
		return mapLegalPage(page);
	},
	async contactMessageCreate() {
		throw new Error("Contact API is not enabled");
	},
	async subscriberCreate() {
		throw new Error("Subscriber API is not enabled");
	},
	async productReviewsBrowse() {
		return {
			data: [],
			meta: { count: 0, offset: 0, limit: 20 },
			summary: { averageRating: 0, reviewCount: 0 },
		};
	},
	async productReviewCreate() {
		throw new Error("Reviews are not enabled");
	},
	async orderGet() {
		return null;
	},
};
