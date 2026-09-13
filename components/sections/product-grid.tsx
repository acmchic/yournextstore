import type {
	APICollectionGetByIdResult,
	APIProductGetByIdResult,
	APIProductsBrowseResult,
} from "commerce-kit";
import { ArrowUpRight } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { commerce } from "@/lib/commerce";

export type Product = APIProductsBrowseResult["data"][number];

type ProductGridProps = {
	title?: string;
	description?: string;
	products?: (
		| Product
		| APICollectionGetByIdResult["productCollections"][number]["product"]
		| NonNullable<APIProductGetByIdResult>
	)[];
	limit?: number;
	showCatalogMeta?: boolean;
	showViewAll?: boolean;
	viewAllHref?: string;
};

export async function ProductGrid({
	title,
	description,
	products,
	limit = 6,
	showCatalogMeta = false,
	showViewAll = false,
	viewAllHref = "/products",
}: ProductGridProps) {
	"use cache";
	cacheLife("seconds");

	const displayProducts = products ?? (await commerce.productBrowse({ active: true, limit })).data;

	return (
		<section className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			{(title || description) && (
				<div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-4 sm:mb-10">
					<div>
						{title && <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>}
						{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
					</div>
					{showViewAll && (
						<Link
							href={viewAllHref}
							className="group/link hidden shrink-0 items-center gap-2 text-sm font-bold sm:flex"
						>
							Shop all
							<ArrowUpRight className="size-4 transition-transform duration-200 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
						</Link>
					)}
				</div>
			)}

			{displayProducts.length > 0 ? (
				<div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6">
					{displayProducts.map((product, index) => (
						<ProductCard
							key={product.id}
							product={product}
							priority={index < 3}
							showCatalogMeta={showCatalogMeta}
						/>
					))}
				</div>
			) : (
				<p className="border border-border px-6 py-16 text-center text-sm text-muted-foreground">
					No products are available right now.
				</p>
			)}

			{showViewAll && (
				<div className="mt-10 sm:hidden">
					<Link
						href={viewAllHref}
						className="flex items-center justify-center gap-2 border border-foreground px-5 py-3 text-sm font-bold active:translate-y-px"
					>
						Shop all
						<ArrowUpRight className="size-4" />
					</Link>
				</div>
			)}
		</section>
	);
}

export function ProductGridSkeleton() {
	return (
		<section className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<div className="mb-8 h-8 w-48 animate-pulse bg-muted sm:mb-10" />
			<div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6">
				{[0, 1, 2].map((i) => (
					<div key={i} className="animate-pulse">
						<div className="mb-4 aspect-square border border-border bg-muted" />
						<div className="flex items-start justify-between gap-4 border-t border-border pt-3">
							<div className="h-5 w-2/3 bg-muted" />
							<div className="h-5 w-16 bg-muted" />
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
