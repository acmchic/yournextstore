"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <span className="block size-11" aria-hidden />;
	}
	const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			onClick={() => setTheme(nextTheme)}
			className="inline-flex size-11 items-center justify-center rounded-sm border border-transparent text-current transition-colors hover:border-current hover:bg-foreground/5"
			aria-label={`Switch to ${nextTheme} mode`}
			title={`Switch to ${nextTheme} mode`}
		>
			<Moon className="block size-[18px] dark:hidden" />
			<Sun className="hidden size-[18px] dark:block" />
		</button>
	);
}
