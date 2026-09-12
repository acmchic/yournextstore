export type DeliverySettings = {
	enabled: boolean;
	processing_min_business_days: number | null;
	processing_max_business_days: number | null;
	standard_transit_min_business_days: number | null;
	standard_transit_max_business_days: number | null;
	express_transit_min_business_days: number | null;
	express_transit_max_business_days: number | null;
};

function addBusinessDays(start: Date, days: number) {
	const date = new Date(start);
	let remaining = days;
	while (remaining > 0) {
		date.setUTCDate(date.getUTCDate() + 1);
		const weekday = date.getUTCDay();
		if (weekday !== 0 && weekday !== 6) remaining -= 1;
	}
	return date;
}

function usStoreDate(now: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(now);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	return new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

function formatRange(start: Date, end: Date) {
	if (start.getTime() === end.getTime()) return formatDate(start);
	return `${formatDate(start)} – ${formatDate(end)}`;
}

export function deliveryEstimate(settings: DeliverySettings, now = new Date()) {
	const values = [
		settings.processing_min_business_days,
		settings.processing_max_business_days,
		settings.standard_transit_min_business_days,
		settings.standard_transit_max_business_days,
		settings.express_transit_min_business_days,
		settings.express_transit_max_business_days,
	];
	if (!settings.enabled || values.some((value) => value === null)) return null;

	const [processingMin, processingMax, standardMin, standardMax, expressMin, expressMax] = values as number[];
	const placed = usStoreDate(now);
	const shipsMin = addBusinessDays(placed, processingMin);
	const shipsMax = addBusinessDays(placed, processingMax);

	return {
		placed: formatDate(placed),
		ships: formatRange(shipsMin, shipsMax),
		standard: formatRange(addBusinessDays(shipsMin, standardMin), addBusinessDays(shipsMax, standardMax)),
		express: formatRange(addBusinessDays(shipsMin, expressMin), addBusinessDays(shipsMax, expressMax)),
	};
}
