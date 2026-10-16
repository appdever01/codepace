export const githubRepository = "appdever01/codepace";
export const githubRepositoryUrl = `https://github.com/${githubRepository}`;

export function isStarCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
