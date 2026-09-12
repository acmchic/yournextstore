import { CartContents } from "@/app/cart/cart-contents";
import { getShippingQuote } from "@/lib/checkout";

export const metadata = { title: "Your cart", robots: { index: false, follow: false } };
export const unstable_instant = false;
export default async function CartPage() {
	const { rates } = await getShippingQuote();
	return (
		<main className="mx-auto max-w-4xl px-6 py-12">
			<h1 className="mb-10 text-4xl font-semibold tracking-tight">Your cart</h1>
			<CartContents rates={rates} />
		</main>
	);
}
