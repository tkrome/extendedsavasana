import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractVideoId, fetchVideoInfo } from "@/lib/youtube";
import { parseSavasanaTimestamp } from "@/lib/parseTimestamps";
import { rateLimit } from "@/lib/rateLimit";
import { getMedianTimestamp } from "@/lib/db";

const RequestSchema = z.object({
  url: z.string().min(1).max(500),
});

function getClientIp(request: NextRequest): string {
  // Prefer X-Real-IP: set by nginx from the actual TCP connection, not spoofable.
  // Fall back to the rightmost X-Forwarded-For entry (least likely to be spoofed)
  // only as a last resort.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim());
    return ips[ips.length - 1] ?? "unknown";
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(getClientIp(request), 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const videoId = extractVideoId(parsed.data.url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not find a YouTube video ID in that URL." },
      { status: 400 },
    );
  }

  try {
    const info = await fetchVideoInfo(videoId);
    const detectedTimestamp = parseSavasanaTimestamp(info.description);
    let communityTimestamp: number | null = null;
    if (detectedTimestamp === null) {
      try {
        communityTimestamp = getMedianTimestamp(videoId);
      } catch (dbErr) {
        console.error("[video-info] DB error (non-fatal):", dbErr);
      }
    }

    return NextResponse.json({
      videoId: info.videoId,
      title: info.title,
      thumbnailUrl: info.thumbnailUrl,
      detectedTimestamp, // seconds | null
      communityTimestamp, // seconds | null (only set when detectedTimestamp is null)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message.includes("not found")) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }
    if (message.includes("API key not configured")) {
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 },
      );
    }
    if (message.includes("quota exceeded")) {
      return NextResponse.json(
        { error: "YouTube API quota exceeded. Please try again later." },
        { status: 503 },
      );
    }
    if (message.includes("key invalid or restricted")) {
      console.error("[video-info] API key restriction error — check Google Cloud Console key settings");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 },
      );
    }

    console.error("[video-info]", err);
    return NextResponse.json(
      { error: "Failed to fetch video information." },
      { status: 500 },
    );
  }
}
