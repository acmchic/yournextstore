"use client";

import { useState } from "react";
import { beginCheckout } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";
import type { ShippingQuote } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const money = (amount: number) => formatMoney({ amount: String(amount), currency: "USD", locale: "en-US" });

export function ShippingSelector({
	options,
	subtotal,
	initialMethod,
	locked,
}: {
	options: ShippingQuote["options"];
	subtotal: number;
	initialMethod: "standard" | "express";
	locked: boolean;
}) {
	const [selected, setSelected] = useState(initialMethod);
	const selectedOption = options.find((option) => option.id === selected) ?? options[0];

	return (
		<form action={beginCheckout} className="space-y-6">
			<input type="hidden" name="shipping_method" value={selected} />
			<fieldset className="space-y-3 border-y py-5" disabled={locked}>
				<legend className="sr-only">Shipping method</legend>
				<div className="flex items-end justify-between gap-4">
					<h2 className="font-medium">Shipping method</h2>
					<span className="text-xs text-muted-foreground">United States</span>
				</div>
				<div className="grid gap-2">
					{options.map((option) => (
						<label
							key={option.id}
							className={cn(
								"flex cursor-pointer items-center justify-between rounded-[3px] border px-4 py-3 transition-colors",
								selected === option.id
									? "border-black bg-[#f1f3f5]"
									: "border-[#d5d9dd] bg-white hover:bg-[#f6f7f8]",
								locked && "cursor-not-allowed opacity-60",
							)}
						>
							<span className="flex items-center gap-3">
								<input
									type="radio"
									name="shipping_method_choice"
									value={option.id}
									checked={selected === option.id}
									onChange={() => setSelected(option.id as "standard" | "express")}
									className="accent-black"
								/>
								<span>{option.name}</span>
							</span>
							<span>{money(option.amount_minor)}</span>
						</label>
					))}
				</div>
				{locked && <p className="text-xs text-muted-foreground">Edit the cart to change an open checkout.</p>}
			</fieldset>

			<div className="flex items-center justify-between font-medium">
				<span>Estimated total</span>
				<span>{money(subtotal + (selectedOption?.amount_minor ?? 0))}</span>
			</div>
			<div className="space-y-3 text-sm text-muted-foreground">
				<p>Applicable tax and the final total are shown before payment.</p>
				<p>Pay by card, or use Apple Pay or Google Pay when available on your device.</p>
			</div>
			<Button className="h-12 w-full rounded-[3px] border border-black bg-black font-semibold text-white shadow-none hover:bg-[#242424] hover:text-white">
				Continue to secure payment
			</Button>
		</form>
	);
}
