import "@/app/globals.css";

import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Inter, Space_Grotesk } from "next/font/google";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { catalogNavigation } from "@/lib/catalog-navigation";
import { commerce, getCanonicalUrl, getStoreFaviconUrl, meGetCached } from "@/lib/commerce";
import { getCartCookieJson } from "@/lib/cookies";
import { StoreJsonLd } from "@/lib/json-ld";
import { catalogBrowse } from "@/lib/own-commerce";
import { storefront } from "@/lib/storefront-config";

const inter = Inter({
	variable: "--font-display",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700", "900"],
});

const spaceGrotesk = Space_Grotesk({
	variable: "--font-body",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
});

async function getStoreMetadata(): Promise<Metadata> {
	"use cache";
	cacheLife("hours");
	const me = await meGetCached();
	const storeName = me.store.name || storefront.brandName;
	const storeDescription = me.store.settings?.storeDescription || storefront.description;
	const faviconUrl = getStoreFaviconUrl(me.store.settings) ?? "/logo.svg";
	const storeLogo =
		typeof me.store.settings?.logo === "string" ? me.store.settings.logo : me.store.settings?.logo?.imageUrl;
	const ogImage = me.store.settings?.ogimage || storeLogo || "/logo.svg";

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
		<div className="w-5 h-5 opacity-20">
			<ShoppingBag className="w-5 h-5" />
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
	const [collections, me, catalogs] = await Promise.all([
		commerce.collectionBrowse({ limit: 5 }),
		meGetCached().catch(() => null),
		catalogBrowse().catch(() => ({ data: [] })),
	]);
	const blogEnabled = me?.store.settings?.enabledTools?.blog ?? false;
	const groups = catalogNavigation(catalogs.data).filter((group) => group.slug !== "home-living");
	return {
		links: [
			{ href: "/products", label: "View all" },
			...collections.data.map((collection) => ({
				href: `/collection/${collection.slug}`,
				label: collection.name,
			})),
			...(blogEnabled ? [{ href: "/blog", label: "Blog" }] : []),
		],
		groups,
	};
}

async function CartProviderWrapper({ children }: { children: React.ReactNode }) {
	const [{ cart, cartId }, navigation] = await Promise.all([getInitialCart(), getNavLinks()]);

	return (
		<CartProvider initialCart={cart} initialCartId={cartId}>
			<div className="min-h-screen flex flex-col bg-card">
				<div className="w-full relative bg-card">
					{/* Brutalist Grid Header */}
					<header className="relative z-30 grid grid-cols-12 grid-border-b h-16 md:h-20 items-center bg-background text-foreground">
						{/* Logo */}
						<div className="order-2 md:order-1 col-span-4 md:col-span-3 h-full flex items-center justify-center md:justify-start px-3 md:px-6 md:border-r md:border-border">
							<Link href="/">
								<span className="font-display font-bold text-sm sm:text-lg tracking-tighter uppercase">
									{storefront.brandName}
								</span>
							</Link>
						</div>

						{/* Mobile menu and desktop navigation */}
						<nav
							aria-label="Main navigation"
							className="order-1 md:order-2 col-span-4 md:col-span-6 flex h-full items-center justify-start md:justify-center pl-3 md:pl-0 gap-4 xl:gap-6 md:border-r md:border-border font-medium text-xs tracking-wide"
						>
							<Navbar links={navigation.links} groups={navigation.groups} />
						</nav>

						{/* Icons */}
						<div className="order-3 col-span-4 md:col-span-3 h-full flex items-center justify-end px-3 md:px-6 space-x-1 sm:space-x-3 md:space-x-5">
							<Suspense>
								<SearchInput />
							</Suspense>
							{AUTH_ENABLED && <AuthButton />}
							<ThemeToggle />
							<Suspense fallback={<CartButtonFallback />}>
								<CartButton />
							</Suspense>
						</div>
					</header>

					{/* Page Content */}
					<main className="flex-1">{children}</main>

					{/* Footer */}
					<Footer />
				</div>
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
			<body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
				{/* DO NOT REMOVE / REORDER: required for GDPR + GTM Consent Mode v2. Must stay at top of <body>. */}
				<Suspense>
					<CookieConsent />
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
