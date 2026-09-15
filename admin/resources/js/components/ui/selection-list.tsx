import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SelectionListItem = {
	id: number | string;
	title: string;
	meta?: ReactNode;
	status?: ReactNode;
};

type SelectionListProps<T extends SelectionListItem> = {
	items: T[];
	selectedId: number | string | null;
	onCreate: () => void;
	onSelect: (item: T) => void;
	createLabel: string;
	label: string;
	emptyLabel?: string;
};

function SelectionList<T extends SelectionListItem>({
	items,
	selectedId,
	onCreate,
	onSelect,
	createLabel,
	label,
	emptyLabel = "Nothing here yet.",
}: SelectionListProps<T>) {
	return (
		<nav aria-label={label} className="space-y-3">
			<Button
				type="button"
				className="w-full"
				onClick={onCreate}
			>
				{createLabel}
			</Button>
			<Card className="gap-1 p-1 shadow-xs">
				<CardContent className="px-0">
					<div
						role="listbox"
						aria-label={`${label} items`}
						className="space-y-1"
					>
						{items.length === 0 ? (
							<p className="px-3 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
						) : (
							items.map((item) => {
								const selected = selectedId === item.id;

								return (
									<Button
										key={item.id}
										type="button"
										variant="ghost"
										role="option"
										aria-selected={selected}
										onClick={() => onSelect(item)}
										className={cn(
											"h-auto w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left",
											selected
												? "bg-accent text-accent-foreground shadow-xs"
												: "hover:bg-muted/70",
										)}
									>
										<span className="min-w-0">
											<span className="block truncate font-medium">{item.title}</span>
											{item.meta && (
												<span className="mt-1 block truncate text-xs text-muted-foreground">
													{item.meta}
												</span>
											)}
										</span>
										{item.status && (
											<Badge variant={selected ? "default" : "secondary"} className="shrink-0">
												{item.status}
											</Badge>
										)}
									</Button>
								);
							})
						)}
					</div>
				</CardContent>
			</Card>
		</nav>
	);
}

export { SelectionList };
