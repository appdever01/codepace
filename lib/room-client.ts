import type { RoomSession, RoomSnapshot } from "./room-types.ts";

export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type RoomResponse = {
  room: RoomSnapshot;
  session: RoomSession;
  self?: { typed: string; strokes: number; errors: number; seq: number };
};

export async function api(
  path: string,
  data?: unknown,
  token?: string,
  signal?: AbortSignal,
): Promise<RoomResponse> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new RequestError(
      result?.error || "Could not connect. Try again.",
      response.status,
    );
  return result;
}

export function isNewerRoom(
  snapshot: RoomSnapshot,
  previous: RoomSnapshot | null,
) {
  if (!previous || snapshot.code !== previous.code) return true;
  if (snapshot.round !== previous.round) return snapshot.round > previous.round;
  if (snapshot.revision !== previous.revision)
    return snapshot.revision > previous.revision;
  return snapshot.serverNow >= previous.serverNow;
}

export function pollDelay(phase: string, failures: number, hidden = false) {
  if (failures) return Math.min(8000, 500 * 2 ** Math.min(failures, 4));
  if (hidden) return 5000;
  return phase === "running" || phase === "countdown" ? 500 : 1200;
}

type Progress = {
  round: number;
  seq: number;
  typed: string;
  strokes: number;
  errors: number;
};
export function synchronizeRoom({
  session,
  progress,
  phase,
  onRoom,
  onError,
  request = api,
}: {
  session: RoomSession;
  progress: () => Progress;
  phase: () => string;
  onRoom: (room: RoomSnapshot, sentAt: number) => void;
  onError: (error: unknown) => void;
  request?: typeof api;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let urgent = false;
  let failures = 0;
  let lastWrite = 0;
  let acknowledged = "";
  const sync = async () => {
    if (controller.signal.aborted) return;
    clearTimeout(timer);
    if (busy) {
      urgent = true;
      return;
    }
    busy = true;
    urgent = false;
    const current = progress();
    const signature = JSON.stringify([
      current.round,
      current.typed,
      current.strokes,
      current.errors,
    ]);
    const sentAt = Date.now();
    const write = signature !== acknowledged || sentAt - lastWrite >= 10000;
    try {
      const result = await request(
        `/api/rooms/${session.code}`,
        write ? { action: "sync", ...current } : undefined,
        session.token,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        failures = 0;
        if (write) {
          lastWrite = sentAt;
          if (result.room.round === current.round) acknowledged = signature;
        }
        onRoom(result.room, sentAt);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        failures++;
        if (error instanceof RequestError && error.status === 409) {
          try {
            const refreshedAt = Date.now();
            const result = await request(
              `/api/rooms/${session.code}`,
              undefined,
              session.token,
              controller.signal,
            );
            if (!controller.signal.aborted) {
              onRoom(result.room, refreshedAt);
              failures = 0;
            }
          } catch (refreshError) {
            if (!controller.signal.aborted) onError(refreshError);
          }
        } else onError(error);
      }
    } finally {
      busy = false;
      if (!controller.signal.aborted)
        timer = setTimeout(
          () => void sync(),
          urgent
            ? 0
            : pollDelay(
                phase(),
                failures,
                typeof document !== "undefined" && document.hidden,
              ),
        );
    }
  };
  const wake = () => {
    void sync();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
  }
  void sync();
  return {
    push: wake,
    stop() {
      controller.abort();
      clearTimeout(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", wake);
        window.removeEventListener("focus", wake);
        document.removeEventListener("visibilitychange", wake);
      }
    },
  };
}

export async function restoreRoom(
  session: RoomSession,
  signal: AbortSignal,
  onRetry: () => void,
  request = api,
) {
  let failures = 0;
  while (!signal.aborted) {
    const sentAt = Date.now();
    try {
      const data = await request(
        `/api/rooms/${session.code}`,
        undefined,
        session.token,
        signal,
      );
      return { data, sentAt };
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof RequestError &&
          [400, 401, 404].includes(error.status))
      )
        throw error;
      onRetry();
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", done);
          resolve();
        };
        const timer = setTimeout(done, pollDelay("ready", ++failures));
        signal.addEventListener("abort", done, { once: true });
      });
    }
  }
  throw signal.reason;
}
