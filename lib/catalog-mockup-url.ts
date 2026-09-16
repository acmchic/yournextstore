export type CatalogMockupImage = {
	blank: boolean;
	color: string;
	placement: "front" | "chest" | "back";
	style: "flat" | "men" | "women";
};

const newMockupPath = /^\/[^/]+\/[^/]+\/([^/.?]+)(?:\/([^/.?]+))?\.webp$/i;
const legacyMockupPath = /^\/[^/]+\/[^/]+_color-([^/.?]+)\.webp$/i;
const placements = new Set(["front", "chest", "back"]);
const styles = new Set(["flat", "men", "women"]);

function parseView(view: string | undefined): Omit<CatalogMockupImage, "color"> | null {
	if (!view) return { blank: false, placement: "front", style: "flat" };
	const [kind, placement = "front", ...rest] = view.toLowerCase().split("-");
	if (rest.length > 0 || !kind) return null;
	if (kind === "blank") {
		return placements.has(placement)
			? { blank: true, placement: placement as CatalogMockupImage["placement"], style: "flat" }
			: null;
	}
	if (placements.has(kind)) {
		return placement === "front"
			? { blank: false, placement: kind as CatalogMockupImage["placement"], style: "flat" }
			: null;
	}
	if (!styles.has(kind) || !placements.has(placement)) return null;
	return {
		blank: false,
		placement: placement as CatalogMockupImage["placement"],
		style: kind as CatalogMockupImage["style"],
	};
}

export function parseCatalogMockupUrl(value: string): CatalogMockupImage | null {
	const url = new URL(value, "http://local");
	if (url.pathname.startsWith("/img/")) return null;
	const legacyMatch = url.pathname.match(legacyMockupPath);
	if (legacyMatch) {
		const requestedPlacement = (
			url.searchParams.get("Placement") ??
			url.searchParams.get("placement") ??
			"front"
		).toLowerCase();
		const placement = requestedPlacement === "left-chest" ? "chest" : requestedPlacement;
		const style = (url.searchParams.get("style") ?? "flat").toLowerCase();
		if (!placements.has(placement) || !styles.has(style)) return null;
		return {
			blank: url.searchParams.get("blank") === "1",
			color: legacyMatch[1] ?? "",
			placement: placement as CatalogMockupImage["placement"],
			style: style as CatalogMockupImage["style"],
		};
	}

	const match = url.pathname.match(newMockupPath);
	if (!match) return null;
	const color = match[1];
	const view = parseView(match[2]);
	return color && view ? { ...view, color } : null;
}

export function isCatalogMockupUrl(value: string): boolean {
	return parseCatalogMockupUrl(value) !== null;
}
