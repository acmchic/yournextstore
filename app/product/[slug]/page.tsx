import { Star } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddToCartButton } from "@/app/product/[slug]/add-to-cart-button";
import { CatalogDetails } from "@/app/product/[slug]/catalog-details";
import { CatalogProductRail } from "@/app/product/[slug]/catalog-product-rail";
import { MediaGallery } from "@/app/product/[slug]/media-gallery";
import { ProductCheckoutTrust, ProductDeliveryEstimate } from "@/app/product/[slug]/product-assurance";
import { ProductReviews } from "@/app/product/[slug]/product-reviews";
import { RelatedProducts } from "@/app/product/[slug]/related-products";
import { TrustBadges } from "@/app/product/[slug]/trust-badges";
import { TiptapRenderer } from "@/components/tiptap-renderer";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { getShippingQuote } from "@/lib/checkout";
import { commerce, meGetCached } from "@/lib/commerce";
import { buildProductBreadcrumbJsonLd, buildProductJsonLd, JsonLdScript } from "@/lib/json-ld";
import { productDisplayName } from "@/lib/merchant";
import { catalogBrowse, productGetByCatalog } from "@/lib/own-commerce";
import { getProductCatalogTypeOptions } from "@/lib/product-catalog-types";
import { cn } from "@/lib/utils";

export const unstable_instant = false;
export const unstable_prefetch = "force-runtime";

