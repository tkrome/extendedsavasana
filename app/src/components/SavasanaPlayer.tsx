"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadYouTubeApi, YTPlayer } from "@/lib/youtubeApi";
import { secondsToTimestamp } from "@/lib/parseTimestamps";

// ─── Constants ──────────────────────────────────────────────────────────────

const CROSSFADE_MS = 4_000; // 4 seconds per crossfade
const CROSSFADE_STEPS = 40; // one tick every 100 ms
const POLL_INTERVAL_MS = 500; // how often to check yoga player position
const DEFAULT_MUSIC_ID = "UfcAVejslrU";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | "loading" // players not ready yet
  | "playing" // yoga video playing, waiting for pause point
  | "fading_out" // yoga fading out, meditation fading in
  | "meditating" // extended savasana in progress, countdown running
  | "fading_in" // meditation fading out, yoga fading back in
  | "complete"; // savasana extension done, yoga continues

interface Props {
  videoId: string;
  pauseSeconds: number | null; // null = user will set live
  durationSeconds: number;
  musicVideoId?: string;
  isManual?: boolean; // true = timestamp was user-entered (not auto-detected)
}

// ─── Circular countdown ring ─────────────────────────────────────────────────

function CircularTimer({
  total,
  remaining,
  isPaused,
}: {
  total: number;
  remaining: number;
  isPaused: boolean;
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / total;
  const dashOffset = circumference * (1 - progress);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    // Outer container is relative + fixed size so the absolute text overlay
    // is centered within the SVG bounds.
    <div className="relative flex items-center justify-center w-[200px] h-[200px]">
      <svg width="200" height="200" className="-rotate-90">
        {/* Track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="6"
        />
        {/* Progress */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: isPaused ? "none" : "stroke-dashoffset 0.9s linear" }}
        />
      </svg>
      {/* Text centered inside the ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white/50 text-sm tracking-widest uppercase">
          {isPaused ? "Paused" : "Savasana"}
        </span>
        <span className="text-white text-5xl font-light tabular-nums mt-1">
          {label}
        </span>
        {remaining <= 30 && remaining > 0 && !isPaused && (
          <span className="text-white/60 text-xs mt-2 tracking-wide">
            Resuming soon…
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SavasanaPlayer({
  videoId,
  pauseSeconds: initialPauseSeconds,
  durationSeconds,
  musicVideoId = DEFAULT_MUSIC_ID,
  isManual = false,
}: Props) {
  const yogaContainerRef = useRef<HTMLDivElement>(null);
  const meditationContainerRef = useRef<HTMLDivElement>(null);
  const yogaPlayerRef = useRef<YTPlayer | null>(null);
  const meditationPlayerRef = useRef<YTPlayer | null>(null);

  // Mutable refs used inside interval callbacks to avoid stale closures
  const pauseSecondsRef = useRef<number | null>(initialPauseSeconds);
  const phaseRef = useRef<Phase>("loading");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const yogaReadyRef = useRef(false);
  const meditationReadyRef = useRef(false);

  // Tracks remaining seconds in a ref so interval callbacks never go stale
  const remainingRef = useRef(durationSeconds);
  // Prevent saving the community timestamp more than once per session
  const timestampSavedRef = useRef(false);

  // React state for rendering
  const [phase, setPhase] = useState<Phase>("loading");
  const [remaining, setRemaining] = useState(durationSeconds);
  const [isPaused, setIsPaused] = useState(false);
  // Live pause-point setting
  const [livePauseSeconds, setLivePauseSeconds] = useState<number | null>(
    initialPauseSeconds,
  );
  const [liveMode] = useState(initialPauseSeconds === null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clearAllIntervals() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (crossfadeRef.current) clearInterval(crossfadeRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollingRef.current = null;
    crossfadeRef.current = null;
    timerRef.current = null;
  }

  function transitionTo(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  // ── Crossfade + savasana extension ─────────────────────────────────────────

  function saveCommunityTimestamp(timestampSeconds: number) {
    if (timestampSavedRef.current) return;
    timestampSavedRef.current = true;
    fetch("/api/timestamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestampSeconds }),
    }).catch(() => {
      // Non-critical: silently ignore save failures
    });
  }

  const startSavasanaExtension = useCallback(() => {
    const yoga = yogaPlayerRef.current;
    const med = meditationPlayerRef.current;
    if (!yoga || !med) return;

    // Save community timestamp when it was manually set (preset or live)
    const pauseAt = pauseSecondsRef.current;
    if ((isManual || initialPauseSeconds === null) && pauseAt !== null) {
      saveCommunityTimestamp(pauseAt);
    }

    transitionTo("fading_out");

    // Rewind & start meditation music from the beginning, volume 0
    med.seekTo(0, true);
    med.setVolume(0);
    med.unMute();
    med.playVideo();

    let step = 0;
    crossfadeRef.current = setInterval(() => {
      step++;
      const t = step / CROSSFADE_STEPS; // 0 → 1
      yoga.setVolume(Math.round(100 * (1 - t)));
      med.setVolume(Math.round(100 * t));

      if (step >= CROSSFADE_STEPS) {
        clearInterval(crossfadeRef.current!);
        crossfadeRef.current = null;
        yoga.pauseVideo();
        yoga.setVolume(0); // ensure silent
        startCountdown();
      }
    }, CROSSFADE_MS / CROSSFADE_STEPS);
  }, []);

  function startCountdown() {
    transitionTo("meditating");
    remainingRef.current = durationSeconds;
    setRemaining(durationSeconds);
    runTimerInterval();
  }

  function runTimerInterval() {
    timerRef.current = setInterval(() => {
      remainingRef.current--;
      setRemaining(remainingRef.current);

      if (remainingRef.current <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        startFadeIn();
      }
    }, 1_000);
  }

  function startFadeIn() {
    const yoga = yogaPlayerRef.current;
    const med = meditationPlayerRef.current;
    if (!yoga || !med) return;

    transitionTo("fading_in");

    // Resume yoga from the saved pause point
    const pauseAt = pauseSecondsRef.current;
    if (pauseAt !== null) yoga.seekTo(pauseAt, true);
    yoga.playVideo();

    let step = 0;
    crossfadeRef.current = setInterval(() => {
      step++;
      const t = step / CROSSFADE_STEPS; // 0 → 1
      yoga.setVolume(Math.round(100 * t));
      med.setVolume(Math.round(100 * (1 - t)));

      if (step >= CROSSFADE_STEPS) {
        clearInterval(crossfadeRef.current!);
        crossfadeRef.current = null;
        med.pauseVideo();
        med.setVolume(0);
        yoga.setVolume(100);
        transitionTo("complete");
      }
    }, CROSSFADE_MS / CROSSFADE_STEPS);
  }

  // ── Polling loop ───────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    pollingRef.current = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const yoga = yogaPlayerRef.current;
      if (!yoga) return;

      const currentTime = yoga.getCurrentTime();
      const pauseAt = pauseSecondsRef.current;

      if (pauseAt !== null && currentTime >= pauseAt - 0.3) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        startSavasanaExtension();
      }
    }, POLL_INTERVAL_MS);
  }, [startSavasanaExtension]);

  // ── Player initialization ──────────────────────────────────────────────────

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await loadYouTubeApi();
      if (destroyed) return;

      const YT = window.YT;

      // Yoga player
      yogaPlayerRef.current = new YT.Player(yogaContainerRef.current!, {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            yogaReadyRef.current = true;
            maybeStartPolling();
          },
          onStateChange: (e) => {
            // If yoga ends before savasana is triggered, still mark complete
            if (e.data === window.YT.PlayerState.ENDED) {
              if (phaseRef.current === "playing") transitionTo("complete");
            }
          },
        },
      });

      // Meditation player — hidden, muted, not autoplayed
      meditationPlayerRef.current = new YT.Player(
        meditationContainerRef.current!,
        {
          height: "1",
          width: "1",
          videoId: musicVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              meditationPlayerRef.current!.setVolume(0);
              meditationPlayerRef.current!.mute();
              meditationReadyRef.current = true;
              maybeStartPolling();
            },
            onStateChange: (e) => {
              // Loop meditation music if it ends while savasana is active
              if (
                e.data === window.YT.PlayerState.ENDED &&
                (phaseRef.current === "meditating" ||
                  phaseRef.current === "fading_in")
              ) {
                meditationPlayerRef.current?.seekTo(0, true);
                meditationPlayerRef.current?.playVideo();
              }
            },
          },
        },
      );
    }

    function maybeStartPolling() {
      if (!yogaReadyRef.current || !meditationReadyRef.current) return;
      // Unmute the yoga player (it starts muted due to autoplay policy in some browsers)
      yogaPlayerRef.current?.unMute();
      yogaPlayerRef.current?.setVolume(100);
      meditationPlayerRef.current?.unMute();
      transitionTo("playing");
      if (pauseSecondsRef.current !== null) {
        startPolling();
      }
      // If live mode, polling starts when the user clicks "Set pause point"
    }

    init();

    return () => {
      destroyed = true;
      clearAllIntervals();
      yogaPlayerRef.current?.destroy();
      meditationPlayerRef.current?.destroy();
    };
  }, [videoId, musicVideoId, startPolling]);

  // ── Savasana controls ──────────────────────────────────────────────────────

  function handlePauseResume() {
    if (isPaused) {
      meditationPlayerRef.current?.playVideo();
      runTimerInterval();
      setIsPaused(false);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      meditationPlayerRef.current?.pauseVideo();
      setIsPaused(true);
    }
  }

  function handleSkip() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPaused(false);
    startFadeIn();
  }

  // ── Live pause-point handler ───────────────────────────────────────────────

  function handleSetLivePause() {
    const yoga = yogaPlayerRef.current;
    if (!yoga) return;
    const t = Math.floor(yoga.getCurrentTime());
    pauseSecondsRef.current = t;
    setLivePauseSeconds(t);
    startSavasanaExtension();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const showOverlay =
    phase === "fading_out" || phase === "meditating" || phase === "fading_in";

  return (
    <div className="flex flex-col items-center w-full">
      {/* Video area */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {/* Yoga video */}
        <div ref={yogaContainerRef} className="absolute inset-0" />

        {/* Meditation overlay */}
        {showOverlay && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-8">
            <CircularTimer
              total={durationSeconds}
              remaining={remaining}
              isPaused={isPaused}
            />
            {phase === "meditating" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePauseResume}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition border border-white/20"
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={handleSkip}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition border border-white/20"
                >
                  End savasana
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete banner */}
        {phase === "complete" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sage-700/90 text-white text-sm px-5 py-2.5 rounded-full z-10 shadow-lg">
            Savasana complete — enjoy the rest of your practice
          </div>
        )}

        {/* Loading overlay */}
        {phase === "loading" && (
          <div className="absolute inset-0 bg-sage-900/60 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden meditation player container */}
      <div
        ref={meditationContainerRef}
        className="absolute pointer-events-none opacity-0"
        aria-hidden="true"
      />

      {/* Info bar below video */}
      <div className="w-full mt-4 flex items-center justify-between text-sm text-sage-600 dark:text-sage-400 px-1">
        <div>
          {phase === "playing" && pauseSecondsRef.current !== null && (
            <span>
              Pause point:{" "}
              <span className="font-mono font-medium text-sage-700">
                {secondsToTimestamp(pauseSecondsRef.current)}
              </span>
            </span>
          )}
          {phase === "fading_out" && (
            <span className="text-sage-500 italic">
              Easing into savasana…
            </span>
          )}
          {phase === "meditating" && (
            <span>
              Extended savasana:{" "}
              <span className="font-mono font-medium text-sage-700">
                {secondsToTimestamp(durationSeconds)}
              </span>{" "}
              total
            </span>
          )}
          {phase === "fading_in" && (
            <span className="text-sage-500 italic">
              Returning to your practice…
            </span>
          )}
          {phase === "complete" && (
            <span className="text-sage-500">
              Extended savasana complete.
            </span>
          )}
        </div>

        {/* Live pause button */}
        {liveMode && phase === "playing" && (
          <button
            onClick={handleSetLivePause}
            className="px-4 py-2 rounded-lg bg-sage-500 hover:bg-sage-600 text-white text-sm transition"
          >
            Pause here for savasana
          </button>
        )}

        {/* Show live pause point once set */}
        {liveMode && livePauseSeconds !== null && phase !== "playing" && (
          <span>
            Paused at{" "}
            <span className="font-mono font-medium text-sage-700">
              {secondsToTimestamp(livePauseSeconds)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
