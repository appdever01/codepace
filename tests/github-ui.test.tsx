import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import CodePace from "../app/codepace";
import GitHubStar from "../components/github-star";
import { GET } from "../app/api/github/route";

test("the header links to CodePace and displays its fetched GitHub star count", async () => {
  const originalFetch = globalThis.fetch;
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = async (input) => {
    assert.equal(input, "/api/github");
    return Response.json({ stars: 1234 });
  };
  try {
    await act(async () => {
      render(<CodePace />);
    });
    const link = screen.getByRole("link", {
      name: /Star CodePace on GitHub.*1,234 GitHub stars/,
    });
    assert.equal(
      link.getAttribute("href"),
      "https://github.com/appdever01/codepace",
    );
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener noreferrer");
    assert.ok(link.closest(".header-tools"));
    assert.match(link.textContent!, /Star on GitHub.*1,234/);
    link.focus();
    assert.equal(document.activeElement, link);
    assert.ok(
      screen.getByRole("button", { name: "Open profile and settings" }),
    );
  } finally {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    globalThis.fetch = originalFetch;
  }
});

test("zero stars remains zero and an unavailable count keeps the star action usable", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const stars of [0, null, -1, 1.5, "10"]) {
      globalThis.fetch = async () => Response.json({ stars });
      await act(async () => {
        render(<GitHubStar />);
      });
      const link = screen.getByRole("link");
      if (stars === 0) {
        assert.match(link.getAttribute("aria-label")!, /0 GitHub stars/);
        assert.match(link.textContent!, /0$/);
      } else {
        assert.match(
          link.getAttribute("aria-label")!,
          /star count unavailable/,
        );
        assert.match(link.textContent!, /—$/);
      }
      assert.equal(
        link.getAttribute("href"),
        "https://github.com/appdever01/codepace",
      );
      cleanup();
    }
    globalThis.fetch = async () => {
      throw new Error("Offline");
    };
    render(<GitHubStar />);
    await waitFor(() => {
      assert.match(
        screen.getByRole("link").getAttribute("aria-label")!,
        /star count unavailable/,
      );
    });
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("the star API reads the public repository and caches a valid count including zero", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const stars of [0, 10]) {
      globalThis.fetch = async (input, init) => {
        assert.equal(input, "https://api.github.com/repos/appdever01/codepace");
        assert.equal(init?.next?.revalidate, 300);
        assert.ok(init?.signal);
        return Response.json({ stargazers_count: stars });
      };
      const response = await GET();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { stars });
      assert.match(response.headers.get("Cache-Control")!, /s-maxage=300/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GitHub errors and malformed counts never become a cached zero", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const response of [
      new Response(null, { status: 403 }),
      new Response(null, { status: 500 }),
      new Response("invalid JSON"),
      ...[null, {}, { stargazers_count: -1 }, { stargazers_count: "10" }].map(
        (data) => Response.json(data),
      ),
    ]) {
      globalThis.fetch = async () => response;
      const result = await GET();
      assert.equal(result.status, 502);
      assert.deepEqual(await result.json(), { stars: null });
      assert.equal(result.headers.get("Cache-Control"), "no-store");
    }
    globalThis.fetch = async () => {
      throw new Error("Timed out");
    };
    assert.equal((await GET()).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
