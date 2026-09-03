import Link from "next/link";
import { storefront } from "@/lib/storefront-config";

export function Hero() {
	return (
		<section className="grid min-h-[360px] grid-cols-12 grid-border-b md:min-h-[430px]">
			<div className="col-span-12 md:col-span-8 grid-border-r flex items-center justify-center p-4 overflow-hidden relative">
				<h2 className="font-display text-[18vw] font-black leading-[0.78] tracking-tighter text-center uppercase select-none transition-transform duration-500 ease-out hover:scale-[1.02] md:text-[9.5rem]">
					{storefront.shortName}
					<br />
					CHIC
				</h2>
			</div>

			<div className="col-span-12 flex flex-col justify-between gap-8 p-8 text-xs leading-relaxed md:col-span-4 md:p-12 md:text-sm">
				<div>
					<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						{storefront.positioning}
					</p>
					<p className="mt-5 max-w-xs text-justify-last-left opacity-85">{storefront.heroStatement}</p>
				</div>
				<Link
					href="/products"
					className="inline-flex w-fit border-b-2 border-foreground pb-1 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:border-primary hover:text-primary"
				>
					Shop drops
				</Link>
			</div>
		</section>
	);
}
