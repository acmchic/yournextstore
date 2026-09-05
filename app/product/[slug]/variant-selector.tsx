"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

type VariantValue = {
	id: string;
	value: string;
	colorValue: string | null;
	variantType: {
		id: string;
		type: "string" | "color";
		label: string;
	};
};

type Combination = {
	variantValue: VariantValue;
};

type Variant = {
	id: string;
	combinations: Combination[];
};

type VariantOption = {
	id: string;
	value: string;
	colorValue: string | null;
};

type VariantGroup = {
	label: string;
	type: "string" | "color";
	options: VariantOption[];
};

type VariantSelectorProps = {
	variants: Variant[];
	selectedVariantId: string | undefined;
};

function processVariants(variants: Variant[]) {
	const allCombinations = variants.flatMap((variant) =>
		variant.combinations.map((combination) => ({
			variantValue: combination.variantValue,
		})),
	);

	// Track seen option IDs per label for O(1) deduplication
	const seenOptionIds = new Map<string, Set<string>>();

	const groupedByLabel = allCombinations.reduce(
		(acc, { variantValue }) => {
			const { label, type } = variantValue.variantType;

			if (!acc[label]) {
				acc[label] = {
					label,
					type,
					options: [],
				};
				seenOptionIds.set(label, new Set());
			}

			const seenIds = seenOptionIds.get(label);
			if (seenIds && !seenIds.has(variantValue.id)) {
				seenIds.add(variantValue.id);
				acc[label].options.push({
					id: variantValue.id,
					value: variantValue.value,
					colorValue: variantValue.colorValue,
				});
			}

			return acc;
		},
		{} as Record<string, VariantGroup>,
	);

	return Object.values(groupedByLabel);
}

export function VariantSelector({ variants, selectedVariantId }: VariantSelectorProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const variantGroups = processVariants(variants);

	// Build Maps for O(1) lookups
	const { groupByLabel, optionsByValue, optionsById } = useMemo(() => {
		const groupByLabel = new Map(variantGroups.map((g) => [g.label, g]));
		const optionsByValue = new Map(
			variantGroups.map((g) => [g.label, new Map(g.options.map((o) => [o.value, o]))]),
		);
		const optionsById = new Map(
			variantGroups.map((g) => [g.label, new Map(g.options.map((o) => [o.id, o]))]),
		);
		return { groupByLabel, optionsByValue, optionsById };
	}, [variantGroups]);

	const selectedOptions = useMemo(() => {
		const paramsOptions: Record<string, string> = {};
		searchParams.forEach((valueName, key) => {
			const option = optionsByValue.get(key)?.get(valueName);
			if (option) {
				paramsOptions[key] = option.id;
			}
		});
		return paramsOptions;
	}, [searchParams, optionsByValue]);

	const handleOptionSelect = (label: string, optionId: string) => {
		const newSelectedOptions = { ...selectedOptions, [label]: optionId };

		const params = new URLSearchParams(searchParams.toString());
		Object.entries(newSelectedOptions).forEach(([key, value]) => {
			const option = optionsById.get(key)?.get(value);
			if (option) {
				params.set(key, option.value);
			}
		});
		router.push(`${pathname}?${params.toString()}`, { scroll: false });
	};

	// Auto-redirect to first variant when no URL params exist (for multi-variant products)
	useEffect(() => {
		if (variants.length <= 1) return;

		const firstVariant = variants[0];
		const params = new URLSearchParams(searchParams.toString());
		let changed = false;
		firstVariant.combinations.forEach((c) => {
			const label = c.variantValue.variantType.label;
			if (!params.has(label)) {
				params.set(label, c.variantValue.value);
				changed = true;
			}
		});
		if (changed) router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	}, [variants, searchParams, pathname]);

	const groupsWithChoices = variantGroups.filter((group) => group.options.length > 1);

	if (groupsWithChoices.length === 0) {
		return null;
	}

	return (
		<div className="space-y-6">
			{groupsWithChoices.map((group) => {
				const selectedOptionId = selectedOptions[group.label];
				const selectedOption = selectedOptionId
					? optionsById.get(group.label)?.get(selectedOptionId)
					: undefined;

				return (
					<fieldset key={group.label} className="m-0 border-0 p-0">
						{group.type === "color" ? (
							<>
								<div className="mb-3 flex items-center justify-between">
									<legend className="text-xs uppercase tracking-[0.06em]">{group.label}</legend>
									{selectedOption && (
										<span className="text-xs text-muted-foreground">{selectedOption.value}</span>
									)}
								</div>
								<div className="flex flex-wrap gap-3.5">
									{group.options.map((option) => {
										const isSelected = selectedOptions[group.label] === option.id;
										const isLightColor =
											option.colorValue?.toUpperCase() === "#FFFFFF" ||
											option.colorValue?.toUpperCase() === "#FFFFF0" ||
											option.colorValue?.toUpperCase() === "#FFF";

										return (
											<button
												key={option.id}
												type="button"
												onClick={() => handleOptionSelect(group.label, option.id)}
												className={cn(
													"relative h-10 w-10 rounded-full transition-all duration-200",
													isSelected
														? "ring-1 ring-foreground ring-offset-2 ring-offset-background"
														: "hover:ring-1 hover:ring-muted-foreground hover:ring-offset-2 hover:ring-offset-background",
												)}
												style={{ backgroundColor: option.colorValue ?? "#fff" }}
												aria-label={option.value}
												title={option.value}
											>
												{isLightColor && (
													<span className="absolute inset-0 rounded-full border border-border" />
												)}
											</button>
										);
									})}
								</div>
							</>
						) : (
							<>
								<div className="mb-3 flex items-center justify-between">
									<legend className="text-xs uppercase tracking-[0.06em]">{group.label}</legend>
								</div>
								<div className="flex flex-wrap gap-2">
									{group.options.map((option) => {
										const isSelected = selectedOptions[group.label] === option.id;

										return (
											<button
												key={option.id}
												type="button"
												onClick={() => handleOptionSelect(group.label, option.id)}
												className={cn(
													"flex min-h-11 min-w-14 items-center justify-center border px-5 py-2.5 transition-colors duration-200",
													isSelected
														? "border-foreground bg-foreground text-background"
														: "border-border bg-background hover:border-muted-foreground",
												)}
											>
												<span className="text-sm font-medium">{option.value}</span>
											</button>
										);
									})}
								</div>
							</>
						)}
					</fieldset>
				);
			})}
		</div>
	);
}
