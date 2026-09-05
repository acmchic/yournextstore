import { cacheLife } from "next/cache";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { commerce } from "@/lib/commerce";
import { type ApiCatalog, catalogBrowse } from "@/lib/own-commerce";

const DEPARTMENTS = [
	["men", "Men"],
	["women", "Women"],
	["kids", "Kids"],
	["home-living", "Home & Living"],
	["accessories", "Accessories"],
] as const;

type Department = (typeof DEPARTMENTS)[number][0];

type CatalogGroup = {
	department: Department;
	label: string;
	types: Array<{
		slug: string;
		label: string;
		catalogs: ApiCatalog[];
	}>;
};

function groupCatalogs(catalogs: ApiCatalog[]): CatalogGroup[] {
	return DEPARTMENTS.map(([department, label]) => {
		const typedCatalogs = catalogs.flatMap((catalog) =>
			catalog.taxonomy
				.filter((item) => item.department === department)
				.map((item) => ({ catalog, taxonomy: item })),
		);
		const typeMap = typedCatalogs.reduce((map, item) => {
			const current = map.get(item.taxonomy.type_slug) ?? {
				slug: item.taxonomy.type_slug,
				label: item.taxonomy.type_label,
				order: item.taxonomy.sort_order,
				catalogs: [],
			};
			current.catalogs.push(item.catalog);
			map.set(item.taxonomy.type_slug, current);
			return map;
		}, new Map<string, { slug: string; label: string; order: number; catalogs: ApiCatalog[] }>());
		return {
			department,
			label,
			types: [...typeMap.values()]
				.toSorted((a, b) => a.order - b.order || a.label.localeCompare(b.label))
				.map(({ order: _order, ...type }) => type),
		};
	}).filter((group) => group.types.length > 0);
}

function selectDiverseCatalogs(groups: CatalogGroup[], limit: number) {
	const queues = groups.map((group) => group.types.flatMap((type) => type.catalogs));
	const longestQueue = Math.max(...queues.map((queue) => queue.length));
	const candidates = Array.from({ length: longestQueue * queues.length }, (_, index) =>
		queues[index % queues.length]?.at(Math.floor(index / queues.length)),
	).filter((catalog): catalog is ApiCatalog => Boolean(catalog));
	return [...new Map(candidates.map((catalog) => [catalog.id, catalog])).values()].slice(0, limit);
}

function CatalogSidebar({ groups }: { groups: CatalogGroup[] }) {
	return (
		<aside className="border-r border-border pr-6" aria-label="Product catalog">
			<div className="sticky top-24">
				<h2 className="border-b border-border pb-4 text-lg font-bold tracking-tight">Catalog</h2>
				<nav className="mt-5 space-y-7">
					{groups.map((group) => (
						<section key={group.department}>
							<h3 className="text-sm font-bold text-foreground">{group.label}</h3>
							<div className="mt-3 space-y-3">
								{group.types.map((type) => (
									<details key={type.slug} className="group/type">
										<summary className="cursor-pointer list-none text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
											<span>{type.label}</span>
											<span className="ml-2 font-mono text-[11px] text-muted-foreground/70">
												{type.catalogs.length}
											</span>
										</summary>
										<div className="mt-2 space-y-2 border-l border-border pl-3">
											{type.catalogs.map((catalog) => (
												<Link
													key={catalog.id}
													href={`/category/${catalog.slug}`}
													className="block text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground"
												>
													{catalog.name}
												</Link>
											))}
										</div>
									</details>
								))}
							</div>
						</section>
					))}
				</nav>
			</div>
		</aside>
	);
}

export async function CatalogShowcase() {
	"use cache";
	cacheLife("seconds");

	const { data: catalogs } = await catalogBrowse();
	const availableCatalogs = catalogs.filter(
		(catalog) => catalog.product_count > 0 && catalog.taxonomy.length > 0,
	);
	const groups = groupCatalogs(availableCatalogs);
	const selectedCatalogs = selectDiverseCatalogs(groups, 9);
	const results = await Promise.all(
		selectedCatalogs.map((catalog, index) =>
			commerce.productBrowse({
				active: true,
				category: catalog.slug,
				limit: 1,
				offset: index % catalog.product_count,
			}),
		),
	);
	const products = results.flatMap((result) => result.data);

	if (products.length === 0) return null;

	return (
		<section className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<div className="mb-8 border-b border-border pb-4 sm:mb-10">
				<h2 className="text-xl font-bold tracking-tight sm:text-2xl">Shop the catalog</h2>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Explore active products across apparel, kids, home goods, and accessories.
				</p>
			</div>

			<div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
				<div className="hidden lg:block">
					<CatalogSidebar groups={groups} />
				</div>
				<div>
					<div className="mb-8 flex gap-2 overflow-x-auto pb-2 lg:hidden">
						{groups.map((group) => {
							const catalog = group.types[0]?.catalogs[0];
							return catalog ? (
								<Link
									key={group.department}
									href={`/category/${catalog.slug}`}
									className="shrink-0 border border-border px-4 py-2 text-sm font-semibold active:translate-y-px"
								>
									{group.label}
								</Link>
							) : null;
						})}
					</div>
					<div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
						{products.map((product, index) => (
							<ProductCard
								key={`${product.id}-${product.category?.slug ?? index}`}
								product={product}
								priority={index < 3}
							/>
						))}
					</div>
					<div className="mt-10 border-t border-border pt-5">
						<Link href="/products" className="text-sm font-bold underline-offset-4 hover:underline">
							View all products
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
