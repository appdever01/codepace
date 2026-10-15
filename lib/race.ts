import { accuracy, correctPrefix, wpm } from "./scoring.ts";

export type TextMode = "words" | "quotes" | "code" | "custom";
export type TypingState = {
  typed: string;
  strokes: number;
  errors: number;
  missed: Record<string, number>;
  streak: number;
  bestStreak: number;
};
export type RaceResult = {
  id: string;
  date: string;
  mode: string;
  duration: number;
  wpm: number;
  accuracy: number;
  correct: number;
  errors: number;
  consistency: number;
  samples: number[];
  missed: Record<string, number>;
  bestStreak?: number;
};

export const emptyTyping = (): TypingState => ({
  typed: "",
  strokes: 0,
  errors: 0,
  missed: {},
  streak: 0,
  bestStreak: 0,
});

export function applyInput(
  state: TypingState,
  next: string,
  target: string,
): TypingState {
  const value = next.slice(0, target.length);
  if (value === state.typed) return state;
  if (value.length < state.typed.length && state.typed.startsWith(value))
    return { ...state, typed: value, streak: 0 };
  if (!value.startsWith(state.typed)) return state;
  let errors = state.errors;
  let streak = state.streak;
  let bestStreak = state.bestStreak;
  let prefix = correctPrefix(state.typed, target);
  const missed = { ...state.missed };
  for (let i = state.typed.length; i < value.length; i++) {
    if (value[i] !== target[i]) {
      errors++;
      const key = target[i] === " " ? "space" : target[i];
      missed[key] = (missed[key] || 0) + 1;
    }
    if (value[i] === target[i] && prefix === i) {
      prefix++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else streak = 0;
  }
  return {
    typed: value,
    strokes: state.strokes + value.length - state.typed.length,
    errors,
    missed,
    streak,
    bestStreak,
  };
}

export function consistency(samples: number[]): number {
  if (samples.length < 2) return 100;
  const mean = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  if (!mean) return 0;
  const variance =
    samples.reduce((sum, n) => sum + (n - mean) ** 2, 0) / samples.length;
  return Math.round(Math.max(0, 1 - Math.sqrt(variance) / mean) * 100);
}

export function stats(state: TypingState, target: string, elapsedMs: number) {
  const correct = correctPrefix(state.typed, target);
  return {
    correct,
    wpm: wpm(correct, elapsedMs),
    accuracy: accuracy(state.strokes, state.errors),
  };
}

export function botProgress(pace: number, elapsedMs: number, length: number) {
  return Math.min(
    length,
    Math.floor((pace * 5 * Math.max(0, elapsedMs)) / 60000),
  );
}

export function readHistory(value: string | null): RaceResult[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is RaceResult =>
          !!row &&
          typeof row === "object" &&
          typeof row.id === "string" &&
          typeof row.date === "string" &&
          Number.isFinite(Date.parse(row.date)) &&
          typeof row.mode === "string" &&
          Number.isFinite(row.wpm) &&
          row.wpm >= 0 &&
          row.wpm <= 1000 &&
          Number.isFinite(row.accuracy) &&
          row.accuracy >= 0 &&
          row.accuracy <= 100 &&
          Number.isFinite(row.duration) &&
          row.duration > 0 &&
          Number.isFinite(row.correct) &&
          Number.isFinite(row.errors) &&
          Number.isFinite(row.consistency) &&
          Array.isArray(row.samples) &&
          row.samples.every(
            (n: unknown) => typeof n === "number" && Number.isFinite(n),
          ) &&
          row.missed &&
          typeof row.missed === "object" &&
          Object.values(row.missed).every(
            (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
          ),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function localDay(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
