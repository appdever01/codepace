import assert from "node:assert/strict";
import { Window } from "happy-dom";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
const canonical = "https://codepace.vercel.app/";
const indexable = process.env.CODEPACE_EXPECT_INDEXABLE !== "false";
const window = new Window();
const parser = new window.DOMParser();
console.log(`Checking SEO at ${origin}`);

async function request(path) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `${path} must be accessible`);
  return response;
}

const home = await request("/");
const document = parser.parseFromString(await home.text(), "text/html");
const meta = (name) =>
  document
    .querySelector(`meta[name="${name}"], meta[property="${name}"]`)
    ?.getAttribute("content");
assert.match(document.title, /code typing practice.*CodePace/i);
assert.ok(document.title.length <= 60, "The search title should fit naturally");
assert.ok(meta("description")?.length >= 120);
assert.ok(meta("description").length <= 165);
assert.equal(document.documentElement.lang, "en");
assert.equal(document.querySelectorAll("h1").length, 1);
assert.match(document.querySelector("h1").textContent, /code typing practice/i);
assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
assert.equal(
  new URL(
    document.querySelector('link[rel="canonical"]').getAttribute("href"),
  ).href,
  canonical,
);
for (const name of ["robots", "googlebot"]) {
  const directives = meta(name)
    ?.split(",")
    .map((value) => value.trim());
  assert.ok(directives?.includes(indexable ? "index" : "noindex"));
}
if (indexable)
  assert.doesNotMatch(home.headers.get("x-robots-tag") || "", /noindex/);
assert.equal(new URL(meta("og:url")).href, canonical);
assert.equal(meta("og:title"), document.title);
assert.equal(meta("twitter:title"), document.title);
assert.equal(meta("twitter:card"), "summary_large_image");
assert.equal(meta("og:image:width"), "1200");
assert.equal(meta("og:image:height"), "630");
const imageUrl = new URL(meta("og:image"));
assert.equal(imageUrl.origin, new URL(canonical).origin);
const image = await request(imageUrl.pathname);
assert.match(image.headers.get("content-type"), /^image\/png/);
const imageBytes = Buffer.from(await image.arrayBuffer());
assert.equal(imageBytes.readUInt32BE(16), 1200);
assert.equal(imageBytes.readUInt32BE(20), 630);

const schemas = [
  ...document.querySelectorAll('script[type="application/ld+json"]'),
].map((script) => JSON.parse(script.textContent));
assert.equal(
  schemas.length,
  1,
  "Structured data must be in the server response",
);
assert.equal(schemas[0]["@context"], "https://schema.org");
const graph = schemas[0]["@graph"];
for (const type of ["WebSite", "WebPage", "WebApplication"]) {
  const entity = graph.find((item) => item["@type"] === type);
  assert.ok(entity, `Missing ${type}`);
  assert.equal(entity.url, canonical);
}
const ids = new Set(graph.map((entity) => entity["@id"]));
const page = graph.find((entity) => entity["@type"] === "WebPage");
assert.ok(ids.has(page.isPartOf["@id"]));
assert.ok(ids.has(page.mainEntity["@id"]));
assert.ok(graph.every((entity) => !entity.aggregateRating && !entity.review));

const robotsResponse = await request("/robots.txt");
assert.match(robotsResponse.headers.get("content-type"), /^text\/plain/);
const robots = await robotsResponse.text();
assert.match(robots, /User-Agent: \*/i);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Disallow: \/api\/$/m);
assert.doesNotMatch(robots, /^Disallow: \/$/m);
assert.match(
  robots,
  /^Sitemap: https:\/\/codepace\.vercel\.app\/sitemap\.xml$/m,
);

const sitemapResponse = await request("/sitemap.xml");
assert.match(sitemapResponse.headers.get("content-type"), /xml/);
const sitemap = parser.parseFromString(
  await sitemapResponse.text(),
  "application/xml",
);
assert.deepEqual(
  [...sitemap.querySelectorAll("loc")].map((node) => node.textContent),
  [canonical],
);
assert.equal(sitemap.querySelectorAll("lastmod").length, 0);

const llmsResponse = await request("/llms.txt");
assert.match(llmsResponse.headers.get("content-type"), /^text\/plain/);
const llms = await llmsResponse.text();
assert.match(llms, /^# CodePace\n\n> /);
assert.ok(llms.includes(canonical));
assert.match(llms, /not executed or graded/);
assert.equal(
  document.querySelector('link[rel="describedby"]').getAttribute("href"),
  "/llms.txt",
);
for (const [, target] of llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
  const url = new URL(target);
  assert.equal(url.origin, new URL(canonical).origin);
  await request(url.pathname);
}
const singular = await fetch(new URL("/llm.txt", origin), {
  redirect: "manual",
});
assert.equal(singular.status, 308);
assert.equal(
  new URL(singular.headers.get("location"), origin).pathname,
  "/llms.txt",
);

const invitation = await request("/?room=SEO234&utm_source=seo-check");
const invitationDocument = parser.parseFromString(
  await invitation.text(),
  "text/html",
);
assert.equal(
  new URL(
    invitationDocument
      .querySelector('link[rel="canonical"]')
      .getAttribute("href"),
  ).href,
  canonical,
);
const api = await fetch(new URL("/api/rooms", origin));
assert.equal(api.status, 405);
assert.match(api.headers.get("x-robots-tag"), /noindex/);

const missing = await fetch(new URL("/seo-nonexistent-page", origin));
assert.equal(missing.status, 404, "Unknown URLs must not become soft 404s");
const missingDocument = parser.parseFromString(
  await missing.text(),
  "text/html",
);
assert.match(
  missingDocument.querySelector('meta[name="robots"]').content,
  /noindex/,
);

console.log(
  "SEO checks passed: server-rendered metadata and heading, canonical URLs, JSON-LD, share image, robots, sitemap, LLM discovery, API exclusion and real 404s.",
);
window.close();
