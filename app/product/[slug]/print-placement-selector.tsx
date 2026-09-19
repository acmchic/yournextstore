"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const placements = [
	{ value: "front", label: "Front" },
	{ value: "back", label: "Back" },
	{ value: "front-back", label: "Front & Back" },
] as const;

export function PrintPlacementSelector() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const requestedPlacement = searchParams.get("Print");
	const selected = placements.some((placement) => placement.value === requestedPlacement)
		? requestedPlacement
		: "front";

	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="mb-3 text-xs uppercase tracking-[0.06em]">Print area</legend>
			<div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Print area">
				{placements.map((placement) => (
					<Button
						key={placement.value}
						type="button"
						variant={selected === placement.value ? "default" : "outline"}
						size="lg"
						role="radio"
						aria-checked={selected === placement.value}
						onClick={() => {
							const params = new URLSearchParams(searchParams.toString());
							params.set("Print", placement.value);
							router.push(`${pathname}?${params.toString()}`, { scroll: false });
						}}
						className="min-w-24 rounded border-foreground px-4 font-normal"
					>
						{placement.label}
					</Button>
				))}
			</div>
		</fieldset>
	);
}
