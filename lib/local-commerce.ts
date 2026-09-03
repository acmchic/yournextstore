import type {
	APICartCreateBody,
	APICartCreateResult,
	APICartGetResult,
	APIContactMessageCreateResult,
	APILegalPageGetByPathResult,
	APIMeGetResult,
	APIPostsBrowseResult,
	APIProductReviewCreateResult,
	APISearchResult,
	APISubscriberCreateResult,
	Commerce,
} from "commerce-kit";
import {
	emptyReviews,
	localCategories,
	localCategoryGet,
	localCollectionGet,
	localCollections,
	localProductBrowseResult,
	localProductFilters,
	localProducts,
} from "@/lib/local-commerce-data";
import { storefront } from "@/lib/storefront-config";

type CommerceClient = ReturnType<typeof Commerce>;
type LocalCommerceClient = Pick<
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
	| "legalPageBrowse"
	| "legalPageGet"
	| "search"
	| "contactMessageCreate"
	| "subscriberCreate"
	| "productReviewsBrowse"
	| "productReviewCreate"
	| "orderGet"
>;

type Cart = NonNullable<APICartCreateResult>;

const carts = new Map<string, Cart>();

const findProductByVariantId = (variantId: string) =>
	localProducts.find((product) => product.variants.some((variant) => variant.id === variantId));

const createCart = (cartId: string): Cart =>
	({
		id: cartId,
		lineItems: [],
		currency: "USD",
		storeId: "local-pod-store",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		addonData: null,
		couponId: null,
		customerId: null,
		stripePaymentIntentId: null,
		checkoutSessionId: null,
		shippingId: null,
		shippingAddressId: null,
		billingAddressId: null,
		deliverySlot: null,
		ucpSessionStatus: null,
		ucpMetadata: null,
		acpSessionStatus: null,
		acpMetadata: null,
		billingAddress: null,
		shippingAddress: null,
		shipping: null,
		coupon: null,
		customer: null,
	}) as Cart;

const upsertLine = (cart: Cart, body: APICartCreateBody): Cart => {
	if (!body.variantId) return cart;
	const product = findProductByVariantId(body.variantId);
	const variant = product?.variants.find((item) => item.id === body.variantId);
	if (!product || !variant) return cart;

	const quantity = Math.max(0, body.quantity ?? 1);
	const existing = cart.lineItems.find((line) => line.productVariant.id === body.variantId);
	const nextQuantity = body.mode === "set" ? quantity : (existing?.quantity ?? 0) + quantity;

	const nextLines =
		nextQuantity === 0
			? cart.lineItems.filter((line) => line.productVariant.id !== body.variantId)
			: existing
				? cart.lineItems.map((line) =>
						line.productVariant.id === body.variantId ? { ...line, quantity: nextQuantity } : line,
					)
				: [
						...cart.lineItems,
						{
							id: `line-${body.variantId}`,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							cartId: cart.id,
							quantity: nextQuantity,
							productVariantId: body.variantId,
							subscriptionPlanId: null,
							attendees: null,
							subscriptionPlan: null,
							preVolumePricingPrice: null,
							setSelections: [],
							productVariant: {
								...variant,
								preVolumePricingPrice: null,
								product: {
									...product,
									setProduct: null,
								},
							},
						},
					];

	return {
		...cart,
		updatedAt: new Date().toISOString(),
		lineItems: nextLines,
	};
};

const listProducts = ({
	query,
	category,
	collection,
	limit = 20,
	offset = 0,
	orderBy,
	orderDirection = "asc",
}: {
	query?: string;
	category?: string;
	collection?: string;
	limit?: number;
	offset?: number;
	orderBy?: "name" | "createdAt" | "price";
	orderDirection?: "asc" | "desc";
}) => {
	const normalizedQuery = query?.trim().toLowerCase();
	const filtered = localProducts.filter((product) => {
		if (normalizedQuery && !`${product.name} ${product.summary}`.toLowerCase().includes(normalizedQuery)) {
			return false;
		}
		if (category && product.category?.slug !== category && product.category?.id !== category) {
			return false;
		}
		if (collection && !product.productCollections.some((pc) => pc.collection.slug === collection)) {
			return false;
		}
		return true;
	});

	const sorted = [...filtered].sort((left, right) => {
		const direction = orderDirection === "desc" ? -1 : 1;
		if (orderBy === "name") return left.name.localeCompare(right.name) * direction;
		if (orderBy === "price") {
			return (Number(left.variants[0]?.price ?? 0) - Number(right.variants[0]?.price ?? 0)) * direction;
		}
		return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
	});

	return {
		data: sorted.slice(offset, offset + limit),
		meta: { count: filtered.length },
	};
};

