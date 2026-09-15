export const storefront = {
	brandName: "TeeBravo",
	shortName: "TeeBravo",
	url: (process.env.NEXT_PUBLIC_URL || "https://teebravo.com").replace(/\/+$/, ""),
	positioning: "Premium graphic clothing",
	description:
		"Discover TeeBravo graphic tees, hoodies, and sweatshirts. Expressive designs and everyday silhouettes, made for your personal style.",
	heroStatement:
		"Graphic tees, hoodies, and sweatshirts with a point of view. Find your design. Make it part of your everyday.",
	footerStatement:
		"TeeBravo brings expressive graphics to everyday clothing. Explore the collection and find the piece that feels like you.",
} as const;
