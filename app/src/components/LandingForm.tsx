"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  secondsToTimestamp,
  timestampToSeconds,
} from "@/lib/parseTimestamps";
import ThemeToggle from "@/components/ThemeToggle";

const DEFAULT_MUSIC_ID = "UfcAVejslrU";
const DEFAULT_MUSIC_LABEL = "Marconi Union - Weightless Part 1";

interface VideoInfo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  detectedTimestamp: number | null;
  communityTimestamp: number | null;
}

function extractVideoId(url: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
  } catch {
    /* not a URL */
  }
  return null;
}

export default function LandingForm() {
  const router = useRouter();

  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Step 1 state
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("10");
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [showMusicOptions, setShowMusicOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 2 state
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [pauseInput, setPauseInput] = useState("");
  const [pauseInputError, setPauseInputError] = useState("");
  const [setLive, setSetLive] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to fetch video info.");
        return;
      }

      setVideoInfo(data);
      if (data.detectedTimestamp !== null) {
        setPauseInput(secondsToTimestamp(data.detectedTimestamp));
        setSetLive(false);
      } else if (data.communityTimestamp !== null) {
        setPauseInput(secondsToTimestamp(data.communityTimestamp));
        setSetLive(false);
      } else {
        setPauseInput("");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!videoInfo) return;

    const durationSecs = Math.round(parseFloat(duration) * 60);
    if (isNaN(durationSecs) || durationSecs < 60) {
      setError("Savasana duration must be at least 1 minute.");
      return;
    }

    let pauseSecs: number | null = null;
    let isManual = false;
    if (!setLive) {
      pauseSecs = timestampToSeconds(pauseInput);
      if (pauseSecs === null) {
        setPauseInputError("Enter a valid timestamp (e.g. 45:30 or 1:23:00)");
        return;
      }
      // Manual if user entered a timestamp that wasn't auto-detected from the description
      isManual = videoInfo.detectedTimestamp === null;
    }

    // Resolve meditation music video ID
    let musicId = DEFAULT_MUSIC_ID;
    if (customMusicUrl.trim()) {
      const extracted = extractVideoId(customMusicUrl.trim());
      if (extracted) musicId = extracted;
    }

    const params = new URLSearchParams({
      v: videoInfo.videoId,
      duration: String(durationSecs),
      music: musicId,
    });
    if (pauseSecs !== null) params.set("pause", String(pauseSecs));
    if (isManual) params.set("manual", "1");

    router.push(`/watch?${params.toString()}`);
  }

  // Shared input classes
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-sage-200 dark:border-sage-700 bg-white dark:bg-[#252a25] text-sage-900 dark:text-sage-100 placeholder:text-sage-400 dark:placeholder:text-sage-600 focus:border-sage-400 dark:focus:border-sage-500 focus:ring-2 focus:ring-sage-100 dark:focus:ring-sage-800 outline-none transition text-sm";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 pb-24">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light tracking-wide text-sage-800 dark:text-sage-100 mb-3">
            Extended Savasana
          </h1>
          <p className="text-sage-600 dark:text-sage-400 text-lg mb-4">
            Take the rest your practice deserves.
          </p>
          <button
            type="button"
            onClick={() => setShowHowItWorks((v: boolean) => !v)}
            className="text-sm text-sage-400 dark:text-sage-500 hover:text-sage-600 dark:hover:text-sage-300 transition inline-flex items-center gap-1.5"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showHowItWorks ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            How it works
          </button>

          {showHowItWorks && (
            <div className="mt-4 text-left bg-white dark:bg-[#252a25] border border-sage-100 dark:border-sage-800 rounded-2xl px-6 py-5 space-y-3">
              {(
                [
                  ["Paste your video", "Drop in any YouTube yoga class URL."],
                  ["Set your pause point", "We detect the savasana timestamp from the video description, or you can enter it manually — or set it live while watching."],
                  ["Choose a duration", "Pick how long your savasana should be extended."],
                  ["Rest", "At the pause point the yoga video fades out and meditation music fades in. A countdown runs for your chosen duration."],
                  ["Resume", "Music fades out, the yoga video fades back in at the exact moment it paused, and your class continues."],
                ] as [string, string][]
              ).map(([title, desc], i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sage-100 dark:bg-sage-800 text-sage-500 dark:text-sage-400 text-xs flex items-center justify-center font-medium mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-sage-600 dark:text-sage-400">
                    <span className="font-medium text-sage-700 dark:text-sage-300">{title}. </span>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {!videoInfo ? (
          /* ── Step 1: Video URL + preferences ── */
          <form
            onSubmit={handleLookup}
            className="bg-white dark:bg-[#252a25] rounded-2xl shadow-sm border border-sage-100 dark:border-sage-800 p-8 space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
                YouTube yoga video URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
                Desired savasana extension
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  max="120"
                  step="1"
                  required
                  className="w-24 px-4 py-3 rounded-xl border border-sage-200 dark:border-sage-700 bg-white dark:bg-[#252a25] text-sage-900 dark:text-sage-100 focus:border-sage-400 dark:focus:border-sage-500 focus:ring-2 focus:ring-sage-100 dark:focus:ring-sage-800 outline-none transition text-sm"
                />
                <span className="text-sage-600 dark:text-sage-400 text-sm">minutes</span>
              </div>
            </div>

            {/* Music options */}
            <div>
              <button
                type="button"
                onClick={() => setShowMusicOptions(!showMusicOptions)}
                className="text-sm text-sage-500 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-200 transition underline underline-offset-2"
              >
                {showMusicOptions
                  ? "Hide music options"
                  : "Customize meditation music"}
              </button>
              {showMusicOptions && (
                <div className="mt-3 p-4 bg-sage-50 dark:bg-sage-900/30 rounded-xl space-y-2">
                  <p className="text-xs text-sage-600 dark:text-sage-400">
                    Default:{" "}
                    <span className="font-medium">{DEFAULT_MUSIC_LABEL}</span>
                  </p>
                  <input
                    type="url"
                    value={customMusicUrl}
                    onChange={(e) => setCustomMusicUrl(e.target.value)}
                    placeholder="Paste a YouTube URL for custom music (optional)"
                    className="w-full px-3 py-2.5 rounded-lg border border-sage-200 dark:border-sage-700 bg-white dark:bg-[#252a25] text-sage-900 dark:text-sage-100 placeholder:text-sage-400 dark:placeholder:text-sage-600 focus:border-sage-400 dark:focus:border-sage-500 outline-none transition text-sm"
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-3 rounded-xl bg-sage-500 hover:bg-sage-600 disabled:bg-sage-200 dark:disabled:bg-sage-800 disabled:cursor-not-allowed text-white font-medium transition"
            >
              {loading ? "Looking up video…" : "Continue"}
            </button>
          </form>
        ) : (
          /* ── Step 2: Confirm pause point ── */
          <form
            onSubmit={handleStart}
            className="bg-white dark:bg-[#252a25] rounded-2xl shadow-sm border border-sage-100 dark:border-sage-800 p-8 space-y-6"
          >
            {/* Video card */}
            <div className="flex items-start gap-4 p-4 bg-sage-50 dark:bg-sage-900/30 rounded-xl">
              {videoInfo.thumbnailUrl && (
                <img
                  src={videoInfo.thumbnailUrl}
                  alt=""
                  className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sage-800 dark:text-sage-200 line-clamp-2">
                  {videoInfo.title}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setVideoInfo(null);
                    setError("");
                  }}
                  className="text-xs text-sage-400 hover:text-sage-600 dark:text-sage-500 dark:hover:text-sage-300 mt-1.5 transition"
                >
                  Change video
                </button>
              </div>
            </div>

            {/* Pause point */}
            <div>
              <label className="block text-sm font-medium text-sage-700 dark:text-sage-300 mb-1">
                Pause point
              </label>
              {videoInfo.detectedTimestamp !== null ? (
                <p className="text-xs text-sage-500 dark:text-sage-400 mb-2">
                  Savasana detected at{" "}
                  <span className="font-mono font-medium">
                    {secondsToTimestamp(videoInfo.detectedTimestamp)}
                  </span>{" "}
                  — adjust if needed.
                </p>
              ) : videoInfo.communityTimestamp !== null ? (
                <p className="text-xs text-sage-500 dark:text-sage-400 mb-2">
                  Community suggestion:{" "}
                  <span className="font-mono font-medium">
                    {secondsToTimestamp(videoInfo.communityTimestamp)}
                  </span>{" "}
                  — adjust if needed.
                </p>
              ) : (
                <p className="text-xs text-sage-500 dark:text-sage-400 mb-2">
                  No savasana timestamp found — enter one below or set it while watching.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm text-sage-600 dark:text-sage-400 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={setLive}
                  onChange={(e) => {
                    setSetLive(e.target.checked);
                    setPauseInputError("");
                  }}
                  className="rounded border-sage-300 dark:border-sage-600 text-sage-500 focus:ring-sage-300 dark:focus:ring-sage-700"
                />
                Set the pause point while watching
              </label>

              {!setLive && (
                <>
                  <input
                    type="text"
                    value={pauseInput}
                    onChange={(e) => {
                      setPauseInput(e.target.value);
                      setPauseInputError("");
                    }}
                    placeholder="e.g. 45:30 or 1:23:00"
                    required={!setLive}
                    className={inputCls + " font-mono"}
                  />
                  {pauseInputError && (
                    <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">
                      {pauseInputError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
                Savasana duration
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  max="120"
                  step="1"
                  required
                  className="w-24 px-4 py-3 rounded-xl border border-sage-200 dark:border-sage-700 bg-white dark:bg-[#252a25] text-sage-900 dark:text-sage-100 focus:border-sage-400 dark:focus:border-sage-500 focus:ring-2 focus:ring-sage-100 dark:focus:ring-sage-800 outline-none transition text-sm"
                />
                <span className="text-sage-600 dark:text-sage-400 text-sm">minutes</span>
              </div>
            </div>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-sage-500 hover:bg-sage-600 text-white font-medium transition"
            >
              Begin practice
            </button>
          </form>
        )}
      </div>

      {/* Donation footer */}
      <p className="mt-10 text-xs text-sage-400 dark:text-sage-600 text-center">
        Free to use.{" "}
        <a
          href="https://venmo.com/Tyler-Krome"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-sage-600 dark:hover:text-sage-400 transition"
        >
          Venmo
        </a>
        {" · "}
        <a
          href="https://paypal.me/extendedsavasana"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-sage-600 dark:hover:text-sage-400 transition"
        >
          PayPal
        </a>{" "}
        a dollar to help with hosting costs.
      </p>
    </div>
  );
}
