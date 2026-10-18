import { wpm } from "./scoring.ts";
import { removeSavedValue } from "./storage.ts";

export const MAX_FAIR_WPM = 200;
export const BAN_STORAGE_KEY = "codepace:banned" as const;
export const BAN_MESSAGE =
  "Impossible speed. This session was removed for automated typing.";

const playKeys = [
  "codepace:history",
  "codepace:settings:v2",
  "codepace:coding:v1",
  "codepace:music:v1",
  "codepace:room",
] as const;

export function isImpossibleProgress(correct: number, elapsedMs: number) {
  if (correct <= 0 || elapsedMs < 2000) return false;
  return wpm(correct, elapsedMs) >= MAX_FAIR_WPM;
}

export function fairCharacterLimit(elapsedMs: number) {
  return Math.max(8, (Math.max(elapsedMs, 0) / 60000) * MAX_FAIR_WPM * 5);
}

export function isBanned(storage: Pick<Storage, "getItem">) {
  return storage.getItem(BAN_STORAGE_KEY) === "1";
}

export function destroyLocalPlay(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  session?: Pick<Storage, "removeItem">,
) {
  for (const key of playKeys) removeSavedValue(storage, key);
  session?.removeItem("codepace:room");
  storage.setItem(BAN_STORAGE_KEY, "1");
}
