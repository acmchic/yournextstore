"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const StoreLink = ({
	exactHrefMatch,
	activeClassName,
	className,
	prefetch,
	...props
}: Omit<ComponentPropsWithRef<typeof Link>, "prefetch"> & {
	exactHrefMatch?: boolean;
	activeClassName?: string;
	prefetch?: boolean | "eager";
}) => {
	const strHref = typeof props.href === "string" ? props.href : props.href.href;

	const pathname = usePathname();
	const isActive = strHref && (exactHrefMatch ? pathname === strHref : pathname.startsWith(strHref));

	return (
		<Link {...props} prefetch={prefetch === true} className={cn(className, isActive && activeClassName)} />
	);
};
