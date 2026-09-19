"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithRef } from "react";
import { ROUTE_PROGRESS_START_EVENT } from "@/components/route-progress-bar";
import { cn } from "@/lib/utils";

export const StoreLink = ({
	exactHrefMatch,
	activeClassName,
	className,
	prefetch,
	onNavigate,
	...props
}: Omit<ComponentPropsWithRef<typeof Link>, "prefetch"> & {
	exactHrefMatch?: boolean;
	activeClassName?: string;
	prefetch?: boolean | "eager";
}) => {
	const strHref = typeof props.href === "string" ? props.href : props.href.href;

	const pathname = usePathname();
	const isActive = strHref && (exactHrefMatch ? pathname === strHref : pathname.startsWith(strHref));
	const nextPrefetch = prefetch === "eager" ? true : prefetch;

	return (
		<Link
			{...props}
			prefetch={nextPrefetch}
			onNavigate={(event) => {
				let navigationPrevented = false;
				const preventDefault = event.preventDefault;
				event.preventDefault = () => {
					navigationPrevented = true;
					preventDefault();
				};
				onNavigate?.(event);
				if (!navigationPrevented) {
					window.dispatchEvent(new Event(ROUTE_PROGRESS_START_EVENT));
				}
			}}
			className={cn(className, isActive && activeClassName)}
		/>
	);
};
