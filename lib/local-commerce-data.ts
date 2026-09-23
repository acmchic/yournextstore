import type {
	APICategoriesBrowseResult,
	APICategoryGetByIdResult,
	APICollectionGetByIdResult,
	APICollectionsBrowseResult,
	APIProductGetByIdResult,
	APIProductReviewsBrowseResult,
	APIProductsBrowseResult,
} from "commerce-kit";

const now = "2026-07-06T00:00:00.000Z";
const storeId = "local-pod-store";

type LocalCategory = NonNullable<APIProductGetByIdResult>["category"];
type LocalCollection = APICollectionsBrowseResult["data"][number];
type LocalProduct = NonNullable<APIProductGetByIdResult>;
type LocalVariant = LocalProduct["variants"][number];

const categories = [
	{
		id: "cat-tees",
		name: "T-Shirts",
		slug: "t-shirts",
		image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1600&auto=format&fit=crop",
	},
	{
		id: "cat-hoodies",
		name: "Hoodies",
		slug: "hoodies",
		image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1600&auto=format&fit=crop",
	},
	{
		id: "cat-sweatshirts",
		name: "Sweatshirts",
		slug: "sweatshirts",
		image: "https://images.unsplash.com/photo-1578681994506-b8f463449011?q=80&w=1600&auto=format&fit=crop",
	},
] as const;

const collections = [
	{
		id: "col-featured",
		name: "Current Edit",
		slug: "featured-designs",
		image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1600&auto=format&fit=crop",
		description: "A focused selection of printed clothing and accessories.",
	},
	{
		id: "col-street",
		name: "Streetwear Index",
		slug: "streetwear-drops",
		image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1600&auto=format&fit=crop",
		description: "Graphic tees, hoodies, and sweatshirts with a sharper streetwear read.",
	},
] as const;

const variantTypes = [
	{
		id: "vt-size",
		type: "string" as const,
		label: "Size",
		variantValues: ["S", "M", "L", "XL"].map((value, position) => ({
			id: `vv-size-${value.toLowerCase()}`,
			value,
			position,
			colorValue: null,
		})),
	},
	{
		id: "vt-color",
		type: "color" as const,
		label: "Color",
		variantValues: [
			{ id: "vv-color-black", value: "Black", position: 0, colorValue: "#111111" },
			{ id: "vv-color-cream", value: "Cream", position: 1, colorValue: "#f2eadc" },
			{ id: "vv-color-slate", value: "Slate", position: 2, colorValue: "#475569" },
		],
	},
];

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
const collectionBySlug = new Map(collections.map((collection) => [collection.slug, collection]));

const categoryShape = (slug: (typeof categories)[number]["slug"]): LocalCategory => {
	const category = categoryBySlug.get(slug);
	if (!category) return null;
	return {
		...category,
		createdAt: now,
		updatedAt: now,
		active: true,
		storeId,
		description: null,
		position: "0",
		seo: {
			title: category.name,
			description: `Shop POD ${category.name.toLowerCase()} with original designs.`,
			canonical: `/category/${category.slug}`,
		},
		longDescription: null,
		parentId: null,
	};
};

const collectionShape = (slug: (typeof collections)[number]["slug"]) => {
	const collection = collectionBySlug.get(slug);
	if (!collection) return null;
	return {
		...collection,
		createdAt: now,
		updatedAt: now,
		active: true,
		filter: { type: "manual" as const },
		storeId,
		seo: {
			title: collection.name,
			description: collection.description,
			canonical: `/collection/${collection.slug}`,
		},
		longDescription: collection.description,
		kind: "product" as const,
		group: null,
	};
};

const variantValue = (
	type: (typeof variantTypes)[number],
	value: (typeof variantTypes)[number]["variantValues"][number],
) => ({
	createdAt: now,
	updatedAt: now,
	productVariantId: "",
	variantValueId: value.id,
	variantValue: {
		id: value.id,
		value: value.value,
		position: value.position,
		colorValue: value.colorValue,
		variantType: {
			id: type.id,
			type: type.type,
			label: type.label,
		},
	},
});

