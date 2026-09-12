import { BadgeCheck, LockKeyhole, PackageCheck, ReceiptText, RotateCcw, Truck } from "lucide-react";
import Link from "next/link";
import type { VolumeTier } from "@/app/product/[slug]/volume-pricing";
import type { ShippingQuote } from "@/lib/checkout";
import { deliveryEstimate } from "@/lib/delivery-estimate";
import { formatMoney } from "@/lib/money";

type PolicyLink = { label: string; href: string };

function money(amount: number | string) {
	return formatMoney({ amount: BigInt(amount), currency: "USD", locale: "en-US" });
}

function tierQuantity(tier: VolumeTier) {
	return tier.maxQuantity ? `${tier.minQuantity}–${tier.maxQuantity} items` : `${tier.minQuantity}+ items`;
}

export function ProductAssurance({
	shipping,
	policies,
	volumePricingTiers,
	inStock,
}: {
	shipping: ShippingQuote;
	policies: PolicyLink[];
	volumePricingTiers: VolumeTier[];
	inStock: boolean;
}) {
	const estimate = deliveryEstimate(shipping.delivery);
	if (!estimate) return null;

	const returnPolicy = policies.find((policy) => /return|refund/i.test(policy.href + policy.label));
	const productTiers = volumePricingTiers.filter((tier) => !tier.productVariantId);

	return (
		<section className="mt-16 border-y border-border">
			{productTiers.length > 0 && (
				<div className="border-b border-border p-5 sm:p-8">
					<div className="mb-5 flex items-center gap-3">
						<BadgeCheck className="size-5" aria-hidden />
						<h2 className="text-sm font-semibold uppercase tracking-[0.08em]">Buy more, lower unit price</h2>
					</div>
					<div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
						{productTiers.map((tier) => (
							<div key={tier.id} className="bg-background p-4">
								<p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
									{tierQuantity(tier)}
								</p>
								<p className="mt-2 text-lg font-semibold">{money(tier.price)}</p>
								<p className="text-xs text-muted-foreground">per item</p>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
				<div className="flex items-center gap-3 p-5 text-xs font-medium sm:p-6">
					<LockKeyhole className="size-4" aria-hidden /> Secure Stripe checkout
				</div>
				<div className="flex items-center gap-3 p-5 text-xs font-medium sm:p-6">
					<PackageCheck className="size-4" aria-hidden />{" "}
					{inStock ? "Available · produced to order" : "Currently unavailable"}
				</div>
				<div className="flex items-center gap-3 p-5 text-xs font-medium sm:p-6">
					{returnPolicy ? (
						<>
							<RotateCcw className="size-4" aria-hidden />
							<Link href={returnPolicy.href} className="underline underline-offset-4">
								Returns & refunds
							</Link>
						</>
					) : (
						<>
							<ReceiptText className="size-4" aria-hidden />
							<span>Full costs shown before payment</span>
						</>
					)}
				</div>
			</div>
		</section>
	);
}

export function ProductDeliveryEstimate({ shipping }: { shipping: ShippingQuote }) {
	const estimate = deliveryEstimate(shipping.delivery);
	if (!estimate) return null;

	return (
		<section className="mt-5 border-y border-border py-5" aria-labelledby="delivery-heading">
			<div className="mb-6 flex items-center gap-3">
				<Truck className="size-4" aria-hidden />
				<h2 id="delivery-heading" className="text-xs font-semibold uppercase tracking-[0.08em]">
					Estimated delivery
				</h2>
			</div>
			<div className="relative grid grid-cols-3 gap-2 before:absolute before:left-[5%] before:right-[5%] before:top-2 before:h-px before:bg-border">
				{[
					["Order placed", estimate.placed],
					["Ships", estimate.ships],
					["Standard delivery", estimate.standard],
				].map(([label, date]) => (
					<div key={label} className="relative min-w-0">
						<span className="mb-3 block size-4 border border-foreground bg-background p-[3px]">
							<span className="block size-full bg-foreground" />
						</span>
						<p className="text-[11px] font-semibold sm:text-xs">{date}</p>
						<p className="mt-1 text-[9px] uppercase leading-tight tracking-[0.04em] text-muted-foreground">
							{label}
						</p>
					</div>
				))}
			</div>
			<p className="mt-5 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
				Express: <strong className="font-medium text-foreground">{estimate.express}</strong>. Business days
				exclude weekends.
			</p>
		</section>
	);
}
