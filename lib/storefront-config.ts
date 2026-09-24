export const storefront = {
	brandName: "TeeBravo",
	shortName: "TeeBravo",
	url: (process.env.NEXT_PUBLIC_URL || "https://teebravo.com").replace(/\/+$/, ""),
	positioning: "Printed apparel and accessories",
	description:
		"Shop printed T-shirts, hoodies and accessories inspired by your hobbies and favorite occasions. Printed to order and shipped within the United States.",
	heroStatement:
		"Find a design that feels like you, on a T-shirt, hoodie or accessory you can make part of your day.",
	footerStatement:
		"Printed clothing and accessories for the hobbies you love and the occasions you look forward to. Made to order for you or someone you know.",
} as const;
