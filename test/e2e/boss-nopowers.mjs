// No-powers boss verification.
//
// This is the test that backs the redesign's central claim: every boss is
// beatable with zero powers, using nothing but left/right/jump.
//
// The bot is deliberately simple and human-shaped:
//   * hold just outside the dash reach while the boss is healthy
//   * back out of the lane the moment a charge telegraph appears
//   * step off the landing ring on a slam, jump the floor shockwave
//   * walk in and jump on the weak point during the stagger
//
// It never presses fire, and every powerup is marked collected before the
// fight, so "no powers" is a fact about the run rather than an assumption.
//
// It also asserts the two bugs that made the fight lie about itself:
//   * per-frame stomp damage, when `force: true` bypassed the boss's hurt
//     cooldown and a staggered boss took five 5-damage stomps 17ms apart
//   * damage attributed by amount instead of by source, which counted a
//     5-damage stagger stomp as a 5-damage spire break

import {
  Results,
  ensureOut,
  forceLevel,
  isMain,
  keyDriver,
  launchBrowser,
  openGame,
  readArena,
  runStandalone,
  sleep,
  startDevServer,
} from "./harness.mjs";
import fs from "node:fs";
import path from "node:path";

const LEVELS = (process.env.LEVELS || "1,2,3,4").split(",").map(Number);
const RUN_MS = Number(process.env.RUN_MS || 90000);
const JUMP_HOLD = 380; // full ascent; a shorter hold triggers the variable-jump cut

// The bounce cycle after a stomp is ~580ms. Anything much under that means
// damage landed on consecutive frames, which is the multi-frame stomp bug.
const MIN_STOMP_GAP = 300;
// A bot with perfect reactions clears a boss in 10-15s. This band is wide on
// purpose: it catches "unkillable" and "dies to one sneeze", not tuning.
const KILL_SECONDS = [5, 60];

