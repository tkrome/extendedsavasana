// Server-side YouTube Data API v3 helpers.
// Never import this file from client components — it references process.env.YOUTUBE_API_KEY.

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/** Extract video ID from any YouTube URL form, or return null. */
export function extractVideoId(input: string): string | null {
  // Bare 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();

  try {
    const url = new URL(input);
    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "music.youtube.com"
    ) {
      return url.searchParams.get("v");
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("?")[0];
      return id.length === 11 ? id : null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube API key not configured");

  const url = new URL(`${YT_API_BASE}/videos`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // cache for 1 hour
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // Read the error body to distinguish quota vs key restriction vs other
    let reason = "";
    try {
      const errData = await res.json();
      reason = errData?.error?.errors?.[0]?.reason ?? "";
    } catch {
      /* ignore parse failure */
    }

    if (res.status === 403) {
      if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
        throw new Error("youtube quota exceeded");
      }
      // accessNotConfigured, keyInvalid, forbidden, etc.
      throw new Error("youtube api key invalid or restricted");
    }

    throw new Error(`YouTube API responded with status ${res.status}`);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error("Video not found");

  const thumbnails = item.snippet.thumbnails;
  const thumbnailUrl =
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    "";

  return {
    videoId,
    title: item.snippet.title as string,
    description: item.snippet.description as string,
    thumbnailUrl,
  };
}
