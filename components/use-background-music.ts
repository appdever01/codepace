"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSavedValue } from "@/lib/storage";

const storageKey = "codepace:music:v1";
const initialVolume = 0.16;

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const enabledRef = useRef(true);
  const volumeRef = useRef(initialVolume);
  const pendingRef = useRef(false);
  const failedRef = useRef(false);
  const mountedRef = useRef(true);
  const [enabled, setEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(initialVolume);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    try {
      const saved = JSON.parse(readSavedValue(localStorage, storageKey) || "{}");
      enabledRef.current = saved.enabled !== false;
      volumeRef.current =
        typeof saved.volume === "number" && Number.isFinite(saved.volume)
          ? Math.min(1, Math.max(0, saved.volume))
          : initialVolume;
    } catch {
      enabledRef.current = true;
      volumeRef.current = initialVolume;
    }
    if (audioRef.current) audioRef.current.volume = volumeRef.current;
    queueMicrotask(() => {
      if (!active) return;
      setEnabledState(enabledRef.current);
      setVolumeState(volumeRef.current);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ enabled, volume }));
    } catch {
      return;
    }
  }, [enabled, volume, ready]);

  const unlock = useCallback(() => {
    const audio = audioRef.current;
    if (
      !enabledRef.current ||
      !audio ||
      !audio.paused ||
      pendingRef.current ||
      failedRef.current
    )
      return;
    audio.volume = volumeRef.current;
    pendingRef.current = true;
    void audio
      .play()
      .catch((reason: unknown) => {
        if (!mountedRef.current) return;
        if (
          reason instanceof Error &&
          ["NotAllowedError", "AbortError"].includes(reason.name)
        )
          return;
        failedRef.current = true;
        setError("Music could not load. Switch it off and on to retry.");
      })
      .finally(() => {
        pendingRef.current = false;
        if (!enabledRef.current || !mountedRef.current) audio.pause();
      });
  }, []);

  const setEnabled = useCallback(
    (value: boolean) => {
      enabledRef.current = value;
      setEnabledState(value);
      setError("");
      if (value) {
        if (failedRef.current) {
          failedRef.current = false;
          audioRef.current?.load();
        }
        unlock();
      } else audioRef.current?.pause();
    },
    [unlock],
  );

  const toggle = useCallback(
    () => setEnabled(!enabledRef.current),
    [setEnabled],
  );
  const setVolume = useCallback((value: number) => {
    const next = Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : initialVolume;
    volumeRef.current = next;
    setVolumeState(next);
    if (audioRef.current) audioRef.current.volume = next;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const audio = audioRef.current;
    if (!audio) return;
    const started = () => setPlaying(true);
    const paused = () => setPlaying(false);
    const failed = () => {
      failedRef.current = true;
      setPlaying(false);
      setError("Music could not load. Switch it off and on to retry.");
    };
    audio.addEventListener("playing", started);
    audio.addEventListener("pause", paused);
    audio.addEventListener("error", failed);
    return () => {
      mountedRef.current = false;
      audio.removeEventListener("playing", started);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("error", failed);
      audio.pause();
    };
  }, []);

  return {
    audioRef,
    enabled,
    volume,
    playing,
    error,
    unlock,
    toggle,
    setEnabled,
    setVolume,
  };
}
