import { Head, useForm } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rates = {
	standard_first_minor: number;
	standard_additional_minor: number;
	express_first_minor: number;
	express_additional_minor: number;
	pdp_assurance_enabled: boolean;
	processing_min_business_days: number | null;
	processing_max_business_days: number | null;
	standard_transit_min_business_days: number | null;
	standard_transit_max_business_days: number | null;
	express_transit_min_business_days: number | null;
	express_transit_max_business_days: number | null;
};
const labels: Record<string, string> = {
	business_name: "Business / legal name",
	business_address: "Business address",
	support_email: "Support email",
	about_story: "About TeeBravo",
	restrictions: "US destinations and delivery restrictions",
	returns_eligibility: "Return eligibility: defective items, change of mind, incorrect size",
	returns_window: "Return request window",
	returns_method: "Return instructions and address",
	returns_fees: "Return shipping and other fees",
	refund_timing: "Refund processing and timing",
};
export default function CheckoutSettings({
	settings,
	details,
	fields,
}: {
	settings: Rates;
	details: Record<string, string>;
	fields: string[];
}) {
	const form = useForm({
		standard_first_minor: settings.standard_first_minor,
		standard_additional_minor: settings.standard_additional_minor,
		express_first_minor: settings.express_first_minor,
		express_additional_minor: settings.express_additional_minor,
		pdp_assurance_enabled: Boolean(settings.pdp_assurance_enabled),
		processing_min_business_days: settings.processing_min_business_days,
		processing_max_business_days: settings.processing_max_business_days,
		standard_transit_min_business_days: settings.standard_transit_min_business_days,
		standard_transit_max_business_days: settings.standard_transit_max_business_days,
		express_transit_min_business_days: settings.express_transit_min_business_days,
		express_transit_max_business_days: settings.express_transit_max_business_days,
		details: Object.fromEntries(fields.map((key) => [key, details[key] || ""])),
	});
	return (
		<div className="mx-auto max-w-4xl space-y-8 p-6">
			<Head title="Shipping & business" />
			<h1 className="text-2xl font-semibold">Shipping & business</h1>
			<p className="text-muted-foreground">
				USD shipping charges apply to total item quantity, across all products in an order. Policies remain
				drafts until you complete and publish them.
			</p>
			<form
				className="space-y-8"
				onSubmit={(event) => {
					event.preventDefault();
					form.put("/checkout-settings");
				}}
			>
				<section className="grid gap-5 border-y py-6 sm:grid-cols-2">
					{(
						[
							"standard_first_minor",
							"standard_additional_minor",
							"express_first_minor",
							"express_additional_minor",
						] as const
					).map((key) => (
						<label key={key} className="space-y-2">
							<span className="block capitalize">
								{key.replaceAll("_", " ").replace("minor", "(USD cents)")}
							</span>
							<Input
								type="number"
								min="0"
								max="100000"
								step="1"
								required
								value={form.data[key]}
								onChange={(event) => form.setData(key, Number(event.target.value))}
							/>
						</label>
					))}
				</section>
				<p className="text-sm">
					500 cents = $5.00. First item + additional item price × (quantity − 1). Existing checkout sessions
					and paid orders retain their quoted rates.
				</p>
				<section className="space-y-5 border-y py-6">
					<div className="flex items-start gap-3">
						<input
							id="pdp-assurance-enabled"
							type="checkbox"
							className="mt-1 size-4"
							checked={form.data.pdp_assurance_enabled}
							onChange={(event) => form.setData("pdp_assurance_enabled", event.target.checked)}
						/>
						<label htmlFor="pdp-assurance-enabled">
							<span className="block font-medium">Show delivery & purchase information on product pages</span>
							<span className="text-muted-foreground text-sm">
								Dates are calculated in US business days. Leave this off until all ranges match the published
								shipping policy.
							</span>
						</label>
					</div>
					<div className="grid gap-5 sm:grid-cols-2">
						{(
							[
								["processing_min_business_days", "Processing minimum"],
								["processing_max_business_days", "Processing maximum"],
								["standard_transit_min_business_days", "Standard transit minimum"],
								["standard_transit_max_business_days", "Standard transit maximum"],
								["express_transit_min_business_days", "Express transit minimum"],
								["express_transit_max_business_days", "Express transit maximum"],
							] as const
						).map(([key, label]) => (
							<label key={key} className="space-y-2">
								<span className="block">{label} (business days)</span>
								<Input
									type="number"
									min="0"
									max="60"
									step="1"
									value={form.data[key] ?? ""}
									onChange={(event) =>
										form.setData(key, event.target.value === "" ? null : Number(event.target.value))
									}
								/>
							</label>
						))}
					</div>
				</section>
				<section className="space-y-5">
					<h2 className="text-xl font-medium">Policy information</h2>
					{fields.map((key) => (
						<label key={key} className="block space-y-2">
							<span>{labels[key] || key}</span>
							<textarea
								className="block min-h-20 w-full rounded-md border p-3"
								maxLength={5000}
								value={form.data.details[key]}
								onChange={(event) =>
									form.setData("details", {
										...form.data.details,
										[key]: event.target.value,
									})
								}
							/>
							<span className="text-muted-foreground text-xs">Dynamic field: {`{{${key}}}`}</span>
						</label>
					))}
				</section>
				{Object.entries(form.errors).map(([key, error]) => (
					<p key={key} role="alert" className="text-destructive">
						{error}
					</p>
				))}
				<Button disabled={form.processing}>Save settings</Button>
				<a className="ml-5 underline" href="/legal">
					Review policy drafts
				</a>
			</form>
		</div>
	);
}
