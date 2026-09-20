// Arena runway regression test.
//
// The whole fight is running and jumping, so both have to work at every x in
// the arena. This is the test that would have caught the bug that made the
// boss fights look unwinnable for a whole session:
//
//   Three 36px ledges at y=366 over a floor at y=456 left a 54px gap under a
//   70px player, so 580px of the 1480px runway was an invisible wall. Raising
//   them to y=344 fixed the wall and created the mirror defect: a 24px ceiling
//   that silently cut every jump to a quarter of its height. The dodge failed
//   with no error and no visible cause, which is far worse than a wall.
//
// So this asserts three separate things: you can run the lane, you can jump
// anywhere in it, and nothing overhangs it.

import {
  Results,
  ensureOut,
  forceLevel,
  isMain,
  openGame,
  parkBossOutside,
  readArena,
  runStandalone,
  sleep,
} from "./harness.mjs";

// A full jump rises ~132px. Anything under 125 means something clipped it.
const MIN_RISE = 125;
const RUNWAY = 1250; // of the ~1480px arena; asserted, not assumed

export async function run({ browser, url, results, outDir }) {
  const { page, errors } = await openGame(browser, url);

  const arena = await readArena(page);
  results.note(`arena ${JSON.stringify(arena)}`);
  await forceLevel(page, 1);
  await sleep(400);
  const parked = await parkBossOutside(page, arena);
  results.check(
    "boss is parked outside the arena for the measurement",
    !!parked && parked.x > arena.x1,
    parked ? `boss x=${parked.x}, arena ends at ${arena.x1}` : "no boss to park"
  );

  // ── 1. the boss-free pad has to exceed the longest charge reach ──────────
  // The pad is where a player goes to breathe. If the dash can cross it, the
  // "safe" zone is not safe, which is exactly what happened when the pad was
  // 300px and the final boss's reach was 335px.
  const reach = await page.evaluate(() => {
    const E = window.__ethan;
    const defs = Object.values(E.bossDefs);
    return {
      longest: Math.max(...defs.map((d) => d.chargeSpeed * E.chargeDash)),
      who: defs.reduce((a, b) => (a.chargeSpeed > b.chargeSpeed ? a : b)).name,
    };
  });
  results.check(
    "arena pad is outside the longest charge reach",
    arena.pad > reach.longest,
    `pad ${arena.pad}px vs ${reach.who} reach ${Math.round(reach.longest)}px`
  );

  // ── 2. walk the lane end to end, both ways ───────────────────────────────
  async function walk(key, from, label) {
    await page.evaluate(
      ({ x, floor }) => {
        const pl = window.__ethan.state.player;
        pl.x = x;
        pl.y = floor - pl.h;
        pl.vx = 0;
        pl.vy = 0;
      },
      { x: from, floor: arena.floor }
    );
    await sleep(250);
    await page.keyboard.down(key);
    let stalls = 0;
    let travelled = 0;
    let prev = null;
    let start = null;
    let bossIntruded = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      await sleep(100);
      // Re-park every sample. If the game ever re-derives the patrol band, the
      // boss comes back and this test would start measuring a body-block.
      await parkBossOutside(page, arena);
      const s = await page.evaluate(() => {
        const E = window.__ethan;
        const p = E.state.player;
        const b = E.boss;
        return { px: Math.round(p.x), vx: Math.round(p.vx), bx: b ? b.x : null };
      });
      if (s.bx !== null && s.bx < arena.x1) bossIntruded = true;
      if (start === null) start = s.px;
      travelled = Math.max(travelled, Math.abs(s.px - start));
      // A sample where the player did not move and has no velocity, with the
      // key held, means something is physically in the way.
      if (prev !== null && s.px === prev && s.vx === 0) stalls++;
      prev = s.px;
      if (travelled >= RUNWAY) break;
    }
    await page.keyboard.up(key);
    await sleep(120);
    results.check(`walk ${label}: the boss stayed out of the lane`, !bossIntruded);
    results.check(`walk ${label}: no invisible walls`, stalls === 0, `stalls ${stalls}`);
    results.check(
      `walk ${label}: covers the runway`,
      travelled >= RUNWAY,
      `${travelled}px of ${RUNWAY}px required`
    );
    return { stalls, travelled };
  }

  console.log("1. runway walk");
  await walk("ArrowLeft", arena.x1 - 160, "left");
  await walk("ArrowRight", arena.x0 + 40, "right");

  // ── 3. jump height at sample points across the arena ────────────────────
  console.log("2. jump apex across the arena");
  await parkBossOutside(page, arena);
  const rises = [];
  for (let i = 0; i <= 23; i++) {
    const x = arena.x0 + 40 + Math.round(((arena.x1 - arena.x0 - 120) * i) / 23);
    const floorY = arena.floor;
    await page.evaluate(
      ({ px, fy }) => {
        const pl = window.__ethan.state.player;
        pl.x = px;
        pl.y = fy - pl.h;
        pl.vx = 0;
        pl.vy = 0;
        // Sample on the render loop rather than on a timer, so the apex is the
        // value the game actually drew.
        window.__apex = 9999;
        window.__on = true;
        const t = () => {
          if (!window.__on) return;
          window.__apex = Math.min(window.__apex, pl.y);
          requestAnimationFrame(t);
        };
        requestAnimationFrame(t);
      },
      { px: x, fy: floorY }
    );
    await sleep(200);
    await page.keyboard.down(" ");
    await sleep(400);
    await page.keyboard.up(" ");
    await sleep(500);
    const apex = await page.evaluate(() => {
      window.__on = false;
      return Math.round(window.__apex);
    });
    rises.push({ x, rise: floorY - 70 - apex });
  }
  const worst = Math.min(...rises.map((r) => r.rise));
  const cut = rises.filter((r) => r.rise < MIN_RISE);
  for (const r of cut) results.note(`cut jump at x=${r.x}: rise ${r.rise}px`);
  results.check(
    "jump reaches full height at every sample",
    cut.length === 0,
    `${rises.length - cut.length}/${rises.length} full, worst ${worst}px`
  );

  // ── 4. nothing may overhang the runway ──────────────────────────────────
  // The player's height comes from the game. A hardcoded 70 was right here but
  // it is the same class of mistake that let a harness keep passing against a
  // constant the game had already moved on from.
  const standH = await page.evaluate(() => window.__ethan.state.player.h);
  const fullRise = Math.max(...rises.map((r) => r.rise));
  const overhangs = await page.evaluate(
    ({ a, h, rise }) => {
      const headApex = a.floor - h - rise;
      const out = [];
      for (const q of window.__ethan.state.platforms) {
        if (q.x + q.w < a.x0 || q.x > a.x1) continue;
        if (q.type === 3) continue;
        const under = q.y + q.h;
        if (under >= a.floor || under <= headApex) continue;
        out.push(`${q.x}..${q.x + q.w} @y${q.y}`);
      }
      return out;
    },
    { a: arena, h: standH, rise: fullRise }
  );
  results.check("no platform overhangs the runway", overhangs.length === 0, overhangs.join(", "));

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await page.screenshot({ path: `${outDir}/arena-runway.png` });
  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  ensureOut();
  await runStandalone(run, { label: "arena runway" });
}
