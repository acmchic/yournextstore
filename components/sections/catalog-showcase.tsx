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
	if (groups.length === 0 || limit < 1) return [];
	const queues = groups.map((group) => group.types.flatMap((type) => type.catalogs));
	const longestQueue = Math.max(...queues.map((queue) => queue.length));
	const candidates = Array.from({ length: longestQueue * queues.length }, (_, index) =>
		queues[index % queues.length]?.at(Math.floor(index / queues.length)),
	).filter((catalog): catalog is ApiCatalog => Boolean(catalog));
	return [...new Map(candidates.map((catalog) => [catalog.id, catalog])).values()].slice(0, limit);
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
	const clothingGroups = groups.filter((group) => group.department !== "home-living");

	return (
		<section className="border-b border-border px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
			<div className="mb-16 grid grid-cols-2 border border-border md:grid-cols-4">
				{clothingGroups.map((group, index) => (
					<Link
						key={group.department}
						href={`/shop/${group.department}`}
						className="group border-border p-5 transition-colors hover:bg-foreground hover:text-background md:p-7"
					>
						<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground group-hover:text-background/60">
							0{index + 1}
						</p>
						<h2 className="mt-12 font-display text-2xl font-black uppercase tracking-[-0.05em] md:text-3xl">
							{group.label}
						</h2>
						<p className="mt-3 text-xs text-muted-foreground group-hover:text-background/70">
							{group.types.length} categories
						</p>
					</Link>
				))}
			</div>
			<div className="mb-10 flex flex-col justify-between gap-6 border-b border-border pb-5 sm:mb-12 md:flex-row md:items-end">
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
						01 / The current edit
					</p>
					<h2 className="mt-3 font-display text-4xl font-black uppercase leading-none tracking-[-0.055em] sm:text-5xl">
						Pieces, not noise.
					</h2>
				</div>
				<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
					A rotating selection of printed clothing and accessories. Choose a product, then find your design.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-x-4 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
				{products.map((product, index) => (
					<ProductCard
						key={`${product.id}-${product.category?.slug ?? index}`}
						product={product}
						priority={index < 4}
					/>
				))}
			</div>
			<div className="mt-12 flex items-center justify-between border-t border-border pt-5">
				<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
					New pieces added continuously
				</span>
				<Link
					href="/products"
					className="text-xs font-bold uppercase tracking-[0.14em] underline-offset-4 hover:underline"
				>
					View all pieces
				</Link>
			</div>
		</section>
	);
}
