import { storefront } from "@/lib/storefront-config";

export function About() {
	return (
		<section id="about" className="grid grid-cols-12 grid-border-b bg-secondary/20">
			<div className="col-span-12 grid-border-r p-8 md:col-span-5 md:p-12">
				<h2 className="max-w-sm text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-5xl">
					Print-on-demand should not look disposable.
				</h2>
			</div>
			<div className="col-span-12 p-8 md:col-span-7 md:p-12">
				<div className="grid gap-8 md:grid-cols-3">
					<div>
						<p className="font-mono text-xs uppercase tracking-[0.16em]">Edit</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Small product runs built from the strongest graphics, not an endless wall of slogans.
						</p>
					</div>
					<div>
						<p className="font-mono text-xs uppercase tracking-[0.16em]">Blank</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Tees, hoodies, and sweatshirts selected for fit, weight, and print surface.
						</p>
					</div>
					<div>
						<p className="font-mono text-xs uppercase tracking-[0.16em]">Proof</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Organic traffic, reviews, and demand signals decide what earns a permanent place.
						</p>
					</div>
				</div>
				<p className="mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
					{storefront.footerStatement}
				</p>
			</div>
		</section>
	);
}
