// Photosensitivity measurement.
//
// WCAG 2.3.1 puts the line at no more than three general flashes in any one
// second. A general flash is a pair of opposing changes in relative luminance
// of 10% or more, where the darker of the two is below 0.80. Games break this
// with full-screen flashes and hard flicker, and the effects that would do it
// here are the hurt overlay, the star-power rainbow trail, the boss attacks and
// the boss defeat burst.
//
// Reading the source to guess which of those flash is exactly the kind of
// reasoning that has been wrong twice in this project, so this measures the
// rendered frames instead. Every animation frame it draws the canvas down to
// 32x18 and averages the relative luminance of that thumbnail. The thumbnail is
// the point: reading the full 960x540 canvas every frame costs ~2 MB a frame and
// would tank the very frame rate being observed, while 576 pixels is free and
// still catches anything that moves the whole screen.
//
// Relative luminance is computed per WCAG (sRGB linearisation, then
// 0.2126/0.7152/0.0722), not a naive channel average, so the thresholds below
// mean what the guideline says they mean.
//
// Coverage note: this exercises the title screen, ordinary corridor play, the
// boss arena while the player is repeatedly hit, star power, and the boss
// defeat burst. It does not attempt every level's decorative effects.
//
// What it can and cannot see. It measures the *mean* luminance of the whole
// frame, so it catches anything that moves a large part of the screen, which is
// what "general flash" means. It will under-count a small localized flicker,
// which is the conservative direction for the guideline (a flashing area under
// roughly a quarter of the field of view is exempt) but is still a real blind
// spot: a 5%-of-screen white strobe at 10 Hz would not register here. Catching
// that needs a per-region analysis this does not attempt.
//
// A screenshot per scenario is written to the output directory. The luminance
// bands below are only meaningful if each scenario is really showing what its
// name claims, and the only way to know that is to look at the frame.

import path from "node:path";
import { isMain, openGame, runStandalone, forceLevel, sleep } from "./harness.mjs";

const AMPLITUDE = 0.1; // WCAG: a change of 10% or more of relative luminance
const DARK_LIMIT = 0.8; // and the darker of the pair must be below this
const MAX_FLASHES_PER_SECOND = 3;

/** Samples the mean relative luminance of the canvas once per animation frame. */
const installSampler = () => {
  const rec = { samples: [], thumb: null };
  window.__flash = rec;
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) {
    return origRAF.call(window, function (t) {
      const c = document.querySelector("canvas");
      if (c) {
        if (!rec.thumb) {
          rec.thumb = document.createElement("canvas");
          rec.thumb.width = 32;
          rec.thumb.height = 18;
        }
        const g = rec.thumb.getContext("2d", { willReadFrequently: true });
        g.drawImage(c, 0, 0, 32, 18);
        const d = g.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const lin = (v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          };
          sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
        }
        rec.samples.push({ t, lum: sum / n });
      }
      return cb(t);
    });
  };
};

const readSamples = (page) =>
  page.evaluate(() => {
    const s = window.__flash.samples;
    window.__flash.samples = [];
    return s;
  });

/**
 * Count general flashes with a hysteresis state machine.
 *
 * A flash is one opposing pair of luminance changes, so this counts rising
 * edges: it arms when luminance climbs AMPLITUDE above the running trough and
 * re-arms when it falls AMPLITUDE below the running peak. Counting both edges
 * would double every flash.
 */
function analyse(samples) {
  if (samples.length < 2) return { flashes: 0, rate: 0, min: 0, max: 0, seconds: 0, frames: samples.length };
  const first = samples[0].t;
  const last = samples[samples.length - 1].t;
  const seconds = Math.max((last - first) / 1000, 1e-6);

  let state = "low";
  let trough = samples[0].lum;
  let peak = samples[0].lum;
  let flashes = 0;
  let min = samples[0].lum;
  let max = samples[0].lum;

  for (const { lum } of samples) {
    if (lum < min) min = lum;
    if (lum > max) max = lum;
    if (state === "low") {
      if (lum < trough) trough = lum;
      if (lum >= trough + AMPLITUDE) {
        // The darker half of the pair has to be genuinely dark to count.
        if (trough < DARK_LIMIT) flashes++;
        state = "high";
        peak = lum;
      }
    } else {
      if (lum > peak) peak = lum;
      if (lum <= peak - AMPLITUDE) {
        state = "low";
        trough = lum;
      }
    }
  }
  return { flashes, rate: flashes / seconds, min, max, seconds, frames: samples.length };
}

