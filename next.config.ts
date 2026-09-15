import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
	turbopack: { root: process.cwd() },
	output: "standalone",
	/* config options here */
	allowedDevOrigins: ["*.vercel.run"],
	poweredByHeader: false,
	productionBrowserSourceMaps: false,
	devIndicators: false,
	reactCompiler: true,
	cacheComponents: true,
	async rewrites() {
		return [
			{ source: "/shipping-policy", destination: "/legal/shipping-policy" },
			{ source: "/return-policy", destination: "/legal/return-policy" },
			{ source: "/privacy-policy", destination: "/legal/privacy-policy" },
			{ source: "/terms-of-service", destination: "/legal/terms-of-service" },
			{ source: "/contact-policy", destination: "/legal/contact" },
			{ source: "/faq-policy", destination: "/legal/faq" },
		];
	},
	experimental: {
		typedEnv: true,
		serverComponentsHmrCache: false,
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-accordion",
			"@radix-ui/react-alert-dialog",
			"@radix-ui/react-avatar",
			"@radix-ui/react-checkbox",
			"@radix-ui/react-collapsible",
			"@radix-ui/react-context-menu",
			"@radix-ui/react-dialog",
			"@radix-ui/react-dropdown-menu",
			"@radix-ui/react-hover-card",
			"@radix-ui/react-label",
			"@radix-ui/react-menubar",
			"@radix-ui/react-navigation-menu",
			"@radix-ui/react-popover",
			"@radix-ui/react-progress",
			"@radix-ui/react-radio-group",
			"@radix-ui/react-scroll-area",
			"@radix-ui/react-select",
			"@radix-ui/react-separator",
			"@radix-ui/react-slider",
			"@radix-ui/react-slot",
			"@radix-ui/react-switch",
			"@radix-ui/react-tabs",
			"@radix-ui/react-toggle",
			"@radix-ui/react-toggle-group",
			"@radix-ui/react-tooltip",
			"date-fns",
			"class-variance-authority",
		],
	},
	images: {
		dangerouslyAllowLocalIP: !isProd,
		qualities: [75, 90],
		localPatterns: [{ pathname: "/img/**" }, { pathname: "/api/catalog-mockup/**" }],
		// The local storefront API may be configured as either localhost or
		// 127.0.0.1; both are valid image origins during development.
		remotePatterns: [
			{ protocol: "https", hostname: "**" },
			{ protocol: "http", hostname: "localhost", port: "8000" },
			{ protocol: "http", hostname: "127.0.0.1", port: "8000" },
		],
	},
	async headers() {
		if (isProd) return [];
		// Dev-only: AI Builder renders this app in an iframe, and Chrome's HTTP cache
		// holds stale sub-resources inside iframes — HMR fires but the preview never
		// sees it. See https://github.com/vercel/next.js/issues/90143.
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Cache-Control", value: "no-store, must-revalidate" },
					{ key: "Pragma", value: "no-cache" },
				],
			},
		];
	},
};

export default nextConfig;
