"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StoreMedia } from "@/lib/store-media";
import { cn } from "@/lib/utils";

type Variant = {
	id: string;
	images: string[];
	combinations: {
		variantValue: {
			value: string;
			variantType: {
				label: string;
			};
		};
	}[];
};

type MediaGalleryProps = {
	images: string[];
	productName: string;
	variants: Variant[];
	avatarImage?: string | null;
};

type PrintArea = "front" | "chest" | "back" | "front-back";

const placementSuffix = {
	front: "-front.webp",
	chest: "-left-chest.webp",
	back: "-back.webp",
} as const;

type GalleryImage = {
	url: string;
	blank: boolean;
	placement: "front" | "chest" | "back";
	style: "flat" | "women" | "men";
};

const styleOrder = { flat: 0, women: 1, men: 2 } as const;

function colorSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function describeGalleryImage(image: string | undefined, color: string): GalleryImage | null {
	if (!image) return null;
	const normalized = image.toLowerCase();
	const legacyMockupUrl = normalized.includes("/api/catalog-mockup/");
	const simpleMockupUrl = /\/[^/]+\/[^/]+_color-[^/?]+\.webp(?:\?|$)/.test(normalized);
	const dynamicParams = /\?/.test(image) ? new URL(image, "http://local").searchParams : null;
	const selectedColorSlug = colorSlug(color);
	const colorPattern = new RegExp(`_color-${selectedColorSlug}(?:\\.webp|[-_])`, "i");
	const dynamicColor = dynamicParams?.get("Color");
	const matchesColor = dynamicColor
		? colorSlug(dynamicColor) === selectedColorSlug
		: colorPattern.test(normalized) || normalized.includes(`-${selectedColorSlug}-`);
	if (!matchesColor) return null;
	const dynamicPlacement = (
		dynamicParams?.get("Placement") ?? dynamicParams?.get("placement")
	)?.toLowerCase();
	const dynamicStyle = dynamicParams?.get("style")?.toLowerCase();
	const placement =
		dynamicPlacement === "back"
			? "back"
			: dynamicPlacement === "front"
				? "front"
				: dynamicPlacement === "chest" || dynamicPlacement === "left-chest"
					? "chest"
					: simpleMockupUrl
						? "front"
						: normalized.endsWith(placementSuffix.chest)
							? "chest"
							: normalized.endsWith(placementSuffix.back)
								? "back"
								: normalized.endsWith(placementSuffix.front)
									? "front"
									: null;
	if (!placement) return null;
	return {
		url: image,
		blank: normalized.includes("/img/blank/") || dynamicParams?.get("blank") === "1",
		placement,
		style:
			dynamicStyle === "women" || normalized.includes("-women-")
				? "women"
				: dynamicStyle === "men" || normalized.includes("-men-")
					? "men"
					: "flat",
	};
}

export function selectGalleryImages(images: string[], color: string, printArea: PrintArea) {
	const described = images
		.map((image) => describeGalleryImage(image, color))
		.filter((image): image is GalleryImage => image !== null);
	const select = (blank: boolean, placement: GalleryImage["placement"]) =>
		described
			.filter((image) => image.blank === blank && image.placement === placement)
			.toSorted((left, right) => styleOrder[left.style] - styleOrder[right.style])
			.map((image) => image.url);

	const selected =
		printArea === "front"
			? [...select(false, "front"), ...select(true, "back")]
			: printArea === "chest"
				? [...select(false, "chest"), ...select(true, "back")]
				: printArea === "back"
					? [...select(true, "front"), ...select(false, "back")]
					: [...select(false, "front"), ...select(false, "back")];
	return [...new Set(selected)];
}

