type ListingColorVariant = {
	stock: number | null;
	combinations?: Array<{
		variantValue: {
			value: string;
			variantType: { label: string };
		};
	}>;
};

export function getListingColorName(variant: ListingColorVariant) {
	return (
		variant.combinations?.find((combination) => combination.variantValue.variantType.label === "Color")
			?.variantValue.value ?? null
	);
}

/** Matches the storefront listing color rotation used by the shop API. */
export function selectListingColor<T extends ListingColorVariant>(variants: readonly T[], position: number) {
	const seenColors = new Set<string>();
	const colors = variants.filter((variant) => {
		const colorName = getListingColorName(variant);
		if (variant.stock === 0 || !colorName || seenColors.has(colorName)) {
			return false;
		}
		seenColors.add(colorName);
		return true;
	});
	const nonWhiteColors = colors.filter(
		(variant) => getListingColorName(variant)?.trim().toLowerCase() !== "white",
	);
	const listingColors = nonWhiteColors.length > 0 ? nonWhiteColors : colors;

	return listingColors.length > 0 ? listingColors[position % listingColors.length] : null;
}
