import { getImageProps } from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import desktopImage from "@/public/images/home/wear-your-mood-desktop.png";

export function Hero() {
	const common = {
		alt: "TeeBravo style inspiration: a man in a black OFFLINE tee and a woman in an ivory SLOW MORNINGS tee",
		quality: 90,
		loading: "eager" as const,
		fetchPriority: "high" as const,
	};
	const { props: desktop } = getImageProps({ ...common, src: desktopImage, sizes: "72vw" });
	const { props: mobile } = getImageProps({ ...common, src: desktopImage, sizes: "150vw" });

	return (
		<section
			aria-labelledby="home-hero-title"
			className="relative isolate overflow-hidden border-b border-border bg-bone dark:bg-background"
		>
			<picture className="block aspect-square sm:aspect-[3/2] w-full overflow-hidden lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[72%]">
				<source
					media="(min-width: 1024px)"
					srcSet={desktop.srcSet}
					sizes={desktop.sizes}
					width={desktop.width}
					height={desktop.height}
				/>
				{/* getImageProps provides Next.js optimization for the art-directed picture. */}
				<img {...mobile} alt={common.alt} className="h-full w-full object-cover object-right-top" />
			</picture>
			<div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[48%] bg-gradient-to-r from-bone from-65% to-transparent dark:from-background lg:block" />
			<div className="relative mx-auto flex max-w-[1600px] items-center px-6 py-9 sm:px-10 lg:min-h-[max(560px,min(680px,48vw))] lg:py-16 lg:px-16 xl:px-20">
				<div className="lg:w-[43%]">
					<p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground sm:text-xs">
						TeeBravo / The everyday edit
					</p>
					<h1
						id="home-hero-title"
						className="mt-4 font-display text-[clamp(2.75rem,5.3vw,5.5rem)] leading-[1.04] tracking-[-0.04em]"
					>
						Wear your
						<br />
						own mood.
					</h1>
					<p className="mt-5 max-w-[19rem] text-sm leading-relaxed text-muted-foreground lg:text-base">
						A little expression. An everyday essential. Find the print that feels like you.
					</p>
					<div className="mt-7 flex flex-wrap gap-3 lg:mt-9">
						<Button asChild size="lg">
							<Link href="/shop/unisex?type=t-shirts">Find your tee</Link>
						</Button>
						<Button asChild variant="outline" size="lg">
							<Link href="/shop/women">Shop women</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
