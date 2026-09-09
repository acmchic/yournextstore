import { NextResponse } from "next/server";
import { meGetCached } from "@/lib/commerce";
import { storefront } from "@/lib/storefront-config";

export async function GET() {
	const me = await meGetCached();
	const storeName = me.store.name || storefront.brandName;

	const manifest = {
		name: storeName,
		short_name: storefront.shortName,
		start_url: "/",
		display: "standalone" as const,
		background_color: "#ffffff",
		theme_color: "#000000",
		icons: [
			{
				src: "/brand/icon-192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/brand/icon-512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};

	return NextResponse.json(manifest, {
		headers: {
			"Content-Type": "application/manifest+json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