/**
 * Keep the player alive so a long stretch of hurt effects can be sampled.
 *
 * The null guards are load-bearing, not defensive noise: `state.player` is
 * null on the win screen, so an unguarded version of this throws a page error
 * a few seconds after the boss dies and fails the console check for a reason
 * that has nothing to do with the game.
 */
const installSurvivor = () => {
  window.__survive = setInterval(() => {
    const E = window.__ethan;
    if (!E || !E.state || !E.state.player) return;
    const pl = E.state.player;
    if (pl.hearts < 3) pl.hearts = 3;
    if (pl.dead) { pl.dead = false; pl.hurtTimer = 0; }
  }, 50);
};

export async function run({ browser, url, results, outDir }) {
  const { page, errors } = await openGame(browser, url, { initScript: [installSampler, installSurvivor] });

  // Each scenario leaves a frame behind. A luminance band this narrow is only
  // meaningful if the scenario is really showing what its name claims, and the
  // only way to know that is to look.
  const scenario = async (name, seconds, drive) => {
    await readSamples(page); // discard whatever the previous scenario left
    const t0 = Date.now();
    if (drive) await drive();
    await sleep(Math.max(0, seconds * 1000 - (Date.now() - t0)));
    const stats = analyse(await readSamples(page));
    if (outDir) {
      const slug = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await page.screenshot({ path: path.join(outDir, `flash-${slug}.png`) }).catch(() => {});
    }
    results.check(
      `${name}: at most ${MAX_FLASHES_PER_SECOND} flashes/second`,
      stats.rate <= MAX_FLASHES_PER_SECOND,
      `${stats.flashes} flashes in ${stats.seconds.toFixed(1)}s = ${stats.rate.toFixed(2)}/s, ` +
        `luminance ${stats.min.toFixed(2)}-${stats.max.toFixed(2)} over ${stats.frames} frames`
    );
    return stats;
  };

  // 1. Title screen. The baseline, and where an animated background would show up.
  await scenario("title screen", 3, null);

  // 2. Ordinary corridor play on level 1, no boss.
  await forceLevel(page, 1);
  await page.keyboard.down("ArrowRight");
  await scenario("corridor play", 5, null);
  await page.keyboard.up("ArrowRight");

  // 3. The boss arena while the player is repeatedly hit. This is the scenario
  //    the hurt overlay, the shake and the boss attack effects all stack in.
  await forceLevel(page, 4);
  await sleep(400);
  await scenario("boss arena, player repeatedly hit", 8, async () => {
    await page.keyboard.down("ArrowRight");
  });
  await page.keyboard.up("ArrowRight");

  // 4. Star power, which drives the rainbow trail.
  await page.evaluate(() => {
    const E = window.__ethan;
    E.state.player.invincible = 5;
    window.__keepStar = setInterval(() => { E.state.player.invincible = 5; }, 100);
  });
  await scenario("star power", 4, null);
  await page.evaluate(() => clearInterval(window.__keepStar));

  // 5. The boss defeat burst, which is the single most likely place for a
  //    full-screen flash. The boss's hp is driven down and the player is
  //    dropped onto it, because a stomp is what actually applies the damage.
  await page.evaluate(() => {
    const E = window.__ethan;
    const b = E.boss;
    if (!b) return;
    b.hp = 1;
    const pl = E.state.player;
    pl.x = b.x;
    pl.y = b.y - 130;
    pl.vy = 240;
    pl.invincible = 5;
  });
  const defeated = await scenario("boss defeat burst", 5, null);
  const bossGone = await page.evaluate(() => {
    const E = window.__ethan;
    return { boss: E.boss ? E.boss.state : null, scene: E.scene };
  });
  results.note(`boss after the drop: ${JSON.stringify(bossGone)} (${defeated.frames} frames sampled)`);

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  await runStandalone(run, { label: "photosensitivity" });
}
