"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import RaceTrophy from "@/components/race-trophy";
import { FlagIcon } from "@solar-icons/react/linear/flag";
import { TargetIcon } from "@solar-icons/react/linear/target";
import { Chart2Icon } from "@solar-icons/react/linear/chart-2";
import { UsersGroupRoundedIcon } from "@solar-icons/react/linear/users-group-rounded";
import { StarIcon } from "@solar-icons/react/linear/star";
import { FaGithub } from "react-icons/fa6";
import { RestartIcon } from "@solar-icons/react/linear/restart";
import { SettingsIcon } from "@solar-icons/react/linear/settings";
import { KeyboardIcon } from "@solar-icons/react/linear/keyboard";
import { BoltIcon } from "@solar-icons/react/bold-duotone/bolt";
import { CloseCircleIcon } from "@solar-icons/react/linear/close-circle";
import { CheckCircleIcon } from "@solar-icons/react/linear/check-circle";
import { CopyIcon } from "@solar-icons/react/linear/copy";
import { CrownIcon } from "@solar-icons/react/bold-duotone/crown";
import { VolumeLoudIcon } from "@solar-icons/react/linear/volume-loud";
import { VolumeCrossIcon } from "@solar-icons/react/linear/volume-cross";
import { MaximizeIcon } from "@solar-icons/react/linear/maximize";
import { MinimizeIcon } from "@solar-icons/react/linear/minimize";
import { CarIcon } from "@solar-icons/react/bold-duotone/car";
import { DangerCircleIcon } from "@solar-icons/react/linear/danger-circle";
import { LogoutIcon } from "@solar-icons/react/linear/logout";
import { AddCircleIcon } from "@solar-icons/react/linear/add-circle";
import { LinkIcon } from "@solar-icons/react/linear/link";
import { RefreshIcon } from "@solar-icons/react/linear/refresh";
import { FireIcon } from "@solar-icons/react/bold-duotone/fire";
import { CupStarIcon } from "@solar-icons/react/bold-duotone/cup-star";
import { RocketIcon } from "@solar-icons/react/bold-duotone/rocket";
import { StopwatchIcon } from "@solar-icons/react/linear/stopwatch";
import { dailyPassage } from "@/lib/daily";
import {
  applyInput,
  botProgress,
  consistency,
  emptyTyping,
  localDay,
  readHistory,
  stats,
  type RaceResult,
  type TextMode,
  type TypingState,
} from "@/lib/race";
import { makePassage } from "@/lib/passages";
import type { RoomSession, RoomSnapshot } from "@/lib/room-types";

