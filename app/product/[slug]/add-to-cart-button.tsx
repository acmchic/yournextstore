"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/cart/actions";
import { useCart } from "@/app/cart/cart-context";
import { PrintPlacementSelector } from "@/app/product/[slug]/print-placement-selector";
import { VariantSelector } from "@/app/product/[slug]/variant-selector";
import { useVolumePricing, VolumePricingDisplay, type VolumeTier } from "@/app/product/[slug]/volume-pricing";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

type Variant = {
	id: string;
	price: string;
	originalPrice: string;
	sku: string | null;
	images: string[];
	stock: number | null;
	/** EU Omnibus: lowest price in the last 30 days (null unless the store enables omnibus). */
	omnibusPrice: string | null;
	combinations: {
		variantValue: {
			id: string;
			value: string;
			colorValue: string | null;
			variantType: {
				id: string;
				type: "string" | "color";
				label: string;
			};
		};
	}[];
};

type AddToCartButtonProps = {
	variants: Variant[];
	product: {
		id: string;
		name: string;
		slug: string;
		images: string[];
	};
	volumePricingTiers?: VolumeTier[];
};

const LOW_STOCK_THRESHOLD = 5;

export function AddToCartButton({ variants, product, volumePricingTiers = [] }: AddToCartButtonProps) {
	const searchParams = useSearchParams();
	const [quantity, setQuantity] = useState(1);
	const { items, openCart, dispatch, startMutation } = useCart();
	const optionValuesByLabel = useMemo(() => {
		return variants
			.flatMap((variant) => variant.combinations)
			.reduce((valuesByLabel, combination) => {
				const label = combination.variantValue.variantType.label;
				const values = valuesByLabel.get(label) ?? new Set<string>();
				values.add(combination.variantValue.value);
				valuesByLabel.set(label, values);
				return valuesByLabel;
			}, new Map<string, Set<string>>());
	}, [variants]);

	const selectedVariant = useMemo(() => {
		if (variants.length === 1) {
			return variants[0];
		}

		if (searchParams.size === 0) {
			return undefined;
		}

		const paramsOptions: Record<string, string> = {};
		searchParams.forEach((valueName, key) => {
			paramsOptions[key] = valueName;
		});

		return variants.find((variant) =>
			variant.combinations.every((combination) => {
				const label = combination.variantValue.variantType.label;
				const selectedValue = paramsOptions[label];
				const optionValues = optionValuesByLabel.get(label);
				if (optionValues?.size === 1) {
					return !selectedValue || selectedValue === combination.variantValue.value;
				}
				return selectedValue === combination.variantValue.value;
			}),
		);
	}, [variants, searchParams, optionValuesByLabel]);

	// stock === null means stock isn't tracked for this variant (unlimited)
	const isOutOfStock = selectedVariant?.stock === 0;
	const maxQuantity = selectedVariant?.stock ?? 99;
	const effectiveQuantity = isOutOfStock ? 1 : Math.min(quantity, maxQuantity);

	const { resolvedTiers, volumePrice } = useVolumePricing(
		volumePricingTiers,
		selectedVariant?.id,
		effectiveQuantity,
	);

	const unitPrice = volumePrice ?? selectedVariant?.price;
	const totalPrice = unitPrice ? BigInt(unitPrice) * BigInt(effectiveQuantity) : null;

	const buttonText = useMemo(() => {
		if (!selectedVariant) return "Add to Cart";
		if (isOutOfStock) return "Out of stock";
		if (totalPrice) {
			return `Add to Cart - ${formatMoney({ amount: totalPrice, currency: CURRENCY, locale: LOCALE })}`;
		}
		return "Add to Cart";
	}, [selectedVariant, isOutOfStock, totalPrice]);

	// Headline price. For the selected variant we show its own price (and the struck-through
	// list price when it's on sale). Before a variant is picked we fall back to a range.
	const priceInfo = useMemo(() => {
		const fmt = (amount: bigint) => formatMoney({ amount, currency: CURRENCY, locale: LOCALE });

		if (selectedVariant) {
			const price = BigInt(selectedVariant.price);
			const listPrice = BigInt(selectedVariant.originalPrice);
			const onSale = listPrice > price;
			return {
				display: fmt(price),
				compareAt: onSale ? fmt(listPrice) : null,
				discountPercent: onSale ? Math.round((Number(listPrice - price) / Number(listPrice)) * 100) : null,
			};
		}

		const prices = variants.map((v) => BigInt(v.price));
		const minPrice = prices.reduce((min, p) => (p < min ? p : min), prices[0] ?? 0n);
		const maxPrice = prices.reduce((max, p) => (p > max ? p : max), prices[0] ?? 0n);
		return {
			display: minPrice === maxPrice ? fmt(minPrice) : `${fmt(minPrice)} - ${fmt(maxPrice)}`,
			compareAt: null,
			discountPercent: null,
		};
	}, [selectedVariant, variants]);

	// EU Omnibus: when the variant is discounted, show the lowest price recorded in the last 30 days.
	const omnibusPrice = useMemo(() => {
		if (!selectedVariant || !priceInfo.compareAt) return null;
		const lowest = selectedVariant.omnibusPrice;
		if (!lowest) return null;
		return formatMoney({ amount: BigInt(lowest), currency: CURRENCY, locale: LOCALE });
	}, [selectedVariant, priceInfo.compareAt]);

	// Stock availability. null stock means it isn't tracked (treated as in stock).
	const stockStatus = useMemo(() => {
		if (!selectedVariant) return null;
		const { stock } = selectedVariant;
		if (stock === 0) return { label: "Out of stock", tone: "out" as const };
		if (stock !== null && stock <= LOW_STOCK_THRESHOLD) {
			return { label: `Only ${stock} left in stock`, tone: "low" as const };
		}
		return { label: "In stock", tone: "in" as const };
	}, [selectedVariant]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedVariant) {
			const hasSelectedOption = (label: string) =>
				variants.some((variant) =>
					variant.combinations.some(
						(combination) =>
							combination.variantValue.variantType.label === label &&
							combination.variantValue.value === searchParams.get(label),
					),
				);
			if (optionValuesByLabel.get("Size")?.size !== 1 && !hasSelectedOption("Size")) {
				toast.error("Please select a size before adding this item.");
			} else if (optionValuesByLabel.get("Color")?.size !== 1 && !hasSelectedOption("Color")) {
				toast.error("Please select a color before adding this item.");
			} else {
				toast.error("Please select all product options before adding this item.");
			}
			return;
		}
		if (isOutOfStock) return;

		const variantId = selectedVariant.id;
		const addedQuantity = effectiveQuantity;
		const previousQuantity = items.find((item) => item.productVariant.id === variantId)?.quantity ?? 0;

		openCart();
		setQuantity(1);

		startMutation(async () => {
			dispatch({
				type: "ADD_ITEM",
				item: {
					quantity: addedQuantity,
					productVariant: {
						id: variantId,
						price: selectedVariant.price,
						images: selectedVariant.images,
						product,
					},
				},
			});

			// The server clamps line quantities to available stock and still responds
			// with the updated cart — compare against what we asked for so the
			// optimistic item doesn't silently vanish on revert.
			const result = await addToCart(variantId, addedQuantity);
			const line = result.cart?.lineItems.find(
				(item: { productVariant: { id: string } }) => item.productVariant.id === variantId,
			);
			if (!result.success || !line) {
				toast.error(
					"Could not add this item. Check availability, or return to checkout and choose Edit cart.",
				);
			} else if (line.quantity < previousQuantity + addedQuantity) {
				toast.warning(`Only ${line.quantity} in stock - quantity adjusted`);
			}
		});
	};

	return (
		<div className="space-y-8 sm:space-y-7">
			{/* Price & sale */}
			<div className="space-y-2 border-b border-border/60 pb-6">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="text-lg font-medium tracking-tight">{priceInfo.display}</span>
					{priceInfo.compareAt && (
						<span className="text-lg text-muted-foreground line-through">{priceInfo.compareAt}</span>
					)}
					{priceInfo.discountPercent ? (
						<span className="bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
							Save {priceInfo.discountPercent}%
						</span>
					) : null}
				</div>

				{omnibusPrice && (
					<p className="text-xs text-muted-foreground">Lowest price in the last 30 days: {omnibusPrice}</p>
				)}
			</div>

			{variants.length > 1 && <VariantSelector variants={variants} selectedVariantId={selectedVariant?.id} />}

			<PrintPlacementSelector />

			<VolumePricingDisplay tiers={resolvedTiers} quantity={effectiveQuantity} volumePrice={volumePrice} />

			<form className="mt-6 block sm:mt-4" onSubmit={handleSubmit}>
				<button
					type="submit"
					disabled={isOutOfStock}
					className="h-12 w-full cursor-pointer rounded bg-foreground px-8 py-3 text-sm font-medium uppercase tracking-[0.06em] text-background transition-[box-shadow,opacity,transform] duration-150 ease-out hover:shadow-[0_0_0_2px_#aaaaac] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
				>
					{buttonText}
				</button>
			</form>
		</div>
	);
}
