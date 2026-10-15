"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CupStarIcon } from "@solar-icons/react/bold-duotone/cup-star";

export default function RaceTrophy() {
  const [status, setStatus] = useState<
    "initial" | "waiting" | "retry" | "failed"
  >("initial");

  useEffect(() => {
    if (status !== "waiting") return;
    const retry = setTimeout(() => setStatus("retry"), 600);
    return () => clearTimeout(retry);
  }, [status]);

  if (status === "waiting" || status === "failed")
    return <CupStarIcon aria-hidden="true" />;

  return (
    <Image
      unoptimized
      src={
        status === "retry" ? "/game/trophy.webp?retry=1" : "/game/trophy.webp"
      }
      alt=""
      width={72}
      height={72}
      loading="eager"
      fetchPriority="high"
      onError={() => setStatus(status === "initial" ? "waiting" : "failed")}
    />
  );
}
