import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { StoreLink } from "@/components/store-link";
import { Button } from "@/components/ui/button";
import { StoreMedia } from "@/lib/store-media";
import everydayWear from "@/public/images/about/everyday-wear.webp";
import materialsAndOptions from "@/public/images/about/materials-and-options.webp";
import studioProcess from "@/public/images/about/studio-process.webp";

const title = "About TeeBravo | Printed Apparel & Accessories";
const description =
	"Learn how TeeBravo offers printed apparel and accessories made after you order. Choose a design, product, color and size, with shipping across the United States.";

export const metadata: Metadata = {
	title: { absolute: title },
	description,
	alternates: { canonical: "/about" },
	openGraph: {
		type: "website",
		title,
		description,
		url: "/about",
		images: [
			{
				url: "/images/about/studio-process.webp",
				alt: "Printed clothing and accessories being arranged on a studio table",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title,
		description,
		images: ["/images/about/studio-process.webp"],
	},
};

const ImagePanel = ({
	src,
	alt,
	priority = false,
	caption,
}: {
	src: typeof studioProcess;
	alt: string;
	priority?: boolean;
	caption: string;
}) => (
	<figure className="relative min-h-[30rem] overflow-hidden bg-secondary sm:min-h-[38rem] lg:min-h-[46rem]">
		<StoreMedia
			src={src}
			alt={alt}
			fill
			priority={priority}
			sizes="(max-width: 1024px) 100vw, 50vw"
			className="object-cover"
		/>
		<figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-20 text-[10px] uppercase tracking-[0.2em] text-white/85 sm:px-10 sm:pb-9">
			{caption}
		</figcaption>
	</figure>
);

export default function AboutPage() {
	return (
		<main className="border-b border-border">
			<section className="grid border-b border-border lg:grid-cols-2" aria-labelledby="about-title">
				<div className="flex min-h-[34rem] flex-col justify-between bg-bone px-6 py-12 dark:bg-background sm:px-10 sm:py-16 lg:min-h-[46rem] lg:border-r lg:border-border lg:px-16 lg:py-20 xl:px-20">
					<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">TeeBravo / About</p>
					<div className="max-w-xl py-14 lg:py-20">
						<h1
							id="about-title"
							className="font-display text-[clamp(3.5rem,8vw,7.5rem)] leading-[0.88] tracking-[-0.055em]"
						>
							About
							<br />
							TeeBravo.
						</h1>
						<p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
							TeeBravo brings printed designs to T-shirts, hoodies, sweatshirts and accessories for customers
							in the United States. Browse by interest or occasion, then choose the product, color and size
							that suit you.
						</p>
					</div>
					<p className="max-w-sm text-xs leading-5 text-muted-foreground">
						Browse by theme, holiday or product.
					</p>
				</div>

				<ImagePanel
					src={everydayWear}
					alt="A person wearing an ivory printed T-shirt at home"
					priority
					caption="Everyday clothing / Printed after you order"
				/>
			</section>

			<section className="grid border-b border-border lg:grid-cols-2" aria-labelledby="choose-design-title">
				<div className="border-b border-border lg:border-r lg:border-b-0">
					<ImagePanel
						src={studioProcess}
						alt="Hands arranging printed T-shirts, a hoodie, a mug and an ornament on a worktable"
						caption="01 / Choose a design"
					/>
				</div>
				<div className="flex items-center px-6 py-16 sm:px-10 sm:py-20 lg:px-16 xl:px-20">
					<div className="max-w-xl">
						<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">01 / How it works</p>
						<h2
							id="choose-design-title"
							className="mt-5 font-display text-4xl leading-[0.98] tracking-[-0.035em] sm:text-6xl"
						>
							Start with the design.
						</h2>
						<p className="mt-7 text-base leading-7 text-muted-foreground">
							One design can appear on more than one kind of product. After you find one you like, choose an
							available garment or accessory. The product page shows the colors, sizes, materials and price
							for that selection.
						</p>
						<Button asChild size="lg" className="mt-9">
							<StoreLink href="/products">
								Browse all designs
								<ArrowRight aria-hidden />
							</StoreLink>
						</Button>
					</div>
				</div>
			</section>

			<section className="grid border-b border-border lg:grid-cols-2" aria-labelledby="made-to-order-title">
				<div className="flex items-center border-b border-border bg-secondary/35 px-6 py-16 sm:px-10 sm:py-20 lg:border-r lg:border-b-0 lg:px-16 xl:px-20">
					<div className="max-w-xl">
						<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
							02 / Made after you order
						</p>
						<h2
							id="made-to-order-title"
							className="mt-5 font-display text-4xl leading-[0.98] tracking-[-0.035em] sm:text-6xl"
						>
							Made after you order.
						</h2>
						<p className="mt-7 text-base leading-7 text-muted-foreground">
							Please review the product details and size guide before checkout. If an item arrives damaged,
							has a print defect or does not match your order, contact us and we will review the issue under
							our Returns &amp; Refunds policy.
						</p>
						<div className="mt-9 flex flex-wrap gap-3">
							<Button asChild variant="outline" size="lg">
								<StoreLink href="/shipping-policy">Shipping details</StoreLink>
							</Button>
							<Button asChild variant="outline" size="lg">
								<StoreLink href="/return-policy">Returns &amp; refunds</StoreLink>
							</Button>
						</div>
					</div>
				</div>
				<ImagePanel
					src={materialsAndOptions}
					alt="Printed garments, fabric color swatches and an acrylic ornament on a studio table"
					caption="02 / Review the product details"
				/>
			</section>

			<section className="grid bg-bone dark:bg-secondary/20 lg:grid-cols-2" aria-labelledby="business-title">
				<div className="border-b border-border px-6 py-16 sm:px-10 sm:py-20 lg:border-r lg:border-b-0 lg:px-16 xl:px-20">
					<p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
						03 / Business information
					</p>
					<h2
						id="business-title"
						className="mt-5 max-w-xl font-display text-4xl leading-[0.98] tracking-[-0.035em] sm:text-6xl"
					>
						Based in Hanoi and serving the United States.
					</h2>
				</div>
				<div className="flex flex-col justify-between gap-14 px-6 py-16 sm:px-10 sm:py-20 lg:px-16 xl:px-20">
					<div className="grid gap-8 sm:grid-cols-2">
						<div>
							<p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Business address</p>
							<address className="mt-4 max-w-xs text-sm not-italic leading-6">
								TeeBravo
								<br />
								54 Lieu Giai, Ba Dinh
								<br />
								Hanoi 100000, Vietnam
							</address>
						</div>
						<div>
							<p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Customer support</p>
							<a
								href="mailto:help@teebravo.com"
								className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
							>
								help@teebravo.com
							</a>
						</div>
					</div>
					<div>
						<p className="max-w-lg text-sm leading-6 text-muted-foreground">
							Questions about a product or order? Send us a message and include the details that will help us
							look into it.
						</p>
						<Button asChild className="mt-7" size="lg">
							<StoreLink href="/contact">
								Contact TeeBravo
								<ArrowRight aria-hidden />
							</StoreLink>
						</Button>
					</div>
				</div>
			</section>
		</main>
	);
}
