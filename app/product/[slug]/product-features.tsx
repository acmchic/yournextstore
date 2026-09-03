import { Award, Hammer, Leaf, type LucideIcon } from "lucide-react";

type Feature = {
	title: string;
	description: string;
	icon?: LucideIcon;
};

type ProductFeaturesProps = {
	features?: Feature[];
};

const defaultFeatures: Feature[] = [
	{
		title: "Selected blanks",
		description: "Each product starts with a blank chosen for fit, weight, and print surface.",
	},
	{
		title: "Graphic-led",
		description: "Artwork is treated as the product, then adapted across tee, hoodie, and sweatshirt bodies.",
	},
	{
		title: "Demand tested",
		description: "Drops stay lean while organic traffic and reviews decide what scales.",
	},
];

const defaultIcons = [Leaf, Hammer, Award];

export function ProductFeatures({ features = defaultFeatures }: ProductFeaturesProps) {
	return (
		<section className="mt-20 border-t border-border pt-16">
			<h2 className="mb-12 text-3xl font-black uppercase tracking-tighter">Built like a drop</h2>
			<div className="grid gap-8 md:grid-cols-3">
				{features.map((feature, index) => {
					const Icon = feature.icon ?? defaultIcons[index % defaultIcons.length];
					return (
						<div key={feature.title} className="group border-t border-border pt-5">
							<div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-secondary transition-colors group-hover:bg-foreground">
								<Icon className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-background" />
							</div>
							<h3 className="mb-2 text-lg font-medium">{feature.title}</h3>
							<p className="text-sm text-muted-foreground">{feature.description}</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
