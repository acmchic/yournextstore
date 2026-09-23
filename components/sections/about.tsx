import { storefront } from "@/lib/storefront-config";

export function About() {
	return (
		<section id="about" className="grid grid-cols-12 border-b border-border bg-secondary/30">
			<div className="col-span-12 border-b border-border p-7 md:col-span-5 md:border-r md:border-b-0 md:p-12">
				<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
					The standard
				</p>
				<h2 className="mt-5 max-w-sm font-display text-5xl font-black uppercase leading-[0.82] tracking-[-0.06em] sm:text-6xl">
					Printed designs for everyday things.
				</h2>
			</div>
			<div className="col-span-12 p-7 md:col-span-7 md:p-12">
				<div className="grid gap-8 md:grid-cols-3">
					<div>
						<p className="font-mono text-[10px] uppercase tracking-[0.18em]">Edit</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Browse designs by interest or occasion, then choose the product you want.
						</p>
					</div>
					<div>
						<p className="font-mono text-[10px] uppercase tracking-[0.18em]">Fit</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Tees, hoodies, and sweatshirts selected for fit, weight, and print surface.
						</p>
					</div>
					<div>
						<p className="font-mono text-[10px] uppercase tracking-[0.18em]">Style</p>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							Choose your design, then find the silhouette and color that work for you.
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
