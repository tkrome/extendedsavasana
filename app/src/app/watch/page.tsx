import { redirect } from "next/navigation";
import Link from "next/link";
import SavasanaPlayer from "@/components/SavasanaPlayer";
import ThemeToggle from "@/components/ThemeToggle";

interface SearchParams {
  v?: string;
  pause?: string;
  duration?: string;
  music?: string;
  manual?: string;
}

function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const videoId = params.v;
  const durationStr = params.duration;
  const pauseStr = params.pause;
  const musicId = params.music;
  const isManual = params.manual === "1";

  // Validate required params
  if (!videoId || !isValidVideoId(videoId)) redirect("/");
  if (!durationStr) redirect("/");

  const durationSeconds = parseInt(durationStr, 10);
  if (isNaN(durationSeconds) || durationSeconds < 60 || durationSeconds > 7200) redirect("/");

  const pauseSeconds =
    pauseStr !== undefined ? parseInt(pauseStr, 10) : null;
  if (pauseSeconds !== null && (isNaN(pauseSeconds) || pauseSeconds < 0)) {
    redirect("/");
  }

  const resolvedMusicId =
    musicId && isValidVideoId(musicId) ? musicId : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal nav */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-sage-100 dark:border-sage-800">
        <Link
          href="/"
          className="text-sage-700 hover:text-sage-900 dark:text-sage-300 dark:hover:text-sage-100 text-sm transition"
        >
          Extended Savasana
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="text-xs text-sage-400 hover:text-sage-600 dark:text-sage-500 dark:hover:text-sage-300 transition"
          >
            New practice
          </Link>
        </div>
      </header>

      {/* Player */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <SavasanaPlayer
            videoId={videoId}
            pauseSeconds={pauseSeconds}
            durationSeconds={durationSeconds}
            musicVideoId={resolvedMusicId}
            isManual={isManual}
          />
        </div>
      </main>
    </div>
  );
}