const makeVariant = ({
	productId,
	slug,
	price,
	size,
	color,
	image,
}: {
	productId: string;
	slug: string;
	price: string;
	size: string;
	color: string;
	image: string;
}): LocalVariant => {
	const sizeType = variantTypes[0];
	const colorType = variantTypes[1];
	const sizeValue = sizeType.variantValues.find((value) => value.value === size) ?? sizeType.variantValues[1];
	const colorValue =
		colorType.variantValues.find((value) => value.value === color) ?? colorType.variantValues[0];
	const id = `${slug}-${size.toLowerCase()}-${color.toLowerCase()}`;

	return {
		id,
		createdAt: now,
		updatedAt: now,
		storeId,
		description: null,
		price,
		images: [image],
		sku: `POD-${slug}-${size}-${color}`.toUpperCase(),
		barcode: null,
		calculatedPrice: null,
		stock: 25,
		depth: null,
		width: null,
		height: null,
		weight: null,
		digital: null,
		shippable: true,
		externalId: null,
		productId,
		attributes: {},
		originalPrice: String(Number(price) + 600),
		combinations: [
			{ ...variantValue(sizeType, sizeValue), productVariantId: id },
			{ ...variantValue(colorType, colorValue), productVariantId: id },
		],
		prices: [
			{
				createdAt: now,
				updatedAt: now,
				currency: "USD",
				storeId,
				price,
				calculatedPrice: null,
				variantId: id,
			},
		],
		prePromotionPrice: null,
		omnibusPrice: null,
	};
};

const makeProduct = ({
	id,
	name,
	slug,
	categorySlug,
	collectionSlugs,
	summary,
	images,
	basePrice,
}: {
	id: string;
	name: string;
	slug: string;
	categorySlug: (typeof categories)[number]["slug"];
	collectionSlugs: Array<(typeof collections)[number]["slug"]>;
	summary: string;
	images: string[];
	basePrice: number;
}): LocalProduct => {
	const category = categoryShape(categorySlug);
	const productCollections = collectionSlugs.flatMap((collectionSlug, index) => {
		const collection = collectionShape(collectionSlug);
		return collection
			? [
					{
						position: String(index),
						productId: id,
						collectionId: collection.id,
						collection: {
							id: collection.id,
							name: collection.name,
							image: collection.image,
							createdAt: collection.createdAt,
							updatedAt: collection.updatedAt,
							slug: collection.slug,
							active: collection.active,
							filter: collection.filter,
							storeId: collection.storeId,
							description: null,
						},
					},
				]
			: [];
	});

	return {
		id,
		name,
		createdAt: now,
		updatedAt: now,
		type: "product",
		slug,
		status: "published",
		flags: null,
		storeId,
		summary,
		content: null,
		images,
		badge: null,
		bundleDiscountPercentage: null,
		seo: {
			title: name,
			description: summary,
			canonical: `/product/${slug}`,
		},
		stripeTaxCode: null,
		categoryId: category?.id ?? null,
		brandId: null,
		category,
		productTaxRate: null,
		productCollections,
		bundleProducts: [],
		variantsTypes: variantTypes,
		tr: [],
		variants: ["S", "M", "L", "XL"].flatMap((size) =>
			["Black", "Cream", "Slate"].map((color, colorIndex) =>
				makeVariant({
					productId: id,
					slug,
					price: String(basePrice + colorIndex * 200),
					size,
					color,
					image: images[colorIndex % images.length] ?? images[0],
				}),
			),
		),
		subscriptionPlanProducts: [],
		volumePricingTiers: [
			{
				id: `${id}-bulk-3`,
				createdAt: now,
				updatedAt: now,
				storeId,
				price: String(basePrice - 200),
				minQuantity: 3,
				maxQuantity: null,
				productId: id,
				productVariantId: null,
			},
		],
	};
};

