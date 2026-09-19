import { LockKeyhole, PackageCheck, ReceiptText, RotateCcw, Truck } from "lucide-react";
import Link from "next/link";
import type { ShippingQuote } from "@/lib/checkout";
import { deliveryEstimate } from "@/lib/delivery-estimate";

type PolicyLink = { label: string; href: string };

export function ProductCheckoutTrust({ policies, inStock }: { policies: PolicyLink[]; inStock: boolean }) {
	const returnPolicy = policies.find((policy) => /return|refund/i.test(policy.href + policy.label));

	return (
		<div
			className="mt-3 grid gap-2 border-y border-border/70 py-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3 sm:gap-3"
			role="group"
			aria-label="Checkout reassurance"
		>
			<div className="flex items-center gap-2">
				<LockKeyhole className="size-4" aria-hidden /> Secure Stripe checkout
			</div>
			<div className="flex items-center gap-2">
				<PackageCheck className="size-4" aria-hidden />{" "}
				{inStock ? "Available · produced to order" : "Currently unavailable"}
			</div>
			<div className="flex items-center gap-2">
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
	);
}

export function ProductDeliveryEstimate({ shipping }: { shipping: ShippingQuote }) {
	const estimate = deliveryEstimate(shipping.delivery);
	if (!estimate) return null;

	return (
		<section className="mt-5 py-5" aria-labelledby="delivery-heading">
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
			<p className="mt-5 pt-4 text-[11px] leading-relaxed text-muted-foreground">
				Express: <strong className="font-medium text-foreground">{estimate.express}</strong>. Business days
				exclude weekends.
			</p>
		</section>
	);
}
