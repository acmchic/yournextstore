"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
	const triggers = useRef<Record<string, HTMLAnchorElement | null>>({});
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelScheduledClose = () => {
		if (closeTimer.current !== null) {
			clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
	};

	const scheduleClose = () => {
		cancelScheduledClose();
		closeTimer.current = setTimeout(() => {
			setActive(null);
			closeTimer.current = null;
		}, 150);
	};

	useEffect(() => {
		return () => {
			if (closeTimer.current !== null) clearTimeout(closeTimer.current);
		};
	}, []);

	return (
		<>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button
						type="button"
						aria-label="Open menu"
						className="-order-1 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-secondary lg:hidden"
					>
						<Menu className="h-6 w-6" />
					</button>
				</SheetTrigger>
				<SheetContent side="left" className="gap-0 overflow-y-auto bg-background p-6 text-foreground">
					<SheetTitle className="sr-only">Menu</SheetTitle>
					<div className="mt-6">
						<MobileSearchInput onNavigate={() => setOpen(false)} />
					</div>
					<nav className="mt-4 flex flex-col gap-4">
						{groups.map((group) => (
							<section key={group.href}>
								<StoreLink
									href={group.href}
									onClick={() => setOpen(false)}
									className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.2em]"
								>
									{group.label}
								</StoreLink>
								<div className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
									{group.children.map((child) => (
										<StoreLink
											key={child.href}
											href={child.href}
											onClick={() => setOpen(false)}
											className="cursor-pointer py-1 text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground"
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
								className="cursor-pointer border-b border-transparent px-0 py-3 text-[13px] font-medium uppercase leading-5 tracking-[0.14em] text-foreground transition-colors hover:border-foreground"
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
					onMouseEnter={() => {
						cancelScheduledClose();
						setActive(group.href);
					}}
					onMouseLeave={scheduleClose}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget)) {
							cancelScheduledClose();
							setActive(null);
						}
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							cancelScheduledClose();
							setActive(null);
							triggers.current[group.href]?.focus();
						}
					}}
				>
					<StoreLink
						href={group.href}
						ref={(node) => {
							triggers.current[group.href] = node;
						}}
						aria-expanded={active === group.href}
						aria-controls={`shop-menu-${group.label}`}
						onClick={() => setActive(null)}
						className="flex h-full min-h-11 cursor-pointer items-center whitespace-nowrap border-b-2 border-transparent text-[11px] font-medium uppercase tracking-[0.12em] aria-expanded:border-[#171717] focus-visible:outline-2 focus-visible:outline-offset-4"
					>
						{group.label}
					</StoreLink>
					<div
						id={`shop-menu-${group.label}`}
						hidden={active !== group.href}
						className="absolute inset-x-0 top-[calc(100%-1px)] border-y border-border bg-background text-foreground shadow-[0_16px_24px_-20px_rgba(0,0,0,0.35)]"
					>
						<div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_2fr_1fr] gap-12 px-10 py-12">
							<div>
								<p className="mb-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Shop {group.label}
								</p>
								<StoreLink
									href={group.href}
									onClick={() => setActive(null)}
									className="inline-block cursor-pointer py-3 text-xs uppercase tracking-[0.08em] underline underline-offset-4"
								>
									View all {group.label}
								</StoreLink>
							</div>
							<div className="grid grid-cols-2 content-start gap-x-12 gap-y-1 border-l border-border pl-12">
								{group.children.map((child) => (
									<StoreLink
										key={child.href}
										href={child.href}
										onClick={() => setActive(null)}
										className="block min-h-11 cursor-pointer py-3 text-[11px] uppercase tracking-[0.08em] transition-colors hover:underline hover:underline-offset-4"
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
									className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-[10px] uppercase tracking-widest"
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
					className="hidden cursor-pointer whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] transition-colors hover:text-primary lg:block"
				>
					{link.label}
				</StoreLink>
			))}
		</>
	);
}
