import { cacheLife } from "next/cache";
import { commerce } from "@/lib/commerce";

export async function generateMetadata() {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });
	const page = await commerce.legalPageGet("about");
	return {
		title: page?.label || "About TeeBravo",
		alternates: { canonical: "/about" },
		robots: { index: Boolean(page), follow: true },
	};
}
export default async function AboutPage() {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });
	const page = await commerce.legalPageGet("about");
	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<h1 className="mb-8 text-4xl font-semibold tracking-tight">{page?.label || "About TeeBravo"}</h1>
			{page ? (
				<div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
			) : (
				<p className="text-muted-foreground">Store information is not available yet.</p>
			)}
		</main>
	);
}
