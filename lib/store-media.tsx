"use client";

import Image, { getImageProps } from "next/image";
import { type ComponentProps, useEffect, useState } from "react";
import { isVideoUrl } from "@/lib/utils";

type ImageProps = ComponentProps<typeof Image>;

const StoreImageWithPolling = (props: ImageProps) => {
	const { props: resolvedProps } = getImageProps(props as Parameters<typeof getImageProps>[0]);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

	const src = resolvedProps.src;

	useEffect(() => {
		setStatus("loading");
		let cancelled = false;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let attempt = 0;
		const maxAttempts = 12;

		const probe = () => {
			attempt += 1;
			const img = new window.Image();
			img.onload = () => {
				if (!cancelled) setStatus("ready");
			};
			img.onerror = () => {
				if (cancelled) return;
				if (attempt >= maxAttempts) {
					setStatus("error");
					return;
				}
				retryTimer = setTimeout(probe, 1000);
			};
			img.src = src;
		};

		probe();

		return () => {
			cancelled = true;
			if (retryTimer) clearTimeout(retryTimer);
		};
	}, [src]);

	if (status === "loading") {
		const style: React.CSSProperties = props.fill
			? { position: "absolute", inset: 0, width: "100%", height: "100%" }
			: { width: resolvedProps.width, height: resolvedProps.height };

		return <div className={`store-image-shimmer ${props.className ?? ""}`} style={style} />;
	}

	if (status === "error") {
		const style: React.CSSProperties = props.fill
			? { position: "absolute", inset: 0, width: "100%", height: "100%" }
			: { width: resolvedProps.width, height: resolvedProps.height };

		return (
			<div
				className={`flex items-center justify-center bg-muted ${props.className ?? ""}`}
				style={style}
				role="img"
				aria-label={`${props.alt || "Product image"} is temporarily unavailable`}
			>
				<span className="px-6 text-center text-xs text-muted-foreground">Image temporarily unavailable</span>
			</div>
		);
	}

	return <Image {...props} />;
};

const StoreImage = process.env.NODE_ENV === "development" ? StoreImageWithPolling : Image;

type StoreMediaProps = ImageProps & {
	autoPlay?: boolean;
	controls?: boolean;
};

/** Renders a <video> for video URLs, otherwise falls back to the Image component. */
export const StoreMedia = ({ autoPlay = true, controls = false, ...props }: StoreMediaProps) => {
	const src = typeof props.src === "string" ? props.src : "";
	if (isVideoUrl(src)) {
		return (
			<video
				className={typeof props.className === "string" ? props.className : undefined}
				style={
					props.fill
						? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
						: undefined
				}
				src={src}
				muted
				loop
				autoPlay={autoPlay}
				playsInline
				controls={controls}
			/>
		);
	}
	return <StoreImage {...props} />;
};
