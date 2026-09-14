import { Head, useForm } from "@inertiajs/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Policy = {
	id: number;
	title: string;
	slug: string;
	content: string;
	published: boolean | number;
};

export default function Policies({
	pages,
	variables,
}: {
	pages: Policy[];
	variables: Record<string, string>;
}) {
	const [selected, setSelected] = useState<number | null>(null);
	const form = useForm({
		title: "",
		slug: "",
		content: "",
		published: false,
	});
	const select = (page?: Policy) => {
		setSelected(page?.id ?? null);
		form.clearErrors();
		form.setData({
			title: page?.title ?? "",
			slug: page?.slug ?? "",
			content: page?.content ?? "",
			published: Boolean(page?.published),
		});
	};
	return (
		<div className="space-y-6 p-6">
			<Head title="Policies" />
			<h1 className="text-2xl font-semibold">Policies</h1>
			<p className="text-muted-foreground">
				Create shipping, returns, privacy and terms pages. Publish only verified business conditions. Uncheck
				Published to remove a page from the storefront.
			</p>
			<p className="text-sm">
				Edit dynamic values in{" "}
				<a href="/checkout-settings" className="underline">
					Shipping & business
				</a>
				. Keep the double-brace fields in policy text so rates and terms update automatically.
			</p>
			<div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
				<nav aria-label="Policies" className="flex flex-col gap-3">
					<Button type="button" onClick={() => select()}>
						New policy
					</Button>
					{pages.map((page) => (
						<button
							type="button"
							key={page.id}
							onClick={() => select(page)}
							className="border p-3 text-left"
							aria-pressed={selected === page.id}
						>
							{page.title}
							<span className="text-muted-foreground block text-xs">
								{page.published ? "Published" : "Draft"}
							</span>
						</button>
					))}
				</nav>
				<form
					className="space-y-5"
					onSubmit={(event) => {
						event.preventDefault();
						if (selected) form.put(`/legal/${selected}`);
						else form.post("/legal");
					}}
				>
					<label className="block">
						Title
						<Input
							required
							value={form.data.title}
							onChange={(event) => form.setData("title", event.target.value)}
						/>
					</label>
					<label className="block">
						URL slug
						<Input
							required
							pattern="[a-z0-9]+(-[a-z0-9]+)*"
							placeholder="shipping-policy"
							value={form.data.slug}
							onChange={(event) => form.setData("slug", event.target.value)}
						/>
					</label>
					<label className="block">
						Policy text
						<textarea
							required
							rows={18}
							className="mt-2 block w-full rounded-md border p-3"
							value={form.data.content}
							onChange={(event) => form.setData("content", event.target.value)}
						/>
					</label>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={form.data.published}
							onChange={(event) => form.setData("published", event.target.checked)}
						/>
						Published
					</label>
					{Object.entries(form.errors).map(([field, error]) => (
						<p role="alert" key={field} className="text-destructive">
							{error}
						</p>
					))}
					<Button disabled={form.processing}>Save policy</Button>
					<details className="border-t pt-4">
						<summary>Preview</summary>
						<h2 className="my-4 text-xl">{form.data.title}</h2>
						<div className="whitespace-pre-wrap">
							{form.data.content.replace(
								/\{\{([a-z_]+)\}\}/g,
								(match, key: string) => variables[key] || match,
							)}
						</div>
					</details>
				</form>
			</div>
		</div>
	);
}
