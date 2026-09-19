import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { getListingColorName, selectListingColor } from "@/lib/catalog-product-rail";
import { type ApiCatalog, productGetByCatalog } from "@/lib/own-commerce";

const catalogProductLimit = 12;

type Catalog = ApiCatalog;
type Product = NonNullable<Awaited<ReturnType<typeof productGetByCatalog>>>;

function productForListing(product: Product, position: number) {
	const selectedVariant = selectListingColor(product.variants, position);
	const selectedColor = selectedVariant ? getListingColorName(selectedVariant) : null;

	if (!selectedVariant || !selectedColor) return product;

	return {
		...product,
		defaultColor: selectedColor,
		images: selectedVariant.images.length > 0 ? selectedVariant.images : product.images,
	};
}

async function CatalogProductRailContent({
	productSlug,
	currentCatalogSlug,
	catalogs,
}: {
	productSlug: string;
	currentCatalogSlug: string;
	catalogs: Catalog[];
}) {
	const catalogSlugs = catalogs
		.filter((catalog) => catalog.slug !== currentCatalogSlug)
		.slice(0, catalogProductLimit)
		.map((catalog) => catalog.slug);
	const products = (
		await Promise.all(catalogSlugs.map((catalogSlug) => productGetByCatalog(productSlug, catalogSlug)))
	).filter((product): product is Product => product !== null);

	if (products.length === 0) return null;

	return (
		<section className="mt-16 border-t border-border pt-10 sm:pt-12" aria-labelledby="also-available-title">
			<Carousel
				className="group/catalog-rail"
				opts={{ align: "start", containScroll: "trimSnaps", dragFree: true }}
				aria-label="Other products available with this design"
			>
				<div className="mb-7 flex items-end justify-between gap-5 border-b border-border pb-4 sm:mb-8">
					<div>
						<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
							More ways to wear it
						</p>
						<h2
							id="also-available-title"
							className="mt-2 font-display text-2xl leading-none tracking-tight sm:text-3xl"
						>
							The Design Is Also Available On
						</h2>
					</div>
					<div className="hidden shrink-0 items-center gap-2 sm:flex">
						<CarouselPrevious className="static size-10 translate-y-0 border-border bg-background hover:bg-muted" />
						<CarouselNext className="static size-10 translate-y-0 border-border bg-background hover:bg-muted" />
					</div>
				</div>

				<CarouselContent>
					{products.map((product, position) => {
						const listingProduct = productForListing(product, position);
						const catalogName = listingProduct.category?.name ?? listingProduct.name;

						return (
							<CarouselItem
								key={`${listingProduct.id}:${listingProduct.category?.slug ?? position}`}
								className="basis-[82%] sm:basis-[48%] lg:basis-1/4"
							>
								<ProductCard product={listingProduct} title={catalogName} priority={position < 4} />
							</CarouselItem>
						);
					})}
				</CarouselContent>
			</Carousel>
		</section>
	);
}

export function CatalogProductRail(props: {
	productSlug: string;
	currentCatalogSlug: string;
	catalogs: Catalog[];
}) {
	return (
		<Suspense>
			<CatalogProductRailContent {...props} />
		</Suspense>
	);
}
