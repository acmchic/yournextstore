import { MailIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactCard, ContactInfo } from "@/components/ui/contact-card";
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
				contactInfoContent={
					<Suspense
						fallback={
							<ContactInfo
								icon={MailIcon}
								label="Email support"
								value="help@teebravo.com"
								href="mailto:help@teebravo.com"
							/>
						}
					>
						<ContactDetails />
					</Suspense>
				}
			>
				<ContactForm />
			</ContactCard>
		</main>
	);
}

async function ContactDetails() {
	const contact = await commerce.legalPageGet("contact");
	const supportEmail = contact?.supportEmail || "help@teebravo.com";

	return (
		<>
			<ContactInfo
				icon={MailIcon}
				label="Email support"
				value={supportEmail}
				href={`mailto:${supportEmail}`}
			/>
			{contact?.businessAddress && (
				<ContactInfo icon={MapPinIcon} label="Business address" value={contact.businessAddress} />
			)}
		</>
	);
}
