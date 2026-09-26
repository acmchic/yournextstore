"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ConfirmationRefresh({ active }: { active: boolean }) {
	const router = useRouter();

	useEffect(() => {
		if (!active) return;
		let attempts = 0;
		const interval = window.setInterval(() => {
			attempts += 1;
			router.refresh();
			if (attempts >= 6) window.clearInterval(interval);
		}, 5000);
		return () => window.clearInterval(interval);
	}, [active]);

	return null;
}
