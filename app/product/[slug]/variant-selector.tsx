"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function SizeSelect({
	group,
	selectedOption,
	onSelect,
}: {
	group: VariantGroup;
	selectedOption?: VariantOption;
	onSelect: (id: string) => void;
}) {
	return (
		<Select value={selectedOption?.id} onValueChange={onSelect}>
			<SelectTrigger
				aria-label="Select size"
				className="h-10 w-full cursor-pointer rounded border-foreground bg-white px-3 text-left text-sm font-normal leading-4 shadow-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#aaaaac] dark:bg-white dark:text-slate-950"
			>
				<SelectValue placeholder="Select Size" />
			</SelectTrigger>
			<SelectContent className="bg-white text-slate-950 dark:bg-white dark:text-slate-950">
				{group.options.map((option) => (
					<SelectItem key={option.id} value={option.id}>
						{option.value}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

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

	const groupsWithChoices = variantGroups
		.filter((group) => group.options.length > 1)
		.sort((a, b) => (a.type === "color" ? -1 : b.type === "color" ? 1 : 0));

	if (groupsWithChoices.length === 0) {
		return null;
	}

	return (
		<div className="space-y-8 sm:space-y-9">
			{groupsWithChoices.map((group) => {
				const selectedOptionId = selectedOptions[group.label];
				const selectedOption = selectedOptionId
					? optionsById.get(group.label)?.get(selectedOptionId)
					: undefined;

				return (
					<fieldset key={group.label} className="min-w-0 border-0 p-0">
						{group.type === "color" ? (
							<>
								<div className="mb-3 flex items-center justify-between">
									<legend className="text-xs uppercase tracking-[0.06em]">{group.label}</legend>
									{selectedOption && (
										<span className="text-xs text-muted-foreground">{selectedOption.value}</span>
									)}
								</div>
								<div className="flex flex-wrap gap-3" role="radiogroup" aria-label={group.label}>
									{group.options.map((option) => {
										const isSelected = selectedOptions[group.label] === option.id;
										const isLightColor =
											option.colorValue?.toUpperCase() === "#FFFFFF" ||
											option.colorValue?.toUpperCase() === "#FFFFF0" ||
											option.colorValue?.toUpperCase() === "#FFF";

										return (
											<Button
												key={option.id}
												type="button"
												variant="ghost"
												size="icon-lg"
												role="radio"
												aria-checked={isSelected}
												onClick={() => handleOptionSelect(group.label, option.id)}
												className={cn(
													"relative h-10 w-10 rounded-full bg-transparent p-0 transition-all duration-200 hover:bg-transparent",
													isSelected
														? "ring-1 ring-foreground ring-offset-2 ring-offset-background"
														: "hover:ring-1 hover:ring-muted-foreground hover:ring-offset-2 hover:ring-offset-background",
												)}
												style={{ backgroundColor: option.colorValue ?? "#fff" }}
												aria-label={option.value}
												title={option.value}
											>
												{isLightColor && (
													<span className="absolute inset-0 rounded-full border border-slate-500/70 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]" />
												)}
											</Button>
										);
									})}
								</div>
							</>
						) : (
							<>
								<div className="mb-3 flex items-center justify-between">
									<legend className="text-xs uppercase tracking-[0.06em]">{group.label}</legend>
									{group.label.toLowerCase() === "size" && (
										<Button
											type="button"
											variant="link"
											size="sm"
											onClick={() => window.dispatchEvent(new CustomEvent("teebravo:size-guide"))}
											className="h-auto rounded-none p-0 text-xs font-normal text-foreground transition-opacity hover:bg-transparent hover:opacity-60"
										>
											Size guide
										</Button>
									)}
								</div>
								<SizeSelect
									group={group}
									selectedOption={selectedOption}
									onSelect={(id) => handleOptionSelect(group.label, id)}
								/>
							</>
						)}
					</fieldset>
				);
			})}
		</div>
	);
}
