"use client";

import { Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { StoreLink } from "@/components/store-link";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MobileSearchInput } from "./search-input";

export type NavLink = {
	href: string;
	label: string;
};

export type NavGroup = {
	href: string;
	label: string;
	children: NavLink[];
};

export function Navbar({ links, groups = [] }: { links: NavLink[]; groups?: NavGroup[] }) {
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState<string | null>(null);
	const triggers = useRef<Record<string, HTMLButtonElement | null>>({});

	return (
		<>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button
						type="button"
						aria-label="Open menu"
						className="-order-1 rounded-full p-2 transition-colors hover:bg-secondary lg:hidden"
					>
						<Menu className="h-6 w-6" />
					</button>
				</SheetTrigger>
				<SheetContent side="left" className="gap-0 overflow-y-auto bg-[#fafafa] text-[#171717] p-6">
					<SheetTitle className="sr-only">Menu</SheetTitle>
					<div className="mt-6">
						<MobileSearchInput onNavigate={() => setOpen(false)} />
					</div>
					<nav className="mt-4 flex flex-col gap-5">
						{groups.map((group) => (
							<section key={group.href}>
								<StoreLink
									href={group.href}
									onClick={() => setOpen(false)}
									className="text-[11px] font-bold uppercase tracking-[0.18em]"
								>
									{group.label}
								</StoreLink>
								<div className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
									{group.children.map((child) => (
										<StoreLink
											key={child.href}
											href={child.href}
											onClick={() => setOpen(false)}
											className="py-1 text-sm text-muted-foreground hover:text-foreground"
										>
											{child.label}
										</StoreLink>
									))}
								</div>
							</section>
						))}
						{links.map((link) => (
							<StoreLink
								key={link.href}
								prefetch="eager"
								href={link.href}
								onClick={() => setOpen(false)}
								className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
							>
								{link.label}
							</StoreLink>
						))}
					</nav>
				</SheetContent>
			</Sheet>
			{groups.map((group) => (
				<div
					key={group.href}
					className="hidden h-full items-center lg:flex"
					onMouseEnter={() => setActive(group.href)}
					onMouseLeave={() => setActive(null)}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							setActive(null);
							triggers.current[group.href]?.focus();
						}
					}}
				>
					<button
						type="button"
						ref={(node) => {
							triggers.current[group.href] = node;
						}}
						aria-expanded={active === group.href}
						aria-controls={`shop-menu-${group.label}`}
						onClick={() => setActive(group.href)}
						className="h-full min-h-11 whitespace-nowrap border-b-2 border-transparent uppercase aria-expanded:border-[#171717] focus-visible:outline-2 focus-visible:outline-offset-4"
					>
						{group.label}
					</button>
					<div
						id={`shop-menu-${group.label}`}
						hidden={active !== group.href}
						className="absolute inset-x-0 top-full border-y border-[#171717] bg-[#fafafa] text-[#171717] shadow-[0_16px_24px_-20px_rgba(0,0,0,0.35)]"
					>
						<div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_2fr_1fr] gap-12 px-10 py-12">
							<div>
								<p className="mb-6 text-[10px] uppercase tracking-[0.16em] text-[#666]">Shop {group.label}</p>
								<StoreLink
									href={group.href}
									onClick={() => setActive(null)}
									className="inline-block py-3 text-sm uppercase underline underline-offset-4"
								>
									View all {group.label}
								</StoreLink>
							</div>
							<div className="grid grid-cols-2 content-start gap-x-12 gap-y-1 border-l border-[#d4d4d4] pl-12">
								{group.children.map((child) => (
									<StoreLink
										key={child.href}
										href={child.href}
										onClick={() => setActive(null)}
										className="block min-h-11 py-3 text-xs uppercase tracking-wide hover:underline underline-offset-4"
									>
										{child.label}
									</StoreLink>
								))}
							</div>
							<div className="flex justify-end items-start">
								<button
									type="button"
									aria-label="Close menu"
									onClick={() => {
										setActive(null);
										triggers.current[group.href]?.focus();
									}}
									className="flex min-h-11 items-center gap-3 px-3 text-[10px] uppercase tracking-widest"
								>
									Close
									<X size={16} />
								</button>
							</div>
						</div>
					</div>
				</div>
			))}
			{links.map((link) => (
				<StoreLink
					key={link.href}
					prefetch="eager"
					href={link.href}
					className="hidden lg:block hover:text-primary transition-colors uppercase"
				>
					{link.label}
				</StoreLink>
			))}
		</>
	);
}