export function MediaGallery({ images, productName, variants, avatarImage }: MediaGalleryProps) {
	const searchParams = useSearchParams();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [mobileCarouselRef, mobileCarouselApi] = useEmblaCarousel({ align: "start", loop: false });

	const selectedColor = searchParams.get("Color") ?? "Black";
	const printParam = searchParams.get("Print");
	const printArea: PrintArea = printParam === "back" || printParam === "front-back" ? printParam : "front";
	const displayImages = useMemo(
		() => selectGalleryImages(images, selectedColor, printArea),
		[images, selectedColor, printArea],
	);
	const mobileImages = useMemo(
		() => [...displayImages, ...(avatarImage ? [avatarImage] : [])],
		[displayImages, avatarImage],
	);
	const variantImageIndex = useMemo(() => {
		const selectedVariant = variants.find(
			(v) =>
				v.combinations.length > 0 &&
				v.combinations.every(
					(c) => searchParams.get(c.variantValue.variantType.label) === c.variantValue.value,
				),
		);

		const firstVariantImage = selectedVariant?.images.find((image) => displayImages.includes(image));
		if (!firstVariantImage) return 0;

		const index = displayImages.indexOf(firstVariantImage);
		return index >= 0 ? index : 0;
	}, [variants, searchParams, displayImages]);

	useEffect(() => {
		setSelectedIndex(variantImageIndex);
		mobileCarouselApi?.reInit();
		mobileCarouselApi?.scrollTo(variantImageIndex, true);
	}, [mobileCarouselApi, variantImageIndex]);

	useEffect(() => {
		if (!mobileCarouselApi) return;
		const updateSelectedIndex = () => setSelectedIndex(mobileCarouselApi.selectedScrollSnap());
		updateSelectedIndex();
		mobileCarouselApi.on("select", updateSelectedIndex);
		mobileCarouselApi.on("reInit", updateSelectedIndex);
		return () => {
			mobileCarouselApi.off("select", updateSelectedIndex);
			mobileCarouselApi.off("reInit", updateSelectedIndex);
		};
	}, [mobileCarouselApi]);

	if (displayImages.length === 0) {
		return (
			<div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
				<div className="flex aspect-[4/5] items-center justify-center bg-[#f4f4f4]">
					<p className="text-muted-foreground">No images available</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 lg:self-start">
			{/* Mobile: Embla keeps touch gestures native while the first image remains the LCP candidate. */}
			<div className="-mx-4 md:hidden">
				<div ref={mobileCarouselRef} className="overflow-hidden bg-white">
					<div className="flex touch-pan-y">
						{mobileImages.map((image, index) => (
							<div key={image} className="min-w-0 shrink-0 grow-0 basis-full">
								<div className="relative aspect-[167/180] w-full overflow-hidden bg-white">
									<StoreMedia
										src={image}
										alt={`${productName} - View ${index + 1}`}
										fill
										quality={
											image.includes("/api/catalog-mockup/") || image.includes("_color-") ? 90 : undefined
										}
										sizes="100vw"
										className="object-contain"
										priority={index === 0}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
				{mobileImages.length > 1 && (
					<div
						className="flex items-center justify-center gap-2 bg-white py-4"
						role="group"
						aria-label="Choose product image"
					>
						{mobileImages.map((image, index) => (
							<button
								key={`dot-${image}`}
								type="button"
								onClick={() => mobileCarouselApi?.scrollTo(index)}
								className={cn(
									"h-1.5 rounded-full transition-[width,background-color]",
									selectedIndex === index ? "w-6 bg-black" : "w-1.5 bg-black/25",
								)}
								aria-label={`Show image ${index + 1}`}
								aria-current={selectedIndex === index ? "true" : undefined}
							/>
						))}
					</div>
				)}
			</div>

			<div className="hidden flex-col gap-4 md:flex">
				{[...displayImages, ...(avatarImage ? [avatarImage] : [])].map((image, index) => (
					<div
						key={`desktop-${image}-${index}`}
						className="relative mx-auto aspect-[4/5] w-full max-w-[720px] overflow-hidden bg-white"
					>
						<StoreMedia
							src={image}
							alt={`${productName} - View ${index + 1}`}
							fill
							quality={image.includes("_color-") ? 90 : undefined}
							sizes="(max-width: 1024px) 100vw, 58vw"
							className="object-contain"
							priority={index === 0}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
