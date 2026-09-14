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

async function FooterCollections() {
	"use cache";
	cacheLife("hours");

	const collections = await commerce.collectionBrowse({ limit: 5 }).catch(() => ({ data: [] }));
	return (
		<FooterColumn title="Collections">
			{collections.data.length > 0 ? (
				collections.data.map((collection) => (
					<FooterLink key={collection.id} href={`/collection/${collection.slug}`}>
						{collection.name}
					</FooterLink>
				))
			) : (
				<FooterLink href="/products">All Products</FooterLink>
			)}
		</FooterColumn>
	);
}

async function FooterLegalPages() {
	"use cache";
	cacheLife("hours");

	const pages = await commerce.legalPageBrowse().catch(() => ({ data: [] }));
	return (
		<FooterColumn title="Legal">
			{pages.data.length > 0 ? (
				pages.data.map((page) => (
					<FooterLink key={page.href} href={`/legal${page.href}`}>
						{page.label}
					</FooterLink>
				))
			) : (
				<>
					<FooterLink href="/legal/terms">Terms of Service</FooterLink>
					<FooterLink href="/legal/privacy">Privacy Policy</FooterLink>
				</>
			)}
		</FooterColumn>
	);
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<h3 className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground">{title}</h3>
			<ul className="mt-6 space-y-3.5">{children}</ul>
		</div>
	);
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<li>
			<StoreLink
				prefetch={"eager"}
				href={href}
				className="text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				{children}
			</StoreLink>
		</li>
	);
}

export function Footer() {
	return (
		<footer className="border-t border-border bg-background">
			<div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
				<div className="border-b border-border py-16 sm:py-20">
					<p className="text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
						Graphic clothing with a point of view
					</p>
					<div className="mt-6 select-none text-center font-display text-[14vw] leading-[0.9] tracking-[0.05em] text-foreground sm:text-[10vw] lg:text-[8vw]">
						{storefront.brandName.toUpperCase()}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-10 py-14 sm:grid-cols-4 lg:grid-cols-5">
					<div className="col-span-2 max-w-xs lg:col-span-2">
						<StoreLink
							prefetch={"eager"}
							href="/"
							className="font-display text-base tracking-[0.3em] text-foreground"
						>
							{storefront.brandName.toUpperCase()}
						</StoreLink>
						<p className="mt-4 text-sm leading-relaxed text-muted-foreground">{storefront.footerStatement}</p>
						<div className="mt-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
							<span>EN / USD</span>
							<span aria-hidden>·</span>
							<span>United States</span>
						</div>
					</div>

					<FooterCollections />

					<FooterColumn title="Support">
						<FooterLink href="/about">About Us</FooterLink>
						<FooterLink href="/faq">FAQ</FooterLink>
						<FooterLink href="/faq#shipping">Shipping</FooterLink>
						<FooterLink href="/faq#returns">Returns</FooterLink>
						<FooterLink href="/faq#care">Garment Care</FooterLink>
						<FooterContactLink />
						<FooterBlogLink />
					</FooterColumn>

					<FooterLegalPages />
				</div>

				<div className="flex flex-col items-center justify-between gap-4 border-t border-border py-8 sm:flex-row">
					<p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:text-left">
						© {new Date().getFullYear()} {storefront.brandName} — All rights reserved
					</p>
					<div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
						<span>Visa</span>
						<span>Mastercard</span>
						<span>Amex</span>
						<span>Apple Pay</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
