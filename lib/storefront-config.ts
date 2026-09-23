export const storefront = {
	brandName: "TeeBravo",
	shortName: "TeeBravo",
	url: (process.env.NEXT_PUBLIC_URL || "https://teebravo.com").replace(/\/+$/, ""),
	positioning: "Printed apparel and accessories",
	description:
		"Discover TeeBravo printed T-shirts, hoodies, sweatshirts and accessories. Choose a design, then find the product, color and size that suit you.",
	heroStatement:
		"Printed T-shirts, hoodies, sweatshirts and accessories for everyday use. Choose your design, product and color.",
	footerStatement:
		"TeeBravo brings printed designs to clothing and accessories. Browse by interest or occasion, then choose the product that suits you.",
} as const;
