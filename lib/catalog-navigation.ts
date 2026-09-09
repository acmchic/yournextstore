import type { ApiCatalog } from "@/lib/own-commerce";

export const departments = [
	{
		slug: "men",
		label: "Men",
		description: "Graphic tees, hoodies, and sweatshirts for your everyday rotation.",
	},
	{
		slug: "women",
		label: "Women",
		description: "Explore graphic tees, relaxed layers, and everyday silhouettes.",
	},
	{
		slug: "kids",
		label: "Kids",
		description: "Graphic tees and layers in youth sizes. Choose a design, then find their fit.",
	},
	{
		slug: "accessories",
		label: "Accessories",
		description: "Small details. Personal touches. Explore graphic accessories.",
	},
	{ slug: "home-living", label: "Home & Living", description: "Graphic objects for your everyday spaces." },
] as const;

export function catalogNavigation(catalogs: ApiCatalog[]) {
	return departments
		.map((department) => {
			const entries = catalogs
				.filter((catalog) => catalog.product_count > 0)
				.flatMap((catalog) => catalog.taxonomy.filter((item) => item.department === department.slug));
			const types = [
				...new Map(
					entries
						.toSorted((a, b) => a.sort_order - b.sort_order || a.type_label.localeCompare(b.type_label))
						.map((item) => [item.type_slug, item]),
				).values(),
			];
			return {
				...department,
				href: `/shop/${department.slug}`,
				children: types.map((type) => ({
					label: type.type_label,
					slug: type.type_slug,
					href: `/shop/${department.slug}?type=${encodeURIComponent(type.type_slug)}`,
				})),
			};
		})
		.filter((department) => department.children.length > 0);
}
