import test from "node:test";
import assert from "node:assert/strict";
import { createSiteMetadata } from "../lib/seo.ts";

test("production stays indexable while Vercel previews do not enter search results", () => {
  for (const environment of ["production", "preview", "development", ""]) {
    const metadata = createSiteMetadata(environment);
    assert.equal(typeof metadata.robots, "object");
    const robots = metadata.robots as {
      index: boolean;
      follow: boolean;
      googleBot: { index: boolean };
    };
    const indexable = environment === "production" || environment === "";
    assert.equal(robots.index, indexable);
    assert.equal(robots.googleBot.index, indexable);
    assert.equal(robots.follow, true);
    assert.equal(
      new URL(metadata.metadataBase!.toString()).origin,
      "https://codepace.vercel.app",
    );
    assert.equal(metadata.alternates?.canonical, "/");
  }
});
