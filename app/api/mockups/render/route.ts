import { NextResponse } from "next/server";

const DEFAULT_MOCKUP_API_URL = "http://localhost:8000";

export async function GET(request: Request) {
	const upstreamBase = process.env.POD_MOCKUP_API_URL || DEFAULT_MOCKUP_API_URL;
	const requestUrl = new URL(request.url);
	const upstreamUrl = new URL("/v1/mockups/render", upstreamBase);
	upstreamUrl.search = requestUrl.searchParams.toString();

	try {
		const upstream = await fetch(upstreamUrl, {
			headers: {
				accept: request.headers.get("accept") || "image/webp,image/*;q=0.8",
			},
			cache: "no-store",
		});

		if (!upstream.ok) {
			const detail = await upstream.text();
			return NextResponse.json({ error: "Mockup renderer failed", detail }, { status: upstream.status });
		}

		const headers = new Headers();
		const contentType = upstream.headers.get("content-type");
		const cacheControl = upstream.headers.get("cache-control");
		const cacheStatus = upstream.headers.get("x-mockup-cache");
		if (contentType) headers.set("content-type", contentType);
		if (cacheControl) headers.set("cache-control", cacheControl);
		if (cacheStatus) headers.set("x-mockup-cache", cacheStatus);

		return new Response(upstream.body, {
			status: upstream.status,
			headers,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: "Mockup renderer unavailable",
				detail: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 },
		);
	}
}
