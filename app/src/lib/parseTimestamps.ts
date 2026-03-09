// Matches H:MM:SS or MM:SS
const TIME_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/;

const SAVASANA_RE =
  /s[aā]v[aā]s[aā]na|corpse[\s-]+pose|final[\s-]+rest|śavāsana/i;

function matchToSeconds(m: RegExpMatchArray): number {
  const [, a, b, c] = m;
  if (c !== undefined) {
    return parseInt(a) * 3600 + parseInt(b) * 60 + parseInt(c);
  }
  return parseInt(a) * 60 + parseInt(b);
}

/**
 * Scan a YouTube video description for a savasana timestamp.
 * Returns seconds from the start, or null if not found.
 *
 * Strategy:
 * 1. Check each line — if the line mentions savasana, extract the nearest timestamp.
 * 2. Fallback: sliding window search across the full description.
 */
export function parseSavasanaTimestamp(description: string): number | null {
  const lines = description.split("\n");

  for (const line of lines) {
    if (!SAVASANA_RE.test(line)) continue;
    const m = line.match(TIME_RE);
    if (m) return matchToSeconds(m);
  }

  // Broader pass: search for "savasana" and look ±120 chars for a timestamp.
  const lower = description.toLowerCase();
  let searchFrom = 0;
  while (true) {
    const idx = lower.indexOf("savasana", searchFrom);
    if (idx === -1) break;
    const window = description.slice(Math.max(0, idx - 80), idx + 120);
    const m = window.match(TIME_RE);
    if (m) return matchToSeconds(m);
    searchFrom = idx + 1;
  }

  return null;
}

export function secondsToTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Returns seconds or null on invalid input. Accepts M:SS, MM:SS, H:MM:SS. */
export function timestampToSeconds(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return matchToSeconds(m);
}
