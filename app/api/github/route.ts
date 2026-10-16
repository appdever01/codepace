import { githubRepository, isStarCount } from "@/lib/github";

export async function GET() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepository}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error("GitHub is unavailable");
    const repository = await response.json();
    if (!isStarCount(repository?.stargazers_count)) {
      throw new Error("GitHub returned an invalid star count");
    }
    return Response.json(
      { stars: repository.stargazers_count },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { stars: null },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
