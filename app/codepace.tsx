"use client";

import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import RaceResults from "@/components/race-results";
import AudioControls from "@/components/audio-controls";
import UserAvatar from "@/components/user-avatar";
import RoomSetup, { RoomConfiguration } from "@/components/room-setup";
import {
  defaultRoomContent,
  roomContentLabel,
  validRoomContent,
  type RoomContent,
} from "@/lib/room-content";
import CodePassage from "@/components/code-passage";
import TypingPassage from "@/components/typing-passage";
import {
  api,
  isNewerRoom,
  RequestError,
  restoreRoom,
  synchronizeRoom,
} from "@/lib/room-client";
import {
  codeLanguages,
  codeKeyLabel,
  codeTabText,
  type CodeExercise,
} from "@/lib/coding";
import { useBackgroundMusic } from "@/components/use-background-music";
import { FlagIcon } from "@solar-icons/react/linear/flag";
import { TargetIcon } from "@solar-icons/react/linear/target";
import { Chart2Icon } from "@solar-icons/react/linear/chart-2";
import { UsersGroupRoundedIcon } from "@solar-icons/react/linear/users-group-rounded";
import { RestartIcon } from "@solar-icons/react/linear/restart";
import { SettingsIcon } from "@solar-icons/react/linear/settings";
import { KeyboardIcon } from "@solar-icons/react/linear/keyboard";
import { CodeSquareIcon } from "@solar-icons/react/linear/code-square";
import { BoltIcon } from "@solar-icons/react/bold-duotone/bolt";
import { CloseCircleIcon } from "@solar-icons/react/linear/close-circle";
import { CheckCircleIcon } from "@solar-icons/react/linear/check-circle";
import { CopyIcon } from "@solar-icons/react/linear/copy";
import { CrownIcon } from "@solar-icons/react/bold-duotone/crown";
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
import { MoonIcon } from "@solar-icons/react/linear/moon";
import { SunIcon } from "@solar-icons/react/linear/sun";
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
import { ROOM_CAPACITY } from "@/lib/room-limits";
import { readSavedValue, removeSavedValue } from "@/lib/storage";

