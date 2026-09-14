import { Head, useForm } from "@inertiajs/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Collection = {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	selection_rule: string;
	status: string;
	featured: boolean | number;
	sort_order: number;
	product_ids: number[];
};
const empty = {
	title: "",
	slug: "",
	description: "",
	selection_rule: "manual",
	status: "draft",
	featured: false,
	sort_order: 0,
	product_ids: [] as number[],
};

export default function Collections({
	collections,
	products,
}: {
	collections: Collection[];
	products: { id: number; title: string }[];
}) {
	const [selected, setSelected] = useState<number | null>(null);
	const form = useForm(empty);
	return (
		<div className="space-y-6 p-6">
			<Head title="Collections" />
			<h1 className="text-2xl font-semibold">Collections</h1>
			<p className="text-muted-foreground">
				Choose products for an editorial collection, or use an automatic selection. Only active, populated
				collections appear in the store.
			</p>
			<div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
				<nav aria-label="Collections" className="flex flex-col gap-3">
					<Button
						type="button"
						onClick={() => {
							setSelected(null);
							form.setData(empty);
							form.clearErrors();
						}}
					>
						New collection
					</Button>
					{collections.map((item) => (
						<button
							type="button"
							key={item.id}
							className="border p-3 text-left"
							aria-pressed={selected === item.id}
							onClick={() => {
								setSelected(item.id);
								form.clearErrors();
								form.setData({
									title: item.title,
									slug: item.slug,
									description: item.description ?? "",
									selection_rule: item.selection_rule,
									status: item.status,
									featured: Boolean(item.featured),
									sort_order: item.sort_order,
									product_ids: item.product_ids,
								});
							}}
						>
							{item.title}
							<span className="block text-xs text-muted-foreground">
								{item.status} · {item.selection_rule}
							</span>
						</button>
					))}
				</nav>
				<form
					className="space-y-5"
					onSubmit={(event) => {
						event.preventDefault();
						if (selected) form.put(`/collections/${selected}`);
						else form.post("/collections");
					}}
				>
					<label className="block">
						Title
						<Input required value={form.data.title} onChange={(e) => form.setData("title", e.target.value)} />
					</label>
					<label className="block">
						Slug
						<Input required value={form.data.slug} onChange={(e) => form.setData("slug", e.target.value)} />
					</label>
					<label className="block">
						Description
						<textarea
							className="block w-full border p-3"
							rows={3}
							value={form.data.description}
							onChange={(e) => form.setData("description", e.target.value)}
						/>
					</label>
					<label className="block">
						Product selection
						<select
							className="ml-4 border p-2"
							value={form.data.selection_rule}
							onChange={(e) => form.setData("selection_rule", e.target.value)}
						>
							<option value="manual">Selected designs</option>
							<option value="newest">Newest designs · clothing</option>
							<option value="tees">Graphic tees</option>
						</select>
					</label>
					{form.data.selection_rule === "manual" && (
						<fieldset className="max-h-72 space-y-3 overflow-y-auto border p-4">
							<legend>Designs</legend>
							{products.map((product) => (
								<label key={product.id} className="flex gap-3">
									<input
										type="checkbox"
										checked={form.data.product_ids.includes(product.id)}
										onChange={(e) =>
											form.setData(
												"product_ids",
												e.target.checked
													? [...form.data.product_ids, product.id]
													: form.data.product_ids.filter((id) => id !== product.id),
											)
										}
									/>
									{product.title}
								</label>
							))}
						</fieldset>
					)}
					<label className="block">
						Status
						<select
							className="ml-4 border p-2"
							value={form.data.status}
							onChange={(e) => form.setData("status", e.target.value)}
						>
							<option value="draft">Draft</option>
							<option value="active">Active</option>
						</select>
					</label>
					<label className="flex gap-3">
						<input
							type="checkbox"
							checked={form.data.featured}
							onChange={(e) => form.setData("featured", e.target.checked)}
						/>
						Show on homepage
					</label>
					<label className="block">
						Display order
						<Input
							type="number"
							min={0}
							max={999}
							value={form.data.sort_order}
							onChange={(e) => form.setData("sort_order", Number(e.target.value))}
						/>
					</label>
					{Object.entries(form.errors).map(([field, error]) => (
						<p role="alert" key={field} className="text-destructive">
							{error}
						</p>
					))}
					<Button disabled={form.processing}>Save collection</Button>
				</form>
			</div>
		</div>
	);
}
