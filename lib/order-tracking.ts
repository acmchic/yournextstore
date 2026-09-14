import "server-only";

export type TrackedOrder = {
	order_number: string;
	email: string;
	currency: string;
	subtotal_minor: number;
	shipping_minor: number;
	tax_minor: number;
	discount_minor: number;
	total_minor: number;
	payment_status: string;
	fulfillment_status: "pending" | "processing" | "shipped" | "delivered" | string;
	created_at: string;
	item_count: number;
};

export async function trackOrder(lookup: string): Promise<TrackedOrder | null> {
	const response = await fetch(
		`${process.env.STORE_API_URL || "http://localhost:8000"}/v1/orders/lookup?lookup=${encodeURIComponent(lookup)}`,
		{
			cache: "no-store",
			headers: { Accept: "application/json" },
		},
	);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error("Order tracking is temporarily unavailable");
	return response.json() as Promise<TrackedOrder>;
}
