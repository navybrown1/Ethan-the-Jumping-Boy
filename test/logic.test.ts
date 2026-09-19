// Unit tests for src/logic.ts. Run with: npm run test:logic
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  lerp,
  rectsOverlap,
  canStomp,
  streakBonus,
  comboMultiplier,
  levelTimeBonus,
  sanitizeSettings,
  sanitizeProgress,
  computeRating,
  STOMP_BOUNCE_VY,
  GUARDIAN_STOMP_BOUNCE_VY,
  BOSS_STOMP_BOUNCE_VY,
  PLAYER_TERMINAL_VY,
  MAX_LEVELS,
} from "../src/logic";

describe("clamp", () => {
  it("clamps below, above, and passes through inside values", () => {
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(99, 0, 10), 10);
    assert.equal(clamp(4, 0, 10), 4);
  });
});

describe("lerp", () => {
  it("interpolates", () => {
    assert.equal(lerp(0, 100, 0.25), 25);
    assert.equal(lerp(10, 20, 1), 20);
  });
});

describe("rectsOverlap", () => {
  it("detects overlap and separation", () => {
    assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
    assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 }), false);
    assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 10, w: 10, h: 10 }), false);
  });
  it("treats containment as overlap", () => {
    assert.equal(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 20, y: 20, w: 5, h: 5 }), true);
  });
});

describe("canStomp", () => {
  it("allows a falling stomp near the enemy top", () => {
    assert.equal(canStomp(200, 100, 60, 95, 95), true);
  });
  it("rejects slow falls, deep overlap, and side hits", () => {
    assert.equal(canStomp(20, 100, 60, 95, 95), false); // too slow
    assert.equal(canStomp(200, 160, 60, 95, 95), false); // sunk too deep
    assert.equal(canStomp(200, 100, 120, 95, 95), false); // player not above
  });
});

describe("streakBonus", () => {
  it("scales with the streak", () => {
    assert.equal(streakBonus(1), 50);
    assert.equal(streakBonus(4), 200);
  });
});

describe("comboMultiplier", () => {
  it("starts at x1 and grows every two stomps", () => {
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(1), 1);
    assert.equal(comboMultiplier(2), 2);
    assert.equal(comboMultiplier(3), 2);
    assert.equal(comboMultiplier(4), 3);
  });
  it("caps at x5", () => {
    assert.equal(comboMultiplier(8), 5);
    assert.equal(comboMultiplier(100), 5);
  });
});

describe("levelTimeBonus", () => {
  it("decays 6 points per second from 600", () => {
    assert.equal(levelTimeBonus(0), 600);
    assert.equal(levelTimeBonus(50), 300);
    assert.equal(levelTimeBonus(99), 6);
  });
  it("floors at zero for slow clears", () => {
    assert.equal(levelTimeBonus(100), 0);
    assert.equal(levelTimeBonus(900), 0);
  });
  it("handles negative input", () => {
    assert.equal(levelTimeBonus(-5), 600);
  });
});

describe("sanitizeSettings", () => {
  it("returns muted false for junk", () => {
    assert.deepEqual(sanitizeSettings(null), { muted: false });
    assert.deepEqual(sanitizeSettings("yes"), { muted: false });
    assert.deepEqual(sanitizeSettings({}), { muted: false });
  });
  it("only accepts a real boolean true", () => {
    assert.deepEqual(sanitizeSettings({ muted: true }), { muted: true });
    assert.deepEqual(sanitizeSettings({ muted: "true" }), { muted: false });
    assert.deepEqual(sanitizeSettings({ muted: 1 }), { muted: false });
  });
});

describe("tuning constants", () => {
  it("keep bounce and terminal values in sane ranges", () => {
    assert.ok(STOMP_BOUNCE_VY < -300 && STOMP_BOUNCE_VY > -700);
    assert.ok(GUARDIAN_STOMP_BOUNCE_VY < STOMP_BOUNCE_VY);
    assert.ok(BOSS_STOMP_BOUNCE_VY < STOMP_BOUNCE_VY);
    assert.ok(PLAYER_TERMINAL_VY > 500 && PLAYER_TERMINAL_VY < 1400);
  });
});

describe("sanitizeProgress", () => {
  it("returns defaults for junk input", () => {
    assert.deepEqual(sanitizeProgress(null), { unlocked: 1, stars: [0, 0, 0, 0], bestScore: 0 });
    assert.deepEqual(sanitizeProgress("nope"), { unlocked: 1, stars: [0, 0, 0, 0], bestScore: 0 });
    assert.deepEqual(sanitizeProgress(42), { unlocked: 1, stars: [0, 0, 0, 0], bestScore: 0 });
  });
  it("clamps out-of-range values", () => {
    const p = sanitizeProgress({ unlocked: 9, stars: [5, -2, 2, 99], bestScore: -100 });
    assert.equal(p.unlocked, MAX_LEVELS);
    assert.deepEqual(p.stars, [3, 0, 2, 3]);
    assert.equal(p.bestScore, 0);
  });
  it("accepts the legacy object star shape", () => {
    const p = sanitizeProgress({ unlocked: 2, stars: { "1": 2, "3": 5 }, bestScore: 10 });
    assert.deepEqual(p.stars, [2, 0, 3, 0]);
  });
  it("keeps valid saves intact", () => {
    const p = sanitizeProgress({ unlocked: 3, stars: [2, 1, 0, 3], bestScore: 12345 });
    assert.deepEqual(p, { unlocked: 3, stars: [2, 1, 0, 3], bestScore: 12345 });
  });
});

describe("computeRating", () => {
  it("awards 3 stars for a clean full run", () => {
    assert.equal(computeRating(10, 10, 0, 200), 3);
  });
  it("awards 2 stars at 40 percent collection", () => {
    assert.equal(computeRating(4, 10, 1, 200), 2);
  });
  it("awards 1 star for a rough run", () => {
    assert.equal(computeRating(1, 10, 5, 200), 1);
  });
  it("docks a star for very slow clears", () => {
    assert.equal(computeRating(10, 10, 0, 500), 2);
  });
  it("handles levels with no stars", () => {
    assert.equal(computeRating(0, 0, 0, 100), 1);
  });
});
