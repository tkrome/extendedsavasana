import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveTimestamp } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

const RequestSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  timestampSeconds: z.number().int().min(0).max(86400),
});

function getClientIp(request: NextRequest): string {
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
  const { allowed } = rateLimit(getClientIp(request), 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
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
      { status: 400 }
    );
  }

  try {
    saveTimestamp(parsed.data.videoId, parsed.data.timestampSeconds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[timestamp]", err);
    return NextResponse.json(
      { error: "Failed to save timestamp." },
      { status: 500 }
    );
  }
}
