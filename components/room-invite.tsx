"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon } from "@solar-icons/react/linear/copy";

export default function RoomInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [fallback, setFallback] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (!fallback) return;
    input.current?.focus();
    input.current?.select();
  }, [fallback]);
  return (
    <div className="room-share">
      <button
        type="button"
        className="room-invite"
        disabled={copying}
        onClick={async () => {
          const url = new URL(location.href);
          url.searchParams.set("room", code);
          setCopying(true);
          setCopied(false);
          setFallback("");
          try {
            await navigator.clipboard.writeText(url.toString());
            setCopied(true);
          } catch {
            setFallback(url.toString());
          } finally {
            setCopying(false);
          }
        }}
      >
        <CopyIcon aria-hidden="true" />
        {copied ? "Copied" : "Copy link"}
      </button>
      <span className="sr-only" role="status">
        {copied ? "Invite link copied." : ""}
      </span>
      {fallback && (
        <label className="room-share-fallback">
          Invite link
          <input
            ref={input}
            type="text"
            readOnly
            value={fallback}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </div>
  );
}
