import { NextResponse } from "next/server";

const DEFAULT_MOCKUP_API_URL = "http://localhost:8000";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ product: string; catalog: string }> },
) {
	const { product, catalog } = await params;
	const upstreamBase = process.env.POD_MOCKUP_API_URL || DEFAULT_MOCKUP_API_URL;
	const requestUrl = new URL(request.url);
	const upstreamUrl = new URL(
		`/v1/products/${encodeURIComponent(product)}/catalogs/${encodeURIComponent(catalog)}/mockup`,
		upstreamBase,
	);
	upstreamUrl.search = requestUrl.searchParams.toString();
	// Next.js is the only lossy encoding pass. A lossless upstream image avoids
	// recompressing an already compressed WebP mockup and keeps artwork crisp.
	upstreamUrl.searchParams.set("format", "png");

	try {
		const upstream = await fetch(upstreamUrl, {
			headers: { accept: "image/png,image/*;q=0.8" },
			cache: "no-store",
		});
		if (!upstream.ok) {
			const detail = await upstream.text();
			return NextResponse.json({ error: "Catalog mockup failed", detail }, { status: upstream.status });
		}
		const headers = new Headers();
		for (const name of ["content-type", "cache-control", "x-mockup-cache"]) {
			const value = upstream.headers.get(name);
			if (value) headers.set(name, value);
		}
		return new Response(upstream.body, { status: upstream.status, headers });
	} catch (error) {
		return NextResponse.json(
			{
				error: "Catalog mockup unavailable",
				detail: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 },
		);
	}
}
