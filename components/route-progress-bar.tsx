"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const progressSteps = [
	{ delay: 180, value: 34 },
	{ delay: 650, value: 58 },
	{ delay: 1400, value: 76 },
	{ delay: 2800, value: 88 },
] as const;

export function RouteProgressBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const locationKey = `${pathname}?${searchParams.toString()}`;
	const [progress, setProgress] = useState(0);
	const [visible, setVisible] = useState(false);
	const startedRef = useRef(false);
	const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

	const clearTimers = useCallback(() => {
		timersRef.current.map((timer) => clearTimeout(timer));
		timersRef.current = [];
	}, []);

	const start = useCallback(() => {
		clearTimers();
		startedRef.current = true;
		setProgress(12);
		setVisible(true);

		timersRef.current = [
			...progressSteps.map(({ delay, value }) =>
				setTimeout(() => setProgress((current) => Math.max(current, value)), delay),
			),
			setTimeout(() => {
				startedRef.current = false;
				setProgress(100);
				setTimeout(() => {
					setVisible(false);
					setProgress(0);
				}, 180);
			}, 12000),
		];
	}, [clearTimers]);

	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}

			const target = event.target;
			if (!(target instanceof Element)) return;

			const anchor = target.closest("a[href]");
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target && anchor.target !== "_self") return;
			if (anchor.hasAttribute("download")) return;

			const destination = new URL(anchor.href, window.location.href);
			if (destination.origin !== window.location.origin) return;

			const current = new URL(window.location.href);
			const sameDocument =
				destination.pathname === current.pathname &&
				destination.search === current.search &&
				destination.hash !== current.hash;
			if (sameDocument || destination.href === current.href) return;

			start();
		};

		const handlePopState = () => start();
		document.addEventListener("click", handleClick, true);
		window.addEventListener("popstate", handlePopState);
		return () => {
			document.removeEventListener("click", handleClick, true);
			window.removeEventListener("popstate", handlePopState);
			clearTimers();
		};
	}, [clearTimers, start]);

	useEffect(() => {
		if (!locationKey || !startedRef.current) return;

		clearTimers();
		startedRef.current = false;
		setProgress(100);
		const finishTimer = setTimeout(() => {
			setVisible(false);
			setProgress(0);
		}, 180);

		return () => clearTimeout(finishTimer);
	}, [clearTimers, locationKey]);

	return (
		<div
			className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
			aria-hidden="true"
		>
			<div
				className="h-full origin-left bg-primary shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
				style={{
					opacity: visible ? 1 : 0,
					transform: `scaleX(${progress / 100})`,
				}}
			/>
		</div>
	);
}
