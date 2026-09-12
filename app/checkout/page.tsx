import { editCheckoutCart } from "@/app/checkout/actions";
import { ShippingSelector } from "@/app/checkout/shipping-selector";
import { type CheckoutCart, checkoutFetch } from "@/lib/checkout";
import { commerce } from "@/lib/commerce";
import { getCartCookieJson } from "@/lib/cookies";
import { formatMoney } from "@/lib/money";
import { StoreMedia } from "@/lib/store-media";

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const unstable_instant = false;
const money = (amount: number) => formatMoney({ amount: String(amount), currency: "USD", locale: "en-US" });

const checkoutImage = (item: CheckoutCart["items"][number]) => {
	const source = item.image ?? item.image_url;
	if (!source) return null;
	if (/^\/[^/]+\/[^/]+_color-[^/]+\.webp(?:\?.*)?$/.test(source)) {
		const query = new URLSearchParams({ Color: item.color, Size: item.size, Placement: "front" });
		return `/api/catalog-mockup/${encodeURIComponent(item.product_slug)}/${encodeURIComponent(item.catalog)}?${query}`;
	}
	return source;
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
	const cookie = await getCartCookieJson();
	const [params, cart, policies] = await Promise.all([
		searchParams,
		cookie
			? checkoutFetch<CheckoutCart>(`/v1/carts/${encodeURIComponent(cookie.id)}/checkout-review`).catch(
					() => null,
				)
			: null,
		commerce.legalPageBrowse(),
	]);
	if (!cart?.items.length)
		return (
			<main className="mx-auto max-w-3xl px-6 py-20">
				<h1 className="text-3xl font-semibold">Your cart is empty</h1>
				<a href="/products" className="mt-6 inline-block underline">
					Explore the collection
				</a>
			</main>
		);
	const shipping = { options: cart.shipping_options };
	return (
		<main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
			<p className="text-xs uppercase tracking-widest text-muted-foreground">TeeBravo / Checkout</p>
			<h1 className="mt-4 text-4xl font-semibold tracking-tight">One step closer.</h1>
			<div className="mt-10 grid gap-12 md:grid-cols-[1.3fr_1fr]">
				<section aria-label="Order review" className="divide-y border-y">
					{cart.items.map((item) => {
						const image = checkoutImage(item);
						return (
							<div key={item.variant_id} className="flex items-start justify-between gap-5 py-5">
								<div className="flex min-w-0 gap-4">
									<div className="relative h-28 w-24 shrink-0 overflow-hidden bg-[#f1f3f5]">
										{image && (
											<StoreMedia
												src={image}
												alt={item.product_title}
												fill
												unoptimized
												className="object-cover"
												sizes="96px"
											/>
										)}
									</div>
									<div>
										<p className="font-medium">{item.product_title}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{item.catalog_name} · {item.color_name} · {item.size}
										</p>
										<p className="mt-2 text-sm">Quantity {item.quantity}</p>
									</div>
								</div>
								<p className="shrink-0">{money(item.price_minor * item.quantity)}</p>
							</div>
						);
					})}
				</section>
				<section aria-label="Payment and shipping" className="space-y-6">
					<div className="flex justify-between">
						<span>Items</span>
						<span>{money(cart.subtotal_minor)}</span>
					</div>
					{params.error && (
						<p role="alert" className="text-sm text-destructive">
							{params.error === "cancel"
								? "We could not reopen your cart. Please try again; your payment may be processing."
								: "Payment is currently unavailable. Your cart is saved. Please try again later."}
						</p>
					)}
					<ShippingSelector
						options={shipping.options}
						subtotal={cart.subtotal_minor}
						initialMethod={cart.selected_shipping}
						locked={cart.locked}
					/>
					<form action={editCheckoutCart}>
						<button type="submit" className="text-sm underline">
							Edit cart
						</button>
					</form>
					<div className="flex flex-wrap gap-4 text-xs">
						{policies.data
							.filter((page) => /shipping|return|refund|privacy|terms/i.test(page.href))
							.map((page) => (
								<a key={page.href} href={`/legal${page.href}`} className="underline">
									{page.label}
								</a>
							))}
					</div>
				</section>
			</div>
		</main>
	);
}
