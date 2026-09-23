"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	type ProductCatalogType,
	type ProductCatalogTypeOptions,
	productCatalogTypes,
} from "@/lib/product-catalog-types";
import { cn } from "@/lib/utils";

const catalogTypeLabels: Record<ProductCatalogType, string> = {
	unisex: "Unisex",
	women: "Women",
	youth: "Youth",
	kids: "Kids",
};

function catalogPath(productSlug: string, catalogSlug: string) {
	return `/product/${encodeURIComponent(productSlug)}/${encodeURIComponent(catalogSlug)}`;
}

export function CatalogTypeSelector({
	productSlug,
	currentCatalogSlug,
	catalogOptions,
}: {
	productSlug: string;
	currentCatalogSlug: string;
	catalogOptions: ProductCatalogTypeOptions;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [optimisticCatalogSlug, setOptimisticCatalogSlug] = useOptimistic(currentCatalogSlug);
	const prefetchedCatalogs = useRef(new Set<string>());
	const prefetchCatalog = useCallback(
		(catalogSlug: string) => {
			if (catalogSlug === currentCatalogSlug || prefetchedCatalogs.current.has(catalogSlug)) {
				return;
			}

			prefetchedCatalogs.current.add(catalogSlug);
			router.prefetch(catalogPath(productSlug, catalogSlug));
		},
		[currentCatalogSlug, productSlug],
	);
	const prefetchType = useCallback(
		(type: ProductCatalogType) => {
			catalogOptions[type].map(({ slug }) => prefetchCatalog(slug));
		},
		[catalogOptions, prefetchCatalog],
	);

	useEffect(() => {
		const prefetchTypes = () => {
			productCatalogTypes.map(prefetchType);
		};
		const timeout = window.setTimeout(prefetchTypes, 200);

		return () => window.clearTimeout(timeout);
	}, [prefetchType]);

	const availableTypes = productCatalogTypes.filter((type) => catalogOptions[type].length > 0);
	const selectedType =
		availableTypes.find((type) => catalogOptions[type].some(({ slug }) => slug === optimisticCatalogSlug)) ??
		(availableTypes.includes("unisex") ? "unisex" : availableTypes[0]);

	if (!selectedType) {
		return null;
	}

	const selectedCatalog =
		catalogOptions[selectedType].find(({ slug }) => slug === optimisticCatalogSlug) ??
		catalogOptions[selectedType][0];
	if (!selectedCatalog) {
		return null;
	}

	const navigateToCatalog = (catalogSlug: string) => {
		if (catalogSlug !== optimisticCatalogSlug) {
			startTransition(() => {
				setOptimisticCatalogSlug(catalogSlug);
				router.push(catalogPath(productSlug, catalogSlug), { scroll: false });
			});
		}
	};

	return (
		<div
			className={cn(
				"grid w-full min-w-0 gap-4 transition-opacity duration-150 ease-out motion-reduce:transition-none",
				isPending && "opacity-80",
			)}
			aria-busy={isPending}
		>
			<fieldset className="m-0 min-w-0 border-0 p-0">
				<legend className="mb-3 text-xs uppercase tracking-[0.06em]">Type</legend>
				<div className="grid w-full min-w-0 grid-cols-4 gap-2" role="radiogroup" aria-label="Type">
					{productCatalogTypes.map((type) => {
						const firstCatalog = catalogOptions[type][0];
						const isSelected = selectedType === type;

						return (
							<Button
								key={type}
								type="button"
								variant={isSelected ? "default" : "outline"}
								size="lg"
								role="radio"
								aria-checked={isSelected}
								className="min-w-0 w-full rounded border-foreground px-1 text-xs font-normal sm:px-2 sm:text-sm"
								disabled={!firstCatalog}
								onPointerEnter={() => firstCatalog && prefetchCatalog(firstCatalog.slug)}
								onFocus={() => firstCatalog && prefetchCatalog(firstCatalog.slug)}
								onClick={() => firstCatalog && navigateToCatalog(firstCatalog.slug)}
							>
								{catalogTypeLabels[type]}
							</Button>
						);
					})}
				</div>
			</fieldset>

			<fieldset className="m-0 min-w-0 border-0 p-0">
				<legend className="mb-3 text-xs uppercase tracking-[0.06em]">Style</legend>
				<Select
					value={selectedCatalog.slug}
					onOpenChange={(open) => open && prefetchType(selectedType)}
					onValueChange={navigateToCatalog}
				>
					<SelectTrigger
						className="h-10 w-full min-w-0 cursor-pointer rounded border-foreground bg-white px-3 text-left text-sm font-normal text-slate-950 focus-visible:ring-2 focus-visible:ring-[#aaaaac] dark:bg-white dark:text-slate-950"
						onFocus={() => prefetchType(selectedType)}
						onPointerDown={() => prefetchType(selectedType)}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="bg-white text-slate-950 dark:bg-white dark:text-slate-950">
						{catalogOptions[selectedType].map((catalog) => (
							<SelectItem key={catalog.slug} value={catalog.slug}>
								{catalog.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</fieldset>
		</div>
	);
}
