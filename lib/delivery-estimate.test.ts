import assert from "node:assert/strict";
import { test } from "node:test";
import { type DeliverySettings, deliveryEstimate } from "@/lib/delivery-estimate";

const settings: DeliverySettings = {
	enabled: true,
	processing_min_business_days: 2,
	processing_max_business_days: 4,
	standard_transit_min_business_days: 5,
	standard_transit_max_business_days: 7,
	express_transit_min_business_days: 2,
	express_transit_max_business_days: 3,
};

test("delivery estimate adds processing and transit as business days", () => {
	assert.deepEqual(deliveryEstimate(settings, new Date("2026-09-11T16:00:00Z")), {
		placed: "Sep 11",
		ships: "Sep 15 – Sep 17",
		standard: "Sep 22 – Sep 28",
		express: "Sep 17 – Sep 22",
	});
});

test("delivery estimate stays hidden until the admin enables complete ranges", () => {
	assert.equal(deliveryEstimate({ ...settings, enabled: false }), null);
	assert.equal(deliveryEstimate({ ...settings, standard_transit_max_business_days: null }), null);
});
