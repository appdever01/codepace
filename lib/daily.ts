import { makePassage } from "./passages.ts";
import { localDay } from "./race.ts";

export function dailyPassage(date: Date) {
  const key = localDay(date);
  const seed = Array.from(key).reduce(
    (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
    2166136261,
  );
  return makePassage("words", seed, "", [], 15);
}
