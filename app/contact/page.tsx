import { MailIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactCard } from "@/components/ui/contact-card";
import { commerce } from "@/lib/commerce";
import { ContactForm } from "./contact-form";

export const unstable_instant = false;

export const metadata: Metadata = {
	title: "Contact Us",
	description: "Contact TeeBravo customer support about an order or product.",
	alternates: { canonical: "/contact" },
};

export default function Page() {
	return (
		<main className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 sm:py-24">
			<ContactCard
				className="mx-auto max-w-5xl"
				title="Get in touch"
				description="Questions about a product or order? Send us a message. Include your order number if you have one, and our support team will follow up by email."
				contactInfo={[
					{
						icon: MailIcon,
						label: "Email support",
						value: "help@teebravo.com",
						href: "mailto:help@teebravo.com",
					},
				]}
			>
				<ContactForm />
			</ContactCard>
			<Suspense fallback={null}>
				<ContactPolicyContent />
			</Suspense>
		</main>
	);
}

async function ContactPolicyContent() {
	const policy = await commerce.legalPageGet("contact");
	if (!policy) return null;

	return (
		<section className="mx-auto mt-12 max-w-3xl border-t border-border pt-10">
			<h2 className="mb-6 text-2xl font-semibold tracking-tight">{policy.label}</h2>
			<div
				className="prose prose-sm dark:prose-invert max-w-none"
				dangerouslySetInnerHTML={{ __html: policy.contentHtml }}
			/>
		</section>
	);
}
