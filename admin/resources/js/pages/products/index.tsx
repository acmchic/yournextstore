import { Head, Link, router } from "@inertiajs/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ImportFolder = {
	path: string;
	label: string;
	count: number;
};

type ProductRow = {
	id: number;
	title: string;
	slug: string;
	design_name: string;
	status: string;
	updated_at: string;
	design_image_url: string;
	available_catalogs: CatalogOption[];
};

type CatalogOption = { slug: string; name: string };

type ProductPaginator = {
	data: ProductRow[];
};

export default function Products({
	products,
	filters,
	importFolders,
}: {
	products: ProductPaginator;
	filters: { q: string; status: string };
	importFolders: ImportFolder[];
}) {
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [folder, setFolder] = useState(importFolders[0]?.path ?? "");
	const [isImporting, setIsImporting] = useState(false);
	const [importError, setImportError] = useState("");

	const importFolder = () => {
		if (folder === "" || isImporting) return;

		setIsImporting(true);
		setImportError("");
		router.post(
			"/products/import",
			{ folder },
			{
				onSuccess: () => setIsImportOpen(false),
				onError: (errors) =>
					setImportError(errors.import ?? errors.folder ?? "Unable to import this folder."),
				onFinish: () => setIsImporting(false),
			},
		);
	};

	return (
		<>
			<Head title="Products" />
			<div className="space-y-6 p-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Products</h1>
						<p className="text-muted-foreground">Manage products published on Teeravo.</p>
					</div>
					<Button asChild>
						<Link href="/products/create">New product</Link>
					</Button>
					<Dialog
						open={isImportOpen}
						onOpenChange={(open) => {
							setIsImportOpen(open);
							if (!open) setImportError("");
						}}
					>
						<DialogTrigger asChild>
							<Button type="button" variant="outline" disabled={importFolders.length === 0}>
								Import images
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Import product images</DialogTitle>
								<DialogDescription>
									Choose a folder under <code>api/public/design</code>. Every supported image in the folder
									will be imported as a product design.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-5">
								<div className="grid gap-2">
									<label htmlFor="import-folder" className="text-sm font-medium">
										Image folder
									</label>
									<select
										id="import-folder"
										name="folder"
										value={folder}
										onChange={(event) => setFolder(event.target.value)}
										className="h-10 rounded-md border bg-background px-3 text-sm"
									>
										{importFolders.map((importFolder) => (
											<option key={importFolder.path} value={importFolder.path}>
												{importFolder.label} ({importFolder.count} images)
											</option>
										))}
									</select>
								</div>
								{importError && <p className="text-sm text-destructive">{importError}</p>}
								<DialogFooter>
									<Button type="button" onClick={importFolder} disabled={folder === "" || isImporting}>
										{isImporting ? "Importing images…" : "Import selected folder"}
									</Button>
								</DialogFooter>
							</div>
						</DialogContent>
					</Dialog>
				</div>
				<form className="flex gap-2">
					<Input name="q" defaultValue={filters.q} placeholder="Search title or slug" />
					<select
						name="status"
						defaultValue={filters.status}
						className="rounded-md border bg-background px-3"
					>
						<option value="">All statuses</option>
						<option value="active">Active</option>
						<option value="draft">Draft</option>
						<option value="archived">Archived</option>
					</select>
					<Button variant="outline">Filter</Button>
				</form>
				<div className="overflow-hidden rounded-xl border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr>
								<th className="p-3 text-left">Product</th>
								<th className="p-3 text-left">Design</th>
								<th className="p-3 text-left">Status</th>
								<th className="p-3 text-left">Preview</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{products.data.map((p) => (
								<tr className="border-t" key={p.id}>
									<td className="p-3">
										<div className="font-medium">{p.title}</div>
										<div className="text-muted-foreground">/{p.slug}</div>
									</td>
									<td className="p-3">
										<div className="flex items-center gap-3">
											<img
												src={p.design_image_url}
												alt={`Design artwork for ${p.title}`}
												className="size-11 rounded-sm border border-border/70 object-cover"
											/>
											<span className="max-w-40 truncate text-muted-foreground">{p.design_name}</span>
										</div>
									</td>
									<td className="p-3 capitalize">{p.status}</td>
									<td className="p-3">
										<select
											aria-label={`Preview ${p.title} in a catalog`}
											defaultValue=""
											onChange={(event) => {
												if (event.target.value) {
													window.open(
														`http://localhost:3000/product/${p.slug}/${event.target.value}`,
														"_blank",
														"noopener,noreferrer",
													);
													event.target.value = "";
												}
											}}
											className="h-9 max-w-52 rounded-md border bg-background px-2 text-sm"
										>
											<option value="">Select catalog</option>
											{p.available_catalogs.map((catalog) => (
												<option key={catalog.slug} value={catalog.slug}>
													{catalog.name}
												</option>
											))}
										</select>
									</td>
									<td className="p-3 text-right">
										<Button variant="ghost" asChild>
											<Link href={`/products/${p.id}/edit`}>Edit</Link>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
