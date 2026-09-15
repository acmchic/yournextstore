"use server";

import { revalidatePath } from "next/cache";
import { try_ as safe } from "safe-try";
import { checkoutFetch } from "@/lib/checkout";
import { commerce } from "@/lib/commerce";
import { getCartCookieJson, setCartCookie } from "@/lib/cookies";

type CartUpsertInput = Parameters<typeof commerce.cartUpsert>[0];

async function upsertCartWithCheckoutRecovery(input: CartUpsertInput) {
	try {
		return await commerce.cartUpsert(input);
	} catch (initialError) {
		if (!input.cartId) throw initialError;
		try {
			await checkoutFetch(`/v1/carts/${encodeURIComponent(input.cartId)}/checkout/cancel`, "POST");
		} catch {
			throw initialError;
		}
		return commerce.cartUpsert(input);
	}
}

export async function getCart() {
	const cartCookie = await getCartCookieJson();

	if (!cartCookie?.id) {
		return null;
	}

	try {
		return await commerce.cartGet({ cartId: cartCookie.id });
	} catch {
		return null;
	}
}

export async function addToCart(variantId: string, quantity = 1) {
	const cartCookie = await getCartCookieJson();
	const [, existing] = cartCookie ? await safe(commerce.cartGet({ cartId: cartCookie.id })) : [null, null];
	const [error, cart] = await safe(
		upsertCartWithCheckoutRecovery({
			cartId: existing?.id,
			variantId,
			quantity,
		}),
	);

	if (error || !cart) {
		return { success: false, cart: null };
	}

	if (cart.id !== cartCookie?.id) {
		await setCartCookie({ id: cart.id });
	}
	revalidatePath("/", "layout");

	return { success: true, cart };
}

export async function removeFromCart(variantId: string) {
	const cartCookie = await getCartCookieJson();

	if (!cartCookie?.id) {
		return { success: false, cart: null };
	}

	try {
		// Quantity 0 removes the item; the response is the updated cart
		const cart = await upsertCartWithCheckoutRecovery({
			cartId: cartCookie.id,
			variantId,
			quantity: 0,
		});
		return { success: true, cart };
	} catch {
		return { success: false, cart: null };
	}
}

// Set absolute quantity for a cart item
export async function setCartQuantity(variantId: string, quantity: number) {
	const cartCookie = await getCartCookieJson();

	if (!cartCookie?.id) {
		return { success: false, cart: null };
	}

	try {
		// mode "set" replaces the line quantity atomically; 0 removes the item
		const cart = await upsertCartWithCheckoutRecovery({
			cartId: cartCookie.id,
			variantId,
			quantity: Math.max(quantity, 0),
			mode: "set",
		});
		return { success: true, cart };
	} catch {
		return { success: false, cart: null };
	}
}
