import type { Metadata } from "next";
import { Suspense } from "react";
import { Hero } from "@/components/sections/hero";
import { HomeCollections } from "@/components/sections/home-collections";
import { storefront } from "@/lib/storefront-config";

export const metadata: Metadata = {
	title: { absolute: "Graphic Tees, Hoodies & Sweatshirts | TeeBravo" },
	description: storefront.description,
	alternates: { canonical: "/" },
	openGraph: {
		type: "website",
		title: "Graphic Tees, Hoodies & Sweatshirts | TeeBravo",
		description: storefront.description,
		url: "/",
	},
};

function ProductGridSkeleton() {
	return (
		<section className="border-b border-border" aria-busy="true" aria-label="Loading TeeBravo homepage">
			<div className="grid grid-cols-3 border-b border-border">
				{Array.from({ length: 3 }).map((_, i) => (
					<div
						key={`buying-skeleton-${i}`}
						className="h-28 border-r border-border bg-secondary/60 last:border-r-0"
					/>
				))}
			</div>
			<div className="border-b border-border px-6 py-12 md:px-10">
				<div className="h-3 w-24 animate-pulse bg-secondary" />
				<div className="mt-4 h-10 max-w-md animate-pulse bg-secondary" />
				<div className="mt-8 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={`style-skeleton-${i}`} className="h-36 animate-pulse bg-background" />
					))}
				</div>
			</div>
			<div className="px-4 py-12 md:px-8">
				<div className="mb-8 h-8 w-48 animate-pulse bg-secondary" />
				<div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-6">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={`product-skeleton-${i}`}>
							<div className="aspect-[3/4] animate-pulse bg-secondary" />
							<div className="mt-4 h-4 w-3/4 animate-pulse bg-secondary" />
							<div className="mt-2 h-4 w-1/3 animate-pulse bg-secondary" />
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export default function Home() {
	return (
		<>
			<Hero />
			<Suspense fallback={<ProductGridSkeleton />}>
				<HomeCollections />
			</Suspense>
		</>
	);
}
