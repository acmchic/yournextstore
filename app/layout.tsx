import "@/app/globals.css";

import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Inter, Tenor_Sans } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { CartProvider } from "@/app/cart/cart-context";
import { CartSidebar } from "@/app/cart/cart-sidebar";
import { CartButton } from "@/app/cart-button";
import { Footer } from "@/app/footer";
import { Navbar, type NavGroup, type NavLink } from "@/app/navbar";
import { SearchInput } from "@/app/search-input";
import { AuthButton } from "@/components/auth-button";
import { CookieConsent } from "@/components/cookie-consent";
import { ErrorOverlayRemover, NavigationReporter } from "@/components/devtools";
import { NewsletterDialog } from "@/components/newsletter-dialog";
import { RouteProgressBar } from "@/components/route-progress-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { catalogNavigation } from "@/lib/catalog-navigation";
import { commerce, getCanonicalUrl, getStoreFaviconUrl, meGetCached } from "@/lib/commerce";
import { getCartCookieJson } from "@/lib/cookies";
import { StoreJsonLd } from "@/lib/json-ld";
import { catalogBrowse } from "@/lib/own-commerce";
import { storefront } from "@/lib/storefront-config";

const sans = Inter({
	variable: "--font-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const display = Tenor_Sans({
	variable: "--font-display",
	subsets: ["latin"],
	weight: ["400"],
});

async function getStoreMetadata(): Promise<Metadata> {
	"use cache";
	cacheLife("hours");
	const me = await meGetCached().catch(() => null);
	const storeName = me?.store.name || storefront.brandName;
	const storeDescription = me?.store.settings?.storeDescription || storefront.description;
	const faviconUrl = getStoreFaviconUrl(me?.store.settings) ?? "/logo.svg";
	const storeLogo =
		typeof me?.store.settings?.logo === "string"
			? me.store.settings.logo
			: me?.store.settings?.logo?.imageUrl;
	const ogImage = me?.store.settings?.ogimage || storeLogo || "/logo.svg";

	return {
		title: {
			default: storeName,
			template: `%s - ${storeName}`,
		},
		description: storeDescription,
		applicationName: storeName,
		alternates: {
			canonical: "/",
		},
		openGraph: {
			type: "website",
			siteName: storeName,
			title: storeName,
			description: storeDescription,
			url: "/",
			images: [{ url: ogImage, alt: storeName }],
		},
		twitter: {
			card: "summary_large_image",
			title: storeName,
			description: storeDescription,
			images: [ogImage],
		},
		robots: {
			index: true,
			follow: true,
			googleBot: {
				index: true,
				follow: true,
				"max-image-preview": "large",
				"max-snippet": -1,
				"max-video-preview": -1,
			},
		},
		icons: {
			icon: [{ url: faviconUrl, sizes: "any", type: "image/svg+xml" }],
			apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
			shortcut: faviconUrl,
		},
		manifest: "/manifest.webmanifest",
	};
}

export async function generateMetadata(): Promise<Metadata> {
	const metadata = await getStoreMetadata();
	// URL instances can't cross the "use cache" serialization boundary, so
	// metadataBase is attached outside the cached scope (env-only, no IO).
	return { ...metadata, metadataBase: new URL(getCanonicalUrl()) };
}

function CartButtonFallback() {
	return (
		<div className="flex min-h-11 min-w-11 items-center justify-center opacity-20">
			<ShoppingBag className="h-5 w-5" />
		</div>
	);
}

async function getInitialCart() {
	const cartCookie = await getCartCookieJson();

	if (!cartCookie?.id) {
		return { cart: null, cartId: null };
	}

	try {
		const cart = await commerce.cartGet({ cartId: cartCookie.id });
		return { cart: cart ?? null, cartId: cartCookie.id };
	} catch {
		return { cart: null, cartId: cartCookie.id };
	}
}

async function getNavLinks(): Promise<{ links: NavLink[]; groups: NavGroup[] }> {
	"use cache";
	cacheLife("minutes");
	const [me, catalogs] = await Promise.all([
		meGetCached().catch(() => null),
		catalogBrowse().catch(() => ({ data: [] })),
	]);
	const blogEnabled = me?.store.settings?.enabledTools?.blog ?? false;
	const groups = catalogNavigation(catalogs.data).filter((group) => group.slug !== "home-living");
	return {
		links: [
			...(blogEnabled ? [{ href: "/blog", label: "Blog" }] : []),
			{ href: "/track-order", label: "Track order" },
		],
		groups,
	};
}

async function CartProviderWrapper({ children }: { children: React.ReactNode }) {
	const [{ cart, cartId }, navigation] = await Promise.all([getInitialCart(), getNavLinks()]);

	return (
		<CartProvider initialCart={cart} initialCartId={cartId}>
			<div className="flex min-h-screen flex-col bg-background">
				<div className="border-b border-border bg-foreground text-background">
					<div className="mx-auto flex min-h-8 max-w-[1400px] items-center justify-center px-4 py-1.5 sm:px-6 lg:px-10">
						<p className="text-center font-sans text-[10px] font-medium uppercase tracking-[0.2em]">
							United States shipping <span aria-hidden>·</span>{" "}
							<Link href="/shipping-policy" className="underline underline-offset-2">
								View shipping details
							</Link>
						</p>
					</div>
				</div>
				<header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
					<div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
						<div className="grid h-16 grid-cols-3 items-center sm:h-20">
							<nav aria-label="Main navigation" className="flex items-center justify-start gap-6">
								<Navbar links={navigation.links} groups={navigation.groups} />
							</nav>
							<div className="flex items-center justify-center">
								<Link href="/" className="font-display text-xl tracking-[0.28em] text-foreground sm:text-2xl">
									{storefront.brandName.toUpperCase()}
								</Link>
							</div>
							<div className="flex items-center justify-end gap-1 sm:gap-2">
								<Suspense>
									<SearchInput />
								</Suspense>
								{AUTH_ENABLED && <AuthButton />}
								<ThemeToggle />
								<Suspense fallback={<CartButtonFallback />}>
									<CartButton />
								</Suspense>
							</div>
						</div>
					</div>
				</header>
				<main className="flex-1">{children}</main>
				<Footer />
			</div>
			<CartSidebar />
		</CartProvider>
	);
}

async function getHtmlLang(): Promise<string> {
	try {
		const me = await meGetCached();
		return me.store.settings?.defaultLanguage?.split("-")[0] ?? "en";
	} catch {
		return "en";
	}
}

async function NewsletterPopupSection() {
	const me = await meGetCached();
	if (!me.store.settings?.enabledTools?.newsletterPopup) {
		return null;
	}
	return <NewsletterDialog settings={me.store.settings?.newsletterPopup} />;
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const env = process.env.VERCEL_ENV || "development";
	const lang = await getHtmlLang();

	return (
		<html lang={lang} className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
			<body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
				{/* DO NOT REMOVE / REORDER: required for GDPR + GTM Consent Mode v2. Must stay at top of <body>. */}
				<Suspense>
					<CookieConsent />
				</Suspense>
				<Suspense fallback={null}>
					<RouteProgressBar />
				</Suspense>
				<Suspense>
					<StoreJsonLd />
				</Suspense>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					<Suspense fallback={null}>
						<CartProviderWrapper>{children}</CartProviderWrapper>
					</Suspense>
				</ThemeProvider>
				<Suspense>
					<NewsletterPopupSection />
				</Suspense>
				<Toaster richColors position="top-center" />
				{env === "development" && (
					<>
						<NavigationReporter />
						<ErrorOverlayRemover />
					</>
				)}
			</body>
		</html>
	);
}
