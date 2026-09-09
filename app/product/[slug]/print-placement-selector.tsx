"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const placements = [
	{ value: "front", label: "Front" },
	{ value: "chest", label: "Chest" },
	{ value: "back", label: "Back" },
	{ value: "front-back", label: "Front & Back" },
] as const;

export function PrintPlacementSelector() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const selected = searchParams.get("Print") ?? "front";

	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="mb-3 text-xs uppercase tracking-[0.06em]">Print area</legend>
			<div className="flex flex-wrap gap-2">
				{placements.map((placement) => (
					<button
						key={placement.value}
						type="button"
						onClick={() => {
							const params = new URLSearchParams(searchParams.toString());
							params.set("Print", placement.value);
							router.push(`${pathname}?${params.toString()}`, { scroll: false });
						}}
						className={cn(
							"min-h-10 cursor-pointer rounded border px-4 py-2 text-sm transition-shadow duration-150",
							selected === placement.value
								? "border-foreground bg-foreground text-background"
								: "border-foreground bg-white hover:shadow-[0_0_0_2px_#aaaaac]",
						)}
						aria-pressed={selected === placement.value}
					>
						{placement.label}
					</button>
				))}
			</div>
		</fieldset>
	);
}
