import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import RaceTrophy from "../components/race-trophy";

test("a failed trophy request recovers with a fresh request", async () => {
  const { container } = render(<RaceTrophy />);
  try {
    const first = container.querySelector("img")!;
    assert.equal(first.loading, "eager");
    fireEvent.error(first);
    assert.equal(container.querySelector("img"), null);
    assert.ok(container.querySelector("svg"));

    await waitFor(() => assert.ok(container.querySelector("img")));
    const retried = container.querySelector("img")!;
    assert.notEqual(retried.src, first.src);
    fireEvent.load(retried);
    assert.equal(container.querySelector("img"), retried);
    assert.equal(container.querySelector("svg"), null);
  } finally {
    cleanup();
  }
});

test("repeated trophy failures leave an icon instead of a broken image", async () => {
  const { container } = render(<RaceTrophy />);
  try {
    fireEvent.error(container.querySelector("img")!);
    await waitFor(() => assert.ok(container.querySelector("img")));
    fireEvent.error(container.querySelector("img")!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    assert.equal(container.querySelector("img"), null);
    assert.ok(container.querySelector("svg[aria-hidden='true']"));
  } finally {
    cleanup();
  }
});
