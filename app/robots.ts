import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/commerce";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = getCanonicalUrl();

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/cart", "/checkout", "/order/", "/search", "/api/auth/", "/api/mockups/render"],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
		host: baseUrl,
	};
}
