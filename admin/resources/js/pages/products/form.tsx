import { Head, Link, useForm } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function ProductForm({ product, designs, catalogs }: any) {
	const form = useForm({
		title: product?.title ?? "",
		slug: product?.slug ?? "",
		description: product?.description ?? "",
		design_id: product?.design_id ?? "",
		brand: product?.brand ?? "TeeBravo",
		status: product?.status ?? "draft",
		seo_title: product?.seo_title ?? "",
		seo_description: product?.seo_description ?? "",
		catalog_ids: [] as number[],
	});
	const submit = (e: any) => {
		e.preventDefault();
		product ? form.put(`/products/${product.id}`) : form.post("/products");
	};
	return (
		<>
			<Head title={product ? "Edit product" : "New product"} />
			<div className="max-w-3xl space-y-6 p-6">
				<div>
					<h1 className="text-2xl font-semibold">{product ? "Edit product" : "New product"}</h1>
					<p className="text-muted-foreground">Product identity is linked to one immutable design.</p>
				</div>
				<form onSubmit={submit} className="space-y-4 rounded-xl border p-6">
					<Input
						placeholder="Title"
						value={form.data.title}
						onChange={(e) => form.setData("title", e.target.value)}
					/>
					<Input
						placeholder="slug"
						value={form.data.slug}
						onChange={(e) => form.setData("slug", e.target.value)}
					/>
					<textarea
						className="min-h-32 w-full rounded-md border bg-background p-3"
						placeholder="Description"
						value={form.data.description}
						onChange={(e) => form.setData("description", e.target.value)}
					/>
					<div className="grid gap-4 sm:grid-cols-2">
						<select
							className="rounded-md border bg-background p-2"
							value={form.data.design_id}
							onChange={(e) => form.setData("design_id", Number(e.target.value))}
						>
							<option value="">Choose design</option>
							{designs.map((d: any) => (
								<option key={d.id} value={d.id}>
									{d.name} ({d.status})
								</option>
							))}
						</select>
						<select
							className="rounded-md border bg-background p-2"
							value={form.data.status}
							onChange={(e) => form.setData("status", e.target.value)}
						>
							<option value="draft">Draft</option>
							<option value="active">Active</option>
							<option value="archived">Archived</option>
						</select>
					</div>
					{!product && (
						<div>
							<p className="mb-2 text-sm font-medium">Catalogs</p>
							{catalogs.map((c: any) => (
								<label className="mr-4 inline-flex gap-2 text-sm" key={c.id}>
									<input
										type="checkbox"
										onChange={(e) =>
											form.setData(
												"catalog_ids",
												e.target.checked
													? [...form.data.catalog_ids, c.id]
													: form.data.catalog_ids.filter((id) => id !== c.id),
											)
										}
									/>
									{c.name}
								</label>
							))}
						</div>
					)}
					<div className="flex gap-2">
						<Button disabled={form.processing}>Save</Button>
						<Button variant="outline" asChild>
							<Link href="/products">Cancel</Link>
						</Button>
					</div>
				</form>
			</div>
		</>
	);
}
