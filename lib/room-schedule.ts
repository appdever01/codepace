export const ROOM_COUNTDOWN_MS = 4000;
export const MAX_SCHEDULE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export function scheduleProblem(scheduledAt: number, now: number) {
  if (!Number.isSafeInteger(scheduledAt) || scheduledAt < now + 10000)
    return "Choose a start time at least 10 seconds from now.";
  if (scheduledAt > now + MAX_SCHEDULE_AHEAD_MS)
    return "Choose a start time within the next seven days.";
  return null;
}

export function scheduledStartTime(
  scheduledAt: number | null | undefined,
  connectedPlayers: number,
  now: number,
) {
  if (
    scheduledAt == null ||
    scheduledAt > now + ROOM_COUNTDOWN_MS ||
    connectedPlayers < 2
  )
    return null;
  return scheduledAt > now ? scheduledAt : now + ROOM_COUNTDOWN_MS;
}

export function localDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDateTime(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && localDateTime(timestamp) === value
    ? timestamp
    : NaN;
}
