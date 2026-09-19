// Pure game-logic helpers for Ethan the Jumping Boy.
//
// Everything in here is DOM/canvas free on purpose, so it can be unit
// tested with plain node. game.ts imports these instead of keeping its
// own copies.

export const MAX_LEVELS = 4;

/** Stomp forgiveness window: a stomp counts while falling faster than this. */
export const STOMP_MIN_VY = 40;
/** Max vertical overlap (px) between Ethan's feet and an enemy's top for a stomp. */
export const STOMP_MAX_OVERLAP = 44;

/** Bounce velocity after a normal enemy stomp. */
export const STOMP_BOUNCE_VY = -450;
/** Bounce velocity after stomping a world guardian. */
export const GUARDIAN_STOMP_BOUNCE_VY = -560;
/** Bounce velocity after stomping the King Roller boss. */
export const BOSS_STOMP_BOUNCE_VY = -520;
/** Max falling speed for Ethan. */
export const PLAYER_TERMINAL_VY = 980;
/** Cap on live gameplay particles; oldest are dropped first. */
export const MAX_PARTICLES = 420;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Forgiving stomp check: falling onto an enemy with feet near its top. */
export function canStomp(
  playerVy: number,
  playerBottom: number,
  playerY: number,
  enemyTop: number,
  enemyY: number
): boolean {
  return (
    playerVy > STOMP_MIN_VY &&
    playerBottom - enemyTop < STOMP_MAX_OVERLAP &&
    playerY < enemyY
  );
}

/** Combo bonus for a stomp streak (added on top of the base 100). */
export function streakBonus(streak: number): number {
  return streak * 50;
}

/** Score multiplier from a stomp streak, capped at x5. */
export function comboMultiplier(streak: number): number {
  return Math.min(5, 1 + Math.floor(streak / 2));
}

/** Portal time bonus on level clear: 600 points decaying 6 per second. */
export function levelTimeBonus(timeSec: number): number {
  return Math.max(0, Math.floor(600 - Math.max(0, timeSec) * 6));
}

/** Validate a raw settings payload (mute persistence) into a safe shape. */
export function sanitizeSettings(raw: unknown): { muted: boolean } {
  if (!raw || typeof raw !== "object") return { muted: false };
  return { muted: (raw as Record<string, unknown>).muted === true };
}

export interface ProgressData {
  unlocked: number;
  /** Per-level star ratings, index 0 = level 1. */
  stars: number[];
  bestScore: number;
}

/** Validate a raw localStorage payload into a safe Progress shape. */
export function sanitizeProgress(raw: unknown): ProgressData {
  const clean: ProgressData = { unlocked: 1, stars: [0, 0, 0, 0], bestScore: 0 };
  if (!raw || typeof raw !== "object") return clean;
  const r = raw as Record<string, unknown>;
  if (Number.isInteger(r.unlocked)) {
    clean.unlocked = clamp(r.unlocked as number, 1, MAX_LEVELS);
  }
  const stars = r.stars;
  const take = (v: unknown) => (Number.isInteger(v) ? clamp(v as number, 0, 3) : 0);
  if (Array.isArray(stars)) {
    for (let i = 0; i < MAX_LEVELS; i++) clean.stars[i] = take(stars[i]);
  } else if (stars && typeof stars === "object") {
    const rec = stars as Record<string, unknown>;
    for (let i = 0; i < MAX_LEVELS; i++) clean.stars[i] = take(rec[String(i + 1)]);
  }
  if (typeof r.bestScore === "number" && Number.isFinite(r.bestScore)) {
    clean.bestScore = Math.max(0, Math.floor(r.bestScore));
  }
  return clean;
}

/** Star rating for a cleared level: 1-3. */
export function computeRating(
  starCount: number,
  totalStars: number,
  deaths: number,
  timeSec: number
): number {
  const starPct = totalStars > 0 ? starCount / totalStars : 0;
  let rating = 1;
  if (starPct >= 0.4) rating = 2;
  if (starPct >= 0.75 && deaths <= 3) rating = 3;
  if (timeSec > 420) rating = Math.max(1, rating - 1);
  return rating;
}
