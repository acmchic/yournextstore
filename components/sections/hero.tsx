import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import heroImage from "@/public/mockup-samples/black-front.webp";

export function Hero() {
	return (
		<section aria-label="Graphic clothing" className="border-b border-border">
			<div className="relative isolate h-[min(680px,calc(100svh-7rem))] min-h-[560px] overflow-hidden bg-secondary">
				<Image
					src={heroImage}
					alt="Black graphic tee with a colorful front print"
					fill
					priority
					sizes="100vw"
					className="object-cover object-center transition-transform duration-700 hover:scale-[1.015] motion-reduce:transition-none md:object-[center_42%]"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
				<div className="relative mx-auto flex h-full max-w-[1400px] items-end px-5 pb-8 sm:px-8 sm:pb-12 lg:px-10 lg:pb-16">
					<div className="max-w-xl text-white">
						<p className="text-[10px] uppercase tracking-[0.24em] text-white/75">
							TeeBravo / Graphic clothing
						</p>
						<h1 className="mt-4 max-w-lg font-display text-4xl leading-[0.95] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
							Graphic tees for your everyday.
						</h1>
						<p className="mt-5 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
							Start with a design you want to wear. Choose the tee, hoodie or layer that fits your rotation.
						</p>
						<div className="mt-7 flex flex-wrap gap-3">
							<Button
								asChild
								size="lg"
								className="h-11 rounded-none bg-white px-6 text-black hover:bg-white/90"
							>
								<Link href="/shop/unisex?type=t-shirts">Shop graphic tees</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								size="lg"
								className="h-11 rounded-none border-white/70 bg-black/10 px-6 text-white hover:bg-white hover:text-black"
							>
								<Link href="/products">Explore new arrivals</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
