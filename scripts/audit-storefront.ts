const base = process.argv[2] ?? "http://localhost:3000";

export {};

const routes = [
	"/",
	"/shop/men",
	"/shop/women",
	"/shop/kids",
	"/shop/accessories",
	"/collection/new-arrivals",
	"/collection/graphic-tees",
];
const extract = (html: string) => ({
	title: html.match(/<title>(.*?)<\/title>/s)?.[1],
	canonical: html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1],
	legacyBrand: /yournextstore|acmchic/i.test(html),
});
const results = await Promise.all(
	routes.map(async (path) => {
		const responses = await Promise.all(
			["Mozilla/5.0", "Googlebot"].map(async (agent) => {
				const response = await fetch(`${base}${path}`, {
					headers: { "User-Agent": agent },
					signal: AbortSignal.timeout(60000),
				});
				return { status: response.status, ...extract(await response.text()) };
			}),
		);
		const [normal, bot] = responses;
		return {
			path,
			...normal,
			pass:
				normal.status === 200 &&
				!normal.legacyBrand &&
				Boolean(normal.canonical && new URL(normal.canonical).origin === "https://teebravo.com") &&
				JSON.stringify(normal) === JSON.stringify(bot),
		};
	}),
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.pass)) process.exitCode = 1;
