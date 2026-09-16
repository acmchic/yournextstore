"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";

export function CartButton() {
	const { itemCount, openCart } = useCart();

	return (
		<button
			type="button"
			onClick={openCart}
			className="relative inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-primary"
			aria-label="Shopping cart"
		>
			<ShoppingBag className="w-5 h-5" />
			{itemCount > 0 ? (
				<span
					aria-live="polite"
					className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
				>
					{itemCount}
				</span>
			) : null}
		</button>
	);
}
