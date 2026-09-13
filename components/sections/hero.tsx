import Image from "next/image";
import Link from "next/link";
import menImage from "@/public/mockup-samples/black-front-men.webp";
import womenImage from "@/public/mockup-samples/black-front-women.webp";

export function Hero() {
	return (
		<section aria-label="Graphic clothing" className="border-b border-border">
			<div className="grid grid-cols-2">
				<Link
					href="/shop/women"
					className="group relative block h-[58svh] min-h-[340px] overflow-hidden border-r border-border bg-secondary md:h-[72svh]"
					aria-label="Shop women"
				>
					<Image
						src={womenImage}
						alt="Women's graphic tee styling"
						fill
						priority
						sizes="50vw"
						className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none"
					/>
				</Link>
				<Link
					href="/shop/unisex"
					className="group relative block h-[58svh] min-h-[340px] overflow-hidden bg-secondary md:h-[72svh]"
					aria-label="Shop unisex"
				>
					<Image
						src={menImage}
						alt="Men's graphic tee styling"
						fill
						priority
						sizes="50vw"
						className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none"
					/>
				</Link>
			</div>
			<div className="px-6 py-10 text-center md:py-12">
				<p className="text-[10px] uppercase tracking-[0.2em]">TeeBravo / Graphic clothing</p>
				<h1 className="mt-3 text-2xl font-semibold uppercase tracking-tight md:text-4xl">
					An everyday point of view.
				</h1>
				<div className="mt-6 flex justify-center gap-8 text-xs uppercase">
					<Link href="/shop/women" className="py-2 underline underline-offset-4">
						Shop women
					</Link>
					<Link href="/shop/unisex" className="py-2 underline underline-offset-4">
						Shop unisex
					</Link>
				</div>
			</div>
		</section>
	);
}
