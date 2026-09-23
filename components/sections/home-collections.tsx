import { cacheLife } from "next/cache";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { OccasionCollections } from "@/components/sections/occasion-collections";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ApiCatalog } from "@/lib/own-commerce";
import { catalogBrowse, homepageCollections, shopBrowse, storefrontCollections } from "@/lib/own-commerce";
import { StoreMedia } from "@/lib/store-media";

type HomeProduct = Awaited<ReturnType<typeof shopBrowse>>["data"][number];
type HomeCollection = Awaited<ReturnType<typeof storefrontCollections>>["data"][number];

const styleDefinitions = [
	{
		slug: "t-shirts",
		label: "Graphic Tees",
		description: "The everyday starting point.",
	},
	{
		slug: "hoodies",
		label: "Hoodies",
		description: "Layer up with a little more weight.",
	},
	{
		slug: "sweatshirts",
		label: "Sweatshirts",
		description: "Relaxed shapes for cooler days.",
	},
	{
		slug: "long-sleeves",
		label: "Long Sleeves",
		description: "More coverage, same point of view.",
	},
] as const;

const departmentOrder = ["unisex", "women", "kids"] as const;

const buyingFaq = [
	{
		question: "Where do you ship?",
		answer:
			"We currently ship to addresses in the United States. Service coverage and available methods are confirmed during checkout.",
		href: "/shipping-policy",
		linkLabel: "Read Shipping Policy",
	},
	{
		question: "How long does delivery take?",
		answer:
			"Processing and transit are separate. Current processing details, shipping methods, fees, and delivery estimates are shown at checkout and kept in the Shipping Policy.",
		href: "/shipping-policy",
		linkLabel: "See delivery details",
	},
	{
		question: "Where can I find sizing information?",
		answer:
			"Open the size guide on the product page for the selected garment. Measurements and fit can change by catalog, so use the guide for that specific piece.",
		href: "/products",
		linkLabel: "Browse products",
	},
	{
		question: "How do returns work?",
		answer:
			"Return eligibility, steps, fees, and refund timing are set out in the current Returns & Refunds policy. Check it before placing an order.",
		href: "/return-policy",
		linkLabel: "Read Returns & Refunds",
	},
] as const;

function distinctProducts(products: HomeProduct[]) {
	const seen = new Set<string>();
	return products.filter((product) => {
		if (seen.has(product.id)) return false;
		seen.add(product.id);
		return true;
	});
}

function buildStyleTiles(catalogs: ApiCatalog[], products: HomeProduct[]) {
	return styleDefinitions.flatMap((style, index) => {
		const matchingCatalogs = catalogs.filter(
			(catalog) =>
				catalog.product_count > 0 && catalog.taxonomy.some((item) => item.type_slug === style.slug),
		);
		const department = departmentOrder.find((candidate) =>
			matchingCatalogs.some((catalog) =>
				catalog.taxonomy.some((item) => item.department === candidate && item.type_slug === style.slug),
			),
		);
		if (!department) return [];
		return [
			{
				...style,
				image: products.find((product) =>
					matchingCatalogs.some((catalog) => catalog.slug === product.category?.slug),
				)?.images[0],
				number: String(index + 1).padStart(2, "0"),
				href: `/shop/${department}?type=${encodeURIComponent(style.slug)}`,
			},
		];
	});
}

function StyleNavigation({ catalogs, products }: { catalogs: ApiCatalog[]; products: HomeProduct[] }) {
	const styles = buildStyleTiles(catalogs, products);
	if (styles.length === 0) return null;
	return (
		<section className="border-b border-border px-5 py-14 sm:px-8 md:py-20" aria-labelledby="shop-by-style">
			<header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Browse the bodies</p>
					<h2
						id="shop-by-style"
						className="mt-3 max-w-lg font-display text-4xl leading-none tracking-tight sm:text-5xl"
					>
						Shop by style.
					</h2>
				</div>
				<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
					Start with the garment, then find the graphic that feels like you.
				</p>
			</header>
			<nav
				aria-label="Shop by style"
				className="grid grid-cols-2 border-l border-t border-border md:grid-cols-4"
			>
				{styles.map((style) => (
					<Link
						key={style.slug}
						href={style.href}
						className="group flex min-h-44 flex-col justify-between border-b border-r border-border p-5 transition-[border-color] hover:border-foreground focus-visible:border-foreground focus-visible:outline-none sm:min-h-52 sm:p-7"
					>
						{style.image && (
							<div className="relative mb-5 aspect-square w-full overflow-hidden bg-white">
								<StoreMedia
									src={style.image}
									alt={style.label}
									fill
									sizes="(max-width: 768px) 50vw, 25vw"
									className="object-contain"
								/>
							</div>
						)}
						<span>
							<span className="block font-display text-2xl tracking-tight sm:text-3xl">{style.label}</span>
							<span className="mt-2 block max-w-[13rem] text-xs leading-relaxed text-muted-foreground">
								{style.description}
							</span>
						</span>
					</Link>
				))}
			</nav>
		</section>
	);
}

