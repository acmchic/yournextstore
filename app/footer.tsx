import { cacheLife } from "next/cache";
import { StoreLink } from "@/components/store-link";
import { commerce, meGetCached } from "@/lib/commerce";
import { storefront } from "@/lib/storefront-config";

async function FooterBlogLink() {
	"use cache";
	cacheLife("hours");

	const me = await meGetCached().catch(() => null);
	if (!me?.store.settings?.enabledTools?.blog) {
		return null;
	}

	return (
		<li>
			<StoreLink
				prefetch={"eager"}
				href="/blog"
				className="text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				Blog
			</StoreLink>
		</li>
	);
}

async function FooterContactLink() {
	"use cache";
	cacheLife("hours");

	const me = await meGetCached().catch(() => null);
	if (!me?.store.settings?.enabledTools?.contactForm) {
		return null;
	}

	return (
		<li>
			<StoreLink
				prefetch={"eager"}
				href="/contact"
				className="text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				Contact Us
			</StoreLink>
		</li>
	);
}

async function PolicyLinks() {
	const { data } = await commerce.legalPageBrowse().catch(() => ({ data: [] }));
	return data.map((page) => (
		<li key={page.href}>
			<StoreLink
				href={page.href === "/about" ? "/about" : `/legal${page.href}`}
				className="text-xs text-muted-foreground hover:text-foreground"
			>
				{page.label}
			</StoreLink>
		</li>
	));
}

export function Footer() {
	return (
		<section className="grid grid-cols-12 grid-border-b md:border-b-0">
			{/* Left column with description text */}
			<div className="col-span-12 md:col-span-4 grid-border-r p-8 md:p-12 min-h-[200px] flex items-center">
				<p className="text-xs leading-relaxed opacity-70">{storefront.footerStatement}</p>
			</div>

			{/* Middle column with support links */}
			<div className="col-span-12 md:col-span-4 grid-border-r p-8 md:p-12 flex items-center">
				<ul className="space-y-2">
					<li>
						<StoreLink
							prefetch={"eager"}
							href="/about"
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							About Us
						</StoreLink>
					</li>
					<FooterContactLink />
					<li>
						<StoreLink
							prefetch={"eager"}
							href="/faq"
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							FAQ
						</StoreLink>
					</li>
					<FooterBlogLink />
				</ul>
			</div>

			{/* Right empty column */}
			<div className="col-span-12 md:col-span-4 p-8 md:p-12">
				<h2 className="mb-5 text-xs font-semibold uppercase tracking-wide">Store information</h2>
				<ul className="space-y-3">
					<PolicyLinks />
				</ul>
				<p className="mt-6 text-xs text-muted-foreground">United States · USD</p>
			</div>
		</section>
	);
}
