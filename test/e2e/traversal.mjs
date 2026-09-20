// Level traversal: can a player actually get from the spawn to the far end?
//
// Every automated run so far has tested the boss arenas. Nothing had ever
// verified that the four corridors are physically traversable, which is the
// most basic thing a player needs: a level they cannot cross is unplayable no
// matter how good the boss is.
//
// Two deliberate isolations, both to keep this a GEOMETRY test rather than a
// difficulty test:
//
//   * The player is held invincible. `hitPlayer` returns immediately when
//     `pl.invincible > 0`, so enemies cannot deal damage or knock the player
//     back. That means a failure here is a wall, a gap, or a ceiling, never
//     "the bot was bad at combat". Combat balance is covered separately.
//   * The boss is parked outside the arena, so the encounter cannot body-block
//     the corridor the way a frozen-but-live boss does.
//
// The bot itself is intentionally dumb: hold right, jump when there is no
// ground ahead, when a wall stops forward motion, or when it has stalled. It is
// not trying to play well. It is trying to answer "is there a way through".
//
// Falling is not a failure. The game respawns a fallen player near where they
// fell and, while invincible, takes no heart for it. Falls are counted and
// reported because a level that only completes after twenty falls is telling
// you something even when it technically passes.

import { openGame, runStandalone, isMain, sleep, forceLevel, parkBossOutside, readArena } from "./harness.mjs";

const BUDGET_MS = Number(process.env.TRAVERSE_MS || 50000);

// Known stalls.
//
// A stall is a spot where a player who only ever holds right and jumps gets
// pinned against something and has to walk back to a place where the game will
// let them jump. Both of these are the same defect: a platform whose underside
// sits 70-100px above a walkable surface. The player is 70px tall, so they can
// walk under it but have 0-30px of jump left, and whatever is ahead needs more
// than that.
//
// These are recorded rather than fixed because clearing them means redesigning
// the surrounding platform cluster, and nudging the numbers has already been
// shown to trade one trap for another. What this list buys is that a NEW stall
// anywhere in any level fails the suite, and a stall that gets fixed shows up
// as a stale entry to delete.
//
// The two that were fixed are worth noting for scale: level 1 stalled at x=716
// with 10px of jump (now clear to x=2656) and level 3 stalled at x=3216 with
// 10px (now clear to x=3556).
const KNOWN_STALLS = {
  1: {
    x: 2656,
    why: "ceiling 2500..2660 has its underside at y=326, exactly head height for a player standing on the block at top=396, so rise is 0px",
  },
  3: {
    x: 3556,
    why: "ceiling 3500..3640 leaves 30px of rise, and the platform at 3600 needs 51px to climb onto",
  },
};
const STALL_TOLERANCE = 60;
// How long without forward progress counts as pinned. Generous: the levels have
// moving platforms with long cycles that can legitimately hold a player still.
const STALL_MS = Number(process.env.STALL_MS || 12000);

/**
 * Installs the driver inside the page.
 *
 * The loop runs on setInterval in the page rather than being driven from Node
 * one frame at a time. A Playwright round trip per frame is milliseconds of
 * latency and would measure the harness rather than the game. Input is sent as
 * real KeyboardEvents on window, which is the same path a human's keyboard
 * takes, so nothing about the game's input handling is bypassed.
 */
const installDriver = ({ budgetMs, stallMs }) => {
  const E = window.__ethan;
  const send = (type, key) => window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  const held = { right: false, jump: false };
  const set = (name, want, key) => {
    if (held[name] === want) return;
    held[name] = want;
    send(want ? "keydown" : "keyup", key);
  };

  const out = {
    done: false,
    reached: false,
    stalled: false,
    maxX: 0,
    falls: 0,
    jumps: 0,
    ms: 0,
    scene: null,
    ticks: 0,
    goalX: E.state.portal.x,
  };
  window.__traverse = out;

  const t0 = performance.now();
  let lastX = E.state.player.x;
  let lastProgressT = t0;
  let jumpUntil = 0;
  let nextJumpAt = 0;
  let prevY = E.state.player.y;

  // Is there standable ground at this x, within reach of the feet?
  // The vertical window is generous on purpose: this only needs to answer
  // "is there something to land on", and a tight window would make the bot
  // jump at every moving platform that happened to be at the wrong phase.
  function groundAt(x, feetY) {
    for (const p of E.state.platforms) {
      if (p.cs === "gone") continue;
      const top = p.y + (p.dy || 0);
      if (x >= p.x - 2 && x <= p.x + p.w + 2 && top >= feetY - 24 && top <= feetY + 170) return true;
    }
    return false;
  }

  const id = setInterval(() => {
    const pl = E.state.player;
    const now = performance.now();
    out.ms = Math.round(now - t0);
    out.ticks++;
    out.maxX = Math.max(out.maxX, pl.x);

    // A respawn from a pit drops the player back to y=160 near where they fell.
    if (prevY > 600 && pl.y <= 200) out.falls++;
    prevY = pl.y;

    if (E.scene !== "playing" || pl.dead) {
      out.done = true;
      out.scene = E.scene;
      clearInterval(id);
      return;
    }
    if (pl.x >= out.goalX - 20) {
      out.done = true;
      out.reached = true;
      clearInterval(id);
      return;
    }
    // A pinned player never makes progress again, so waiting out the full
    // budget on every stalled level only makes the suite slow. This is set
    // well above the longest legitimate pause the levels ask for.
    if (now - lastProgressT > stallMs) {
      out.done = true;
      out.stalled = true;
      clearInterval(id);
      return;
    }
    if (now - t0 > budgetMs) {
      out.done = true;
      clearInterval(id);
      return;
    }

    // Refresh every tick: the star power timer that normally sets this would
    // expire, and a single hit is enough to end the run.
    pl.invincible = 5;
    pl.invuln = 5;

    set("right", true, "ArrowRight");

    const feet = pl.y + pl.h;
    const gapAhead = !groundAt(pl.x + pl.w + 34, feet);
    const blocked = pl.grounded && pl.vx < 40;
    const stalled = now - lastProgressT > 1400;

    if (pl.x > lastX + 12) {
      lastX = pl.x;
      lastProgressT = now;
    }

    if (now > nextJumpAt && (gapAhead || blocked || stalled)) {
      set("jump", true, " ");
      jumpUntil = now + 300; // hold long enough for a full-height jump
      nextJumpAt = now + 420; // but do not machine-gun it
      out.jumps++;
    }
    if (held.jump && now > jumpUntil) set("jump", false, " ");
  }, 16);
};