function ProductRail({
	eyebrow,
	title,
	description,
	products,
	href,
	linkLabel,
	id,
}: {
	eyebrow: string;
	title: string;
	description: string;
	products: HomeProduct[];
	href: string;
	linkLabel: string;
	id: string;
}) {
	if (products.length === 0) return null;
	return (
		<section className="border-b border-border px-4 py-14 sm:px-8 md:py-20" aria-labelledby={id}>
			<header className="mb-9 flex flex-col gap-5 border-b border-border pb-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
					<h2 id={id} className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
						{title}
					</h2>
					<p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
				</div>
				<Link
					href={href}
					className="inline-flex min-h-11 shrink-0 items-center text-xs uppercase tracking-[0.12em] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
				>
					{linkLabel}
				</Link>
			</header>
			<div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 md:gap-x-6 md:gap-y-12">
				{products.map((product, index) => (
					<ProductCard
						key={`${product.id}:${product.category?.slug ?? index}`}
						product={product}
						priority={index < 4}
						showCatalogMeta
					/>
				))}
			</div>
		</section>
	);
}

function InterestTiles({ collections, excludedId }: { collections: HomeCollection[]; excludedId?: string }) {
	const tiles = collections
		.filter(
			(collection) =>
				collection.selection_rule === "manual" && collection.image_url && collection.id !== excludedId,
		)
		.slice(0, 4);
	if (tiles.length === 0) return null;
	return (
		<section
			className="border-b border-border px-5 py-14 sm:px-8 md:py-20"
			aria-labelledby="shop-by-interest"
		>
			<header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Curated by feeling</p>
					<h2
						id="shop-by-interest"
						className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl"
					>
						Shop by interest.
					</h2>
				</div>
				<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
					A few focused worlds, each built from a real edit of designs.
				</p>
			</header>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
				{tiles.map((collection) => (
					<Link
						key={collection.id}
						href={`/collection/${collection.slug}`}
						className="group block focus-visible:outline-none"
					>
						<div className="relative aspect-[4/5] overflow-hidden bg-secondary">
							<StoreMedia
								src={collection.image_url ?? ""}
								alt={collection.title}
								fill
								sizes="(max-width: 768px) 50vw, 25vw"
								className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
							<div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
								<p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Explore</p>
								<h3 className="mt-2 font-display text-2xl leading-none sm:text-3xl">{collection.title}</h3>
							</div>
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}

function SeasonalFeature({ collection }: { collection: HomeCollection | undefined }) {
	if (!collection?.image_url) return null;
	return (
		<section className="border-b border-border px-5 py-14 sm:px-8 md:py-20" aria-labelledby="seasonal-edit">
			<div className="relative min-h-[26rem] overflow-hidden bg-secondary sm:min-h-[32rem]">
				<StoreMedia
					src={collection.image_url}
					alt={collection.title}
					fill
					sizes="(max-width: 768px) 100vw, 90vw"
					className="object-cover transition-transform duration-700 ease-out hover:scale-[1.02] motion-reduce:transition-none"
				/>
				<div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
				<div className="relative flex min-h-[26rem] items-end p-6 text-white sm:min-h-[32rem] sm:p-10 md:p-14">
					<div className="max-w-md">
						<p className="text-[10px] uppercase tracking-[0.22em] text-white/70">Seasonal edit</p>
						<h2 id="seasonal-edit" className="mt-4 font-display text-4xl leading-none sm:text-6xl">
							{collection.title}
						</h2>
						<p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">{collection.description}</p>
						<Link
							href={`/collection/${collection.slug}`}
							className="mt-7 inline-flex min-h-11 items-center border border-white/70 px-5 text-xs uppercase tracking-[0.12em] transition-colors hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:outline-none"
						>
							Explore the edit
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}

function AboutBlock() {
	return (
		<section
			className="grid border-b border-border md:grid-cols-[1.05fr_0.95fr]"
			aria-labelledby="about-teebravo"
		>
			<div className="border-b border-border px-6 py-14 sm:px-10 md:border-b-0 md:border-r md:px-16 md:py-20">
				<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">TeeBravo / About</p>
				<h2
					id="about-teebravo"
					className="mt-5 max-w-lg font-display text-4xl leading-[0.95] tracking-tight sm:text-6xl"
				>
					Graphic clothing with a point of view.
				</h2>
			</div>
			<div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16 md:py-20">
				<p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
					TeeBravo brings expressive graphics to everyday clothing. Start with the artwork, choose the
					silhouette, and find the color and fit that work for your rotation.
				</p>
				<Link
					href="/about"
					className="mt-6 inline-flex min-h-11 items-center text-xs uppercase tracking-[0.12em] underline underline-offset-4"
				>
					Discover TeeBravo
				</Link>
			</div>
		</section>
	);
}

function BuyingFaq() {
	return (
		<section className="border-b border-border px-5 py-14 sm:px-8 md:py-20" aria-labelledby="buying-faq">
			<div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
						Before you check out
					</p>
					<h2 id="buying-faq" className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
						Buying FAQ.
					</h2>
					<p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
						Short answers to the questions that matter before an order.
					</p>
				</div>
				<Accordion type="single" collapsible className="border-t border-border">
					{buyingFaq.map((item, index) => (
						<AccordionItem key={item.question} value={`homepage-faq-${index}`}>
							<AccordionTrigger className="py-5 text-left text-sm font-medium">
								{item.question}
							</AccordionTrigger>
							<AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
								<p>
									{item.answer}{" "}
									<Link href={item.href} className="text-foreground underline underline-offset-4">
										{item.linkLabel}
									</Link>
								</p>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
			<div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs uppercase tracking-[0.12em]">
				<span className="text-muted-foreground">Need more detail?</span>
				<Link href="/faq" className="underline underline-offset-4">
					Visit the full FAQ
				</Link>
			</div>
		</section>
	);
}

function findSeasonalCollection(collections: HomeCollection[]) {
	return collections.find(
		(collection) =>
			collection.image_url &&
			collection.selection_rule === "manual" &&
			/(fall|spring|summer|winter|halloween|holiday|seasonal)/i.test(
				`${collection.slug} ${collection.title}`,
			),
	);
}

export async function HomeCollections() {
	"use cache";
	cacheLife("minutes");
	const [catalogs, collections, homepageCollectionResult, newArrivalResult] = await Promise.all([
		catalogBrowse(),
		storefrontCollections(),
		homepageCollections(),
		shopBrowse({ collection: "new-arrivals", limit: 8 }),
	]);
	const newArrivals = distinctProducts(newArrivalResult.data).slice(0, 8);
	const newArrivalIds = new Set(newArrivals.map((product) => product.id));
	const picksCollection = collections.data.find(
		(collection) => collection.featured && collection.selection_rule === "manual",
	);
	const picksResult = picksCollection
		? await shopBrowse({ collection: picksCollection.slug, limit: 24 })
		: null;
	const picks = picksResult
		? distinctProducts(picksResult.data)
				.filter((product) => !newArrivalIds.has(product.id))
				.slice(0, 4)
		: [];
	const seasonalCollection = findSeasonalCollection(collections.data);

	return (
		<>
			<StyleNavigation catalogs={catalogs.data} products={newArrivals} />
			<ProductRail
				eyebrow="01 / Just in"
				title="New arrivals"
				description="Fresh graphics on tees, hoodies and sweatshirts. Find your next everyday favorite."
				products={newArrivals}
				href="/collection/new-arrivals"
				linkLabel="View all new arrivals"
				id="new-arrivals"
			/>
			<OccasionCollections collections={homepageCollectionResult.data} />
			<InterestTiles collections={collections.data} excludedId={seasonalCollection?.id} />
			<SeasonalFeature collection={seasonalCollection} />
			<ProductRail
				eyebrow="02 / Curated by TeeBravo"
				title="TeeBravo picks"
				description="A few favorites from our latest edit. Find the graphic that feels like you."
				products={picks}
				href={picksCollection ? `/collection/${picksCollection.slug}` : "/products"}
				linkLabel="Explore the picks"
				id="teebravo-picks"
			/>
			<AboutBlock />
			<BuyingFaq />
		</>
	);
}
