import { NextResponse } from "next/server";

const DEFAULT_MOCKUP_API_URL = "http://127.0.0.1:8000";

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const upstreamBase = process.env.POD_MOCKUP_API_URL || DEFAULT_MOCKUP_API_URL;
	const upstreamUrl = new URL(requestUrl.pathname, upstreamBase);
	upstreamUrl.search = requestUrl.searchParams.toString();

	try {
		const upstream = await fetch(upstreamUrl, {
			headers: {
				accept: request.headers.get("accept") || "image/webp,image/*;q=0.8",
			},
			cache: "no-store",
			redirect: "manual",
		});
		if (upstream.status >= 300 && upstream.status < 400) {
			const location = upstream.headers.get("location");
			if (location) {
				return new Response(null, {
					status: upstream.status,
					headers: { location: new URL(location, requestUrl.origin).toString() },
				});
			}
		}
		if (!upstream.ok) {
			const detail = await upstream.text();
			return NextResponse.json({ error: "Mockup renderer failed", detail }, { status: upstream.status });
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
				error: "Mockup renderer unavailable",
				detail: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 },
		);
	}
}
