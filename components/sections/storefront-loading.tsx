const shopSkeletonCards = Array.from({ length: 8 }, (_, index) => `shop-skeleton-${index}`);

export function HomeLoadingSkeleton() {
	return (
		<div role="status" aria-busy="true" aria-label="Loading TeeBravo homepage">
			<section className="border-b border-border">
				<div className="h-[min(680px,calc(100svh-7rem))] min-h-[560px] animate-pulse bg-secondary" />
			</section>
			<section className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
				<div className="mb-8 h-8 w-48 animate-pulse bg-secondary sm:mb-10" />
				<div className="grid grid-cols-2 gap-x-3 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
					{shopSkeletonCards.slice(0, 4).map((key) => (
						<div key={key} className="animate-pulse">
							<div className="aspect-[3/4] bg-secondary" />
							<div className="mt-4 h-4 w-3/4 bg-secondary" />
							<div className="mt-2 h-4 w-1/3 bg-secondary" />
						</div>
					))}
				</div>
			</section>
		</div>
	);
}

export function ShopLoadingSkeleton() {
	return (
		<div role="status" aria-busy="true" aria-label="Loading shop">
			<header className="border-b border-border px-6 py-16 text-center md:py-24">
				<div className="mx-auto h-3 w-20 animate-pulse bg-secondary" />
				<div className="mx-auto mt-4 h-10 max-w-xs animate-pulse bg-secondary" />
				<div className="mx-auto mt-5 h-4 max-w-md animate-pulse bg-secondary" />
			</header>
			<div className="grid gap-8 p-4 md:p-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
				<aside className="space-y-3">
					{Array.from({ length: 6 }, (_, index) => (
						<div key={`shop-filter-${index}`} className="h-8 animate-pulse bg-secondary" />
					))}
				</aside>
				<section>
					<div className="mb-6 h-4 w-24 animate-pulse bg-secondary" />
					<div className="grid grid-cols-2 gap-x-3 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
						{shopSkeletonCards.map((key) => (
							<div key={key} className="animate-pulse">
								<div className="aspect-[3/4] bg-secondary" />
								<div className="mt-4 h-4 w-3/4 bg-secondary" />
								<div className="mt-2 h-4 w-1/3 bg-secondary" />
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}

export function ShopProductGridSkeleton() {
	return (
		<div role="status" aria-busy="true" aria-label="Loading products">
			<div className="grid grid-cols-2 gap-x-3 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
				{shopSkeletonCards.slice(0, 8).map((key) => (
					<div key={key} className="animate-pulse">
						<div className="aspect-[3/4] bg-secondary" />
						<div className="mt-4 h-4 w-3/4 bg-secondary" />
						<div className="mt-2 h-4 w-1/3 bg-secondary" />
					</div>
				))}
			</div>
		</div>
	);
}
