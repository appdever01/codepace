import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import CodePace from "../app/codepace";
import type { RoomSnapshot } from "../lib/room-types";

for (const phase of ["lobby", "finished"] as const) {
  test(`a full ${phase} room keeps all 50 racers accessible in a bounded list`, async () => {
    const originalFetch = globalThis.fetch;
    const now = Date.now();
    const room: RoomSnapshot = {
      code: "ABC234",
      hostId: "player-0",
      round: 1,
      revision: 10,
      passage: "A shared passage for all fifty people in this room.",
      content: { mode: "quotes" },
      duration: 30,
      startAt: phase === "finished" ? now - 31000 : null,
      serverNow: now,
      expiresAt: now + 7200000,
      phase,
      players: Array.from({ length: 50 }, (_, index) => ({
        id: `player-${index}`,
        name: `Racer ${index}`,
        joinedAt: now - 1000,
        seenAt: now,
        round: 1,
        correct: phase === "finished" ? 12 : 0,
        strokes: phase === "finished" ? 12 : 0,
        errors: 0,
        finishedAt: null,
        wpm: phase === "finished" ? 5 : 0,
        accuracy: 100,
      })),
    };
    globalThis.fetch = async () =>
      Response.json({
        room,
        self: {
          typed: phase === "finished" ? room.passage.slice(0, 12) : "",
          strokes: phase === "finished" ? 12 : 0,
          errors: 0,
          seq: 1,
        },
      });
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(
      "codepace:room",
      JSON.stringify({
        code: room.code,
        id: "player-49",
        token: "test-session",
      }),
    );
    try {
      await act(async () => {
        render(<CodePace />);
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      await waitFor(() =>
        assert.ok(
          screen.getByRole("status", { name: "50 of 50 players in room" }),
        ),
      );
      const grid = screen.getByRole("region", { name: "All racers" });
      assert.equal(grid.tabIndex, 0);
      assert.equal(grid.querySelectorAll(".lane").length, 50);
      assert.ok(grid.firstElementChild?.classList.contains("own-lane"));
      if (phase === "finished") {
        const standings = screen.getByRole("region", {
          name: "Room standings",
        });
        assert.equal(standings.tabIndex, 0);
        assert.equal(standings.querySelectorAll(":scope > div").length, 50);
      }
      const styles = ["globals", "immersive", "workspace", "coding", "results"]
        .map((name) =>
          readFileSync(new URL(`../app/${name}.css`, import.meta.url), "utf8"),
        )
        .join("\n");
      for (const width of [320, 760, 1440])
        for (const theme of ["dark", "light"]) {
          const view = new Window({ width, height: 900 });
          view.document.documentElement.dataset.theme = theme;
          view.document.body.innerHTML = document.body.innerHTML;
          const style = view.document.createElement("style");
          style.textContent = styles;
          view.document.head.append(style);
          for (const list of view.document.querySelectorAll(
            ".room-lanes, .room-standings",
          )) {
            const computed = view.getComputedStyle(list);
            assert.equal(computed.overflowY, "auto");
            assert.equal(computed.maxHeight, "min(540px, 560px)");
          }
          assert.equal(
            view.getComputedStyle(
              view.document.querySelector(".room-lanes .own-lane")!,
            ).position,
            "sticky",
          );
          await view.close();
        }
    } finally {
      cleanup();
      globalThis.fetch = originalFetch;
      localStorage.clear();
      sessionStorage.clear();
    }
  });
}
