export function wpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || correctChars <= 0) return 0;
  return Math.round(correctChars / 5 / (Math.max(elapsedMs, 2000) / 60000));
}

export function accuracy(totalKeystrokes: number, errors: number): number {
  if (totalKeystrokes === 0) return 100;
  return Math.max(
    0,
    Math.round(((totalKeystrokes - errors) / totalKeystrokes) * 1000) / 10,
  );
}

export function correctPrefix(typed: string, target: string): number {
  let i = 0;
  while (i < typed.length && i < target.length && typed[i] === target[i]) i++;
  return i;
}
