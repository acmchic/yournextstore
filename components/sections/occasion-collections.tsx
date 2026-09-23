import { StoreLink } from "@/components/store-link";
import { homepageCollections } from "@/lib/own-commerce";
import { StoreMedia } from "@/lib/store-media";

type HomepageCollection = Awaited<ReturnType<typeof homepageCollections>>["data"][number];

function ThemeCollections({ collections, query }: { collections: HomepageCollection[]; query: string }) {
	if (collections.length === 0) return null;

	return (
		<section className="border-b border-border px-5 py-14 sm:px-8 md:py-20" aria-labelledby="shop-by-theme">
			<header className="mb-8 flex items-end justify-between gap-6 md:mb-10">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Find your people</p>
					<h2
						id="shop-by-theme"
						className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl"
					>
						Shop by theme.
					</h2>
				</div>
				<p className="hidden max-w-sm text-right text-sm leading-relaxed text-muted-foreground md:block">
					Start with an interest. We’ll bring together every matching design as the collection grows.
				</p>
			</header>

			<div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6">
				{collections.map((collection) => (
					<StoreLink
						key={collection.id}
						href={`/collection/${collection.slug}${query}`}
						className="group w-[42vw] min-w-36 shrink-0 snap-start focus-visible:outline-none sm:w-44 md:w-auto md:min-w-0"
					>
						<div className="relative aspect-square overflow-hidden rounded-[42%] bg-[#f1e9dc] ring-1 ring-foreground/5 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none">
							{collection.image_url ? (
								<StoreMedia
									src={collection.image_url}
									alt=""
									fill
									sizes="(max-width: 640px) 42vw, (max-width: 1024px) 33vw, 16vw"
									className="object-contain p-[8%] transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
								/>
							) : null}
						</div>
						<h3 className="mt-4 text-center text-sm font-medium tracking-tight sm:text-base">
							{collection.title}
						</h3>
					</StoreLink>
				))}
			</div>
		</section>
	);
}

function HolidayCollections({ collections, query }: { collections: HomepageCollection[]; query: string }) {
	if (collections.length === 0) return null;

	return (
		<section className="border-b border-border px-5 py-14 sm:px-8 md:py-20" aria-labelledby="shop-by-holiday">
			<header className="mb-8 flex items-end justify-between gap-6 md:mb-10">
				<div>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">The seasonal edit</p>
					<h2
						id="shop-by-holiday"
						className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl"
					>
						Shop by holiday.
					</h2>
				</div>
				<StoreLink
					href="/products"
					className="hidden min-h-11 items-center text-xs uppercase tracking-[0.14em] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none sm:inline-flex"
				>
					View all designs
				</StoreLink>
			</header>

			<div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
				{collections.map((collection) => (
					<StoreLink
						key={collection.id}
						href={`/collection/${collection.slug}${query}`}
						className="group relative aspect-[5/4] w-[86vw] max-w-xl shrink-0 snap-center overflow-hidden bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-[68vw] lg:w-auto"
					>
						{collection.image_url ? (
							<StoreMedia
								src={collection.image_url}
								alt=""
								fill
								sizes="(max-width: 640px) 86vw, (max-width: 1024px) 68vw, 33vw"
								className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
							/>
						) : null}
						<div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/5" />
						<div className="absolute inset-0 flex items-end p-6 text-white sm:p-8">
							<div className="max-w-[18rem]">
								<h3 className="font-display text-3xl leading-none sm:text-4xl">{collection.title}</h3>
								{collection.description ? (
									<p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/78">
										{collection.description}
									</p>
								) : null}
								<span className="mt-6 inline-flex min-h-11 items-center border border-white/65 px-4 text-[11px] uppercase tracking-[0.12em] transition-colors group-hover:bg-white group-hover:text-black">
									Shop {collection.title}{" "}
									<span aria-hidden="true" className="ml-3">
										→
									</span>
								</span>
							</div>
						</div>
					</StoreLink>
				))}
			</div>
		</section>
	);
}

export async function OccasionCollections({
	collections,
	department,
	catalog,
	type,
}: {
	collections?: HomepageCollection[];
	department?: string;
	catalog?: string;
	type?: string;
}) {
	const resolvedCollections = collections ?? (await homepageCollections()).data;
	const themes = resolvedCollections
		.filter((collection) => collection.homepage_section === "theme")
		.slice(0, 8);
	const holidays = resolvedCollections
		.filter((collection) => collection.homepage_section === "holiday")
		.slice(0, 6);
	const queryString = new URLSearchParams({
		...(department ? { department } : {}),
		...(catalog ? { catalog } : {}),
		...(type ? { type } : {}),
	}).toString();
	const query = queryString ? `?${queryString}` : "";

	return (
		<>
			<ThemeCollections collections={themes} query={query} />
			<HolidayCollections collections={holidays} query={query} />
		</>
	);
}
