"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Details = {
	catalogName: string;
	description?: string | null;
	material?: string | null;
	materialDetails?: { items?: string[] } | null;
	brand?: string | null;
	productType?: string | null;
	chart?: { unit?: string; note?: string; rows?: string[][] } | null;
	sizes?: string[];
	isApparel: boolean;
	policies: Array<{ label: string; href: string }>;
};

function measurementToNumber(value: string): number | null {
	const parts = value.trim().split(/\s+/);
	const parsed = parts.reduce<number | null>((total, part) => {
		const fraction = part.match(/^(\d+)\/(\d+)$/);
		const number = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(part);
		return total === null || Number.isNaN(number) ? null : total + number;
	}, 0);
	return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function formatMeasurement(value: string): string {
	const inches = measurementToNumber(value);
	return inches === null ? value : `${value}" / ${(inches * 2.54).toFixed(1)} CM`;
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<section className="border-t border-border">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex min-h-14 w-full cursor-pointer items-center justify-between py-4 text-left text-xs font-medium uppercase tracking-[0.1em] transition-opacity hover:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-4"
			>
				{title}
				<ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
			</button>
			{open && <div className="pb-6 text-sm leading-relaxed text-muted-foreground">{children}</div>}
		</section>
	);
}

export function CatalogDetails({ details }: { details: Details }) {
	const [guideOpen, setGuideOpen] = useState(false);

	useEffect(() => {
		const openGuide = () => setGuideOpen(true);
		window.addEventListener("teebravo:size-guide", openGuide);
		return () => window.removeEventListener("teebravo:size-guide", openGuide);
	}, []);

	const rows = details.chart?.rows?.filter((row) => row.length > 0) ?? [];
	const measurementRows = rows
		.slice(1)
		.filter((row) => /^(body length|chest width(?: \(laid flat\))?)$/i.test(row[0]?.trim() ?? ""));
	const tableHeaders = ["Size", ...measurementRows.map((row) => row[0] ?? "Measurement")];
	const tableRows = (rows[0] ?? [])
		.slice(1)
		.map((size, sizeIndex) => [
			size,
			...measurementRows.map((row) => formatMeasurement(row[sizeIndex + 1] ?? "—")),
		]);
	const materialItems = Array.from(
		new Set(
			[details.material, ...(details.materialDetails?.items ?? [])]
				.filter((item): item is string => Boolean(item?.trim()))
				.map((item) => item.trim()),
		),
	);
	return (
		<div className="mt-8 space-y-0">
			<Disclosure title="Product details">
				<div className="space-y-3">
					<p>Catalog: {details.catalogName}</p>
					{details.brand && <p>Brand: {details.brand}</p>}
					{details.productType && <p>Product type: {details.productType.replaceAll("-", " ")}</p>}
					{details.description && <p>{details.description}</p>}
				</div>
			</Disclosure>
			{materialItems.length > 0 && (
				<Disclosure title="Material">
					<ul className="list-disc space-y-2 pl-5">
						{materialItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</Disclosure>
			)}
			{details.isApparel && (
				<Disclosure title="Size & fit">
					<div className="space-y-3">
						{details.sizes && details.sizes.length > 0 && <p>Available sizes: {details.sizes.join(", ")}</p>}
						{details.chart?.unit && <p>Measurements: inches and centimeters.</p>}
						<p>Compare your measurements with the size guide before ordering.</p>
					</div>
				</Disclosure>
			)}
			{details.policies.length > 0 && (
				<Disclosure title="Shipping, returns & refunds">
					<div className="flex flex-col gap-3">
						{details.policies.map((policy) => (
							<a
								key={policy.href}
								href={`/legal${policy.href}`}
								className="min-h-11 inline-flex items-center text-xs uppercase underline underline-offset-4"
							>
								{policy.label}
							</a>
						))}
					</div>
				</Disclosure>
			)}
			<Drawer direction="right" open={guideOpen} onOpenChange={setGuideOpen}>
				<DrawerContent className="bg-white">
					<DrawerHeader className="border-b px-6 py-6 text-left">
						<DrawerTitle className="text-2xl font-semibold uppercase tracking-[0.06em]">
							Size guide
						</DrawerTitle>
						<DrawerDescription className="text-sm">
							{details.catalogName} · {details.chart?.unit ?? "in"}
						</DrawerDescription>
					</DrawerHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
						{details.chart?.note && (
							<p className="mb-5 text-sm leading-relaxed text-muted-foreground">{details.chart.note}</p>
						)}
						{tableRows.length > 0 ? (
							<div className="overflow-hidden rounded-md border border-slate-300 bg-white">
								<Table className="table-fixed text-xs sm:text-sm">
									<TableHeader className="bg-slate-100">
										<TableRow>
											{tableHeaders.map((header) => (
												<TableHead
													key={header}
													className="h-auto whitespace-normal px-3 py-3 font-medium uppercase leading-tight"
												>
													{header}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{tableRows.map((tableRow) => (
											<TableRow key={tableRow[0]}>
												{tableRow.map((value, index) => (
													<TableCell
														key={`${tableRow[0]}-${index}`}
														className="whitespace-normal px-3 py-4 align-top leading-relaxed"
													>
														{value}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								Size information is not available for this catalog yet.
							</p>
						)}
					</div>
					<div className="border-t px-6 py-5">
						<DrawerClose className="flex h-11 w-full items-center justify-center border border-foreground text-xs uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-white">
							Close
						</DrawerClose>
					</div>
				</DrawerContent>
			</Drawer>
		</div>
	);
}