function StarRow({ rating }: { rating: number }) {
	const rounded = Math.round(rating);
	return (
		<span className="flex gap-0.5" aria-hidden>
			{Array.from({ length: 5 }, (_, i) => (
				<Star
					key={i}
					className={cn("h-4 w-4", i < rounded ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted")}
				/>
			))}
		</span>
	);
}

type ProductRouteParams = { slug: string; catalog?: string };

async function getProduct(slug: string, catalog?: string) {
	return catalog ? productGetByCatalog(slug, catalog) : commerce.productGet({ idOrSlug: slug });
}

async function getProductMetadata(slug: string, catalog?: string): Promise<Metadata> {
	"use cache";
	cacheLife("minutes");
	const product = await getProduct(slug, catalog);

	if (!product) {
		return { title: "Product Not Found", robots: { index: false, follow: true } };
	}

	const displayName = productDisplayName(product);
	const configuredTitle = product.seo?.title?.trim();
	const catalogName = product.category?.name;
	const seoTitle =
		configuredTitle &&
		catalogName &&
		!configuredTitle.toLocaleLowerCase().includes(catalogName.toLocaleLowerCase())
			? `${configuredTitle} — ${catalogName}`
			: configuredTitle || displayName;
	const seoDescription = product.seo?.description || product.summary || undefined;
	const canonical = product.seo?.canonical || `/product/${product.slug}`;
	const image = product.images[0];

	return {
		title: seoTitle,
		description: seoDescription,
		alternates: { canonical },
		openGraph: {
			type: "website",
			title: seoTitle,
			description: seoDescription,
			url: canonical,
			images: image ? [{ url: image, alt: displayName }] : undefined,
		},
		twitter: {
			card: image ? "summary_large_image" : "summary",
			title: seoTitle,
			description: seoDescription,
			images: image ? [image] : undefined,
		},
	};
}

export async function generateMetadata({
	params,
}: {
	params: Promise<ProductRouteParams>;
}): Promise<Metadata> {
	const { slug, catalog } = await params;
	return getProductMetadata(slug, catalog);
}

function ProductDetailsSkeleton() {
	return (
		<div
			className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6 lg:px-8 lg:py-4"
			role="status"
			aria-busy="true"
			aria-label="Loading product details"
		>
			<div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4" aria-hidden>
				<Skeleton className="h-3 w-10" />
				<Skeleton className="h-px w-3" />
				<Skeleton className="h-3 w-16" />
				<Skeleton className="hidden h-px w-3 sm:block" />
				<Skeleton className="hidden h-3 w-24 sm:block" />
			</div>

			<div className="lg:grid lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)] lg:gap-12 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)] xl:gap-20">
				<div aria-hidden>
					<Skeleton className="aspect-[4/5] w-full" />
					<div className="mt-4 hidden gap-3 md:flex">
						{Array.from({ length: 4 }, (_, index) => (
							<Skeleton key={index} className="aspect-square w-20 border border-border" />
						))}
					</div>
				</div>

				<div className="mt-8 space-y-6 lg:mt-0 lg:px-4 xl:px-8" aria-hidden>
					<div className="space-y-4">
						<Skeleton className="h-5 w-[72%]" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-full max-w-lg" />
							<Skeleton className="h-4 w-3/4 max-w-md" />
						</div>
					</div>

					<div className="space-y-3">
						<Skeleton className="h-9 w-28" />
						<div className="flex gap-4">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-40" />
						</div>
					</div>

					<div className="space-y-3">
						<Skeleton className="h-4 w-10" />
						<div className="flex flex-wrap gap-3">
							{[60, 64, 60, 68, 72].map((width, index) => (
								<Skeleton key={index} className="h-12 border border-border" style={{ width }} />
							))}
						</div>
					</div>

					<div className="space-y-3">
						<Skeleton className="h-4 w-12" />
						<div className="flex gap-3">
							{Array.from({ length: 4 }, (_, index) => (
								<Skeleton key={index} className="h-12 w-12 rounded-full border border-border" />
							))}
						</div>
					</div>

					<div className="space-y-3">
						<Skeleton className="h-4 w-20" />
						<div className="flex flex-wrap gap-3">
							{[72, 74, 68, 112].map((width) => (
								<Skeleton key={width} className="h-12 border border-border" style={{ width }} />
							))}
						</div>
					</div>

					<Skeleton className="h-14 w-full" />
				</div>
			</div>
			<span className="sr-only">Loading product details</span>
		</div>
	);
}

async function DynamicRouteMarker() {
	await connection();
	return null;
}

export default function ProductPage(props: { params: Promise<ProductRouteParams> }) {
	return (
		<>
			<Suspense fallback={null}>
				<DynamicRouteMarker />
			</Suspense>
			<Suspense fallback={<ProductDetailsSkeleton />}>
				<ProductDetails params={props.params} />
			</Suspense>
		</>
	);
}

const ProductDetails = async ({ params }: { params: Promise<ProductRouteParams> }) => {
	const { slug, catalog } = await params;
	return <CachedProductDetails slug={slug} catalog={catalog} />;
};

const CachedProductDetails = async ({ slug, catalog }: ProductRouteParams) => {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });
	const me = await meGetCached().catch(() => null);
	const reviewsEnabled = me?.store.settings?.enabledTools?.reviews ?? false;
	const [product, reviews, catalogs, legalPages, shipping] = await Promise.all([
		getProduct(slug, catalog).catch(() => null),
		reviewsEnabled ? commerce.productReviewsBrowse({ idOrSlug: slug }, { limit: 20 }) : Promise.resolve(null),
		catalogBrowse().catch(() => ({ data: [] })),
		commerce.legalPageBrowse().catch(() => ({ data: [], meta: { count: 0, offset: 0, limit: 0 } })),
		getShippingQuote().catch(() => null),
	]);

	if (!product) {
		notFound();
	}

	const reviewSummary = reviews?.summary ?? null;
	const catalogDetails =
		catalogs.data.find((item) => item.slug === catalog) ??
		catalogs.data.find((item) => item.slug === product.category?.slug) ??
		catalogs.data.find((item) => item.product_type === product.category?.slug);
	const currentCatalogSlug = catalogDetails?.slug ?? product.category?.slug ?? catalog ?? "";
	const catalogTypeOptions = getProductCatalogTypeOptions(catalogs.data, catalogDetails);
	const isApparel =
		catalogDetails?.taxonomy.some(({ department }) =>
			["men", "unisex", "women", "kids"].includes(department),
		) ?? false;
	const policies = legalPages.data
		.filter((page) => /shipping|return|refund/i.test(page.href + page.label))
		.map((page) => ({ label: page.label, href: page.href }));

	const allImages = [
		...product.images,
		...product.variants.flatMap((v) => v.images).filter((img) => !product.images.includes(img)),
	];
	const displayName = productDisplayName(product);
	const displayProduct = { ...product, name: displayName };
	const galleryAssets = (
		product as typeof product & {
			galleryAssets?: { design: string | null; avatar: string | null };
		}
	).galleryAssets;
	const inStock = product.variants.some((variant) => variant.stock === null || variant.stock > 0);

	const productJsonLd = await buildProductJsonLd(displayProduct, reviews);

	return (
		<div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
			<JsonLdScript data={productJsonLd} />
			<JsonLdScript data={buildProductBreadcrumbJsonLd(displayProduct)} />
			<Breadcrumb className="mb-3 border-b border-border/60 pb-2 text-[10px] uppercase leading-none tracking-[0.06em]">
				<BreadcrumbList className="flex-nowrap gap-1 overflow-hidden text-[10px] sm:gap-1.5">
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link href="/">Home</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link href="/products">Products</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem className="min-w-0">
						<BreadcrumbPage className="max-w-[55vw] truncate sm:max-w-none" title={product.name}>
							{product.name}
						</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="lg:grid lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)] lg:gap-12 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)] xl:gap-20">
				{/* Left: Image Gallery (sticky on desktop) */}
				<MediaGallery
					images={allImages}
					productName={displayName}
					variants={product.variants}
					avatarImage={galleryAssets?.avatar}
				/>

				{/* Right: Product Details */}
				<div className="mt-8 lg:sticky lg:top-24 lg:mt-0 lg:self-start lg:px-4 xl:px-8">
					{/* Title & reviews summary */}
					<div className="mb-4 space-y-3 border-b border-border/60 pb-5">
						<div className="flex items-start gap-3">
							<h1 className="min-w-0 flex-1 text-left text-base font-semibold leading-[1.12] tracking-[-0.02em] text-foreground sm:text-xl">
								{displayName}
							</h1>
						</div>
						{reviewSummary && reviewSummary.reviewCount > 0 && (
							<a
								href="#reviews"
								className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
							>
								<StarRow rating={reviewSummary.averageRating} />
								<span className="font-medium">{reviewSummary.averageRating.toFixed(1)}</span>
								<span className="text-muted-foreground underline-offset-4 hover:underline">
									({reviewSummary.reviewCount} {reviewSummary.reviewCount === 1 ? "review" : "reviews"})
								</span>
							</a>
						)}
					</div>

					{/* Short description, price, SKU, stock, variants, quantity, add to cart */}
					<AddToCartButton
						variants={product.variants}
						product={{
							id: product.id,
							name: displayName,
							slug: product.slug,
							images: product.images,
						}}
						volumePricingTiers={product.volumePricingTiers}
						catalogSelection={{ currentCatalogSlug, options: catalogTypeOptions }}
					/>
					<ProductCheckoutTrust policies={policies} inStock={inStock} />
					{shipping && <ProductDeliveryEstimate shipping={shipping} />}
					{shipping && <TrustBadges rates={shipping.rates} policies={policies} />}
					<CatalogDetails
						details={{
							catalogName: catalogDetails?.name ?? product.category?.name ?? "TeeBravo",
							description: catalogDetails?.description ?? product.summary,
							material: catalogDetails?.material,
							materialDetails: catalogDetails?.material_details,
							brand: catalogDetails?.brand,
							productType: catalogDetails?.product_type,
							chart: catalogDetails?.size_chart,
							sizes: catalogDetails?.sizes.map((size) => size.label),
							isApparel,
							policies,
						}}
					/>
				</div>
			</div>

			{/* Full description (below the fold, full width) */}
			{product.content && (
				<section className="mt-16 border-t border-border pt-12">
					<h2 className="mb-6 text-2xl font-medium tracking-tight">Product details</h2>
					<div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
						<TiptapRenderer content={product.content} />
					</div>
				</section>
			)}

			{/* Reviews Section */}
			{reviews && <ProductReviews reviews={reviews} slug={slug} />}

			<CatalogProductRail
				productSlug={product.slug}
				currentCatalogSlug={currentCatalogSlug}
				catalogs={catalogs.data}
			/>

			{/* Related Products */}
			<RelatedProducts productId={product.id} categorySlug={product.category?.slug} />
		</div>
	);
};