export const localCommerce: LocalCommerceClient = {
	async meGet(): Promise<APIMeGetResult> {
		return {
			store: {
				id: "local-pod-store",
				name: storefront.brandName,
				currency: "usd",
				settings: {
					storeName: storefront.brandName,
					storeDescription: storefront.description,
					logo: "/logo.svg",
					ogimage: "/screenshot.png",
					defaultLanguage: "en-US",
					enabledTools: {
						blog: false,
						newsletter: true,
						loyalty: false,
						reviews: false,
						productSubscriptions: false,
						contactForm: true,
						wishlist: false,
						cookieConsent: false,
						auctions: false,
						surveys: false,
						bookings: false,
						productSets: false,
						restockNotifications: false,
						abandonedCarts: false,
						newsletterPopup: false,
						stripeTaxes: false,
						translations: false,
						cartRecommendations: false,
						withdrawalButton: false,
						events: false,
					},
					enabledLanguages: {
						"en-US": true,
						"pl-PL": false,
						"es-ES": false,
						"de-DE": false,
					},
					socials: {
						email: "hello@example.com",
					},
				},
			},
			publicUrl: "http://localhost:3000",
		} as APIMeGetResult;
	},
	async productBrowse(params) {
		return localProductBrowseResult(listProducts(params).data);
	},
	async productGet(params) {
		const idOrSlug = String(params.idOrSlug);
		return localProducts.find((product) => product.id === idOrSlug || product.slug === idOrSlug) ?? null;
	},
	async productFilters() {
		return localProductFilters();
	},
	async cartGet({ cartId }): Promise<APICartGetResult> {
		return carts.get(cartId) ?? null;
	},
	async cartUpsert(body): Promise<APICartCreateResult> {
		const cartId = body.cartId ?? `local-cart-${crypto.randomUUID()}`;
		const cart = carts.get(cartId) ?? createCart(cartId);
		const nextCart = upsertLine(cart, body);
		carts.set(cartId, nextCart);
		return nextCart;
	},
	async collectionBrowse(params) {
		const result = localCollections();
		const data = result.data.slice(
			params.offset ?? 0,
			(params.offset ?? 0) + (params.limit ?? result.data.length),
		);
		return { data, meta: { count: result.meta.count } };
	},
	async collectionGet(params) {
		return localCollectionGet(String(params.idOrSlug));
	},
	async categoriesBrowse(params) {
		const result = localCategories();
		const data = result.data.slice(
			params.offset ?? 0,
			(params.offset ?? 0) + (params.limit ?? result.data.length),
		);
		return { data, meta: { count: result.meta.count } };
	},
	async categoryGet(params) {
		return localCategoryGet(String(params.idOrSlug));
	},
	async postBrowse() {
		return { data: [], meta: { count: 0, offset: 0, limit: 20 } } as APIPostsBrowseResult;
	},
	async postGet() {
		return null;
	},
	async legalPageBrowse() {
		return { data: [], meta: { count: 0, offset: 0, limit: 20 } };
	},
	async legalPageGet(key) {
		return {
			id: `local-${key}`,
			key,
			label: key,
			contentHtml: null,
			contentJson: {},
			href: `/legal/${key}`,
			locale: "en-US",
			isFallback: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		} as APILegalPageGetByPathResult;
	},
	async search(params): Promise<APISearchResult> {
		const products = listProducts({ query: params.query, limit: params.limit ?? 6 });
		return {
			items: products.data.map((product) => ({
				type: "product",
				id: product.id,
				name: product.name,
				slug: product.slug,
				image: product.images[0] ?? null,
				summary: product.summary,
				relevance: 1,
			})),
			pagination: {
				total: products.meta.count,
				offset: params.offset ?? 0,
				limit: params.limit ?? 6,
				hasMore: products.meta.count > (params.offset ?? 0) + (params.limit ?? 6),
			},
		};
	},
	async contactMessageCreate(body) {
		return {
			id: `contact-${Date.now()}`,
			email: body.email,
			message: body.message,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			storeId: "local-pod-store",
			readAt: null,
		} as APIContactMessageCreateResult;
	},
	async subscriberCreate(body) {
		return {
			id: `subscriber-${Date.now()}`,
			name: null,
			email: body.email,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			storeId: "local-pod-store",
			location: null,
			source: "storefront",
			unsubscribed: false,
			unsubscribedAt: null,
			unsubscribeToken: null,
		} as APISubscriberCreateResult;
	},
	async productReviewsBrowse() {
		return emptyReviews();
	},
	async productReviewCreate(_params, body) {
		return {
			id: `review-${Date.now()}`,
			author: body.author,
			content: body.content,
			rating: body.rating,
			createdAt: new Date().toISOString(),
		} as APIProductReviewCreateResult;
	},
	async orderGet() {
		return null;
	},
};
