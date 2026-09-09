import type { LucideIcon } from "lucide-react";
import { RotateCcw, Shield, Truck } from "lucide-react";

type TrustBadge = {
	icon: LucideIcon;
	title: string;
	description: string;
};

const defaultBadges: TrustBadge[] = [
	{ icon: Truck, title: "US Shipping", description: "Tracked delivery" },
	{ icon: Shield, title: "Print Checked", description: "Mockup reviewed" },
	{ icon: RotateCcw, title: "Returns", description: "30-day window" },
];

export function TrustBadges({ badges = defaultBadges }: { badges?: TrustBadge[] }) {
	return (
		<div className="grid grid-cols-1 border-y border-border/60 sm:grid-cols-3">
			{badges.map((badge) => (
				<div
					key={badge.title}
					className="flex items-start gap-2.5 py-4 sm:px-3 sm:first:pl-0 sm:[&:not(:last-child)]:border-r sm:border-border/60"
				>
					<badge.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.25} />
					<div className="flex flex-col">
						<span className="text-[11px] font-medium uppercase tracking-[0.05em]">{badge.title}</span>
						<span className="text-[10px] text-muted-foreground">{badge.description}</span>
					</div>
				</div>
			))}
		</div>
	);
}
