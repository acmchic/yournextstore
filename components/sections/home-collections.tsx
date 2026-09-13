import { cacheLife } from "next/cache";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { catalogNavigation } from "@/lib/catalog-navigation";
import { catalogBrowse, shopBrowse, storefrontCollections } from "@/lib/own-commerce";

export async function HomeCollections() {
	"use cache";
	cacheLife("minutes");
	const [catalogs, collections] = await Promise.all([catalogBrowse(), storefrontCollections()]);
	const groups = catalogNavigation(catalogs.data).filter((group) => group.slug !== "home-living");
	const edits = await Promise.all(
		collections.data
			.filter((item) => item.featured)
			.slice(0, 3)
			.map(async (collection) => ({
				collection,
				products: await shopBrowse({ collection: collection.slug, limit: 4 }),
			})),
	);
	return (
		<>
			<section
				className="border-b border-border px-6 py-14 md:px-10 md:py-20"
				aria-labelledby="shop-the-edit"
			>
				<div className="grid gap-8 md:grid-cols-[1fr_2fr] md:items-end">
					<div>
						<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
							TeeBravo / Curated edits
						</p>
						<h2
							id="shop-the-edit"
							className="mt-3 max-w-sm text-3xl font-semibold uppercase leading-[0.95] tracking-tight md:text-5xl"
						>
							Find your next everyday favorite.
						</h2>
					</div>
					<p className="max-w-md text-sm leading-relaxed text-muted-foreground">
						A tighter way to browse graphic clothing: seasonal stories, new drops and the designs worth
						wearing on repeat.
					</p>
				</div>
			</section>
			<nav aria-label="Shop by department" className="grid grid-cols-2 border-b border-border md:grid-cols-4">
				{groups.map((group) => (
					<Link
						key={group.slug}
						href={group.href}
						className="border-r border-border px-5 py-8 text-center text-xs uppercase tracking-widest transition-colors last:border-r-0 hover:bg-foreground hover:text-background md:py-10"
					>
						{group.label}
					</Link>
				))}
			</nav>
			{edits
				.filter((edit) => edit.products.data.length > 0)
				.map(({ collection, products }) => (
					<section
						key={collection.id}
						className="border-b border-border py-12 md:py-20"
						aria-labelledby={`edit-${collection.slug}`}
					>
						<header className="mb-10 flex flex-col items-center px-6 text-center md:flex-row md:items-end md:justify-between md:text-left">
							<div>
								<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">The edit</p>
								<h2
									id={`edit-${collection.slug}`}
									className="text-2xl font-semibold uppercase tracking-tight md:text-3xl"
								>
									{collection.title}
								</h2>
								<p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
									{collection.description}
								</p>
							</div>
							<Link
								href={`/collection/${collection.slug}`}
								className="mt-5 text-xs uppercase tracking-wider underline underline-offset-4 md:mt-0"
							>
								View all
							</Link>
						</header>
						<div className="grid grid-cols-2 gap-x-3 gap-y-8 px-4 md:grid-cols-4 md:gap-x-6 md:px-8">
							{products.data.map((product) => (
								<ProductCard
									key={`${product.id}:${product.category?.slug}`}
									product={product}
									showCatalogMeta
								/>
							))}
						</div>
						<div className="mt-10 text-center">
							<Link
								href={`/collection/${collection.slug}`}
								className="inline-flex min-h-11 items-center border border-foreground px-8 text-xs uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
							>
								Explore {collection.title}
							</Link>
						</div>
					</section>
				))}
			<section className="grid border-b border-border md:grid-cols-3" aria-label="The TeeBravo difference">
				{[
					["01", "Design-led graphics", "Distinctive artwork made to bring personality to everyday layers."],
					["02", "Choose your silhouette", "Explore the same point of view across tees, hoodies and more."],
					[
						"03",
						"Made for repeat wear",
						"Simple staples, considered graphics and an easy way to find your fit.",
					],
				].map(([number, title, description]) => (
					<div
						key={number}
						className="border-b border-border px-8 py-10 last:border-b-0 md:border-b-0 md:border-r md:px-10 md:py-14 md:last:border-r-0"
					>
						<p className="text-xs text-muted-foreground">{number}</p>
						<h2 className="mt-8 text-xl font-semibold uppercase tracking-tight">{title}</h2>
						<p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
					</div>
				))}
			</section>
			<section className="grid border-b border-border md:grid-cols-2">
				<div className="border-b border-border px-8 py-16 md:border-r md:border-b-0 md:px-16">
					<p className="text-xs uppercase tracking-widest">TeeBravo</p>
					<h2 className="mt-4 max-w-sm text-3xl font-semibold uppercase leading-tight">
						Your graphic.
						<br />
						Your everyday.
					</h2>
				</div>
				<div className="flex flex-col justify-center gap-5 px-8 py-12 md:px-16">
					<p className="max-w-lg text-sm leading-relaxed">
						Start with the artwork. Find a silhouette. Make it part of your rotation. Explore graphic tees,
						hoodies and layers in the fit and color that feel like you.
					</p>
					<Link href="/about" className="text-xs uppercase underline underline-offset-4">
						Discover TeeBravo
					</Link>
				</div>
			</section>
		</>
	);
}
