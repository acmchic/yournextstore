import Link from "next/link";
import { Button } from "@/components/ui/button";
import { storefront } from "@/lib/storefront-config";

export const metadata = {
	title: "Checkout",
	robots: { index: false, follow: false },
};
export const instant = false;

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cartId?: string }> }) {
	const { cartId } = await searchParams;

	return (
		<main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
			<p className="text-sm font-bold uppercase tracking-widest text-primary">Private checkout preview</p>
			<h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
				{storefront.brandName} is taking shape.
			</h1>
			<p className="mt-5 max-w-xl text-muted-foreground">
				The catalog, cart, and product pages now run on the local POD layer. Payments can connect after the
				first drop, reviews, and traffic signals are ready.
			</p>
			{cartId && <p className="mt-6 font-mono text-xs text-muted-foreground">Cart {cartId}</p>}
			<div className="mt-8 flex flex-wrap gap-3">
				<Button asChild>
					<Link href="/products">Back to drops</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href="/">Home</Link>
				</Button>
			</div>
		</main>
	);
}
