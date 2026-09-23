import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { getCanonicalUrl } from "@/lib/commerce";
import { JsonLdScript } from "@/lib/json-ld";
import { shopBrowse, storefrontCollections } from "@/lib/own-commerce";

type Props = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ page?: string; department?: string; catalog?: string; type?: string }>;
};
export const unstable_instant = false;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const [{ slug }, query, collections] = await Promise.all([params, searchParams, storefrontCollections()]);
	const collection = collections.data.find((item) => item.slug === slug);
	if (!collection) return { title: "Collection not found", robots: { index: false, follow: true } };
	return {
		title: collection.title,
		description: collection.description ?? undefined,
		alternates: { canonical: `/collection/${slug}` },
		robots: {
			index:
				Boolean(collection.indexable) && !query.page && !query.department && !query.catalog && !query.type,
			follow: true,
		},
	};
}

export default async function CollectionPage({ params, searchParams }: Props) {
	const [{ slug }, query, collections] = await Promise.all([params, searchParams, storefrontCollections()]);
	const collection = collections.data.find((item) => item.slug === slug);
	if (!collection) notFound();
	const page = Number(query.page ?? 1);
	if (!Number.isSafeInteger(page) || page < 1) notFound();
	const products = await shopBrowse({
		collection: slug,
		department: query.department,
		catalog: query.catalog,
		type: query.type,
		limit: 24,
		offset: (page - 1) * 24,
	});
	if (!products.data.length) notFound();
	const base = getCanonicalUrl();
	const pageHref = (target: number) => `?${new URLSearchParams({ ...query, page: String(target) })}`;
	return (
		<div>
			<JsonLdScript
				data={{
					"@context": "https://schema.org",
					"@type": "CollectionPage",
					name: collection.title,
					description: collection.description,
					url: `${base}/collection/${slug}`,
				}}
			/>
			<JsonLdScript
				data={{
					"@context": "https://schema.org",
					"@type": "BreadcrumbList",
					itemListElement: [
						{ "@type": "ListItem", position: 1, name: "Home", item: base },
						{ "@type": "ListItem", position: 2, name: collection.title, item: `${base}/collection/${slug}` },
					],
				}}
			/>
			<header className="border-b border-border px-6 py-16 text-center md:py-24">
				<p className="text-xs uppercase tracking-widest">The TeeBravo edit</p>
				<h1 className="mt-4 text-3xl font-semibold uppercase tracking-tight md:text-5xl">
					{collection.title}
				</h1>
				<p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">{collection.description}</p>
			</header>
			{collection.selection_rule !== "manual" && (
				<nav aria-label="Collection garment types" className="flex flex-wrap justify-center gap-3 px-4 pt-8">
					{[
						{ slug: "", label: "All styles" },
						{ slug: "t-shirts", label: "T-shirts" },
						{ slug: "hoodies", label: "Hoodies" },
						{ slug: "sweatshirts", label: "Sweatshirts" },
					].map((style) => (
						<Button
							key={style.slug}
							asChild
							variant={(query.type ?? "") === style.slug ? "default" : "outline"}
						>
							<Link
								href={`?${new URLSearchParams({ ...(query.department ? { department: query.department } : {}), ...(style.slug ? { type: style.slug } : {}) })}`}
								aria-current={(query.type ?? "") === style.slug ? "page" : undefined}
							>
								{style.label}
							</Link>
						</Button>
					))}
				</nav>
			)}
			<section className="px-4 py-10 md:px-8">
				<p className="mb-6 text-xs uppercase">{products.meta.count} pieces</p>
				<div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-6">
					{products.data.map((product, index) => (
						<ProductCard
							key={`${product.id}:${product.category?.slug}`}
							product={product}
							priority={index < 2}
							showCatalogMeta
						/>
					))}
				</div>
				{products.meta.count > 24 && (
					<nav aria-label="Pagination" className="mt-12 flex justify-between border-t py-6 text-sm">
						{page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span />}
						<span>
							Page {page} of {Math.ceil(products.meta.count / 24)}
						</span>
						{page * 24 < products.meta.count ? <Link href={pageHref(page + 1)}>Next</Link> : <span />}
					</nav>
				)}
			</section>
		</div>
	);
}
