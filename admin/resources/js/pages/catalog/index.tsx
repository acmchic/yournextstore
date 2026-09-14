import { Head, Link } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function Catalog({ catalogs, filters }: any) {
	return (
		<>
			<Head title="Catalog" />
			<div className="space-y-6 p-6">
				<div className="flex items-start justify-between gap-6">
					<div>
						<h1 className="text-2xl font-semibold">Catalog</h1>
						<p className="text-muted-foreground">Manage provider products, variants and stock defaults.</p>
					</div>
					<Button asChild>
						<Link href="/catalog/create">New catalog</Link>
					</Button>
				</div>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{["all", "unisex", "women", "kids", "accessories", "home-living"].map((category) => (
						<Link
							key={category}
							href={category === "all" ? "/catalog" : `/catalog?category=${category}`}
							className="rounded-xl border p-4 text-sm font-medium capitalize hover:bg-muted/40"
						>
							{category === "all" ? "All catalogs" : category.replace("-", " ")}
						</Link>
					))}
				</div>
				<form className="flex gap-2">
					<Input name="q" defaultValue={filters.q} placeholder="Search catalog" />
					<Button variant="outline">Filter</Button>
				</form>
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{catalogs.data.map((c: any) => (
						<Link
							key={c.id}
							href={`/catalog/${c.id}/edit`}
							className="rounded-xl border p-4 transition hover:bg-muted/40"
						>
							<img src={c.thumbnail_url} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
							<h2 className="font-medium">{c.name}</h2>
						</Link>
					))}
				</div>
			</div>
		</>
	);
}
