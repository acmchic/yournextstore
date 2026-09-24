import type React from "react";
import { PlusIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ContactInfoProps = {
	className?: string;
	icon: LucideIcon;
	label: string;
	value: string;
	href?: string;
};

type ContactCardProps = React.ComponentProps<"div"> & {
	title?: string;
	description?: string;
	contactInfo?: ContactInfoProps[];
	formSectionClassName?: string;
};

export function ContactCard({
	title = "Contact TeeBravo",
	description = "Questions about a product or order? Send us a message and our support team will follow up by email.",
	contactInfo,
	className,
	formSectionClassName,
	children,
	...props
}: ContactCardProps) {
	return (
		<div
			className={cn("relative grid h-full w-full border border-border bg-card md:grid-cols-2", className)}
			{...props}
		>
			<PlusIcon aria-hidden className="absolute -top-3 -left-3 h-6 w-6 bg-background" />
			<PlusIcon aria-hidden className="absolute -top-3 -right-3 h-6 w-6 bg-background" />
			<PlusIcon aria-hidden className="absolute -bottom-3 -left-3 h-6 w-6 bg-background" />
			<PlusIcon aria-hidden className="absolute -right-3 -bottom-3 h-6 w-6 bg-background" />
			<div className="flex flex-col justify-between">
				<div className="space-y-5 p-6 sm:p-9">
					<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Customer care</p>
					<h1 className="font-display text-4xl leading-[0.98] tracking-[-0.035em] sm:text-5xl">{title}</h1>
					<p className="max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
					<div className="grid gap-3 sm:grid-cols-2">
						{contactInfo?.map((info) => (
							<ContactInfo key={`${info.label}-${info.value}`} {...info} />
						))}
					</div>
				</div>
			</div>
			<div
				className={cn(
					"flex w-full items-center border-t bg-muted/30 p-6 sm:p-9 md:border-t-0 md:border-l",
					formSectionClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

function ContactInfo({ icon: Icon, label, value, href, className }: ContactInfoProps) {
	const content = (
		<>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
				<Icon aria-hidden className="size-5" />
			</span>
			<span className="min-w-0">
				<span className="block text-sm font-medium">{label}</span>
				<span className="block break-all text-xs text-muted-foreground">{value}</span>
			</span>
		</>
	);

	return href ? (
		<a
			className={cn("flex items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
			href={href}
		>
			{content}
		</a>
	) : (
		<div className={cn("flex items-center gap-3 py-2", className)}>
			{content}
		</div>
	);
}
