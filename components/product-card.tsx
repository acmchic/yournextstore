import type {
	APICollectionGetByIdResult,
	APIProductGetByIdResult,
	APIProductsBrowseResult,
} from "commerce-kit";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { StoreMedia } from "@/lib/store-media";
import { isVideoUrl } from "@/lib/utils";
import { QuickAddButton } from "./quick-add-button";
import { StoreLink } from "./store-link";

type BrowseProduct = APIProductsBrowseResult["data"][number];
type CollectionProduct = APICollectionGetByIdResult["productCollections"][number]["product"];
type FullProduct = NonNullable<APIProductGetByIdResult>;

export function ProductCard({
	product,
	priority = false,
}: {
	product: BrowseProduct | CollectionProduct | FullProduct;
	priority?: boolean;
}) {
	const variants = "variants" in product ? product.variants : null;
	const firstVariantPrice = variants?.[0] ? BigInt(variants[0].price) : null;
	const { minPrice, maxPrice } =
		variants && firstVariantPrice !== null
			? variants.reduce(
					(acc, v) => {
						const price = BigInt(v.price);
						return {
							minPrice: price < acc.minPrice ? price : acc.minPrice,
							maxPrice: price > acc.maxPrice ? price : acc.maxPrice,
						};
					},
					{ minPrice: firstVariantPrice, maxPrice: firstVariantPrice },
				)
			: { minPrice: null, maxPrice: null };

	const priceDisplay =
		variants && variants.length > 1 && minPrice && maxPrice && minPrice !== maxPrice
			? `${formatMoney({ amount: minPrice, currency: CURRENCY, locale: LOCALE })} - ${formatMoney({ amount: maxPrice, currency: CURRENCY, locale: LOCALE })}`
			: minPrice
				? formatMoney({ amount: minPrice, currency: CURRENCY, locale: LOCALE })
				: null;

	const primaryImage = product.images?.[0] ?? variants?.flatMap((variant) => variant.images ?? [])[0];

	const singleVariant = variants?.length === 1 && variants[0]?.stock !== 0 ? variants[0] : null;
	const categorySlug = "category" in product ? product.category?.slug : null;
	const selectedCatalog =
		"defaultCatalog" in product && typeof product.defaultCatalog === "string"
			? product.defaultCatalog
			: categorySlug;
	const selectedColor =
		"defaultColor" in product && typeof product.defaultColor === "string" ? product.defaultColor : null;
	const productHref = selectedCatalog
		? `/product/${product.slug}/${selectedCatalog}${selectedColor ? `?Color=${encodeURIComponent(selectedColor)}` : ""}`
		: `/product/${product.slug}`;

	return (
		<StoreLink prefetch={"eager"} href={productHref} className="group">
			<div className="relative mb-4 aspect-square overflow-hidden border border-border bg-secondary">
				{singleVariant && (
					<QuickAddButton
						variantId={singleVariant.id}
						variantPrice={singleVariant.price}
						variantImages={singleVariant.images}
						product={{
							id: product.id,
							name: product.name,
							slug: product.slug,
							images: product.images ?? [],
						}}
					/>
				)}
				{primaryImage &&
					(isVideoUrl(primaryImage) ? (
						<video
							className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
							src={primaryImage}
							muted
							loop
							autoPlay
							playsInline
						/>
					) : (
						<StoreMedia
							src={primaryImage}
							alt={product.name}
							fill
							quality={primaryImage.includes("/api/catalog-mockup/") ? 90 : undefined}
							sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
							className="bg-white object-contain transition-transform duration-500 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
							priority={priority}
						/>
					))}
			</div>
			<div className="flex items-start justify-between gap-4 border-t border-border pt-3">
				<h3 className="text-base font-medium text-foreground">{product.name}</h3>
				<p className="whitespace-nowrap font-mono text-sm font-semibold text-foreground">{priceDisplay}</p>
			</div>
		</StoreLink>
	);
}
