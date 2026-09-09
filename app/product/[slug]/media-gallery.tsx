"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StoreMedia } from "@/lib/store-media";
import { cn, isVideoUrl } from "@/lib/utils";

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
		style: normalized.includes("-women-") ? "women" : normalized.includes("-men-") ? "men" : "flat",
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

export function MediaGallery({ images, productName, variants }: MediaGalleryProps) {
	const searchParams = useSearchParams();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isZoomed, setIsZoomed] = useState(false);

	const selectedColor = searchParams.get("Color") ?? "Black";
	const printParam = searchParams.get("Print");
	const printArea: PrintArea =
		printParam === "chest" || printParam === "back" || printParam === "front-back" ? printParam : "front";
	const displayImages = useMemo(
		() => selectGalleryImages(images, selectedColor, printArea),
		[images, selectedColor, printArea],
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

	// Jump to the selected variant's image when the variant changes (avoids useEffect)
	const searchParamsKey = searchParams.toString();
	const prevSearchParamsKey = useRef(searchParamsKey);
	if (prevSearchParamsKey.current !== searchParamsKey) {
		prevSearchParamsKey.current = searchParamsKey;
		setSelectedIndex(variantImageIndex);
	}
	if (selectedIndex >= displayImages.length && displayImages.length > 0) {
		setSelectedIndex(0);
	}

	const handlePrevious = useCallback(() => {
		setSelectedIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
	}, [displayImages.length]);

	const handleNext = useCallback(() => {
		setSelectedIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
	}, [displayImages.length]);

	// Keyboard navigation: ArrowLeft / ArrowRight (scoped to gallery container)
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (displayImages.length <= 1) return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				handlePrevious();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				handleNext();
			}
		},
		[displayImages.length, handlePrevious, handleNext],
	);

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
		<div
			tabIndex={0}
			onKeyDown={handleKeyDown}
			className="flex flex-col gap-3 outline-none focus-visible:ring-1 focus-visible:ring-ring lg:self-start"
		>
			{/* Mobile: native horizontal swipe with CSS scroll snapping. */}
			<div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
				{displayImages.map((image, index) => (
					<div
						key={image}
						className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-[#f4f4f4]"
					>
						<StoreMedia
							src={image}
							alt={`${productName} - View ${index + 1}`}
							fill
							quality={image.includes("/api/catalog-mockup/") || image.includes("_color-") ? 90 : undefined}
							sizes="(max-width: 768px) 100vw, 60vw"
							className="object-contain"
							priority={index === 0}
						/>
					</div>
				))}
			</div>

			{/* Desktop main image */}
			<div className="group relative hidden h-[min(78vh,900px)] min-h-[520px] overflow-hidden bg-[#f4f4f4]">
				{isVideoUrl(displayImages[selectedIndex] ?? "") ? (
					<video
						className="absolute inset-0 h-full w-full object-contain"
						src={displayImages[selectedIndex]}
						muted
						loop
						autoPlay
						playsInline
						controls
					/>
				) : (
					<StoreMedia
						src={displayImages[selectedIndex]}
						alt={`${productName} - View ${selectedIndex + 1}`}
						fill
						quality={
							displayImages[selectedIndex]?.includes("/api/catalog-mockup/") ||
							displayImages[selectedIndex]?.includes("_color-")
								? 90
								: undefined
						}
						sizes="(max-width: 1024px) 100vw, 50vw"
						className={cn(
							"object-contain transition-transform duration-500 ease-out",
							isZoomed && "scale-150 cursor-zoom-out",
						)}
						onClick={() => setIsZoomed(!isZoomed)}
						priority
					/>
				)}

				{/* Navigation Arrows */}
				{displayImages.length > 1 && (
					<div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
						<Button
							variant="secondary"
							size="icon"
							className="h-10 w-10 border border-foreground/20 bg-background/95 shadow-none hover:bg-background"
							onClick={(e) => {
								e.stopPropagation();
								handlePrevious();
							}}
							aria-label="Previous image"
						>
							<ChevronLeft className="h-5 w-5" />
						</Button>
						<Button
							variant="secondary"
							size="icon"
							className="h-10 w-10 border border-foreground/20 bg-background/95 shadow-none hover:bg-background"
							onClick={(e) => {
								e.stopPropagation();
								handleNext();
							}}
							aria-label="Next image"
						>
							<ChevronRight className="h-5 w-5" />
						</Button>
					</div>
				)}

				{/* Zoom Indicator (hidden for videos) */}
				{!isVideoUrl(displayImages[selectedIndex] ?? "") && (
					<div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
						<div className="flex items-center gap-2 bg-background/90 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] backdrop-blur-sm">
							<ZoomIn className="h-3.5 w-3.5" />
							Click to zoom
						</div>
					</div>
				)}

				{/* Image Counter */}
				{displayImages.length > 1 && (
					<div className="absolute bottom-4 left-4 text-[10px] font-medium tracking-[0.08em]">
						{selectedIndex + 1} / {displayImages.length}
					</div>
				)}
			</div>

			<div className="hidden flex-col gap-4 md:flex">
				{displayImages.map((image, index) => (
					<div
						key={`desktop-${image}-${index}`}
						className="relative aspect-[4/5] w-full overflow-hidden bg-white"
					>
						<StoreMedia
							src={image}
							alt={`${productName} - View ${index + 1}`}
							fill
							quality={image.includes("_color-") ? 90 : undefined}
							sizes="(max-width: 1024px) 100vw, 60vw"
							className="object-contain"
							priority={index === 0}
						/>
					</div>
				))}
			</div>

			{/* Thumbnails */}
			{displayImages.length > 1 && (
				<div className="hidden gap-2 overflow-x-auto pb-1 md:flex [scrollbar-width:thin]">
					{displayImages.map((image, index) => (
						<button
							key={`${image}-${index}`}
							type="button"
							onClick={() => setSelectedIndex(index)}
							className={cn(
								"relative aspect-square w-20 flex-shrink-0 overflow-hidden border transition-opacity duration-200",
								selectedIndex === index
									? "border-foreground opacity-100"
									: "border-transparent opacity-55 hover:opacity-100",
							)}
						>
							{isVideoUrl(image) ? (
								<video
									className="absolute inset-0 h-full w-full object-contain"
									src={image}
									muted
									playsInline
								/>
							) : (
								<StoreMedia
									src={image}
									alt={`${productName} thumbnail ${index + 1}`}
									fill
									sizes="80px"
									className="object-contain"
								/>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