type Tab = "code" | "race" | "practice" | "friends" | "progress";
type Phase = "ready" | "countdown" | "running" | "finished";
type Settings = {
  name: string;
  avatarSeed: string;
  pace: number;
  sound: boolean;
  light: boolean;
};
const palette = ["cobalt", "violet", "coral", "blue", "pink", "yellow"];
const initialSettings: Settings = {
  name: "You",
  avatarSeed: "codepace",
  pace: 60,
  sound: false,
  light: false,
};
const MemoCodePractice = memo(lazy(() => import("@/components/code-practice")));
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function CodePace({
  initialRoom = "",
}: { initialRoom?: string } = {}) {
  const [tab, setTab] = useState<Tab>(initialRoom ? "friends" : "code");
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [mode, setMode] = useState<TextMode>(initialRoom ? "quotes" : "code");
  const [duration, setDuration] = useState(30);
  const [codeDuration, setCodeDuration] = useState(0);
  const [codeExercise, setCodeExercise] = useState<CodeExercise | null>(null);
  const codeExerciseRef = useRef<CodeExercise | null>(null);
  const [passage, setPassage] = useState(() =>
    initialRoom ? makePassage("quotes", 74) : "",
  );
  const passageRef = useRef(passage);
  const [engine, setEngine] = useState(emptyTyping);
  const engineRef = useRef<TypingState>(emptyTyping());
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(3);
  const [focused, setFocused] = useState(false);
  const [zen, setZen] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const {
    audioRef: musicAudioRef,
    enabled: musicEnabled,
    volume: musicVolume,
    playing: musicPlaying,
    error: musicError,
    unlock: unlockMusic,
    toggle: toggleMusic,
    setEnabled: setMusicEnabled,
    setVolume: setMusicVolume,
  } = useBackgroundMusic();
  const [history, setHistory] = useState<RaceResult[]>([]);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [dialog, setDialog] = useState<"settings" | "help" | null>(null);
  const [custom, setCustom] = useState("");
  const [weakKeys, setWeakKeys] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomContent, setRoomContent] =
    useState<RoomContent>(defaultRoomContent);
  const [roomDraftPending, setRoomDraftPending] = useState(false);
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
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const clockRttRef = useRef(Infinity);
  const roomSyncRef = useRef<ReturnType<typeof synchronizeRoom> | null>(null);
  const sessionRef = useRef(session);
  const effectiveDuration =
    tab === "code" && !session ? codeDuration : duration;
  const configRef = useRef({ duration: effectiveDuration, mode, tab });
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    configRef.current = { duration: effectiveDuration, mode, tab };
    sessionRef.current = session;
    passageRef.current = passage;
  }, [effectiveDuration, mode, tab, session, passage]);

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
  const codingStorageError = useCallback(() => setStorageWorks(false), []);
  const selectCodeExercise = useCallback(
    (exercise: CodeExercise | null) => {
      codeExerciseRef.current = exercise;
      setCodeExercise(exercise);
      clearEngine();
      changePhase("ready");
      setPassage(exercise?.code || "");
      passageRef.current = exercise?.code || "";
      setFocused(false);
    },
    [clearEngine, changePhase],
  );
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
          : config.tab === "race"
            ? "Race"
            : config.mode === "code" && codeExerciseRef.current
              ? `${codeExerciseRef.current.kind === "leetcode" ? "LeetCode" : "Code"} · ${codeExerciseRef.current.title} · ${codeLanguages.find((l) => l.id === codeExerciseRef.current?.language)?.name}`
              : config.mode,
        ...(config.mode === "code" && !joined && codeExerciseRef.current
          ? {
              coding: {
                language: codeExerciseRef.current.language,
                problemId: codeExerciseRef.current.problemId,
                completed: engineRef.current.typed === passageRef.current,
              },
            }
          : {}),
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
      roomSyncRef.current?.push();
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
      if (!isNewerRoom(snapshot, snapshotRef.current)) return;
      const previous = snapshotRef.current;
      snapshotRef.current = snapshot;
      const rtt = Date.now() - sentAt;
      if (rtt < clockRttRef.current || snapshot.round !== roundRef.current) {
        clockRttRef.current = rtt;
        offsetRef.current = snapshot.serverNow - (sentAt + Date.now()) / 2;
      }
      if (
        roundRef.current !== snapshot.round ||
        (previous && previous.passage !== snapshot.passage)
      ) {
        clearEngine();
        roundRef.current = snapshot.round;
      }
      setRoom(snapshot);
      setMode(snapshot.content?.mode || "quotes");
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
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      try {
        setHistory(
          readHistory(readSavedValue(localStorage, "codepace:history")),
        );
        const saved = JSON.parse(
          readSavedValue(localStorage, "codepace:settings:v2") || "{}",
        );
        setSettings({
          name:
            typeof saved.name === "string" ? saved.name.slice(0, 24) : "You",
          avatarSeed:
            typeof saved.avatarSeed === "string" && saved.avatarSeed.trim()
              ? saved.avatarSeed.slice(0, 128)
              : crypto.randomUUID(),
          pace: Number.isFinite(saved.pace)
            ? Math.max(30, Math.min(140, saved.pace))
            : 60,
          sound: saved.sound === true,
          light: typeof saved.light === "boolean" ? saved.light : false,
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
          readSavedValue(sessionStorage, "codepace:room") || "null",
        );
        if (
          remembered &&
          typeof remembered.code === "string" &&
          typeof remembered.id === "string" &&
          typeof remembered.token === "string" &&
          (!requested || requested === remembered.code)
        ) {
          setPending(true);
          try {
            const { data, sentAt } = await restoreRoom(
              remembered,
              controller.signal,
              () => {
                if (mounted) setRoomError("Reconnecting to your room…");
              },
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
            setRoomError("");
          } catch (error) {
            if (!mounted) return;
            if (
              error instanceof RequestError &&
              [400, 401, 404].includes(error.status)
            ) {
              removeSavedValue(sessionStorage, "codepace:room");
              setRoomError(error.message);
            }
          } finally {
            if (mounted) setPending(false);
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
      controller.abort();
    };
  }, [acceptRoom]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("codepace:history", JSON.stringify(history));
      localStorage.setItem("codepace:settings:v2", JSON.stringify(settings));
    } catch {
      queueMicrotask(() => setStorageWorks(false));
    }
    document.documentElement.dataset.theme = settings.light ? "light" : "dark";
  }, [history, settings, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (session)
        sessionStorage.setItem("codepace:room", JSON.stringify(session));
      else removeSavedValue(sessionStorage, "codepace:room");
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
    const synchronizer = synchronizeRoom({
      session,
      progress: () => ({
        round: roundRef.current,
        seq: ++seqRef.current,
        typed: engineRef.current.typed,
        strokes: engineRef.current.strokes,
        errors: engineRef.current.errors,
      }),
      phase: () => phaseRef.current,
      onRoom: acceptRoom,
      onError: (error) => {
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
        } else if (error instanceof RequestError && error.status === 400)
          notify(error.message);
      },
    });
    roomSyncRef.current = synchronizer;
    return () => {
      synchronizer.stop();
      roomSyncRef.current = null;
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
      const limit = configRef.current.duration
        ? configRef.current.duration * 1000
        : Infinity;
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
      const nextPassage =
        nextMode === "code"
          ? codeExerciseRef.current?.code || ""
          : makePassage(nextMode, Date.now(), nextCustom, keys, seconds);
      setPassage(nextPassage);
      passageRef.current = nextPassage;
      setFocused(false);
    },
    [custom, weakKeys, clearEngine, changePhase],
  );
  const begin = useCallback(() => {
    if (sessionRef.current || dialog) return;
    if (configRef.current.mode === "code" && !codeExerciseRef.current) {
      notify("Choose a code exercise first.");
      return;
    }
    if (configRef.current.mode === "custom" && passageRef.current.length < 30) {
      notify("Add at least 30 characters of custom text first.");
      return;
    }
    if (phaseRef.current === "finished" && configRef.current.mode !== "code")
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
  ]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        dialog ||
        tab === "progress" ||
        tab === "friends"
      )
        return;
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(
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
    if (effectiveDuration && time >= effectiveDuration * 1000) {
      finish(effectiveDuration * 1000);
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
    setWeakKeys([]);
    if (next !== "progress") {
      const nextMode =
        next === "code" ? "code" : next === "practice" ? "words" : "quotes";
      setMode(nextMode);
      reset(nextMode, "", [], next === "code" ? codeDuration : duration);
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
          ? { name: name.trim(), duration, content: roomContent }
          : { action: "join", name: name.trim() },
      );
      setSettings((previous) => ({ ...previous, name: name.trim() }));
      roundRef.current = 0;
      snapshotRef.current = null;
      clockRttRef.current = Infinity;
      sessionRef.current = data.session;
      try {
        sessionStorage.setItem("codepace:room", JSON.stringify(data.session));
      } catch {
        setStorageWorks(false);
      }
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
  async function roomAction(
    action: "start" | "rematch" | "leave" | "reclaim" | "configure",
    selection?: { content: RoomContent; duration: number },
  ) {
    if (!session || pending) return;
    setPending(true);
    setRoomError("");
    const sentAt = Date.now();
    try {
      const data = await api(
        `/api/rooms/${session.code}`,
        { action, round: room?.round, ...selection },
        session.token,
      );
      if (action === "leave") {
        roomSyncRef.current?.stop();
        sessionRef.current = null;
        try {
          removeSavedValue(sessionStorage, "codepace:room");
        } catch {
          setStorageWorks(false);
        }
        setSession(null);
        setRoom(null);
        snapshotRef.current = null;
        clockRttRef.current = Infinity;
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
  const remaining = effectiveDuration
    ? Math.max(0, Math.ceil(effectiveDuration - elapsed / 1000))
    : Math.floor(elapsed / 1000);
  const isSoloCoding = tab === "code" && !room;
  const isCoding = isSoloCoding || room?.content?.mode === "code";
  const activeCodeLanguage =
    room?.content?.mode === "code"
      ? room.content.language
      : codeExercise?.language;
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
  const largeRoom = !!room && racers.length > 10;
  const gridRacers = largeRoom
    ? [
        ...racers.filter((racer) => racer.id === ownId),
        ...racers.filter((racer) => racer.id !== ownId),
      ]
    : racers;
  const position = Math.max(
    1,
    [...racers]
      .sort((a, b) => b.correct - a.correct || a.finishedMs - b.finishedMs)
      .findIndex((racer) => racer.id === ownId) + 1,
  );
  const hasError = engine.typed.length > live.correct;
  const weak = useMemo(
    () =>
      Object.entries(
        history.reduce<Record<string, number>>((all, row) => {
          Object.entries(row.missed).forEach(([key, value]) => {
            all[key] = (all[key] || 0) + value;
          });
          return all;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [history],
  );
  const completedProblems = useMemo(
    () =>
      history
        .filter((row) => row.coding?.completed && row.coding.problemId)
        .map((row) => `${row.coding!.language}:${row.coding!.problemId}`),
    [history],
  );
  const drill = (keys: string[]) => {
    const letters = keys.filter(
      (key) => key.length === 1 && /[a-z]/i.test(key),
    );
    setTab("practice");
    setMode("words");
    setWeakKeys(letters);
    reset("words", "", letters);
  };

  const actionTools = (
    <div className="action-tools">
      <button
        className="icon-button"
        aria-label={zen ? "Exit focus mode" : "Enter focus mode"}
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
  );

  const typingPanel = (
    <section
      className={`typing-panel ${hasError ? "has-error" : ""} ${isCoding ? "coding-panel" : ""}`}
      aria-label="Typing race"
    >
      {isCoding && (
        <div className="code-editor-bar">
          <span className="code-file-tab">
            <CodeSquareIcon aria-hidden="true" />
            {room ? "race" : "practice"}.
            {codeLanguages.find(
              (language) => language.id === activeCodeLanguage,
            )?.extension || "txt"}
          </span>
          <div className="code-editor-actions">
            <span>
              {passage
                ? `${passage.split("\n").length} lines`
                : "Choose an exercise"}
            </span>
            {room ? null : phase === "ready" || phase === "finished" ? (
              <button
                className="button primary code-start-button"
                aria-label={
                  phase === "finished"
                    ? "Practise again"
                    : "Start coding practice"
                }
                disabled={!codeExercise}
                onClick={begin}
              >
                <RocketIcon />
                {phase === "finished" ? "Try again" : "Start typing"}
              </button>
            ) : (
              <button
                className="button secondary code-start-button"
                onClick={() => reset()}
              >
                <RestartIcon />
                Restart
              </button>
            )}
          </div>
        </div>
      )}
      <div className="typing-top">
        <div className="live-stats" aria-label="Live race statistics">
          <span
            className={
              effectiveDuration && remaining <= 5 && phase === "running"
                ? "time-urgent"
                : ""
            }
          >
            <b>
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")}
            </b>
            <span>{effectiveDuration ? "Time" : "Elapsed"}</span>
          </span>
          <span>
            <b>{live.wpm}</b>
            <span>WPM</span>
          </span>
          <span>
            <b>
              {live.accuracy}
              <small>%</small>
            </b>
            <span>Accuracy</span>
          </span>
        </div>
      </div>
      <div className="play-hud">
        <span className="passage-label">
          <KeyboardIcon />
          {room
            ? roomContentLabel(room.content || { mode: "quotes" })
            : mode === "code"
              ? codeExercise
                ? `${codeLanguages.find((l) => l.id === codeExercise.language)?.name} · ${codeExercise.title}`
                : "Choose an exercise"
              : mode === "words"
                ? weakKeys.length
                  ? "Focused words"
                  : "Common words"
                : mode === "custom"
                  ? "Your text"
                  : "Original passage"}
        </span>
        <span
          className={`combo-chip ${engine.streak >= 10 ? "combo-active" : ""}`}
        >
          <FireIcon />
          <b key={Math.floor(engine.streak / 10)}>{engine.streak}</b> clean keys
        </span>
        <span className="next-key">
          Next key{" "}
          <kbd>
            {isCoding
              ? codeKeyLabel(passage[engine.typed.length])
              : passage[engine.typed.length] === " "
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
              if (phase === "ready" && !room && (!isCoding || codeExercise))
                begin();
              else inputRef.current?.focus();
            }}
          >
            <div className="passage" ref={passageBox} aria-hidden="true">
              {isCoding ? (
                <CodePassage code={passage} typed={engine.typed} />
              ) : (
                <TypingPassage passage={passage} typed={engine.typed} />
              )}
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
                if (
                  isCoding &&
                  event.key === "Tab" &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  onInput(
                    engineRef.current.typed +
                      codeTabText(
                        passageRef.current,
                        engineRef.current.typed.length,
                      ),
                  );
                }
                if (isCoding && event.key === "Enter") {
                  event.preventDefault();
                  onInput(engineRef.current.typed + "\n");
                }
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
          <div
            className="race-meter"
            role="progressbar"
            aria-label="Passage completed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (live.correct / Math.max(1, passage.length)) * 100,
            )}
          >
            <span
              style={{
                transform: `scaleX(${live.correct / Math.max(1, passage.length)})`,
              }}
            />
          </div>
          <div className="typing-bottom">
            <span
              id="typing-instructions"
              className={hasError ? "error-text" : ""}
            >
              {hasError
                ? "Backspace to fix the highlighted mistake."
                : isCoding
                  ? "Enter for a new line. Tab for indentation. Shift+Tab to leave."
                  : phase === "running"
                    ? "Keep a steady rhythm. Accuracy comes first."
                    : room
                      ? "Everyone gets the same text and start time."
                      : "The clock starts after the countdown."}
            </span>
            <span className="language">
              <span className="tiny-dot" />
              {isCoding
                ? codeLanguages.find((l) => l.id === activeCodeLanguage)
                    ?.name || "Code"
                : "English"}
            </span>
            {actionTools}
          </div>
        </>
      ) : (
        <RaceResults
          result={result}
          attempted={engine.strokes > 0}
          practice={tab === "practice" || isSoloCoding}
          code={
            isCoding
              ? {
                  completed: engine.typed === passage,
                  length: passage.length,
                  fromLibrary:
                    isSoloCoding && codeExercise?.kind === "leetcode",
                }
              : undefined
          }
          placement={
            tab === "race" || isFriends
              ? { position, total: racers.length }
              : undefined
          }
          previousBest={history.reduce(
            (highest, row) =>
              row.id === result?.id ? highest : Math.max(highest, row.wpm),
            0,
          )}
        >
          {room && (
            <div
              className="room-standings"
              role={largeRoom ? "region" : undefined}
              aria-label={largeRoom ? "Room standings" : undefined}
              tabIndex={largeRoom ? 0 : undefined}
            >
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
        </RaceResults>
      )}
    </section>
  );

  return (
    <div
      className={`app slick-codepace view-${tab} ${zen ? "zen" : ""} phase-${phase}`}
      onPointerDownCapture={unlockMusic}
      onKeyDownCapture={unlockMusic}
    >
      <audio
        ref={musicAudioRef}
        src="/audio/reverie-scott-buckley.mp3"
        loop
        preload="none"
        aria-hidden="true"
      />
      <a className="skip-link" href="#main">
        Skip to practice
      </a>
      <header className="header">
        <button
          className="brand"
          onClick={() => navigate("code")}
          aria-label="CodePace home"
        >
          <span className="brand-mark" aria-hidden="true">
            <BoltIcon />
          </span>
          codepace<span className="brand-period">.</span>
        </button>
        <nav aria-label="Main navigation">
          {(
            [
              ["code", "Code", CodeSquareIcon],
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
          <AudioControls
            musicEnabled={musicEnabled}
            musicPlaying={musicPlaying}
            musicVolume={musicVolume}
            typingSound={settings.sound}
            onToggleMusic={toggleMusic}
            onVolumeChange={setMusicVolume}
            onToggleTyping={() =>
              setSettings((previous) => ({
                ...previous,
                sound: !previous.sound,
              }))
            }
          />
          <button
            className="icon-button theme-button"
            aria-label={
              settings.light ? "Switch to dark theme" : "Switch to light theme"
            }
            onClick={() =>
              setSettings((previous) => ({
                ...previous,
                light: !previous.light,
              }))
            }
          >
            {settings.light ? <MoonIcon /> : <SunIcon />}
          </button>
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
            <UserAvatar seed={settings.avatarSeed} />
          </button>
        </div>
      </header>
      <main
        id="main"
        className={`main ${isSoloCoding ? "code-main" : ""}`}
        tabIndex={-1}
      >
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
                  anchor.download = "codepace-history.json";
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
            {(tab === "race" || isFriends) && (
              <h1 className="sr-only">
                {isFriends ? "Race with friends" : "Typing race"}
              </h1>
            )}
            {tab !== "race" && !isFriends && (
              <div className="page-heading">
                <div>
                  <h1>
                    {isCoding ? "Code typing practice" : "Practice typing."}
                  </h1>
                  <p>
                    {isCoding
                      ? "Snippets, LeetCode solutions or your own code."
                      : "Find your rhythm with words, passages or your own text."}
                  </p>
                </div>
                {!isCoding && (
                  <button
                    className="button secondary invite-top"
                    onClick={() => navigate("friends")}
                  >
                    <UsersGroupRoundedIcon />
                    Race with friends
                  </button>
                )}
              </div>
            )}
            {room && (
              <div
                className="room-controls"
                role="group"
                aria-label="Room controls"
              >
                <button
                  className="room-invite"
                  onClick={() => void copyInvite()}
                  aria-label={`Copy invite link for room ${room.code}`}
                  title="Copy invite link"
                >
                  <span className="room-code-value">{room.code}</span>
                  <CopyIcon aria-hidden="true" />
                </button>
                <span
                  className={`room-occupancy ${connection ? "" : "offline"}`}
                  role="status"
                  aria-label={
                    connection
                      ? `${room.players.length} of ${ROOM_CAPACITY} players in room`
                      : "Reconnecting to room"
                  }
                >
                  <UsersGroupRoundedIcon aria-hidden="true" />
                  <span aria-hidden="true">
                    {connection
                      ? `${room.players.length}/${ROOM_CAPACITY}`
                      : "Reconnecting…"}
                  </span>
                </span>
                <button
                  className="button secondary room-leave"
                  disabled={pending}
                  onClick={() => void roomAction("leave")}
                >
                  <LogoutIcon aria-hidden="true" />
                  Leave room
                </button>
              </div>
            )}
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
                  <p>
                    Up to {ROOM_CAPACITY} racers. No accounts needed in the
                    game.
                  </p>
                  <label htmlFor="racer-name">Your racer name</label>
                  <input
                    id="racer-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={24}
                    placeholder="What should we call you?"
                    autoComplete="nickname"
                  />
                  <RoomSetup
                    content={roomContent}
                    duration={duration}
                    disabled={pending}
                    onChange={(content, seconds) => {
                      setRoomContent(content);
                      setDuration(seconds);
                    }}
                  />
                  <button
                    className="button primary full-width"
                    disabled={
                      pending || !name.trim() || !validRoomContent(roomContent)
                    }
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
                <div
                  className={`race-column ${isSoloCoding ? "code-workspace" : ""} ${room ? "room-race" : ""}`}
                >
                  {room && host && room.phase === "lobby" && (
                    <RoomConfiguration
                      key={JSON.stringify([
                        room.code,
                        room.round,
                        room.duration,
                        room.content,
                      ])}
                      content={room.content || { mode: "quotes" }}
                      duration={room.duration}
                      disabled={pending}
                      onDirtyChange={setRoomDraftPending}
                      onApply={(content, seconds) =>
                        void roomAction("configure", {
                          content,
                          duration: seconds,
                        })
                      }
                    />
                  )}
                  {!room && (
                    <div className="race-toolbar">
                      {!isCoding && (
                        <div className="segments" aria-label="Passage mode">
                          {(
                            [
                              "quotes",
                              "words",
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
                      )}
                      <div className="toolbar-end">
                        <div
                          className="times"
                          aria-label={
                            isCoding
                              ? "Code practice duration"
                              : "Race duration"
                          }
                        >
                          {(isCoding ? [0, 60, 180] : [15, 30, 60]).map(
                            (seconds) => (
                              <button
                                key={seconds}
                                disabled={isBusy}
                                className={
                                  effectiveDuration === seconds
                                    ? "selected"
                                    : ""
                                }
                                aria-pressed={effectiveDuration === seconds}
                                onClick={() => {
                                  if (isCoding) setCodeDuration(seconds);
                                  else setDuration(seconds);
                                  reset(mode, custom, weakKeys, seconds);
                                }}
                              >
                                {seconds === 0 ? "Full code" : seconds}
                                {seconds !== 0 && <span>s</span>}
                              </button>
                            ),
                          )}
                        </div>
                        <span className="toolbar-divider" />
                        <button
                          className="icon-button"
                          aria-label={
                            isCoding ? "Practice settings" : "Race settings"
                          }
                          onClick={() => setDialog("settings")}
                        >
                          <SettingsIcon />
                        </button>
                        {tab === "race" && (
                          <button
                            className="icon-button invite-top"
                            aria-label="Race with friends"
                            title="Race with friends"
                            onClick={() => navigate("friends")}
                          >
                            <UsersGroupRoundedIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {isSoloCoding && (
                    <Suspense
                      fallback={<div role="status">Loading code practice…</div>}
                    >
                      <MemoCodePractice
                        disabled={isBusy}
                        completed={completedProblems}
                        onChange={selectCodeExercise}
                        onStorageError={codingStorageError}
                      />
                    </Suspense>
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
                    {((!room && !isCoding) || phase === "finished") && (
                      <div className="race-actions">
                        <div>
                          {!room &&
                            !isCoding &&
                            (phase === "ready" || phase === "finished") && (
                              <button
                                className="button primary start-button"
                                disabled={isCoding && !codeExercise}
                                onClick={begin}
                              >
                                <RocketIcon />
                                {isCoding
                                  ? phase === "finished"
                                    ? "Practise again"
                                    : "Start coding practice"
                                  : phase === "finished"
                                    ? "Race again"
                                    : tab === "practice"
                                      ? "Start practice"
                                      : "Start race"}
                                <kbd>enter</kbd>
                              </button>
                            )}
                          {!room && !isCoding && isBusy && (
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
                        {phase === "finished" && actionTools}
                      </div>
                    )}
                  </div>
                  <details className="track-drawer" open>
                    <summary>
                      <span>
                        <CarIcon />
                        {room
                          ? "Room grid"
                          : tab === "practice" || isCoding
                            ? "Your lane"
                            : "Race grid"}
                      </span>
                      <span>
                        {racers.length}{" "}
                        {racers.length === 1 ? "racer" : "racers"}
                        <span className="grid-toggle">
                          <span className="grid-show-label">View</span>
                          <span className="grid-hide-label">Hide</span>
                        </span>
                      </span>
                    </summary>
                    <section className="track-panel" aria-label="Race progress">
                      <div className="track-heading">
                        <h2>
                          {room
                            ? "Starting grid"
                            : tab === "practice" || isCoding
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
                      <div
                        className={`lanes ${largeRoom ? "room-lanes" : ""}`}
                        role={largeRoom ? "region" : undefined}
                        aria-label={largeRoom ? "All racers" : undefined}
                        tabIndex={largeRoom ? 0 : undefined}
                      >
                        {gridRacers.map((racer) => (
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
                                roomDraftPending ||
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
                  </details>
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
      {(message || musicError) && (
        <div className="toast" role="status">
          <CheckCircleIcon />
          {message || musicError}
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
                  checked={musicEnabled}
                  onChange={(event) => setMusicEnabled(event.target.checked)}
                />
                Background music
              </label>
              <label htmlFor="music-volume">
                Music volume <b>{Math.round(musicVolume * 100)}%</b>
              </label>
              <input
                id="music-volume"
                type="range"
                min={0}
                max={100}
                value={Math.round(musicVolume * 100)}
                onChange={(event) =>
                  setMusicVolume(Number(event.target.value) / 100)
                }
              />
              <p className="music-credit">
                <a
                  href="https://www.scottbuckley.com.au/library/reverie/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Reverie by Scott Buckley
                </a>{" "}
                ·{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
              </p>
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
                The host starts the shared countdown. Rooms hold up to{" "}
                {ROOM_CAPACITY} people and expire after two hours.
              </p>
              <p className="muted">
                Solo rivals are pace bots. Personal results stay on this device.
                Friend rooms are casual races, with no global ranking.
              </p>
              <p className="credit">
                Background photo by{" "}
                <a
                  href="https://unsplash.com/photos/the-night-sky-with-stars-above-a-mountain-range-IO1d7aXD0bs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Aimee Zaugg / Unsplash
                </a>
                , used under the{" "}
                <a
                  href="https://unsplash.com/license"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unsplash License
                </a>
                . Music:{" "}
                <a
                  href="https://www.scottbuckley.com.au/library/reverie/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Reverie by Scott Buckley
                </a>
                , released under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                . Encoded for the web.
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
              <p className="credit">
                Avatars generated with{" "}
                <a
                  href="https://www.dicebear.com/styles/dylan/"
                  target="_blank"
                  rel="noreferrer"
                >
                  DiceBear’s Dylan style by Natalia Spivak
                </a>
                , used under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
