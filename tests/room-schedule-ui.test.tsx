import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import RoomSchedule from "../components/room-schedule";
import { localDateTime } from "../lib/room-schedule";

test("the host schedules a local time, keeps a rejected draft and can change or cancel a saved schedule", async () => {
  const now = Date.now();
  let received = 0;
  let accepted = false;
  let cancelled = false;
  const props = {
    scheduledAt: null as number | null,
    serverNow: now,
    host: true,
    disabled: false,
    onSchedule: async (timestamp: number) => {
      received = timestamp;
      return accepted;
    },
    onCancel: () => {
      cancelled = true;
    },
  };
  try {
    const view = render(<RoomSchedule {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Schedule start" }));
    const input = screen.getByLabelText(/^Start time/) as HTMLInputElement;
    const value = localDateTime(now + 3600000);
    fireEvent.change(input, { target: { value } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Schedule race" }));
    });
    assert.equal(localDateTime(received), value);
    assert.equal(
      (screen.getByLabelText(/^Start time/) as HTMLInputElement).value,
      value,
    );
    accepted = true;
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Schedule race" }));
    });
    assert.equal(screen.queryByRole("form", { name: "Schedule race" }), null);
    view.rerender(<RoomSchedule {...props} scheduledAt={received} />);
    assert.ok(screen.getByRole("status").textContent?.includes("Starts"));
    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    assert.equal(
      (screen.getByLabelText(/^Start time/) as HTMLInputElement).value,
      value,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    assert.equal(
      Boolean(screen.queryByRole("button", { name: "Cancel schedule" })),
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel schedule" }));
    assert.equal(cancelled, true);
  } finally {
    cleanup();
  }
});

test("guests see the shared time and waiting state without host controls", () => {
  const now = Date.now();
  try {
    const view = render(
      <RoomSchedule
        scheduledAt={now + 3600000}
        serverNow={now}
        host={false}
        disabled={false}
        onSchedule={async () => false}
        onCancel={() => {}}
      />,
    );
    assert.equal(screen.queryByRole("button"), null);
    assert.ok(screen.getByRole("status").textContent?.includes("Starts"));
    assert.equal(Boolean(screen.queryByText(/Starts automatically/)), false);
    assert.equal(
      document.querySelector("time")?.dateTime,
      new Date(now + 3600000).toISOString(),
    );
    view.rerender(
      <RoomSchedule
        scheduledAt={now - 1000}
        serverNow={now}
        host={false}
        disabled={false}
        onSchedule={async () => false}
        onCancel={() => {}}
      />,
    );
    assert.ok(screen.getByText("Waiting for 2 players"));
  } finally {
    cleanup();
  }
});

test("the real room saves its schedule across reloads and starts typing without a Start click", async () => {
  const { default: CodePace } = await import("../app/codepace");
  const { waitFor } = await import("@testing-library/react");
  const nativeFetch = globalThis.fetch;
  const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
  const sessions: { code: string; id: string; token: string }[] = [];
  const actions: string[] = [];
  const progressSequences: number[] = [];
  const request = async (path: string, data?: unknown, token?: string) => {
    const response = await nativeFetch(origin + path, {
      method: data ? "POST" : "GET",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    assert.ok(response.ok, result.error);
    if (result.session) sessions.push(result.session);
    return result;
  };
  globalThis.fetch = (input, init) => {
    if (typeof init?.body === "string") {
      const payload = JSON.parse(init.body);
      actions.push(payload.action);
      if (payload.action === "sync") progressSequences.push(payload.seq);
    }
    return nativeFetch(
      typeof input === "string" ? new URL(input, origin) : input,
      init,
    );
  };
  localStorage.clear();
  sessionStorage.clear();
  try {
    const created = await request("/api/rooms", {
      name: "Schedule UI host",
      duration: 15,
      content: { mode: "words" },
    });
    const host = created.session;
    const path = `/api/rooms/${host.code}`;
    await request(path, { action: "join", name: "Schedule UI guest" });
    sessionStorage.setItem("codepace:room", JSON.stringify(host));
    render(<CodePace />);
    await waitFor(() =>
      assert.ok(screen.getByRole("button", { name: "Schedule start" })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Schedule start" }));
    const value = localDateTime(Date.now() + 120000);
    fireEvent.change(screen.getByLabelText(/^Start time/), {
      target: { value },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Schedule race" }));
    await waitFor(() =>
      assert.ok(screen.getByRole("button", { name: "Change time" })),
    );
    assert.equal(
      localDateTime(
        (await request(path, undefined, host.token)).room.scheduledAt,
      ),
      value,
    );
    cleanup();
    render(<CodePace />);
    await waitFor(() =>
      assert.ok(screen.getByRole("button", { name: "Change time" })),
    );
    assert.ok(screen.getByRole("button", { name: "Start now" }));
    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel schedule" }));
    await waitFor(() =>
      assert.ok(screen.getByRole("button", { name: "Schedule start" })),
    );
    await request(
      path,
      { action: "schedule", round: 1, scheduledAt: Date.now() + 12000 },
      host.token,
    );
    await waitFor(
      () =>
        assert.equal(
          (
            screen.getByRole("textbox", {
              name: /^Type this passage:/,
            }) as HTMLTextAreaElement
          ).disabled,
          false,
        ),
      { timeout: 18000 },
    );
    assert.equal(
      Boolean(screen.queryByRole("button", { name: "Start now" })),
      false,
    );
    assert.equal(
      Boolean(screen.queryByRole("button", { name: "Schedule start" })),
      false,
    );
    assert.ok(!actions.includes("start"));
    assert.ok(
      progressSequences.every((seq) => seq === 0),
      "Waiting and polling must not use the typing sequence budget.",
    );
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    const passage = input.labels![0].textContent!.replace(
      "Type this passage: ",
      "",
    );
    fireEvent.change(input, { target: { value: passage.slice(0, 3) } });
    await waitFor(
      async () =>
        assert.equal(
          (await request(path, undefined, host.token)).self.typed,
          passage.slice(0, 3),
        ),
      { timeout: 2500 },
    );
  } finally {
    cleanup();
    globalThis.fetch = nativeFetch;
    for (const session of sessions)
      await request(
        `/api/rooms/${session.code}`,
        { action: "leave" },
        session.token,
      );
    localStorage.clear();
    sessionStorage.clear();
  }
});