export const localProducts: LocalProduct[] = [
	makeProduct({
		id: "prod-solar-bloom-tee",
		name: "Solar Bloom Tee",
		slug: "solar-bloom-classic-tee",
		categorySlug: "t-shirts",
		collectionSlugs: ["featured-designs", "streetwear-drops"],
		summary: "Midweight tee carrying a sun-bleached floral graphic across a clean streetwear blank.",
		basePrice: 4200,
		images: [
			"https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1600&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1600&auto=format&fit=crop",
		],
	}),
	makeProduct({
		id: "prod-midnight-code-hoodie",
		name: "Midnight Code Hood",
		slug: "midnight-code-hoodie",
		categorySlug: "hoodies",
		collectionSlugs: ["featured-designs", "streetwear-drops"],
		summary: "Heavy fleece hood with a quiet technical graphic built for late-night city wear.",
		basePrice: 7400,
		images: [
			"https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1600&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1600&auto=format&fit=crop",
		],
	}),
	makeProduct({
		id: "prod-desert-wave-sweatshirt",
		name: "Desert Wave Crew",
		slug: "desert-wave-sweatshirt",
		categorySlug: "sweatshirts",
		collectionSlugs: ["featured-designs"],
		summary: "Relaxed crewneck with a washed desert-wave print across a neutral blank.",
		basePrice: 6800,
		images: [
			"https://images.unsplash.com/photo-1578681994506-b8f463449011?q=80&w=1600&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1600&auto=format&fit=crop",
		],
	}),
] as LocalProduct[];

export const localProductBrowseResult = (products = localProducts): APIProductsBrowseResult => ({
	data: products,
	meta: {
		count: products.length,
		countPublished: products.length,
		countDraft: 0,
		countHidden: 0,
		nextCursor: undefined,
	},
});

export const localProductFilters = () => ({
	priceBounds: { min: 4200, max: 7800 },
	variantTypes: [
		{ label: "Size", values: ["S", "M", "L", "XL"] },
		{ label: "Color", values: ["Black", "Cream", "Slate"] },
	],
	categories: categories.map(({ name, slug }) => ({ name, slug })),
	collections: collections.map(({ name, slug }) => ({ name, slug })),
	brands: [],
});

export const localCategories = (): APICategoriesBrowseResult => ({
	data: categories.map((category) => {
		const shaped = categoryShape(category.slug);
		return {
			id: category.id,
			name: category.name,
			image: category.image,
			createdAt: shaped?.createdAt ?? now,
			updatedAt: shaped?.updatedAt ?? now,
			slug: category.slug,
			active: true,
			description: null,
			position: "0",
			parentId: null,
		};
	}),
	meta: { count: categories.length },
});

export const localCategoryGet = (slugOrId: string): APICategoryGetByIdResult | null => {
	const category = categories.find((item) => item.slug === slugOrId || item.id === slugOrId);
	const shaped = category ? categoryShape(category.slug) : null;
	if (!shaped) return null;
	return {
		...shaped,
		products: localProducts.filter((product) => product.category?.slug === shaped.slug),
		parent: null,
		children: [],
	};
};

export const localCollections = (): APICollectionsBrowseResult => ({
	data: collections.map((collection) => ({
		id: collection.id,
		name: collection.name,
		image: collection.image,
		createdAt: now,
		slug: collection.slug,
		active: true,
		description: null,
		group: null,
		productCollections: localProducts
			.filter((product) => product.productCollections.some((pc) => pc.collection.slug === collection.slug))
			.map((product) => ({ productId: product.id })),
		tr: [],
	})),
	meta: { count: collections.length },
});

export const localCollectionGet = (slugOrId: string): APICollectionGetByIdResult | null => {
	const collection = collections.find((item) => item.slug === slugOrId || item.id === slugOrId);
	const shaped = collection ? collectionShape(collection.slug) : null;
	if (!shaped) return null;
	return {
		...shaped,
		productCollections: localProducts
			.filter((product) => product.productCollections.some((pc) => pc.collection.slug === shaped.slug))
			.map((product, index) => ({
				position: String(index),
				productId: product.id,
				collectionId: shaped.id,
				product,
			})),
	} as unknown as APICollectionGetByIdResult;
};

export const emptyReviews = (): APIProductReviewsBrowseResult => ({
	data: [],
	meta: { count: 0, offset: 0, limit: 20 },
	summary: {
		averageRating: 0,
		reviewCount: 0,
	},
});