async function traverse(page, level, results) {
  const arena = await readArena(page);
  await forceLevel(page, level);
  const parked = await parkBossOutside(page, arena);

  // forceLevel parks the player relative to the arena, which is the wrong end
  // of the map for this test. Put them at the real spawn, standing on whatever
  // platform is under x=110, read from the game rather than assumed.
  const start = await page.evaluate(() => {
    const E = window.__ethan;
    const pl = E.state.player;
    const under = E.state.platforms.find((p) => 110 >= p.x && 110 <= p.x + p.w && p.y >= 300);
    pl.x = 110;
    pl.y = (under ? under.y : E.arena.floor) - pl.h;
    pl.vx = 0;
    pl.vy = 0;
    E.state.cameraX = 0;
    return { x: pl.x, y: pl.y, on: under ? under.y : null };
  });

  await page.evaluate(installDriver, { budgetMs: BUDGET_MS, stallMs: STALL_MS });

  let out = null;
  const deadline = Date.now() + BUDGET_MS + 8000;
  while (Date.now() < deadline) {
    out = await page.evaluate(() => window.__traverse);
    if (out.done) break;
    await sleep(250);
  }

  // Stop the loop no matter how we left it, so it cannot leak into the next level.
  await page.evaluate(() => {
    const p = window.__traverse;
    if (p) p.done = true;
  });

  const secs = (out.ms / 1000).toFixed(1);
  const known = KNOWN_STALLS[level];
  const atKnown = known && Math.abs(out.maxX - known.x) <= STALL_TOLERANCE;
  const ok = out.reached || atKnown;

  results.check(
    `L${level}: crossed to the portal, or stalled only where already known`,
    ok,
    out.reached
      ? `reached the portal in ${secs}s, ${out.jumps} jumps, ${out.falls} falls`
      : ok
        ? `known stall at x=${Math.round(out.maxX)} (${known.why})`
        : `NEW ${out.stalled ? "stall" : "timeout"} at x=${Math.round(out.maxX)} of ${out.goalX} after ${secs}s`
  );
  if (out.reached) {
    results.check(`L${level}: no stall on the way`, true, `${secs}s, ${out.jumps} jumps, ${out.falls} falls`);
  } else {
    results.note(
      `L${level}: ${out.jumps} jumps, ${out.falls} falls before stalling at x=${Math.round(out.maxX)}`
    );
  }
  results.check(
    `L${level}: the run does not end in a death or a scene change`,
    out.scene === null,
    `scene=${out.scene}`
  );
  results.note(
    `L${level}: spawn x=${Math.round(start.x)} y=${Math.round(start.y)} on ${start.on}, ` +
      `boss parked at ${parked ? Math.round(parked.x) : "n/a"}`
  );
  return out;
}

export async function run({ browser, url, results: r }) {
  const { page, errors } = await openGame(browser, url);
  const levels = (process.env.LEVELS || "1,2,3,4")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n >= 1 && n <= 4);
  const outs = [];
  for (const level of levels) {
    outs.push({ level, out: await traverse(page, level, r) });
  }
  const clean = outs.filter((o) => o.out.reached).map((o) => o.level);
  const stalled = outs.filter((o) => !o.out.reached).map((o) => o.level);
  r.note(
    `clean runs: ${clean.length ? clean.join(", ") : "none"}` +
      (stalled.length ? ` | known stalls: ${stalled.join(", ")}` : "")
  );
  r.check("no console errors during the traversal runs", errors.length === 0, errors.slice(0, 3).join(" | "));
  return r.report();
}

if (isMain(import.meta.url)) {
  runStandalone(run, { label: "traversal" });
}
