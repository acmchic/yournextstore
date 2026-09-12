"use client";

import { useCart } from "@/app/cart/cart-context";
import { CartItem } from "@/app/cart/cart-item";
import type { ShippingRates } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

export function CartContents({ rates }: { rates: ShippingRates }) {
	const { items, itemCount, subtotal, isMutating } = useCart();
	const money = (amount: bigint | number) =>
		formatMoney({ amount: String(amount), currency: "USD", locale: "en-US" });
	if (!items.length)
		return (
			<p>
				Your cart is empty.{" "}
				<a href="/products" className="underline">
					Explore the collection
				</a>
			</p>
		);
	return (
		<div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
			<div className="divide-y border-y">
				{items.map((item) => (
					<CartItem key={item.productVariant.id} item={item} />
				))}
			</div>
			<div className="space-y-5">
				<div className="flex justify-between">
					<span>Subtotal</span>
					<span>{money(subtotal)}</span>
				</div>
				<div className="space-y-2 border-y py-4">
					<p className="text-sm">US shipping for {itemCount} items</p>
					<p className="text-sm">
						Standard: {money(rates.standard_first_minor + (itemCount - 1) * rates.standard_additional_minor)}
					</p>
					<p className="text-sm">
						Express: {money(rates.express_first_minor + (itemCount - 1) * rates.express_additional_minor)}
					</p>
				</div>
				<p className="text-xs text-muted-foreground">
					Applicable taxes and the final total are shown before payment.
				</p>
				<a
					href="/checkout"
					aria-disabled={isMutating}
					onClick={(event) => {
						if (isMutating) event.preventDefault();
					}}
					className="flex h-12 items-center justify-center rounded-[3px] border border-black bg-black font-semibold text-white transition-colors hover:bg-[#242424]"
				>
					{isMutating ? "Updating…" : "Checkout"}
				</a>
			</div>
		</div>
	);
}
