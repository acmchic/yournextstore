import PolicyPage, { generateMetadata as policyMetadata } from "@/app/[slug]/page";

export const unstable_instant = false;

export function generateMetadata() {
	return policyMetadata({ params: Promise.resolve({ slug: "faq" }) });
}

export default function Page() {
	return <PolicyPage params={Promise.resolve({ slug: "faq" })} />;
}
