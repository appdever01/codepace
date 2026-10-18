export const PLAYER_CONNECTED_MS = 30_000;

export function roomRaceFinished({
  startAt,
  now,
  players,
}: {
  startAt: number | null;
  now: number;
  players: { finishedAt: number | null; seenAt: number }[];
}) {
  if (startAt === null || now < startAt) return false;
  const connected = players.filter(
    (player) => player.seenAt > now - PLAYER_CONNECTED_MS,
  );
  const field = connected.length ? connected : players;
  return field.every((player) => player.finishedAt !== null);
}

export function roomTimedOut(
  startAt: number | null,
  duration: number,
  now: number,
) {
  return startAt !== null && now >= startAt + duration * 1000;
}