async function runLevel(page, level, arena, outDir, results) {
  await forceLevel(page, level);

  const keys = keyDriver(page);
  const t0 = Date.now();
  let last = null;
  let jumpUntil = 0;
  let heartsLost = 0;
  let prevHp = null;
  let prevLives = null;
  let staggerShots = 0;
  let volleyDir = 0; // committed direction through the lightning barrage
  let lastDir = 0; // direction hysteresis, so the bot commits to a line
  let dirHoldUntil = 0;
  const hitCauses = [];

  while (Date.now() - t0 < RUN_MS) {
    const snap = await page.evaluate(() => {
      const E = window.__ethan;
      const b = E.boss;
      const p = E.state.player;
      const s = E.state;
      if (!b || !p) return null;
      return {
        scene: E.scene,
        bx: b.x, bw: b.w, by: b.y, bstate: b.state, battack: b.attack,
        bhp: b.hp, bmax: b.maxHp, bdying: b.dying,
        breach: b.chargeSpeed * E.chargeDash, landX: b.landX ?? null,
        px: p.x, pw: p.w, pgrounded: p.grounded,
        lives: s.lives, time: s.time,
        fire: p.firePower, star: p.invincible, superT: p.superTimer,
        shock: s.shockwaves.map((w) => ({ x: w.x, vx: w.vx })),
        minions: (b.minions || []).filter((m) => m.alive).map((m) => ({ x: m.x, w: m.w })),
        strikes: (s.strikes || []).map((k) => ({ x: k.x, st: k.state })),
      };
    });

    if (!snap) { await sleep(60); continue; }
    if (snap.scene !== "playing") { last = { ...snap, ended: snap.scene }; break; }

    prevHp = snap.bhp;
    if (prevLives !== null && snap.lives < prevLives) {
      heartsLost += prevLives - snap.lives;
      hitCauses.push({
        t: Math.round(snap.time), st: snap.bstate, at: snap.battack,
        gap: Math.round(Math.abs(snap.px - snap.bx)),
      });
    }
    prevLives = snap.lives;

    if (snap.bstate === "stagger" && staggerShots < 3) {
      staggerShots++;
      await page.screenshot({ path: path.join(outDir, `L${level}-stagger-${staggerShots}.png`) });
    }
    if (snap.bhp <= 0 || snap.bdying > 0) {
      await page.screenshot({ path: path.join(outDir, `L${level}-defeat.png`) });
      last = { ...snap, ended: "killed" };
      break;
    }

    const bc = snap.bx + snap.bw / 2;
    const pc = snap.px + snap.pw / 2;
    const dist = pc - bc;
    const now0 = Date.now();
    const away = dist > 0 ? 1 : -1;
    const toward = -away;
    const reach = snap.breach;
    let dir = 0;
    let wantJump = false;
    // An active dodge outranks the arena-end parking rule below. Parking at a
    // wall while a charge is inbound would pin the bot, which is a harness bug
    // rather than a game bug.
    let dodging = false;

    // Floor shockwaves outlive the sweep that spawned them: the wave lives
    // 2.4s, the attack state only 0.75s. Checking inside the sweep branch meant
    // the bot stopped dodging while the boss was already staggered, which is
    // how it kept eating waves. This runs in every state. Jumping is the only
    // answer: the wave travels at 430px/s and the player tops out at 295px/s.
    const waveIncoming = snap.shock.some(
      (w) => Math.abs(w.x - pc) < 230 && ((w.vx > 0 && w.x < pc) || (w.vx < 0 && w.x > pc))
    );
    if (waveIncoming && snap.pgrounded) wantJump = true;

    // Minions are part of the final fight. The bot used to ignore them and take
    // roller hits, which is a harness gap, not a boss problem.
    const nearMinion = snap.minions
      .map((m) => m.x + m.w / 2 - pc)
      .filter((d) => Math.abs(d) < 170)
      .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    const minionDir = nearMinion === undefined ? 0 : nearMinion >= 0 ? 1 : -1;
    // A roller inside 300px means the bot has to keep a jump in reserve. It
    // cannot jump again until it lands, so spending the jump on the weak point
    // guarantees eating the roller on the way down. This was the real failure
    // mode: airborne 0.8s straight while a roller closed to 10px.
    const rollerNear = snap.minions.some((m) => Math.abs(m.x + m.w / 2 - pc) < 300);
    if (nearMinion !== undefined && snap.pgrounded && !rollerNear) wantJump = true;

    if (snap.bstate === "stagger") {
      // Close in and jump on the weak point. Once airborne the bot keeps
      // steering to the boss centre so it comes down on the weak point instead
      // of landing beside the boss and taking contact damage.
      if (Math.abs(dist) > 20) dir = toward;
      if (snap.pgrounded && Math.abs(dist) < 150 && !rollerNear) wantJump = true;
    } else if (
      (snap.bstate === "telegraph" || snap.bstate === "attack") &&
      snap.battack === "slam" &&
      snap.landX != null
    ) {
      // Clear the whole flight lane, not just the crater. The boss's body
      // sweeps every pixel between launch and landing, so the crater's edge is
      // not safe and neither is where the boss took off. Exit on the side the
      // bot is already on, so the escape never routes through the boss body.
      const laneA = Math.min(snap.bx, snap.landX) - snap.pw / 2 - 24;
      const laneB = Math.max(snap.bx + snap.bw, snap.landX + snap.bw) + snap.pw / 2 + 24;
      if (pc > laneA && pc < laneB) {
        const bossRight = snap.bx + snap.bw + snap.pw / 2 + 20;
        const bossLeft = snap.bx - snap.pw / 2 - 20;
        if (pc >= bossRight) dir = 1;
        else if (pc <= bossLeft) dir = -1;
        else dir = dist >= 0 ? 1 : -1;
      }
      dodging = true;
    } else if (Math.abs(dist) < snap.bw / 2 + snap.pw / 2 + 18) {
      // Never stand inside the boss. This outranks the charge and lightning
      // dodges for the same reason: an escape through the boss body is not an
      // escape.
      dir = away;
      dodging = true;
    } else if (snap.bstate === "telegraph" && snap.battack === "charge") {
      dir = away;
      dodging = true;
    } else if (snap.bstate === "attack" && snap.battack === "sweep") {
      if (Math.abs(dist) < 300) dir = away;
    } else if (snap.strikes.some((k) => k.st === "telegraph" && Math.abs(k.x - pc) < 130)) {
      // The final boss's lightning is aimed where the player is heading, so
      // standing still under the marker is a guaranteed heart.
      const k = snap.strikes
        .filter((q) => q.st === "telegraph")
        .sort((a, b) => Math.abs(a.x - pc) - Math.abs(b.x - pc))[0];
      dir = pc - k.x >= 0 ? 1 : -1;
      dodging = true;
    } else if (snap.bstate === "attack" && snap.battack === "charge") {
      dir = away;
      dodging = true;
    } else {
      // Dead band sits outside the dash reach plus room for the boss's patrol
      // closing the gap during the wind-up.
      const want = reach + 190;
      if (Math.abs(dist) < want) dir = away;
      else if (Math.abs(dist) > want + 240) dir = toward;
    }

    // The arena ends are the boss-free zone, so they are where the bot parks
    // when it needs breathing room.
    if (!dodging) {
      if (snap.px < arena.x0 + 30) dir = 1;
      if (snap.px + snap.pw > arena.x1 - 30) dir = -1;
    }
    // Hard arena bounds, even mid-dodge. Letting a dodge carry the bot out of
    // the arena made it measure corridor enemies instead of the boss fight.
    if (snap.px < arena.x0 + 10) dir = 1;
    if (snap.px + snap.pw > arena.x1 - 10) dir = -1;

    // Run one consistent line through the lightning barrage. The boss aims at
    // `px + vx*0.3`, so a player running flat out is aimed ~88px ahead but
    // travels ~212px during the 0.72s telegraph, putting every bolt safely
    // behind them. Reversing on each new marker walked the bot back into the
    // previous one, which is why the volley kept connecting.
    if (snap.bstate === "attack" && (snap.battack === "volley" || snap.battack === "special")) {
      if (volleyDir === 0) volleyDir = pc < (arena.x0 + arena.x1) / 2 ? -1 : 1;
      dir = volleyDir;
      dodging = true;
    } else {
      volleyDir = 0;
    }

    // A marker centred on the bot is a guaranteed heart in 0.72s, so it
    // overrides everything, including the stagger punish. Standing in it to
    // land one more stomp is a bad trade every time.
    const marker = snap.strikes
      .filter((k) => k.st === "telegraph")
      .map((k) => k.x - pc)
      // 140, not 78. The boss leads the player's velocity when it aims, so the
      // marker appears ~88px ahead of a player running flat out. Detecting at
      // 78px meant the bot never saw it coming and ran straight into it.
      .filter((d) => Math.abs(d) < 140)
      .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (marker !== undefined) { dir = marker >= 0 ? -1 : 1; dodging = true; }

    // A roller inside ~95px is an imminent hit, and stomping it is both the
    // escape and the kill. This overrides the stagger punish for the same
    // reason the marker does. The old version gated minions on "not staggered",
    // which is exactly when the bot was closing in and got rolled.
    const urgentMinion = snap.minions
      .map((m) => m.x + m.w / 2 - pc)
      .filter((d) => Math.abs(d) < 150)
      .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (urgentMinion !== undefined) {
      dir = urgentMinion >= 0 ? 1 : -1;
      // Steer onto it so the jump becomes a stomp: that removes the roller for
      // the rest of the fight instead of just postponing it.
      if (snap.pgrounded) { wantJump = true; dodging = true; }
    }

    // Steer onto a nearby minion mid-air so the jump becomes a stomp instead of
    // a hop past it.
    if (wantJump && !snap.pgrounded && minionDir !== 0) dir = minionDir;

    // Direction hysteresis. The decision chain can flip between "walk toward
    // the minion" and "walk away from the boss" on consecutive frames, and a
    // direction that flips every ~100ms is a player standing still: the
    // acceleration never accumulates. A real player commits.
    if (dir !== 0 && dir === -lastDir && now0 < dirHoldUntil) dir = lastDir;
    if (dir !== 0 && dir !== lastDir) { lastDir = dir; dirHoldUntil = now0 + 160; }

    await keys.set("left", dir < 0);
    await keys.set("right", dir > 0);

    // Release the jump key BEFORE re-pressing it.
    //
    // The old order refreshed jumpUntil first and checked the release second,
    // so whenever wantJump stayed true across the expiry frame the key was
    // never released. No release means no new keydown edge, and the game reads
    // jumps from the keydown edge (keys.jumpPressed), so the bot held jump down
    // and never jumped again. The trace showed it plainly: 380ms of "jump
    // requested, grounded, jump held" with zero airborne frames while a roller
    // closed to contact. The sleep matters too: an up and a down in the same
    // game frame makes the engine see jumpReleased and jumpPressed together,
    // and jumpReleased cuts the fresh jump to 48% height.
    const now = Date.now();
    if (keys.down.jump && now > jumpUntil) {
      await keys.set("jump", false);
      await sleep(24);
    }
    const now2 = Date.now();
    if (wantJump && snap.pgrounded && now2 > jumpUntil) {
      jumpUntil = now2 + JUMP_HOLD;
      await keys.set("jump", true);
    }

    await sleep(26);
  }

  await keys.releaseAll();

  const final = await page.evaluate(() => {
    const E = window.__ethan;
    const b = E.boss;
    const p = E.state.player;
    return {
      scene: E.scene, lives: E.state.lives, time: Math.round(E.state.time),
      fire: p ? p.firePower : null, star: p ? p.invincible : null,
      superT: p ? p.superTimer : null,
      boss: b ? { name: b.name, hp: b.hp, max: b.maxHp, alive: b.alive } : null,
      // Authoritative attribution, straight from damageBoss itself.
      dmgLog: window.__dmgLog || [],
      hitLog: window.__hitLog || [],
    };
  });

  // Classify by source, not by amount. The old `d >= 5` rule silently counted
  // a 5-damage stagger stomp as a 5-damage spire break on the bosses where
  // those numbers collide, which is most of them.
  const bySrc = {};
  let minGap = null;
  let lastT = null;
  for (const e of final.dmgLog) {
    bySrc[e.src] = (bySrc[e.src] || 0) + 1;
    if (e.src === "stomp-stagger") {
      const gap = lastT == null ? null : Math.round((e.t - lastT) * 1000);
      if (gap != null && (minGap == null || gap < minGap)) minGap = gap;
      lastT = e.t;
    }
  }

  const killed = !!(final.boss && (final.boss.hp <= 0 || !final.boss.alive));
  const name = final.boss ? final.boss.name : `level ${level}`;
  const stomps = bySrc["stomp-stagger"] || 0;

  results.check(`L${level} ${name}: killed with no powers`, killed,
    killed ? `in ${final.time}s game time, ${stomps} weak-point stomps`
           : `hp ${final.boss ? final.boss.hp : "?"}/${final.boss ? final.boss.max : "?"} left after ${Math.round((Date.now() - t0) / 1000)}s`);
  results.check(`L${level} ${name}: kill time is in a sane band`, killed && final.time >= KILL_SECONDS[0] && final.time <= KILL_SECONDS[1],
    `${final.time}s, expected ${KILL_SECONDS[0]}-${KILL_SECONDS[1]}s`);
  results.check(`L${level} ${name}: no fire, no star, no super`, !final.fire && !final.star && !(final.superT > 0),
    `fire=${final.fire} star=${final.star} super=${final.superT}`);
  results.check(`L${level} ${name}: weak-point damage is not per-frame`, minGap == null || minGap >= MIN_STOMP_GAP,
    minGap == null ? "no stagger stomps recorded" : `min gap between stagger stomps ${minGap}ms`);
  // The bot's baseline is zero hearts across all four bosses. One is tolerated
  // for timing jitter; more than that is a fairness regression. A human will
  // lose more than this and that is fine.
  results.check(`L${level} ${name}: the bot survives the fight`, heartsLost <= 1, `hearts lost ${heartsLost}`);
  if (final.hitLog.length) {
    const byCause = {};
    for (const h of final.hitLog) byCause[h.src] = (byCause[h.src] || 0) + 1;
    results.note(`damage taken from ${Object.entries(byCause).map(([k, v]) => `${k} x${v}`).join(", ")}`);
  }

  return {
    level, boss: name, killed, gameSeconds: final.time,
    wallSeconds: Math.round((Date.now() - t0) / 1000),
    heartsLost, heartsLeft: final.lives, stomps, bySrc,
    minStaggerStompGapMs: minGap, usedFire: final.fire, usedStar: final.star,
    lastState: last ? last.bstate : null, hitCauses,
  };
}

