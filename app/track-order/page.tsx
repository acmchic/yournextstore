import { Check, PackageCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { formatMoney } from "@/lib/money";
import { type TrackedOrder, trackOrder } from "@/lib/order-tracking";

export const metadata: Metadata = {
	title: "Track your order",
	description: "Check the latest production and delivery status of your TeeBravo order.",
	robots: { index: false, follow: false },
};

const steps = [
	{
		key: "pending",
		label: "Order confirmed",
		description: "Your payment has been confirmed and your order is in our queue.",
		icon: Check,
	},
	{
		key: "processing",
		label: "In production",
		description: "Your piece is being prepared and printed to order.",
		icon: PackageCheck,
	},
	{
		key: "shipped",
		label: "Shipped",
		description: "Your order is on its way. Carrier updates will appear as available.",
		icon: Truck,
	},
	{
		key: "delivered",
		label: "Delivered",
		description: "Your TeeBravo order has arrived.",
		icon: Check,
	},
] as const;

function stepIndex(status: TrackedOrder["fulfillment_status"]): number {
	return Math.max(
		0,
		steps.findIndex((step) => step.key === status),
	);
}

function formatOrderDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function maskedEmail(email: string): string {
	const [name, domain] = email.split("@");
	if (!name || !domain) return email;
	return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function TrackingTimeline({ order }: { order: TrackedOrder }) {
	const currentStep = stepIndex(order.fulfillment_status);
	return (
		<div className="mt-10 border-y border-border">
			{steps.map((step, index) => {
				const complete = index <= currentStep;
				const Icon = step.icon;
				return (
					<div className="grid grid-cols-[2.75rem_1fr] gap-4 py-6 sm:grid-cols-[3.25rem_1fr]" key={step.key}>
						<div className="relative flex justify-center">
							<div
								className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border ${
									complete
										? "border-foreground bg-foreground text-background"
										: "border-border text-muted-foreground"
								}`}
							>
								<Icon className="h-4 w-4" />
							</div>
							{index < steps.length - 1 && (
								<span
									className={`absolute top-10 h-full w-px ${index < currentStep ? "bg-foreground" : "bg-border"}`}
								/>
							)}
						</div>
						<div className="pt-1">
							<p
								className={`text-sm font-medium uppercase tracking-[0.12em] ${complete ? "text-foreground" : "text-muted-foreground"}`}
							>
								{step.label}
							</p>
							<p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{step.description}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function TrackingResult({ order }: { order: TrackedOrder }) {
	return (
		<section className="mt-12" aria-labelledby="tracking-result-title">
			<div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order located</p>
					<h2 id="tracking-result-title" className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
						{order.order_number}
					</h2>
				</div>
				<div className="text-left text-sm text-muted-foreground sm:text-right">
					<p>Placed {formatOrderDate(order.created_at)}</p>
					<p className="mt-1">{maskedEmail(order.email)}</p>
				</div>
			</div>
			<TrackingTimeline order={order} />
			<div className="mt-8 grid gap-4 sm:grid-cols-3">
				<div className="border border-border p-5">
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Items</p>
					<p className="mt-2 text-lg">{order.item_count}</p>
				</div>
				<div className="border border-border p-5">
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Payment</p>
					<p className="mt-2 text-lg capitalize">{order.payment_status}</p>
				</div>
				<div className="border border-border p-5">
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Order total</p>
					<p className="mt-2 text-lg">
						{formatMoney({ amount: String(order.total_minor), currency: order.currency, locale: "en-US" })}
					</p>
				</div>
			</div>
		</section>
	);
}

export default async function TrackOrderPage({
	searchParams,
}: {
	searchParams: Promise<{ lookup?: string }>;
}) {
	const lookup = (await searchParams).lookup?.trim() || "";
	let order: TrackedOrder | null = null;
	let unavailable = false;
	if (lookup) {
		try {
			order = await trackOrder(lookup);
		} catch {
			unavailable = true;
		}
	}

	return (
		<main className="mx-auto max-w-4xl px-6 py-16 sm:py-24 lg:px-10">
			<div className="max-w-2xl">
				<p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">TeeBravo / Order care</p>
				<h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
					Track your order.
				</h1>
				<p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
					Enter your order number or the email address used at checkout to see the latest update.
				</p>
			</div>

			<form action="/track-order" method="get" className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-end">
				<div className="flex-1">
					<label htmlFor="lookup" className="text-xs font-medium uppercase tracking-[0.16em]">
						Order number or email
					</label>
					<input
						id="lookup"
						name="lookup"
						defaultValue={lookup}
						autoComplete="email"
						placeholder="TB-260914-ABC123 or you@example.com"
						className="mt-3 h-12 w-full border border-border bg-background px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
						required
						minLength={3}
					/>
				</div>
				<button
					type="submit"
					className="h-12 bg-foreground px-7 text-xs font-medium uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-80"
				>
					Find order
				</button>
			</form>

			{lookup && !unavailable && !order && (
				<p className="mt-5 text-sm text-muted-foreground" role="alert">
					We couldn&apos;t find an order with those details. Check the order number or checkout email and try
					again.
				</p>
			)}
			{unavailable && (
				<p className="mt-5 text-sm text-muted-foreground" role="alert">
					Order tracking is temporarily unavailable. Please try again in a moment.
				</p>
			)}
			{order && <TrackingResult order={order} />}

			<div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
				<p>Need help? Contact us with your order number and we&apos;ll take a look.</p>
				<a href="/contact" className="mt-2 inline-block text-foreground underline underline-offset-4">
					Contact TeeBravo
				</a>
			</div>
		</main>
	);
}
