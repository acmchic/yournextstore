import { cacheLife } from "next/cache";
import { StoreLink } from "@/components/store-link";
import { shopBrowse, storefrontCollections } from "@/lib/own-commerce";
import { StoreMedia } from "@/lib/store-media";
import { cn } from "@/lib/utils";

export async function OccasionCollections({
	department,
	catalog,
	type,
}: {
	department?: string;
	catalog?: string;
	type?: string;
}) {
	"use cache";
	cacheLife("minutes");
	const collections = await storefrontCollections();
	const occasions = await Promise.all(
		collections.data
			.filter((collection) => collection.selection_rule === "keywords" && collection.featured)
			.slice(0, 6)
			.map(async (collection) => {
				const products = await shopBrowse({
					collection: collection.slug,
					department,
					catalog,
					type,
					limit: 1,
				});
				const product = products.data[0];
				return { collection, product, count: products.meta.count };
			}),
	);
	const populated = occasions.filter(({ product }) => product?.images[0]);
	if (!populated.length) return null;
	const query = new URLSearchParams({
		...(department ? { department } : {}),
		...(catalog ? { catalog } : {}),
		...(type ? { type } : {}),
	}).toString();
	return (
		<section
			className="border-t border-border px-4 py-14 sm:px-8 md:py-20"
			aria-labelledby="shop-by-occasion"
		>
			<header className="mb-8 max-w-xl">
				<h2 id="shop-by-occasion" className="font-display text-4xl tracking-tight sm:text-5xl">
					Made for the occasion.
				</h2>
				<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
					Find a graphic for the days you look forward to, from spooky nights to holiday gatherings.
				</p>
			</header>
			<div className={cn("grid grid-cols-2 gap-x-4 gap-y-8", populated.length > 2 && "md:grid-cols-3")}>
				{populated.map(({ collection, product, count }) => (
					<StoreLink
						key={collection.id}
						href={`/collection/${collection.slug}${query ? `?${query}` : ""}`}
						className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
					>
						<div className="relative aspect-[4/3] overflow-hidden bg-secondary">
							<StoreMedia
								src={product.images[0]}
								alt={`${collection.title}: ${product.name}`}
								fill
								sizes={populated.length > 2 ? "(max-width: 768px) 50vw, 33vw" : "50vw"}
								className="object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
							/>
						</div>
						<h3 className="mt-4 text-base font-medium group-hover:underline underline-offset-4">
							{collection.title}
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							{count} {count === 1 ? "design" : "designs"}
						</p>
					</StoreLink>
				))}
			</div>
		</section>
	);
}
