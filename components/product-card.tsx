import type {
	APICollectionGetByIdResult,
	APIProductGetByIdResult,
	APIProductsBrowseResult,
} from "commerce-kit";
import { isCatalogMockupUrl } from "@/lib/catalog-mockup-url";
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
	showCatalogMeta = false,
	title,
}: {
	product: BrowseProduct | CollectionProduct | FullProduct;
	priority?: boolean;
	showCatalogMeta?: boolean;
	title?: string;
}) {
	const displayName = title ?? product.name;
	const variants = "variants" in product ? product.variants : null;
	const firstVariantPrice = variants?.[0] ? BigInt(variants[0].price) : null;
	// Accessory/sticker variants (very low price points) skew the apparel price range
	const apparelVariants = variants?.filter((v) => BigInt(v.price) >= 1_000n) ?? null;
	const { minPrice, maxPrice } =
		variants && firstVariantPrice !== null
			? (apparelVariants ?? []).reduce(
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
	const availableColors =
		variants?.reduce<Array<{ name: string; hex: string | null }>>((colors, variant) => {
			const color = variant.combinations?.find(
				(combination) => combination.variantValue.variantType.label === "Color",
			);
			if (!color || variant.stock === 0 || colors.some((item) => item.name === color.variantValue.value))
				return colors;
			colors.push({ name: color.variantValue.value, hex: color.variantValue.colorValue });
			return colors;
		}, []) ?? [];
	const catalogName = "category" in product ? product.category?.name : null;

	return (
		<StoreLink prefetch={"eager"} href={productHref} className="group">
			<div className="relative mb-4 aspect-[3/4] overflow-hidden bg-white">
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
							className="absolute inset-0 h-full w-full bg-white object-contain p-4 transition-opacity duration-200 ease-out group-hover:opacity-95 motion-reduce:transition-none sm:p-5"
							src={primaryImage}
							muted
							loop
							autoPlay
							playsInline
						/>
					) : (
						<StoreMedia
							src={primaryImage}
							alt={displayName}
							fill
							quality={
								isCatalogMockupUrl(primaryImage) || primaryImage.includes("/api/catalog-mockup/")
									? 90
									: undefined
							}
							sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
							className="bg-white object-contain p-4 transition-opacity duration-200 ease-out group-hover:opacity-95 motion-reduce:transition-none sm:p-5"
							priority={priority}
						/>
					))}
			</div>
			<div className="min-w-0 border-t border-border pt-3">
				<h3
					className="line-clamp-2 min-h-10 text-xs font-medium leading-5 text-foreground sm:text-sm"
					title={displayName}
				>
					{displayName}
				</h3>
				{showCatalogMeta && (catalogName || availableColors.length > 0) && (
					<div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						{catalogName && <span className="truncate">{catalogName}</span>}
						{availableColors.length > 0 && <span className="shrink-0">{availableColors.length} colors</span>}
					</div>
				)}
				{showCatalogMeta && availableColors.length > 0 && (
					<div className="mt-2 flex items-center gap-1.5">
						<span className="sr-only">
							Available colors: {availableColors.map((color) => color.name).join(", ")}
						</span>
						{availableColors.slice(0, 8).map((color) => (
							<span
								key={color.name}
								className="size-4 rounded-full border border-foreground/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
								style={{ backgroundColor: color.hex ?? "#e5e7eb" }}
								title={color.name}
							/>
						))}
						{availableColors.length > 8 && (
							<span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
								+{availableColors.length - 8}
							</span>
						)}
					</div>
				)}
				<div className="mt-3 flex items-center justify-between gap-2">
					<p className="whitespace-nowrap font-display text-xs text-foreground sm:text-sm">{priceDisplay}</p>
				</div>
			</div>
		</StoreLink>
	);
}