type Tab = "race" | "practice" | "friends" | "progress";
type Phase = "ready" | "countdown" | "running" | "finished";
type Settings = { name: string; pace: number; sound: boolean; light: boolean };
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api(path: string, data?: unknown, token?: string) {
  const response = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const result = (await response.json()) as {
    error?: string;
    room: RoomSnapshot;
    session: RoomSession;
    self?: { typed: string; strokes: number; errors: number; seq: number };
  };
  if (!response.ok)
    throw new RequestError(
      result.error || "Could not connect. Try again.",
      response.status,
    );
  return result;
}
const palette = ["cobalt", "violet", "coral", "blue", "pink", "yellow"];
const initialSettings: Settings = {
  name: "You",
  pace: 60,
  sound: false,
  light: true,
};
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function Keylane({
  initialRoom = "",
}: { initialRoom?: string } = {}) {
  const [tab, setTab] = useState<Tab>(initialRoom ? "friends" : "race");
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [mode, setMode] = useState<TextMode>("quotes");
  const [duration, setDuration] = useState(30);
  const [passage, setPassage] = useState(() => makePassage("quotes", 74));
  const passageRef = useRef(passage);
  const [engine, setEngine] = useState(emptyTyping);
  const engineRef = useRef<TypingState>(emptyTyping());
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(3);
  const [focused, setFocused] = useState(false);
  const [zen, setZen] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [history, setHistory] = useState<RaceResult[]>([]);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [dialog, setDialog] = useState<"settings" | "help" | null>(null);
  const [custom, setCustom] = useState("");
  const [daily, setDaily] = useState(false);
  const [weakKeys, setWeakKeys] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [roomError, setRoomError] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoom.toUpperCase());
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [storageWorks, setStorageWorks] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const passageBox = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const startRef = useRef(0);
  const savedRef = useRef(false);
  const samplesRef = useRef<number[]>([]);
  const secondRef = useRef(0);
  const seqRef = useRef(0);
  const roundRef = useRef(0);
  const offsetRef = useRef(0);
  const snapshotTimeRef = useRef(0);
  const sessionRef = useRef(session);
  const configRef = useRef({ duration, mode, tab, daily });
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    configRef.current = { duration, mode, tab, daily };
    sessionRef.current = session;
    passageRef.current = passage;
  }, [duration, mode, tab, daily, session, passage]);

  const changePhase = useCallback((value: Phase) => {
    phaseRef.current = value;
    setPhase(value);
  }, []);
  const notify = useCallback((value: string) => setMessage(value), []);
  const clearEngine = useCallback(() => {
    const next = emptyTyping();
    engineRef.current = next;
    setEngine(next);
    setElapsed(0);
    setResult(null);
    savedRef.current = false;
    samplesRef.current = [];
    secondRef.current = 0;
    seqRef.current = 0;
    if (passageBox.current) passageBox.current.scrollTop = 0;
  }, []);
  const finish = useCallback(
    (time: number) => {
      if (savedRef.current) return;
      savedRef.current = true;
      const config = configRef.current;
      const current = stats(engineRef.current, passageRef.current, time);
      const joined = sessionRef.current;
      const completed: RaceResult = {
        id: joined
          ? `${joined.code}:${roundRef.current}:${joined.id}`
          : crypto.randomUUID(),
        date: new Date().toISOString(),
        mode: joined
          ? "Friends"
          : config.daily
            ? "Daily sprint"
            : config.tab === "race"
              ? "Race"
              : config.mode,
        duration: Math.max(0.1, time / 1000),
        wpm: current.wpm,
        accuracy: current.accuracy,
        correct: current.correct,
        errors: engineRef.current.errors,
        bestStreak: engineRef.current.bestStreak,
        consistency: consistency(samplesRef.current),
        samples: [...samplesRef.current],
        missed: { ...engineRef.current.missed },
      };
      setElapsed(time);
      setResult(completed);
      changePhase("finished");
      if (engineRef.current.strokes)
        setHistory((previous) =>
          previous.some((row) => row.id === completed.id)
            ? previous
            : [completed, ...previous].slice(0, 100),
        );
    },
    [changePhase],
  );
  const acceptRoom = useCallback(
    (snapshot: RoomSnapshot, sentAt: number) => {
      if (
        snapshot.round < roundRef.current ||
        (snapshot.round === roundRef.current &&
          snapshot.serverNow < snapshotTimeRef.current)
      )
        return;
      snapshotTimeRef.current = snapshot.serverNow;
      offsetRef.current = snapshot.serverNow - (sentAt + Date.now()) / 2;
      if (roundRef.current !== snapshot.round) {
        clearEngine();
        roundRef.current = snapshot.round;
      }
      setRoom(snapshot);
      setConnection(true);
      setDuration(snapshot.duration);
      setPassage(snapshot.passage);
      passageRef.current = snapshot.passage;
      if (snapshot.startAt)
        startRef.current = snapshot.startAt - offsetRef.current;
      if (snapshot.phase === "lobby") {
        changePhase("ready");
        return;
      }
      if (savedRef.current) return;
      if (snapshot.phase === "finished")
        finish(
          Math.min(
            snapshot.duration * 1000,
            Math.max(0, Date.now() - startRef.current),
          ),
        );
      else
        changePhase(snapshot.phase === "countdown" ? "countdown" : "running");
    },
    [changePhase, clearEngine, finish],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await Promise.resolve();
      try {
        setHistory(readHistory(localStorage.getItem("keylane:history")));
        const saved = JSON.parse(
          localStorage.getItem("keylane:settings:v2") || "{}",
        );
        setSettings({
          name:
            typeof saved.name === "string" ? saved.name.slice(0, 24) : "You",
          pace: Number.isFinite(saved.pace)
            ? Math.max(30, Math.min(140, saved.pace))
            : 60,
          sound: saved.sound === true,
          light: typeof saved.light === "boolean" ? saved.light : true,
        });
        setName(
          typeof saved.name === "string" && saved.name !== "You"
            ? saved.name.slice(0, 24)
            : "",
        );
        const requested = new URLSearchParams(location.search).get("room");
        if (requested) {
          setTab("friends");
          setJoinCode(requested.toUpperCase().slice(0, 6));
        }
        const remembered: RoomSession | null = JSON.parse(
          sessionStorage.getItem("keylane:room") || "null",
        );
        if (
          remembered &&
          typeof remembered.code === "string" &&
          typeof remembered.id === "string" &&
          typeof remembered.token === "string" &&
          (!requested || requested === remembered.code)
        ) {
          try {
            const sentAt = Date.now();
            const data = await api(
              `/api/rooms/${remembered.code}`,
              undefined,
              remembered.token,
            );
            if (!mounted) return;
            roundRef.current = data.room.round;
            sessionRef.current = remembered;
            const restored = {
              ...emptyTyping(),
              typed: data.self?.typed || "",
              strokes: data.self?.strokes || 0,
              errors: data.self?.errors || 0,
            };
            engineRef.current = restored;
            setEngine(restored);
            seqRef.current = data.self?.seq || 0;
            acceptRoom(data.room, sentAt);
            setSession(remembered);
            setTab("friends");
          } catch {
            sessionStorage.removeItem("keylane:room");
          }
        }
      } catch {
        setStorageWorks(false);
      }
      setHydrated(true);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [acceptRoom]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("keylane:history", JSON.stringify(history));
      localStorage.setItem("keylane:settings:v2", JSON.stringify(settings));
    } catch {
      queueMicrotask(() => setStorageWorks(false));
    }
    document.documentElement.dataset.theme = settings.light ? "light" : "dark";
  }, [history, settings, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (session)
        sessionStorage.setItem("keylane:room", JSON.stringify(session));
      else sessionStorage.removeItem("keylane:room");
    } catch {
      queueMicrotask(() => setStorageWorks(false));
    }
  }, [session, hydrated]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    if (dialog) {
      dialogTriggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      dialogTriggerRef.current?.focus();
    }
  }, [dialog]);
  useEffect(() => {
    if (phase === "running") inputRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    const box = passageBox.current;
    const caret = box?.querySelector<HTMLElement>(".caret");
    if (box && caret)
      box.scrollTop = Math.max(
        0,
        caret.getBoundingClientRect().top -
          box.getBoundingClientRect().top +
          box.scrollTop -
          48,
      );
  }, [engine.typed.length]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let busy = false;
    const sync = async () => {
      if (stopped || busy) return;
      busy = true;
      const sentAt = Date.now();
      const current = engineRef.current;
      try {
        const data = await api(
          `/api/rooms/${session.code}`,
          {
            action: "sync",
            round: roundRef.current,
            seq: ++seqRef.current,
            typed: current.typed,
            strokes: current.strokes,
            errors: current.errors,
          },
          session.token,
        );
        if (!stopped) acceptRoom(data.room, sentAt);
      } catch (error) {
        if (!stopped) {
          setConnection(false);
          if (
            error instanceof RequestError &&
            [401, 404].includes(error.status)
          ) {
            setRoomError(error.message);
            setSession(null);
            setRoom(null);
            changePhase("ready");
            clearEngine();
          } else if (error instanceof RequestError && error.status === 409) {
            try {
              const data = await api(
                `/api/rooms/${session.code}`,
                undefined,
                session.token,
              );
              if (!stopped) acceptRoom(data.room, sentAt);
            } catch {
              setConnection(false);
            }
          } else if (error instanceof RequestError && error.status === 400)
            notify(error.message);
        }
      } finally {
        busy = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 800);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, acceptRoom, changePhase, clearEngine, notify]);
  useEffect(() => {
    const timer = setInterval(() => {
      const currentPhase = phaseRef.current;
      if (currentPhase !== "countdown" && currentPhase !== "running") return;
      const time = Date.now() - startRef.current;
      if (time < 0) {
        setCount(Math.max(1, Math.ceil(-time / 1000)));
        return;
      }
      if (currentPhase === "countdown") changePhase("running");
      const limit = configRef.current.duration * 1000;
      setElapsed(Math.min(time, limit));
      const second = Math.floor(time / 1000);
      if (second > secondRef.current) {
        samplesRef.current.push(
          stats(engineRef.current, passageRef.current, Math.min(time, limit))
            .wpm,
        );
        secondRef.current = second;
      }
      if (time >= limit) finish(limit);
    }, 100);
    return () => clearInterval(timer);
  }, [changePhase, finish]);
  const reset = useCallback(
    (
      nextMode = configRef.current.mode,
      nextCustom = custom,
      keys = weakKeys,
      seconds = configRef.current.duration,
    ) => {
      if (sessionRef.current) return;
      clearEngine();
      changePhase("ready");
      setDaily(false);
      setPassage(makePassage(nextMode, Date.now(), nextCustom, keys, seconds));
      setFocused(false);
    },
    [custom, weakKeys, clearEngine, changePhase],
  );
  const begin = useCallback(() => {
    if (sessionRef.current || dialog) return;
    if (configRef.current.mode === "custom" && passageRef.current.length < 30) {
      notify("Add at least 30 characters of custom text first.");
      return;
    }
    if (phaseRef.current === "finished" && !daily)
      setPassage(
        makePassage(
          configRef.current.mode,
          Date.now(),
          custom,
          weakKeys,
          configRef.current.duration,
        ),
      );
    clearEngine();
    setCount(3);
    startRef.current = Date.now() + 3000;
    changePhase("countdown");
    if (settings.sound && !audioRef.current)
      audioRef.current = new AudioContext();
    if (audioRef.current?.state === "suspended") void audioRef.current.resume();
  }, [
    dialog,
    clearEngine,
    changePhase,
    notify,
    settings.sound,
    custom,
    weakKeys,
    daily,
  ]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (dialog || tab === "progress" || tab === "friends") return;
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (event.key === "Enter" && phaseRef.current === "ready") {
        event.preventDefault();
        begin();
      }
      if (event.key === "Escape" && !sessionRef.current) reset();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [begin, reset, tab, dialog]);

  function onInput(value: string) {
    if (phaseRef.current !== "running") return;
    const time = Date.now() - startRef.current;
    if (time >= duration * 1000) {
      finish(duration * 1000);
      return;
    }
    const previous = engineRef.current;
    const next = applyInput(previous, value, passage);
    engineRef.current = next;
    setEngine(next);
    if (settings.sound && next.strokes > previous.strokes) {
      const context = audioRef.current ?? new AudioContext();
      audioRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = next.errors > previous.errors ? 180 : 580;
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + 0.035,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.04);
    }
    if (next.typed === passage) finish(time);
  }
  function navigate(next: Tab) {
    if (session && next !== "friends") {
      notify("Leave your friend room before switching modes.");
      return;
    }
    if (phase === "running" || phase === "countdown") {
      notify("Finish or restart this race before switching modes.");
      return;
    }
    setTab(next);
    setDaily(false);
    setWeakKeys([]);
    if (next !== "progress" && next !== "friends") {
      const nextMode = next === "practice" ? "words" : "quotes";
      setMode(nextMode);
      reset(nextMode, "", []);
    }
  }
  async function enterRoom(create: boolean) {
    if (pending) return;
    setPending(true);
    setRoomError("");
    const sentAt = Date.now();
    try {
      const data = await api(
        create ? "/api/rooms" : `/api/rooms/${joinCode.toUpperCase()}`,
        create
          ? { name: name.trim(), duration }
          : { action: "join", name: name.trim() },
      );
      setSettings((previous) => ({ ...previous, name: name.trim() }));
      roundRef.current = 0;
      snapshotTimeRef.current = 0;
      acceptRoom(data.room, sentAt);
      setSession(data.session);
      setTab("friends");
      const url = new URL(location.href);
      url.searchParams.set("room", data.session.code);
      window.history.replaceState(null, "", url);
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "Could not join the room.",
      );
    } finally {
      setPending(false);
    }
  }
  async function roomAction(action: "start" | "rematch" | "leave" | "reclaim") {
    if (!session || pending) return;
    setPending(true);
    setRoomError("");
    const sentAt = Date.now();
    try {
      const data = await api(
        `/api/rooms/${session.code}`,
        { action, round: room?.round },
        session.token,
      );
      if (action === "leave") {
        setSession(null);
        setRoom(null);
        roundRef.current = 0;
        clearEngine();
        changePhase("ready");
        window.history.replaceState(null, "", location.pathname);
        setTab("race");
        setMode("quotes");
        setPassage(makePassage("quotes", Date.now(), "", [], duration));
      } else acceptRoom(data.room, sentAt);
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "Could not update the room.",
      );
    } finally {
      setPending(false);
    }
  }
  async function copyInvite() {
    if (!room) return;
    try {
      const url = new URL(location.href);
      url.searchParams.set("room", room.code);
      await navigator.clipboard.writeText(url.toString());
      notify("Invite link copied.");
    } catch {
      notify(`Share this room code: ${room.code}`);
    }
  }

  const live = stats(engine, passage, elapsed);
  const best = history.length ? Math.max(...history.map((r) => r.wpm)) : 0;
  const average = history.length
    ? Math.round(
        history.slice(0, 10).reduce((n, r) => n + r.wpm, 0) /
          Math.min(10, history.length),
      )
    : 0;
  const today = history.filter(
    (row) => localDay(row.date) === localDay(new Date()),
  );
  const todaySeconds = today.reduce((n, row) => n + row.duration, 0);
  const isBusy = phase === "running" || phase === "countdown";
  const isFriends = tab === "friends";
  const host = !!room && room.hostId === session?.id;
  const remaining = Math.max(0, Math.ceil(duration - elapsed / 1000));
  const localBots = [settings.pace - 20, settings.pace, settings.pace + 20].map(
    (pace, index) => ({
      id: `bot-${index}`,
      name: ["Steady", "Cruise", "Sprint"][index],
      pace: Math.max(20, pace),
      correct: botProgress(Math.max(20, pace), elapsed, passage.length),
      finishedMs: (passage.length / (Math.max(20, pace) * 5)) * 60000,
      wpm: phase === "ready" || phase === "countdown" ? 0 : Math.max(20, pace),
      bot: true,
    }),
  );
  const racers = room
    ? room.players.map((p, index) => ({
        ...p,
        correct: p.id === session?.id ? live.correct : p.correct,
        wpm: p.id === session?.id ? live.wpm : p.wpm,
        bot: false,
        finishedMs:
          p.finishedAt && room.startAt
            ? p.finishedAt - room.startAt
            : p.id === session?.id && engine.typed === passage
              ? elapsed
              : Infinity,
        color: palette[index % palette.length],
      }))
    : [
        {
          id: "you",
          name: settings.name,
          correct: live.correct,
          wpm: live.wpm,
          bot: false,
          finishedMs: engine.typed === passage ? elapsed : Infinity,
          color: "cobalt",
        },
        ...(tab === "race"
          ? localBots.map((bot, i) => ({ ...bot, color: palette[i + 1] }))
          : []),
      ];
  const ownId = session?.id || "you";
  const position = Math.max(
    1,
    [...racers]
      .sort((a, b) => b.correct - a.correct || a.finishedMs - b.finishedMs)
      .findIndex((racer) => racer.id === ownId) + 1,
  );
  const hasError = engine.typed.length > live.correct;
  const weak = Object.entries(
    history.reduce<Record<string, number>>((all, row) => {
      Object.entries(row.missed).forEach(([key, value]) => {
        all[key] = (all[key] || 0) + value;
      });
      return all;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const drill = (keys: string[]) => {
    const letters = keys.filter(
      (key) => key.length === 1 && /[a-z]/i.test(key),
    );
    setTab("practice");
    setMode("words");
    setWeakKeys(letters);
    reset("words", "", letters);
  };

  const typingPanel = (
    <section
      className={`typing-panel ${hasError ? "has-error" : ""}`}
      aria-label="Typing race"
    >
      <div className="typing-top">
        <span className="passage-label">
          <KeyboardIcon />
          {room
            ? "Shared passage"
            : daily
              ? "Daily sprint"
              : mode === "code"
                ? "JavaScript"
                : mode === "words"
                  ? weakKeys.length
                    ? "Focused words"
                    : "Common words"
                  : mode === "custom"
                    ? "Your text"
                    : "Original passage"}
        </span>
        <div className="live-stats">
          <span>
            <b>{live.wpm}</b> wpm
          </span>
          <span>
            <b>
              {live.accuracy}
              <small>%</small>
            </b>{" "}
            accuracy
          </span>
          <span
            className={
              remaining <= 5 && phase === "running" ? "time-urgent" : ""
            }
          >
            <b>
              {remaining}
              <small>s</small>
            </b>{" "}
            left
          </span>
        </div>
      </div>
      <div className="play-hud">
        <span
          className={`combo-chip ${engine.streak >= 10 ? "combo-active" : ""}`}
        >
          <FireIcon />
          <b key={Math.floor(engine.streak / 10)}>{engine.streak}</b> clean keys
        </span>
        <span className="next-key">
          Next key{" "}
          <kbd>
            {passage[engine.typed.length] === " "
              ? "space"
              : passage[engine.typed.length]?.toUpperCase() || "done"}
          </kbd>
        </span>
      </div>
      {phase !== "finished" ? (
        <>
          <div
            className={`typing-surface ${phase === "running" && !focused ? "unfocused" : ""}`}
            onClick={() => {
              if (phase === "ready" && !room) begin();
              else inputRef.current?.focus();
            }}
          >
            <div className="passage" ref={passageBox} aria-hidden="true">
              {(() => {
                let start = 0;
                const words = passage.split(" ");
                return words.map((word, index) => {
                  const base = start;
                  const chunk = word + (index < words.length - 1 ? " " : "");
                  start += chunk.length;
                  let glyphOffset = 0;
                  return (
                    <span className="word" key={index}>
                      {Array.from(chunk).map((char) => {
                        const i = base + glyphOffset;
                        glyphOffset += char.length;
                        return (
                          <span
                            key={i}
                            className={`${i < engine.typed.length ? (engine.typed.slice(i, i + char.length) === char ? "correct-char" : "wrong-char") : ""} ${i === engine.typed.length ? "caret" : ""}`}
                          >
                            {char}
                          </span>
                        );
                      })}
                    </span>
                  );
                });
              })()}
            </div>
            <label className="sr-only" htmlFor="typing-input">
              Type this passage: {passage}
            </label>
            <textarea
              id="typing-input"
              ref={inputRef}
              className="typing-input"
              value={engine.typed}
              disabled={phase !== "running"}
              onChange={(event) => onInput(event.target.value)}
              onFocus={(event) => {
                setFocused(true);
                event.currentTarget.setSelectionRange(
                  engineRef.current.typed.length,
                  engineRef.current.typed.length,
                );
              }}
              onBlur={() => setFocused(false)}
              onPaste={(event) => {
                event.preventDefault();
                notify("Type each character to keep the race fair.");
              }}
              onDrop={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !room) {
                  event.preventDefault();
                  reset();
                }
              }}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="typing-instructions"
            />
            {phase === "countdown" && (
              <div className="countdown" role="status">
                <span key={count}>{count}</span>
                <p>Hands on the keys.</p>
              </div>
            )}
            {phase === "running" && !focused && (
              <button
                className="focus-prompt"
                onClick={() => inputRef.current?.focus()}
              >
                <KeyboardIcon />
                Click to keep typing
              </button>
            )}
          </div>
          <div className="typing-bottom">
            <span
              id="typing-instructions"
              className={hasError ? "error-text" : ""}
            >
              {hasError
                ? "Backspace to fix the highlighted mistake."
                : phase === "running"
                  ? "Keep a steady rhythm. Accuracy comes first."
                  : room
                    ? "Everyone gets the same text and start time."
                    : "The clock starts after the countdown."}
            </span>
            <span className="language">
              <span className="tiny-dot" />
              English
            </span>
          </div>
        </>
      ) : (
        <div className="results" aria-live="polite">
          <div className="result-heading">
            <span className="result-icon" aria-hidden="true">
              <RaceTrophy />
            </span>
            <div>
              <h2>
                {live.correct === 0
                  ? "Every start counts."
                  : position === 1 && tab !== "practice"
                    ? "That’s a winning rhythm."
                    : "A good lap in the books."}
              </h2>
              <p>
                {engine.strokes === 0
                  ? "Start typing next time to save a result."
                  : result &&
                      result.wpm >
                        Math.max(
                          0,
                          ...history
                            .filter((row) => row.id !== result.id)
                            .map((row) => row.wpm),
                        )
                    ? "A new personal best. Nicely done."
                    : "Your next race is a fresh chance to improve."}
              </p>
            </div>
          </div>
          <div className="result-position">
            <CupStarIcon />
            {tab === "practice"
              ? "Practice complete"
              : `Position ${position} of ${racers.length}`}
          </div>
          <div className="result-numbers">
            <div>
              <strong>{result?.wpm || 0}</strong>
              <span>words per minute</span>
            </div>
            <div>
              <strong>
                {result?.accuracy ?? 100}
                <small>%</small>
              </strong>
              <span>accuracy</span>
            </div>
            <div>
              <strong>
                {result?.consistency ?? 0}
                <small>%</small>
              </strong>
              <span>consistency</span>
            </div>
          </div>
          <div
            className="speed-chart"
            role="img"
            aria-label={`Speed over the race: ${result?.samples.join(", ") || "no samples"} words per minute`}
          >
            {(result?.samples.length ? result.samples : [0]).map((value, i) => (
              <div
                key={i}
                style={{
                  height: `${Math.max(3, (value / Math.max(1, ...(result?.samples || []))) * 100)}%`,
                }}
                title={`${i + 1}s: ${value} wpm`}
              />
            ))}
          </div>
          <div className="chart-labels">
            <span>YOUR PACE OVER TIME</span>
            <span>{Math.round(result?.duration || duration)} seconds</span>
          </div>
          {room && (
            <div className="room-standings">
              <h3>
                {room.phase === "finished"
                  ? "Final standings"
                  : "Waiting for the other racers"}
              </h3>
              {[...room.players]
                .sort(
                  (a, b) =>
                    b.correct - a.correct ||
                    (a.finishedAt || Infinity) - (b.finishedAt || Infinity),
                )
                .map((player, i) => (
                  <div key={player.id}>
                    <span>{i + 1}</span>
                    <b>
                      {player.name}
                      {player.id === ownId ? " (you)" : ""}
                    </b>
                    <span>{player.wpm} wpm</span>
                    <span>{player.accuracy}%</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className={`app ${zen ? "zen" : ""} phase-${phase}`}>
      <a className="skip-link" href="#main">
        Skip to race
      </a>
      <header className="header">
        <button
          className="brand"
          onClick={() => navigate("race")}
          aria-label="Keylane home"
        >
          <span className="brand-mark" aria-hidden="true">
            <BoltIcon />
          </span>
          keylane<span className="brand-period">.</span>
        </button>
        <nav aria-label="Main navigation">
          {(
            [
              ["race", "Race", FlagIcon],
              ["practice", "Practice", TargetIcon],
              ["friends", "Friends", UsersGroupRoundedIcon],
              ["progress", "Progress", Chart2Icon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              className={tab === value ? "nav-active" : ""}
              onClick={() => navigate(value)}
              aria-current={tab === value ? "page" : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <div className="github-links">
            <a
              href="https://github.com/aroach98/typerace"
              target="_blank"
              rel="noreferrer"
              aria-label="View the open-source reference on GitHub"
              title="Open-source reference: aroach98/typerace"
            >
              <FaGithub aria-hidden="true" />
              <span className="github-label">GitHub</span>
            </a>
            <a
              className="github-star"
              href="https://github.com/aroach98/typerace"
              target="_blank"
              rel="noreferrer"
              aria-label="Star the original typerace project on GitHub"
              title="Support the original open-source racer"
            >
              <StarIcon aria-hidden="true" />
              <span>Star</span>
            </a>
          </div>
          <button
            className="icon-button help-button"
            aria-label="Keyboard shortcuts"
            onClick={() => setDialog("help")}
          >
            <KeyboardIcon />
          </button>
          <button
            className="profile-button"
            onClick={() => setDialog("settings")}
            aria-label="Open profile and settings"
          >
            {settings.name.slice(0, 1).toUpperCase() || "Y"}
          </button>
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {tab === "progress" ? (
          <>
            <div className="page-heading">
              <div>
                <h1>Your progress.</h1>
                <p>Small improvements add up. Here are yours.</p>
              </div>
              <button
                className="button primary"
                onClick={() => navigate("race")}
              >
                Take another lap
              </button>
            </div>
            <div className="progress-summary">
              <div>
                <span>Personal best</span>
                <strong>
                  {best || "—"}
                  <small> wpm</small>
                </strong>
              </div>
              <div>
                <span>Recent average</span>
                <strong>
                  {average || "—"}
                  <small> wpm</small>
                </strong>
              </div>
              <div>
                <span>Races completed</span>
                <strong>{history.length}</strong>
              </div>
              <div>
                <span>Practice today</span>
                <strong>
                  {Math.floor(todaySeconds / 60)}
                  <small> min {Math.round(todaySeconds % 60)}s</small>
                </strong>
              </div>
            </div>
            <section className="history-section">
              <div className="section-heading">
                <h2>Race history</h2>
                <span>Last 100 races · on this device</span>
              </div>
              {history.length ? (
                <div className="history-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Speed</th>
                        <th>Accuracy</th>
                        <th>Consistency</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate(row.date)}</td>
                          <td className="capitalize">{row.mode}</td>
                          <td className="accent-text">{row.wpm} wpm</td>
                          <td>{row.accuracy}%</td>
                          <td>{row.consistency}%</td>
                          <td>{Math.round(row.duration)}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-history">
                  <Chart2Icon />
                  <h3>Your first race starts the story.</h3>
                  <p>
                    Finish a race to see your speed, accuracy and rhythm here.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => navigate("race")}
                  >
                    Start a race
                  </button>
                </div>
              )}
            </section>
            <div className="progress-foot">
              <KeyboardIcon />
              <p>
                Your results stay in this browser. Clearing browser data removes
                them.
              </p>
              <button
                className="text-button"
                disabled={!history.length}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(history, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = "keylane-history.json";
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export results
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <h1>
                  {isFriends
                    ? room
                      ? "Race with friends."
                      : "Race with friends."
                    : tab === "practice"
                      ? "Practice typing."
                      : "Ready. Set. Type."}
                </h1>
                <p>
                  {isFriends
                    ? room
                      ? "Same passage. Same start. See who finds their rhythm."
                      : "Create a private room and send your friends the link."
                    : tab === "practice"
                      ? "Find your rhythm with words, passages or your own text."
                      : "Pick your pace. Race the clock. Make every key count."}
                </p>
              </div>
              {!isFriends && (
                <button
                  className="button secondary invite-top"
                  onClick={() => navigate("friends")}
                >
                  <UsersGroupRoundedIcon />
                  Race with friends
                </button>
              )}
              {room && (
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => void roomAction("leave")}
                >
                  <LogoutIcon />
                  Leave room
                </button>
              )}
            </div>
            {isFriends && !room ? (
              <div className="friends-layout">
                <section className="friends-form">
                  <div className="friends-graphic" aria-hidden="true">
                    <Image
                      unoptimized
                      src="/game/rally-orange.webp"
                      alt=""
                      width={176}
                      height={88}
                    />
                  </div>
                  <h2>Create or join a room.</h2>
                  <p>Up to six racers. No accounts needed in the game.</p>
                  <label htmlFor="racer-name">Your racer name</label>
                  <input
                    id="racer-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={24}
                    placeholder="What should we call you?"
                    autoComplete="nickname"
                  />
                  <div className="field-row">
                    <label htmlFor="room-duration">Race length</label>
                    <select
                      id="room-duration"
                      value={duration}
                      onChange={(event) =>
                        setDuration(Number(event.target.value))
                      }
                    >
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                    </select>
                  </div>
                  <button
                    className="button primary full-width"
                    disabled={pending || !name.trim()}
                    onClick={() => void enterRoom(true)}
                  >
                    {pending ? (
                      <RefreshIcon className="spin" />
                    ) : (
                      <AddCircleIcon />
                    )}
                    Create a room
                  </button>
                  <div className="form-divider">
                    <span>or join a friend</span>
                  </div>
                  <label htmlFor="room-code">Room code</label>
                  <div className="join-row">
                    <input
                      id="room-code"
                      value={joinCode}
                      onChange={(event) =>
                        setJoinCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z2-9]/g, "")
                            .slice(0, 6),
                        )
                      }
                      placeholder="ABC234"
                      maxLength={6}
                      autoCapitalize="characters"
                    />
                    <button
                      className="button secondary"
                      disabled={
                        pending || joinCode.length !== 6 || !name.trim()
                      }
                      onClick={() => void enterRoom(false)}
                    >
                      Join
                    </button>
                  </div>
                  {roomError && (
                    <p role="alert" className="form-error">
                      <DangerCircleIcon />
                      {roomError}
                    </p>
                  )}
                </section>
                <aside className="friends-info">
                  <span className="oversize-flag">
                    <FlagIcon />
                  </span>
                  <h2>
                    A little friendly
                    <br />
                    competition.
                  </h2>
                  <p>
                    Share a link, get everyone on the starting line and let the
                    fastest fingers win.
                  </p>
                  <ol>
                    <li>
                      <span>1</span>Create a room with your name.
                    </li>
                    <li>
                      <span>2</span>Copy the invite link to your friends.
                    </li>
                    <li>
                      <span>3</span>The host starts when everyone is ready.
                    </li>
                  </ol>
                  <div className="friends-note">
                    <LinkIcon />
                    <span>
                      Rooms last two hours. Progress updates about once a
                      second.
                    </span>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="workspace">
                <div className="race-column">
                  {room ? (
                    <div className="room-toolbar">
                      <span className="room-code">
                        Room <b>{room.code}</b>
                        <button
                          className="icon-button"
                          onClick={() => void copyInvite()}
                          aria-label="Copy invite link"
                        >
                          <CopyIcon />
                        </button>
                      </span>
                      <span
                        className={`connection ${connection ? "" : "offline"}`}
                      >
                        <span className="tiny-dot" />
                        {connection
                          ? `${room.players.length}/6 in room`
                          : "Reconnecting…"}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => void copyInvite()}
                      >
                        Invite friends
                      </button>
                    </div>
                  ) : (
                    <div className="race-toolbar">
                      <div className="segments" aria-label="Passage mode">
                        {(
                          [
                            "quotes",
                            "words",
                            "code",
                            ...(tab === "practice" ? ["custom"] : []),
                          ] as TextMode[]
                        ).map((value) => (
                          <button
                            key={value}
                            disabled={isBusy}
                            aria-pressed={mode === value}
                            className={mode === value ? "selected" : ""}
                            onClick={() => {
                              setMode(value);
                              setWeakKeys([]);
                              reset(value, custom, []);
                            }}
                          >
                            {value === "quotes"
                              ? "Passages"
                              : value === "code"
                                ? "Code"
                                : value === "words"
                                  ? "Words"
                                  : "Custom"}
                          </button>
                        ))}
                      </div>
                      <div className="toolbar-end">
                        <div className="times" aria-label="Race duration">
                          {[15, 30, 60].map((seconds) => (
                            <button
                              key={seconds}
                              disabled={isBusy}
                              className={duration === seconds ? "selected" : ""}
                              aria-pressed={duration === seconds}
                              onClick={() => {
                                setDuration(seconds);
                                reset(mode, custom, weakKeys, seconds);
                              }}
                            >
                              {seconds}
                              <span>s</span>
                            </button>
                          ))}
                        </div>
                        <span className="toolbar-divider" />
                        <button
                          className="icon-button"
                          aria-label="Race settings"
                          onClick={() => setDialog("settings")}
                        >
                          <SettingsIcon />
                        </button>
                      </div>
                    </div>
                  )}
                  {mode === "custom" && !room && (
                    <div className="custom-text">
                      <label htmlFor="custom-passage">
                        Your practice text <span>30–2,000 characters</span>
                      </label>
                      <textarea
                        id="custom-passage"
                        disabled={isBusy}
                        value={custom}
                        maxLength={2000}
                        placeholder="Paste something you want to practice…"
                        onChange={(event) => {
                          setCustom(event.target.value);
                          reset("custom", event.target.value);
                        }}
                      />
                    </div>
                  )}
                  {weakKeys.length > 0 && (
                    <div className="focused-banner">
                      <TargetIcon />
                      Practicing your tricky keys: {weakKeys.join(", ")}
                      <button
                        className="icon-button"
                        aria-label="Clear focused practice"
                        onClick={() => {
                          setWeakKeys([]);
                          reset("words", "", []);
                        }}
                      >
                        <CloseCircleIcon />
                      </button>
                    </div>
                  )}
                  <div className="arena">
                    {typingPanel}
                    {roomError && (
                      <p className="form-error" role="alert">
                        <DangerCircleIcon />
                        {roomError}
                      </p>
                    )}
                    <div className="race-actions">
                      <div>
                        {!room &&
                          (phase === "ready" || phase === "finished") && (
                            <button
                              className="button primary start-button"
                              onClick={begin}
                            >
                              <RocketIcon />
                              {phase === "finished"
                                ? "Race again"
                                : tab === "practice"
                                  ? "Start practice"
                                  : daily
                                    ? "Start daily sprint"
                                    : "Start race"}
                              <kbd>enter</kbd>
                            </button>
                          )}
                        {!room && isBusy && (
                          <button
                            className="button secondary"
                            onClick={() => reset()}
                          >
                            <RestartIcon />
                            Restart<kbd>esc</kbd>
                          </button>
                        )}
                        {room && phase === "finished" && host && (
                          <button
                            className="button primary"
                            disabled={pending || room.phase !== "finished"}
                            onClick={() => void roomAction("rematch")}
                          >
                            Next round
                          </button>
                        )}
                        {room && phase === "finished" && !host && (
                          <span className="muted">
                            Waiting for the host to open the next round.
                          </span>
                        )}
                      </div>
                      <div className="action-tools">
                        <button
                          className="icon-button"
                          aria-label={
                            settings.sound
                              ? "Turn typing sound off"
                              : "Turn typing sound on"
                          }
                          aria-pressed={settings.sound}
                          onClick={() =>
                            setSettings((previous) => ({
                              ...previous,
                              sound: !previous.sound,
                            }))
                          }
                        >
                          {settings.sound ? (
                            <VolumeLoudIcon />
                          ) : (
                            <VolumeCrossIcon />
                          )}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={
                            zen ? "Exit focus mode" : "Enter focus mode"
                          }
                          aria-pressed={zen}
                          onClick={() => setZen(!zen)}
                        >
                          {zen ? <MinimizeIcon /> : <MaximizeIcon />}
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Keyboard shortcuts and help"
                          onClick={() => setDialog("help")}
                        >
                          <KeyboardIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                  <section className="track-panel" aria-label="Race progress">
                    <div className="track-heading">
                      <h2>
                        {room
                          ? "Starting grid"
                          : tab === "practice"
                            ? "Your lane"
                            : "Meet your competition"}
                      </h2>
                      <span className="track-status">
                        <span
                          className={`tiny-dot ${phase === "running" ? "active-dot" : ""}`}
                        />
                        {phase === "running"
                          ? "Race in progress"
                          : phase === "countdown"
                            ? "Starting…"
                            : phase === "finished"
                              ? "Finish line"
                              : room
                                ? "Waiting for racers"
                                : tab === "race"
                                  ? "You + 3 pace bots"
                                  : "Just you, no pressure"}
                      </span>
                    </div>
                    <div className="lanes">
                      {racers.map((racer) => (
                        <div
                          className={`lane ${racer.color} ${racer.id === ownId ? "own-lane" : ""}`}
                          key={racer.id}
                        >
                          <div className="racer-identity">
                            <span className="racer-avatar">
                              {racer.id === ownId ? (
                                <BoltIcon />
                              ) : racer.bot ? (
                                <CarIcon />
                              ) : (
                                racer.name.charAt(0).toUpperCase()
                              )}
                            </span>
                            <div>
                              <b>
                                {racer.id === ownId ? "You" : racer.name}
                                {room?.hostId === racer.id && (
                                  <CrownIcon className="host-crown" />
                                )}
                              </b>
                              <span>
                                {racer.bot
                                  ? `${"pace" in racer ? racer.pace : ""} wpm · bot`
                                  : racer.id === ownId
                                    ? "This is your lane"
                                    : (room?.serverNow || 0) -
                                          (room?.players.find(
                                            (p) => p.id === racer.id,
                                          )?.seenAt || 0) >
                                        10000
                                      ? "Away"
                                      : "Ready to race"}
                              </span>
                            </div>
                          </div>
                          <div className="lane-road">
                            <div className="road-line" />
                            <div
                              className="road-fill"
                              style={{
                                transform: `scaleX(${racer.correct / Math.max(1, passage.length)})`,
                              }}
                            />
                            <div
                              className="race-car"
                              aria-hidden="true"
                              style={{
                                transform: `translateX(calc(${Math.min(100, (racer.correct / Math.max(1, passage.length)) * 100)}% - 2px))`,
                              }}
                            >
                              <Image
                                unoptimized
                                src={
                                  racer.id === ownId
                                    ? "/game/rally-blue.webp"
                                    : "/game/rally-orange.webp"
                                }
                                alt=""
                                width={68}
                                height={34}
                              />
                            </div>
                            <FlagIcon className="finish-flag" />
                          </div>
                          <div className="lane-speed">
                            <b>{racer.wpm}</b>
                            <span>wpm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!room && tab === "race" && (
                      <div className="pace-select">
                        <span>Pick your competition</span>
                        <div className="pace-options">
                          {[
                            [50, "Chill"],
                            [80, "Quick"],
                            [110, "Turbo"],
                          ].map(([pace, label]) => (
                            <button
                              key={pace}
                              disabled={isBusy}
                              className={
                                (settings.pace < 65
                                  ? 50
                                  : settings.pace < 95
                                    ? 80
                                    : 110) === pace
                                  ? "selected"
                                  : ""
                              }
                              aria-pressed={
                                (settings.pace < 65
                                  ? 50
                                  : settings.pace < 95
                                    ? 80
                                    : 110) === pace
                              }
                              onClick={() =>
                                setSettings((previous) => ({
                                  ...previous,
                                  pace: Number(pace),
                                }))
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {room && room.phase === "lobby" && (
                      <div className="lobby-action">
                        <p>
                          {host
                            ? room.players.length < 2
                              ? "Share the invite link to bring a friend to the grid."
                              : "Your grid is ready. Start when everyone is here."
                            : "Waiting for the host to start the race."}
                        </p>
                        {host ? (
                          <button
                            className="button primary small"
                            disabled={
                              pending ||
                              room.players.filter(
                                (p) => room.serverNow - p.seenAt < 30000,
                              ).length < 2
                            }
                            onClick={() => void roomAction("start")}
                          >
                            Start race
                          </button>
                        ) : room.serverNow -
                            (room.players.find((p) => p.id === room.hostId)
                              ?.seenAt || 0) >
                          30000 ? (
                          <button
                            className="button secondary small"
                            disabled={pending}
                            onClick={() => void roomAction("reclaim")}
                          >
                            Take over as host
                          </button>
                        ) : null}
                      </div>
                    )}
                  </section>
                  {phase === "finished" &&
                    result &&
                    result.errors > 0 &&
                    !room && (
                      <button
                        className="mistake-drill text-button"
                        onClick={() =>
                          drill(Object.keys(result.missed).slice(0, 5))
                        }
                      >
                        <TargetIcon />
                        Practice the keys you missed
                      </button>
                    )}
                </div>
                <aside className="progress-sidebar">
                  <section className="daily-sprint">
                    <div className="daily-art" aria-hidden="true">
                      <Image
                        unoptimized
                        src="/game/canyon-circuit.webp"
                        alt=""
                        width={720}
                        height={480}
                        fetchPriority="high"
                      />
                    </div>
                    <div className="daily-title">
                      <h2>Daily sprint</h2>
                      <span>
                        <StopwatchIcon />
                        15 sec
                      </span>
                    </div>
                    <p>
                      Fifteen seconds. One canyon circuit. Beat your best lap.
                    </p>
                    <button
                      className="button daily-button"
                      disabled={isBusy || !!room}
                      onClick={() => {
                        clearEngine();
                        changePhase("ready");
                        setTab("race");
                        setMode("words");
                        setDuration(15);
                        setDaily(true);
                        setPassage(dailyPassage(new Date()));
                      }}
                    >
                      Try today’s sprint
                    </button>
                    {today.some((row) => row.mode === "Daily sprint") && (
                      <span className="daily-record">
                        Today’s best:{" "}
                        {Math.max(
                          ...today
                            .filter((row) => row.mode === "Daily sprint")
                            .map((row) => row.wpm),
                        )}{" "}
                        wpm
                      </span>
                    )}
                  </section>
                  <section className="session-stats">
                    <div className="section-heading">
                      <h2>Your personal best</h2>
                      <CupStarIcon aria-hidden="true" />
                    </div>
                    <div className="personal-best">
                      {history.length ? (
                        <div className="best-score">
                          <strong>{best}</strong>
                          <span>wpm</span>
                        </div>
                      ) : (
                        <h3>Set your first record.</h3>
                      )}
                      <p>
                        {history.length
                          ? `Across ${history.length} ${history.length === 1 ? "completed race" : "completed races"}`
                          : "Finish a race to see your best speed here."}
                      </p>
                    </div>
                    <div className="mini-stats">
                      {history.length > 0 && (
                        <div>
                          <span>Recent average</span>
                          <b>
                            {average} <small>wpm</small>
                          </b>
                        </div>
                      )}
                      <div>
                        <span>Races today</span>
                        <b>{today.length}</b>
                      </div>
                    </div>
                    <div className="daily-goal">
                      <div>
                        <span>Daily goal</span>
                        <b>{Math.min(today.length, 5)} / 5 races</b>
                      </div>
                      <div className="goal-segments">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={today.length > i ? "filled" : ""}
                          />
                        ))}
                      </div>
                      <p>
                        {today.length >= 5
                          ? "Five laps down. You showed up."
                          : "A few minutes is a good place to start."}
                      </p>
                    </div>
                  </section>
                  <section className="recent-races">
                    <div className="section-heading">
                      <h2>Recent races</h2>
                      <button
                        className="text-button history-link"
                        aria-label="See all race history"
                        onClick={() => navigate("progress")}
                      >
                        View all
                      </button>
                    </div>
                    {history.length ? (
                      <div className="recent-list">
                        {history.slice(0, 3).map((row) => (
                          <div key={row.id}>
                            <span className="recent-icon">
                              <FlagIcon />
                            </span>
                            <div>
                              <b>
                                {row.wpm} <small>wpm</small>
                              </b>
                              <span>{row.accuracy}% accuracy</span>
                            </div>
                            <span>{formatDate(row.date)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="recent-empty">
                        <span className="empty-mini-track">
                          <i />
                          <i />
                          <i />
                        </span>
                        <p>A clean starting line.</p>
                        <span>Your finished races appear here.</span>
                      </div>
                    )}
                  </section>
                  <section className="typing-tip">
                    <span className="tip-icon">
                      <BoltIcon />
                    </span>
                    <h3>
                      {weak.length
                        ? "A little targeted practice."
                        : "Smooth is fast."}
                    </h3>
                    <p>
                      {weak.length
                        ? `Your most missed keys: ${weak.map(([key]) => key).join(", ")}. Slow down and give them a little attention.`
                        : "Look at the next word, not the keyboard. A steady rhythm beats a rushed start."}
                    </p>
                    {weak.length > 0 && !isBusy && !room && (
                      <button
                        className="text-button"
                        onClick={() => drill(weak.map(([key]) => key))}
                      >
                        Practice these keys
                      </button>
                    )}
                  </section>
                </aside>
              </div>
            )}
          </>
        )}
        {!storageWorks && (
          <p className="storage-warning" role="status">
            <DangerCircleIcon />
            Browser storage is unavailable. Your results will only last for this
            visit.
          </p>
        )}
      </main>
      {message && (
        <div className="toast" role="status">
          <CheckCircleIcon />
          {message}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="dialog"
        onCancel={() => setDialog(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-inner">
          <div className="section-heading">
            <h2 id="dialog-title">
              {dialog === "settings" ? "Make it yours." : "Find your rhythm."}
            </h2>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <CloseCircleIcon />
            </button>
          </div>
          {dialog === "settings" ? (
            <div className="settings-form">
              <label htmlFor="display-name">Racer name</label>
              <input
                id="display-name"
                maxLength={24}
                value={settings.name}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
              />
              <label htmlFor="pace">
                Middle bot pace <b>{settings.pace} wpm</b>
              </label>
              <input
                id="pace"
                type="range"
                min={30}
                max={140}
                step={5}
                value={settings.pace}
                disabled={isBusy}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    pace: Number(event.target.value),
                  }))
                }
              />
              <p>The other bots race 20 wpm slower and faster.</p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      sound: event.target.checked,
                    }))
                  }
                />
                Soft typing sounds
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={settings.light}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      light: event.target.checked,
                    }))
                  }
                />
                Light theme
              </label>
              <button
                className="button primary full-width"
                onClick={() => setDialog(null)}
              >
                Back to the keys
              </button>
            </div>
          ) : (
            <div className="help-content">
              <p>
                Pick a passage and a time, then start the race. Type each
                character in order. Use backspace to fix a mistake before moving
                forward.
              </p>
              <div>
                <kbd>enter</kbd>
                <span>Start from the ready screen</span>
              </div>
              <div>
                <kbd>esc</kbd>
                <span>Restart a solo race</span>
              </div>
              <div>
                <kbd>tab</kbd>
                <span>Move between controls</span>
              </div>
              <h3>What the numbers mean</h3>
              <p>
                Speed counts five correct characters as one word. Accuracy
                remembers every typing mistake, even after you fix it.
                Consistency measures how steady your speed was.
              </p>
              <h3>Playing with friends</h3>
              <p>
                Create a room, share its link and wait for at least one friend.
                The host starts the shared countdown. Rooms hold six people and
                expire after two hours.
              </p>
              <p className="muted">
                Solo rivals are pace bots. Personal results stay on this device.
                Friend rooms are casual races, with no global ranking.
              </p>
              <p className="credit">
                Scoring adapted from Andrew Roach’s{" "}
                <a
                  href="https://github.com/aroach98/typerace"
                  target="_blank"
                  rel="noreferrer"
                >
                  typerace
                </a>
                , used under the MIT license. Icons by{" "}
                <a
                  href="https://www.figma.com/community/file/1166831539721848736"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solar / 480 Design
                </a>
                , used under CC BY 4.0.
              </p>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
