import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_ENABLED } from "./lib/auth-config";

export function proxy(request: NextRequest) {
	if (AUTH_ENABLED && !request.cookies.get("better-auth.session_token")) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/account", "/account/:path*"],
};
