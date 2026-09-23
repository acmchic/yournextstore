import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://localhost:3100";
const paths = [
	"/about",
	"/contact",
	"/faq",
	"/shipping-policy",
	"/return-policy",
	"/privacy-policy",
	"/terms-of-service",
];
for (const path of paths) {
	const results = await Promise.all(
		["Mozilla/5.0", "Googlebot", "Pinterestbot"].map(async (agent) => {
			const response = await fetch(`${base}${path}`, { headers: { "User-Agent": agent } });
			assert.equal(response.status, 200, `${agent} ${path}`);
			const html = await response.text();
			assert.ok(html.includes(`rel="canonical" href="https://teebravo.com${path}"`), `${path} canonical`);
			assert.ok(!/name="robots" content="[^"]*noindex/.test(html), `${path} indexable`);
			const article = html.match(/<div class="prose[^>]*>(.*?)<\/div>/s)?.[1];
			assert.ok(article && article.length > 200 && !article.includes("{{"), `${path} published HTML`);
			return article;
		}),
	);
	assert.equal(results[0], results[1], `${path} Googlebot content`);
	assert.equal(results[0], results[2], `${path} Pinterestbot content`);
	const old = await fetch(`${base}/legal${path}`, { redirect: "manual" });
	assert.equal(old.status, 308, `${path} legacy redirect`);
	assert.equal(new URL(old.headers.get("location") ?? "", base).pathname, path);
	console.log(`PASS ${path}: HTML, canonical, bots, redirect`);
}
const html = await (await fetch(base)).text();
const footer = html.match(/<footer\b[^>]*>(.*?)<\/footer>/s)?.[1] ?? "";
for (const path of paths) {
	assert.equal(footer.split(`href="${path}"`).length - 1, 1, `${path} appears once in footer`);
}
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
assert.ok(!sitemap.includes("/legal/"));
for (const path of paths) assert.equal(sitemap.split(`<loc>https://teebravo.com${path}</loc>`).length - 1, 1);
console.log("PASS footer and sitemap: no duplicate policy links");
