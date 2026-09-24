import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { OccasionCollections } from "@/components/sections/occasion-collections";
import { ShopProductGridSkeleton } from "@/components/sections/storefront-loading";
import { catalogNavigation, departments } from "@/lib/catalog-navigation";
import { getCanonicalUrl } from "@/lib/commerce";
import { JsonLdScript } from "@/lib/json-ld";
import { catalogBrowse, shopBrowse } from "@/lib/own-commerce";

async function getCachedCatalogs() {
	"use cache";
	cacheLife("minutes");
	return catalogBrowse();
}

async function getCachedShopProducts(
	department: string,
	type: string | undefined,
	catalog: string | undefined,
	offset: number,
) {
	"use cache";
	cacheLife("minutes");
	return shopBrowse({ department, type, catalog, limit: 24, offset });
}

async function DepartmentProducts({
	department,
	type,
	catalog,
	page,
}: {
	department: string;
	type?: string;
	catalog?: string;
	page: number;
}) {
	const products = await getCachedShopProducts(department, type, catalog, (page - 1) * 24);
	if (page > 1 && !products.data.length) notFound();
	const pageHref = (target: number) =>
		`/shop/${department}?${new URLSearchParams({
			...(type ? { type } : {}),
			...(catalog ? { catalog } : {}),
			page: String(target),
		})}`;
	return (
		<>
			<div className="grid grid-cols-2 gap-x-3 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
				{products.data.map((product, index) => (
					<ProductCard
						key={`${product.id}:${product.category?.slug}`}
						product={product}
						priority={index < 4}
						showCatalogMeta
					/>
				))}
			</div>
			{products.meta.count > 24 && (
				<nav
					aria-label="Pagination"
					className="mt-12 flex items-center justify-between border-t py-6 text-sm"
				>
					{page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span />}
					<span>
						Page {page} of {Math.ceil(products.meta.count / 24)}
					</span>
					{page * 24 < products.meta.count ? <Link href={pageHref(page + 1)}>Next</Link> : <span />}
				</nav>
			)}
		</>
	);
}

type Props = {
	params: Promise<{ department: string }>;
	searchParams: Promise<{ type?: string; catalog?: string; page?: string }>;
};
export const unstable_instant = false;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const [{ department }, query] = await Promise.all([params, searchParams]);
	const data = departments.find((item) => item.slug === department);
	return {
		title: data?.label ?? "Shop",
		description: data?.description,
		alternates: { canonical: `/shop/${department}` },
		robots: query.type || query.catalog || query.page ? { index: false, follow: true } : undefined,
	};
}

export default async function DepartmentPage({ params, searchParams }: Props) {
	const [{ department }, query, catalogs] = await Promise.all([params, searchParams, getCachedCatalogs()]);
	const group = catalogNavigation(catalogs.data).find((item) => item.slug === department);
	if (!group) notFound();
	const selected = group.children.find((item) => item.slug === query.type);
	if (query.type && !selected) notFound();
	const selectedCatalog = selected?.catalogs.find((item) => item.slug === query.catalog);
	if (query.catalog && !selectedCatalog) notFound();
	const page = Number(query.page ?? 1);
	if (!Number.isSafeInteger(page) || page < 1) notFound();
	return (
		<div>
			<JsonLdScript
				data={{
					"@context": "https://schema.org",
					"@type": "BreadcrumbList",
					itemListElement: [
						{ "@type": "ListItem", position: 1, name: "Home", item: getCanonicalUrl() },
						{
							"@type": "ListItem",
							position: 2,
							name: group.label,
							item: `${getCanonicalUrl()}${group.href}`,
						},
					],
				}}
			/>
			<header className="border-b border-border px-6 py-16 text-center md:py-24">
				<p className="text-xs uppercase tracking-widest">{group.label}</p>
				<h1 className="mt-4 text-3xl font-semibold uppercase tracking-tight md:text-5xl">
					{selectedCatalog?.label ?? selected?.label ?? group.label}
				</h1>
				<p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">{group.description}</p>
			</header>
			<div className="grid gap-8 p-4 md:p-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
				<aside className="hidden lg:block">
					<nav
						aria-label={`${group.label} categories`}
						className="flex flex-wrap gap-3 lg:sticky lg:top-8 lg:flex-col"
					>
						<Link
							href={group.href}
							className="p-2 text-xs uppercase"
							aria-current={!selected ? "page" : undefined}
						>
							View all
						</Link>
						{group.children.map((item) => (
							<div key={item.slug} className="flex flex-col gap-1">
								<Link
									href={item.href}
									aria-current={selected?.slug === item.slug && !selectedCatalog ? "page" : undefined}
									className="p-2 text-xs font-medium uppercase aria-[current=page]:underline underline-offset-4"
								>
									{item.label}
								</Link>
								<div className="flex flex-col border-l border-border pl-2">
									{item.catalogs.map((catalog) => (
										<Link
											key={catalog.slug}
											href={catalog.href}
											aria-current={selectedCatalog?.slug === catalog.slug ? "page" : undefined}
											className="px-2 py-1.5 text-xs text-muted-foreground aria-[current=page]:text-foreground aria-[current=page]:underline underline-offset-4"
										>
											{catalog.label}
										</Link>
									))}
								</div>
							</div>
						))}
					</nav>
				</aside>
				<section>
					<Suspense fallback={<ShopProductGridSkeleton />}>
						<DepartmentProducts
							department={department}
							type={query.type}
							catalog={query.catalog}
							page={page}
						/>
					</Suspense>
				</section>
			</div>
			{page === 1 && (
				<Suspense fallback={null}>
					<OccasionCollections department={department} type={query.type} catalog={query.catalog} />
				</Suspense>
			)}
		</div>
	);
}
