import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { generateMetadata as policyMetadata } from "@/app/[slug]/page";
import { FaqAccordion } from "@/components/faq-accordion";
import { commerce } from "@/lib/commerce";

export const unstable_instant = false;

export function generateMetadata(): Promise<Metadata> {
	return policyMetadata({ params: Promise.resolve({ slug: "faq" }) });
}

function splitFaqContent(content: string) {
	return content
		.trim()
		.split(/\r?\n\s*\r?\n/)
		.map((block) => block.trim())
		.filter(Boolean)
		.reduce<{ items: { question: string; answer: string }[]; supplemental: string[] }>(
			(result, block) => {
				const [question, ...answerLines] = block.split(/\r?\n/);
				const answer = answerLines.join("\n").trim();
				if (question?.trim().endsWith("?") && answer) {
					result.items.push({ question: question.trim(), answer });
				} else {
					result.supplemental.push(block);
				}
				return result;
			},
			{ items: [], supplemental: [] },
		);
}

export default async function Page() {
	"use cache";
	cacheLife({ stale: 0, revalidate: 30, expire: 60 });

	const page = await commerce.legalPageGet("faq");
	if (!page) notFound();

	const { items, supplemental } = splitFaqContent(page.contentText);

	return (
		<main className="border-b border-border px-5 py-16 sm:px-8 md:py-24">
			<div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
				<header>
					<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">TeeBravo support</p>
					<h1 className="mt-5 max-w-xl font-display text-5xl leading-[0.98] tracking-tight sm:text-6xl">
						{page.label}
					</h1>
					<p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
						Answers about orders, payments, shipping, returns, and more.
					</p>
				</header>
				{items.length ? (
					<FaqAccordion
						items={items.map((item) => ({
							question: item.question,
							answer: <p className="whitespace-pre-line">{item.answer}</p>,
						}))}
					/>
				) : (
					<div
						className="prose prose-sm dark:prose-invert max-w-none border-t border-border pt-6"
						dangerouslySetInnerHTML={{ __html: page.contentHtml }}
					/>
				)}
			</div>
			{supplemental.length > 0 && (
				<div className="mt-8 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
					{supplemental.map((text) => (
						<p key={text} className="whitespace-pre-line">
							{text}
						</p>
					))}
				</div>
			)}
		</main>
	);
}
