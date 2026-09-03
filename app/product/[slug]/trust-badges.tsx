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
		<div className="grid grid-cols-3 border border-border bg-secondary/40 p-4">
			{badges.map((badge) => (
				<div key={badge.title} className="flex flex-col items-center text-center">
					<badge.icon className="mb-2 h-5 w-5 text-muted-foreground" />
					<span className="text-xs font-medium">{badge.title}</span>
					<span className="text-[10px] text-muted-foreground">{badge.description}</span>
				</div>
			))}
		</div>
	);
}
