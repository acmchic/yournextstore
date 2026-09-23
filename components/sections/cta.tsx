import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { storefront } from "@/lib/storefront-config";

export function CTA() {
	return (
		<section className="relative overflow-hidden py-24 sm:py-32">
			<div className="absolute inset-0 bg-secondary" />
			<div
				className="absolute inset-0 opacity-5"
				style={{
					backgroundImage:
						"linear-gradient(rgba(241, 149, 81, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(241, 149, 81, 0.3) 1px, transparent 1px)",
					backgroundSize: "50px 50px",
				}}
			/>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
				<div className="mx-auto max-w-3xl border border-border bg-background p-8 sm:p-12">
					<h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">First drops are live.</h2>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
						{storefront.positioning}, with a focused selection of designs and product options.
					</p>

					<div className="mt-8 flex flex-col gap-4 sm:flex-row">
						<Button
							asChild
							size="lg"
							className="h-14 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary/90"
						>
							<Link href="/products" className="flex items-center gap-2">
								View drops
								<ArrowRight className="h-5 w-5" />
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="h-14 px-10 text-lg border-2 border-border hover:border-primary hover:text-primary"
						>
							<Link href="/contact">Contact Us</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
