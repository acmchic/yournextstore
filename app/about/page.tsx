import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { YnsLink } from "@/components/yns-link";
import { meGetCached } from "@/lib/commerce";
import { JsonLdScript } from "@/lib/json-ld";
import { storefront } from "@/lib/storefront-config";

export const metadata: Metadata = {
	title: "About",
	description: storefront.description,
	alternates: { canonical: "/about" },
	openGraph: {
		type: "website",
		title: "About",
		description: storefront.description,
		url: "/about",
	},
};

async function getStoreInfo() {
	try {
		const me = await meGetCached();
		return {
			storeName: me.store.name || storefront.brandName,
			storeDescription: me.store.settings?.storeDescription || storefront.description,
			contactFormEnabled: me.store.settings?.enabledTools?.contactForm ?? false,
		};
	} catch {
		return {
			storeName: storefront.brandName,
			storeDescription: storefront.description,
			contactFormEnabled: false,
		};
	}
}

export default async function AboutPage() {
	"use cache";
	cacheLife("hours");

	const { storeName, storeDescription, contactFormEnabled } = await getStoreInfo();

	const aboutJsonLd = {
		"@context": "https://schema.org",
		"@type": "AboutPage",
		name: `About ${storeName}`,
		description: storeDescription ?? storefront.description,
	};

	return (
		<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
			<JsonLdScript data={aboutJsonLd} />

			{/* Header */}
			<div className="mb-10">
				<YnsLink
					prefetch="eager"
					href="/"
					className="text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Home
				</YnsLink>
				<span className="mx-2 text-muted-foreground">/</span>
				<span className="text-sm">About</span>
				<h1 className="mt-4 text-4xl font-medium tracking-tight">About {storeName}</h1>
				{storeDescription && <p className="mt-3 text-lg text-muted-foreground">{storeDescription}</p>}
			</div>

			{/* Story */}
			<div className="space-y-12">
				<section>
					<h2 className="text-2xl font-medium tracking-tight mb-4">The Edit</h2>
					<div className="space-y-4 text-muted-foreground leading-relaxed">
						<p>
							We build apparel around the graphic first, then adapt it across tees, hoodies, and sweatshirts
							only when the blank supports the artwork.
						</p>
						<p>
							Print-on-demand keeps the run lean while organic traffic and early reviews prove which designs
							deserve to scale.
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-2xl font-medium tracking-tight mb-4">What We Stand For</h2>
					<div className="grid gap-6 sm:grid-cols-3">
						<div>
							<h3 className="text-base font-medium text-foreground">Sharp graphics</h3>
							<p className="mt-2 text-sm text-muted-foreground leading-relaxed">
								Artwork has to carry the product before it becomes a wider drop.
							</p>
						</div>
						<div>
							<h3 className="text-base font-medium text-foreground">Better blanks</h3>
							<p className="mt-2 text-sm text-muted-foreground leading-relaxed">
								Weight, surface, and fit matter because they decide how the print lives.
							</p>
						</div>
						<div>
							<h3 className="text-base font-medium text-foreground">Lean drops</h3>
							<p className="mt-2 text-sm text-muted-foreground leading-relaxed">
								Small edits let demand shape the next release instead of guessing at scale.
							</p>
						</div>
					</div>
				</section>
			</div>

			{/* CTA */}
			<div className="mt-16 border border-border bg-secondary/30 p-8">
				<h2 className="text-2xl font-medium tracking-tight">Start with the current edit.</h2>
				<p className="mt-2 text-muted-foreground">Browse the first drops and see which graphics hold up.</p>
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<YnsLink
						prefetch="eager"
						href="/products"
						className="inline-flex h-11 items-center justify-center bg-foreground px-8 font-medium text-background transition-all hover:bg-foreground/90"
					>
						View drops
					</YnsLink>
					{contactFormEnabled && (
						<YnsLink
							prefetch="eager"
							href="/contact"
							className="inline-flex h-11 items-center justify-center border border-border px-8 font-medium text-foreground transition-colors hover:bg-secondary"
						>
							Contact us
						</YnsLink>
					)}
				</div>
			</div>
		</div>
	);
}
