import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { JsonLdScript } from "@/lib/json-ld";
import { storefront } from "@/lib/storefront-config";

// Legal pages are CMS-backed and may change independently of the storefront build.
// Allow the request to resolve the published page instead of forcing prerendering.
export const unstable_instant = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });
	const { slug } = await params;
	const page = await commerce.legalPageGet(slug);

	if (!page) {
		return { title: "Page Not Found", robots: { index: false, follow: true } };
	}

	const canonical = page.href;

	return {
		title: page.label,
		description: `${page.label} for TeeBravo. Business information, customer support and purchase policies.`,
		alternates: { canonical },
		openGraph: {
			type: "article",
			title: page.label,
			url: canonical,
		},
	};
}

export default async function LegalPage(props: { params: Promise<{ slug: string }> }) {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });

	const { slug } = await props.params;
	const page = await commerce.legalPageGet(slug);

	if (!page) {
		notFound();
	}

	return (
		<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			{/return|refund/i.test(slug) && (
				<JsonLdScript
					data={{
						"@context": "https://schema.org",
						"@type": "OnlineStore",
						name: storefront.brandName,
						url: storefront.url,
						hasMerchantReturnPolicy: {
							"@type": "MerchantReturnPolicy",
							merchantReturnLink: `${storefront.url}/${slug}`,
						},
					}}
				/>
			)}
			<h1 className="text-3xl font-bold tracking-tight mb-8">{page.label}</h1>
			{page.contentHtml ? (
				<div
					className="prose prose-sm dark:prose-invert max-w-none"
					dangerouslySetInnerHTML={{ __html: page.contentHtml }}
				/>
			) : (
				<p className="text-muted-foreground">No content available.</p>
			)}
		</div>
	);
}
