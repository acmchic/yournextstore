import "server-only";

import type { DeliverySettings } from "@/lib/delivery-estimate";

export type ShippingRates = {
	standard_first_minor: number;
	standard_additional_minor: number;
	express_first_minor: number;
	express_additional_minor: number;
};
export type ShippingQuote = {
	rates: ShippingRates;
	options: { id: string; name: string; amount_minor: number }[];
	delivery: DeliverySettings;
};
export type CheckoutCart = {
	id: string;
	subtotal_minor: number;
	shipping_options: ShippingQuote["options"];
	selected_shipping: "standard" | "express";
	locked: boolean;
	items: {
		variant_id: string;
		product_title: string;
		catalog_name: string;
		catalog: string;
		color_name: string;
		color: string;
		product_slug: string;
		size: string;
		quantity: number;
		price_minor: number;
		image?: string;
		image_url?: string;
	}[];
};
export async function checkoutFetch<T>(path: string, method = "GET"): Promise<T> {
	const response = await fetch(`${process.env.STORE_API_URL || "http://localhost:8000"}${path}`, {
		method,
		cache: "no-store",
		headers: { Accept: "application/json" },
	});
	if (!response.ok) throw new Error("Checkout is unavailable. Please try again.");
	return response.json() as Promise<T>;
}
export const getShippingQuote = (quantity = 1) =>
	checkoutFetch<ShippingQuote>(`/v1/shipping?quantity=${quantity}`);
