import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreLink } from "@/components/store-link";
import { Button } from "@/components/ui/button";
import { commerce } from "@/lib/commerce";
import { StoreMedia } from "@/lib/store-media";
import everydayWear from "@/public/images/about/everyday-wear.webp";
import materialsAndOptions from "@/public/images/about/materials-and-options.webp";
import studioProcess from "@/public/images/about/studio-process.webp";

const title = "About TeeBravo | Printed Apparel & Accessories";
const description =
	"Get to know TeeBravo, an online store for printed clothing and accessories inspired by hobbies and holidays. Based in Hanoi, serving customers in the US.";

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
							A shirt about your favorite hobby or a gift that reminds you of a friend can say a lot. TeeBravo
							is an online store for printed clothing and accessories, with designs for everyday interests and
							the occasions you look forward to.
						</p>
					</div>
					<p className="max-w-sm text-xs leading-5 text-muted-foreground">
						Printed to order. Available to customers in the United States.
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
							Find something that feels like you.
						</h2>
						<p className="mt-7 text-base leading-7 text-muted-foreground">
							Browse designs around your interests, from pets and hobbies to holidays and family occasions.
							Some designs come on several products, so you can choose a T-shirt, hoodie or accessory from the
							available options. Each product page lists its materials, colors, sizes and price.
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
							We work with production partners to print each item after it is ordered. Please check the
							product details and size guide before buying, since we do not accept returns for a change of
							mind or a size chosen incorrectly. If your item arrives damaged, has a print defect or differs
							from your order, contact us within 30 days of delivery. Our Returns &amp; Refunds policy
							explains how to request a free replacement or refund after we verify the problem.
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
					<Suspense
						fallback={
							<p className="text-sm text-muted-foreground">
								Contact details are available on our contact page.
							</p>
						}
					>
						<BusinessDetails />
					</Suspense>
					<div>
						<p className="max-w-lg text-sm leading-6 text-muted-foreground">
							We are based in Hanoi, Vietnam, and work with production and shipping partners to serve
							customers in the United States. This is our business mailing address, not a retail store or
							returns location. For help with a product or delivery, contact us directly and include your
							order reference if you have one.
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

async function BusinessDetails() {
	const contact = await commerce.legalPageGet("contact");
	const supportEmail = contact?.supportEmail || "help@teebravo.com";
	return (
		<div className="grid gap-8 sm:grid-cols-2">
			<div>
				<p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Business address</p>
				<address className="mt-4 max-w-xs text-sm not-italic leading-6">
					{contact?.businessName || "TeeBravo"}
					<br />
					{contact?.businessAddress}
				</address>
			</div>
			<div>
				<p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Customer support</p>
				<a
					href={`mailto:${supportEmail}`}
					className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
				>
					{supportEmail}
				</a>
			</div>
		</div>
	);
}
