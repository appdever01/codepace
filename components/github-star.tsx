"use client";

import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { StarIcon } from "@solar-icons/react/linear/star";
import { githubRepositoryUrl, isStarCount } from "@/lib/github";

export default function GitHubStar() {
  const [stars, setStars] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStars() {
      try {
        const response = await fetch("/api/github", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("GitHub is unavailable");
        const data = await response.json();
        if (!isStarCount(data?.stars)) throw new Error("Invalid star count");
        if (!controller.signal.aborted) setStars(data.stars);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    }
    void loadStars();
    return () => controller.abort();
  }, []);

  const count = stars === null ? "—" : stars.toLocaleString("en-US");
  const countLabel =
    stars === null
      ? unavailable
        ? "GitHub star count unavailable"
        : "Loading GitHub star count"
      : `${count} GitHub ${stars === 1 ? "star" : "stars"}`;

  return (
    <a
      className="github-star-cta"
      href={githubRepositoryUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Star CodePace on GitHub (opens in a new tab). ${countLabel}`}
      title={`Star CodePace on GitHub · ${countLabel}`}
    >
      <FaGithub aria-hidden="true" />
      <span className="github-star-label">
        Star<span className="github-star-label-detail"> on GitHub</span>
      </span>
      <span className="github-star-count" aria-hidden="true">
        <StarIcon />
        {count}
      </span>
    </a>
  );
}
