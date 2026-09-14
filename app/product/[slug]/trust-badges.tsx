import type { ShippingRates } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

export function TrustBadges({
	rates,
	policies,
}: {
	rates: ShippingRates;
	policies: { label: string; href: string }[];
}) {
	const shipping = policies.find((page) => /shipping/i.test(page.href));
	const returns = policies.find((page) => /return|refund/i.test(page.href));
	const money = (amount: number) => formatMoney({ amount: String(amount), currency: "USD", locale: "en-US" });
	return (
		<div className="divide-y text-sm">
			<section className="space-y-2 py-5">
				<h2 className="text-xs font-semibold uppercase tracking-widest">US shipping</h2>
				<p>
					Standard: {money(rates.standard_first_minor)} for the first item, then{" "}
					{money(rates.standard_additional_minor)} each.
				</p>
				<p>
					Express: {money(rates.express_first_minor)} for the first item, then{" "}
					{money(rates.express_additional_minor)} each.
				</p>
				{shipping && (
					<a href={`/legal${shipping.href}`} className="inline-block underline underline-offset-4">
						Shipping policy
					</a>
				)}
			</section>
			<section className="space-y-2 py-5">
				<h2 className="text-xs font-semibold uppercase tracking-widest">Returns & refunds</h2>
				{returns ? (
					<>
						<p>Review eligibility, return instructions and refund details.</p>
						<a href={`/legal${returns.href}`} className="inline-block underline underline-offset-4">
							Returns policy
						</a>
					</>
				) : (
					<p className="text-muted-foreground">Return information is not available yet.</p>
				)}
			</section>
		</div>
	);
}
