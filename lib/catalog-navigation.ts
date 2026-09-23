import type { ApiCatalog } from "@/lib/own-commerce";

export const departments = [
	{
		slug: "unisex",
		label: "Unisex",
		description: "Printed T-shirts, hoodies and sweatshirts in unisex styles.",
	},
	{
		slug: "women",
		label: "Women",
		description: "Explore printed T-shirts, relaxed layers and women’s styles.",
	},
	{
		slug: "kids",
		label: "Kids",
		description: "Printed T-shirts and layers in youth sizes. Choose a design, then find their fit.",
	},
	{
		slug: "accessories",
		label: "Accessories",
		description: "Explore printed ornaments, flags and other accessories.",
	},
	{ slug: "home-living", label: "Home & Living", description: "Printed pieces for your everyday spaces." },
] as const;

export function catalogNavigation(catalogs: ApiCatalog[]) {
	return departments
		.map((department) => {
			const departmentCatalogs = catalogs
				.filter((catalog) => catalog.product_count > 0)
				.filter((catalog) => catalog.taxonomy.some((item) => item.department === department.slug));
			const entries = departmentCatalogs.flatMap((catalog) =>
				catalog.taxonomy.filter((item) => item.department === department.slug),
			);
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
					catalogs: departmentCatalogs
						.filter((catalog) =>
							catalog.taxonomy.some(
								(item) => item.department === department.slug && item.type_slug === type.type_slug,
							),
						)
						.map((catalog) => ({
							label: catalog.name,
							slug: catalog.slug,
							href: `/shop/${department.slug}?${new URLSearchParams({
								type: type.type_slug,
								catalog: catalog.slug,
							})}`,
						})),
				})),
			};
		})
		.filter((department) => department.children.length > 0);
}
