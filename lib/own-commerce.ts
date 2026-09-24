import type {
	APICartCreateResult,
	APICartGetResult,
	APICategoriesBrowseResult,
	APICategoryGetByIdResult,
	APICollectionGetByIdResult,
	APICollectionsBrowseResult,
	APIContactMessageCreateResult,
	APIMeGetResult,
	APIProductGetByIdResult,
	APIProductsBrowseResult,
	Commerce,
} from "commerce-kit";
import { isCatalogMockupUrl } from "@/lib/catalog-mockup-url";
import { productDisplayName } from "@/lib/merchant";
import { storefront } from "@/lib/storefront-config";

const API_URL = process.env.STORE_API_URL || "http://localhost:8000";
const MEDIA_URL = process.env.STORE_MEDIA_URL || API_URL;
const now = () => new Date().toISOString();

function resolveMediaUrl(url: string): string {
	if (
		url.startsWith("/v1/products/") ||
		url.startsWith("/v1/catalogs/") ||
		url.startsWith("/v1/merchandising/")
	) {
		return `${MEDIA_URL}${url}`;
	}
	if (url.startsWith("/") && isCatalogMockupUrl(url)) {
		return `${MEDIA_URL}${url}`;
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
	gallery_assets?: { design?: string | null; avatar?: string | null };
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
		department: "unisex" | "women" | "kids" | "home-living" | "accessories";
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
	selection_rule?: "manual" | "newest" | "tees" | string | null;
	homepage_section?: "theme" | "holiday" | null;
	created_at: string;
	updated_at: string;
	products?: ApiProduct[];
};
type ApiStore = {
	name?: string | null;
	currency?: string | null;
	locale?: string | null;
};

const TRANSIENT_API_STATUSES = new Set([502, 503, 504]);
const READ_RETRY_LIMIT = 3;
const RETRY_BACKOFF_MS = 250;
const API_REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.STORE_API_TIMEOUT_MS) || 10000);
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
		catalog: string;
		catalog_name: string;
		color: string;
		color_name: string;
		size: string;
		image: string;
	}>;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const method = (init?.method || "GET").toUpperCase();
	const canRetry = method === "GET" || method === "HEAD";
	let response: Response | undefined;
	let lastError: unknown;
	for (let attempt = 0; attempt <= (canRetry ? READ_RETRY_LIMIT : 0); attempt += 1) {
		response = undefined;
		const controller = init?.signal ? undefined : new AbortController();
		const timeout = controller ? setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS) : undefined;
		try {
			response = await fetch(`${API_URL}${path}`, {
				...init,
				signal: init?.signal ?? controller?.signal,
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					...init?.headers,
				},
			});
		} catch (error) {
			lastError = error;
			if (!canRetry || attempt === READ_RETRY_LIMIT) break;
			await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * 2 ** attempt));
			continue;
		} finally {
			if (timeout) clearTimeout(timeout);
		}
		if (!canRetry || !TRANSIENT_API_STATUSES.has(response.status) || attempt === READ_RETRY_LIMIT) {
			break;
		}
		await response.arrayBuffer();
		await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * 2 ** attempt));
	}
	if (!response) {
		const error = new Error(`Store API unavailable at ${API_URL}${path}`);
		if (lastError instanceof Error) error.cause = lastError;
		throw error;
	}
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
		// Provider variant images contain printed views; catalog media also carries blank placement views.
		const catalogMediaImages = product.media
			.filter((media) => media.catalog === variant.catalog && media.color === variant.color)
			.flatMap((media) => [media.url, media.blank_url].filter(Boolean).map(resolveMediaUrl));
		const variantImages = [
			...new Set([...(variant.images ?? []).map(resolveMediaUrl), ...catalogMediaImages]),
		];
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
		galleryAssets: {
			design: product.gallery_assets?.design ? resolveMediaUrl(product.gallery_assets.design) : null,
			avatar: product.gallery_assets?.avatar ? resolveMediaUrl(product.gallery_assets.avatar) : null,
		},
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
	try {
		const product = await apiFetch<ApiProduct | null>(
			`/v1/products/${encodeURIComponent(slug)}?${search.toString()}`,
		);
		return product ? mapProduct(product) : null;
	} catch {
		return null;
	}
}

export async function catalogBrowse() {
	try {
		return await apiFetch<{ data: ApiCatalog[] }>("/v1/catalogs");
	} catch {
		return { data: [] };
	}
}

export async function shopBrowse({
	department,
	type,
	catalog,
	collection,
	limit = 24,
	offset = 0,
}: {
	department?: string;
	type?: string;
	catalog?: string;
	collection?: string;
	limit?: number;
	offset?: number;
}) {
	const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
	if (department) query.set("department", department);
	if (type) query.set("product_type", type);
	if (catalog) query.set("catalog", catalog);
	if (collection) query.set("collection", collection);
	try {
		const result = await apiFetch<ApiBrowse>(`/v1/shop?${query}`);
		return { data: result.data.map(mapProduct), meta: result.meta };
	} catch {
		return { data: [], meta: { count: 0, limit, offset } };
	}
}

export async function storefrontCollections() {
	try {
		const result = await apiFetch<{ data: (ApiCollection & { featured: boolean; indexable: boolean })[] }>(
			"/v1/collections",
		);
		return {
			data: result.data.map((collection) => ({
				...collection,
				image_url: collection.image_url ? resolveMediaUrl(collection.image_url) : null,
			})),
		};
	} catch {
		return { data: [] };
	}
}