export async function run({ browser, url, results, outDir }) {
  const { page, errors } = await openGame(browser, url);

  const atlas = await page.evaluate(async () => {
    const out = {};
    for (const k of ["grove", "ember", "crystal", "storm"]) {
      out[k] = await fetch(`/assets/bosses/${k}_atlas.png`).then((r) => r.status).catch(() => "ERR");
    }
    return out;
  });
  results.check("all four boss atlases load",
    Object.values(atlas).every((s) => s === 200),
    Object.entries(atlas).map(([k, v]) => `${k}:${v}`).join(" "));

  const arena = await readArena(page);
  const rows = [];
  for (const lv of LEVELS) {
    console.log(`\nlevel ${lv}`);
    rows.push(await runLevel(page, lv, arena, outDir, results));
  }

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  fs.writeFileSync(path.join(outDir, "boss-run.json"), JSON.stringify(rows, null, 2));
  console.log(`\nraw run data: ${path.join(outDir, "boss-run.json")}`);
  for (const r of rows) {
    console.log(`  L${r.level} ${r.boss}: ${r.killed ? "KILLED" : "NOT KILLED"} ` +
      `${r.gameSeconds}s game / ${r.wallSeconds}s wall, hearts lost ${r.heartsLost}, ` +
      `stomps ${r.stomps}, min gap ${r.minStaggerStompGapMs ?? "-"}ms`);
  }

  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  // Standalone runs use the harness defaults; the orchestrator injects its own.
  ensureOut();
  const server = process.env.GAME_URL ? null : await startDevServer();
  const browser = await launchBrowser();
  try {
    const url = process.env.GAME_URL || server.url;
    console.log(`boss no-powers verification against ${url}\n`);
    const ok = await run({ browser, url, results: new Results("boss no-powers"), outDir: ensureOut() });
    process.exitCode = ok ? 0 : 1;
  } finally {
    await browser.close();
    if (server) await server.close();
  }
}
