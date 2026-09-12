"use server";

import { redirect } from "next/navigation";
import { checkoutFetch } from "@/lib/checkout";
import { getCartCookieJson } from "@/lib/cookies";

export async function beginCheckout(formData: FormData) {
	const cart = await getCartCookieJson();
	if (!cart) redirect("/cart");
	const requestedShipping = formData.get("shipping_method");
	const shippingMethod = requestedShipping === "express" ? "express" : "standard";
	let url: string;
	try {
		const session = await checkoutFetch<{ url: string }>(
			`/v1/carts/${encodeURIComponent(cart.id)}/checkout?shipping_method=${shippingMethod}`,
			"POST",
		);
		const destination = new URL(session.url);
		if (destination.protocol !== "https:" || destination.hostname !== "checkout.stripe.com")
			throw new Error("Invalid checkout URL");
		url = session.url;
	} catch {
		redirect("/checkout?error=unavailable");
	}
	redirect(url);
}

export async function editCheckoutCart() {
	const cart = await getCartCookieJson();
	if (cart) {
		try {
			await checkoutFetch(`/v1/carts/${encodeURIComponent(cart.id)}/checkout/cancel`, "POST");
		} catch {
			redirect("/checkout?error=cancel");
		}
	}
	redirect("/cart");
}