export async function homepageCollections() {
	try {
		const result = await apiFetch<{
			data: (ApiCollection & {
				featured: boolean;
				indexable: boolean;
				homepage_section: "theme" | "holiday";
			})[];
		}>("/v1/homepage-collections");
		return {
			data: result.data.map((collection) => ({
				...collection,
				image_url: collection.image_url ? resolveMediaUrl(collection.image_url) : null,
			})),
		};
	} catch {
		return { data: [] };
	}
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
				productUrl: `/product/${item.product_slug}/${item.catalog}?${new URLSearchParams({ Color: item.color_name, Size: item.size })}`,
				variantLabel: `${item.color_name} · ${item.size}`,
				price: String(item.price_minor),
				images: [resolveMediaUrl(item.image)],
				sku: item.sku,
				product: {
					id: item.product_id,
					name: productDisplayName({
						name: item.product_title,
						category: { name: item.catalog_name },
					}),
					slug: item.product_slug,
					images: [resolveMediaUrl(item.image)],
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
		let store: ApiStore | null = null;
		try {
			store = await apiFetch<ApiStore | null>("/v1/store");
		} catch {
			// Keep public layout/metadata usable while the optional API is restarting.
		}
		const resolvedStore = resolveStoreConfig(store);
		return {
			store: {
				id: "own-store",
				name: resolvedStore.name,
				currency: resolvedStore.currency,
				settings: {
					storeName: resolvedStore.name,
					storeDescription: storefront.description,
					logo: "/logo.svg",
					ogimage: "/brand/og.png",
					defaultLanguage: resolvedStore.locale,
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
		try {
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
		} catch {
			return {
				data: [],
				meta: { count: 0, countPublished: 0, countDraft: 0, countHidden: 0, nextCursor: undefined },
			} as unknown as APIProductsBrowseResult;
		}
	},
	async productGet({ idOrSlug }) {
		try {
			const product = await apiFetch<ApiProduct | null>(
				`/v1/products/${encodeURIComponent(String(idOrSlug))}`,
			);
			return product ? mapProduct(product) : null;
		} catch {
			return null;
		}
	},
	async productFilters() {
		try {
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
		} catch {
			return {
				priceBounds: { min: 0, max: 0 },
				brands: [],
				categories: [],
				collections: [],
				variantTypes: [],
			};
		}
	},
	async cartGet({ cartId }): Promise<APICartGetResult> {
		return mapCart(
			await apiFetch<ApiCart | null>(`/v1/carts/${encodeURIComponent(cartId)}`, { cache: "no-store" }),
		);
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
		const { data } = await catalogBrowse();
		const sliced = data.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? data.length));
		return { data: sliced.map(categoryShape), meta: { count: data.length } } as APICategoriesBrowseResult;
	},
	async categoryGet({ idOrSlug }) {
		const { data } = await catalogBrowse();
		const catalog = data.find((item) => item.slug === idOrSlug || item.id === idOrSlug);
		if (!catalog) return null;
		let products: ApiBrowse;
		try {
			products = await apiFetch<ApiBrowse>(
				`/v1/products?catalog=${encodeURIComponent(catalog.slug)}&limit=100`,
			);
		} catch {
			products = { data: [], meta: { count: 0, limit: 100, offset: 0 } };
		}
		return {
			...categoryShape(catalog),
			products: products.data.map(mapProduct),
			parent: null,
			children: [],
		} as unknown as APICategoryGetByIdResult;
	},
	async collectionBrowse(params): Promise<APICollectionsBrowseResult> {
		let data: ApiCollection[] = [];
		try {
			({ data } = await apiFetch<{ data: ApiCollection[] }>("/v1/collections"));
		} catch {
			// Empty navigation is a safe fallback while the API restarts.
		}
		const sliced = data.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? data.length));
		return {
			data: sliced.map((item) => ({
				id: item.id,
				name: item.title,
				slug: item.slug,
				image: item.image_url ? resolveMediaUrl(item.image_url) : null,
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
		let item: ApiCollection | null = null;
		try {
			item = await apiFetch<ApiCollection | null>(`/v1/collections/${encodeURIComponent(String(idOrSlug))}`);
		} catch {
			return null;
		}
		if (!item) return null;
		return {
			id: item.id,
			name: item.title,
			slug: item.slug,
			image: item.image_url ? resolveMediaUrl(item.image_url) : null,
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
		let result: ApiBrowse;
		try {
			result = await apiFetch<ApiBrowse>(
				`/v1/products?q=${encodeURIComponent(params.query)}&limit=${params.limit ?? 6}&offset=${params.offset ?? 0}`,
			);
		} catch {
			result = { data: [], meta: { count: 0, limit: params.limit ?? 6, offset: params.offset ?? 0 } };
		}
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
		let data: ApiLegalPage[] = [];
		try {
			({ data } = await apiFetch<{ data: ApiLegalPage[] }>("/v1/legal-pages"));
		} catch {
			// Policies are optional UI content; keep the storefront renderable during outages.
		}
		return { data: data.map(mapLegalPage), meta: { count: data.length, offset: 0, limit: data.length } };
	},
	async legalPageGet(slug) {
		let data: ApiLegalPage[] = [];
		try {
			({ data } = await apiFetch<{ data: ApiLegalPage[] }>("/v1/legal-pages"));
		} catch {
			return null;
		}
		const page = data.find((page) => page.slug === String(slug).replace(/^\//, ""));
		if (!page) return null;
		return mapLegalPage(page);
	},
	async contactMessageCreate(body) {
		return apiFetch<APIContactMessageCreateResult>("/v1/contact-messages", {
			method: "POST",
			body: JSON.stringify(body),
		});
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
