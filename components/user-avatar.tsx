import { useMemo } from "react";
import Image from "next/image";
import { Avatar, Style } from "@dicebear/core";
import dylan from "@dicebear/styles/dylan.json";

const style = new Style(dylan);

export default function UserAvatar({ seed }: { seed: string }) {
  const src = useMemo(
    () =>
      new Avatar(style, {
        seed,
        size: 80,
        backgroundColor: ["#b6e3f4", "#c0aede", "#d1d4f9"],
        borderRadius: 50,
      }).toDataUri(),
    [seed],
  );

  return (
    <Image
      className="user-avatar"
      unoptimized
      src={src}
      alt=""
      width={80}
      height={80}
      loading="eager"
    />
  );
}
