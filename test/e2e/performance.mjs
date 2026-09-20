// Frame-time measurement.
//
// The directive asked for real numbers against a 60 Hz budget (16.7 ms) and a
// long-task threshold (50 ms). This measures frame deltas on the page's own
// render loop across the three scenes that matter: the title screen, a
// corridor, and the arena with the boss active and attacking.
//
// Honest limitation: this runs in headless Chrome with software rasterisation,
// so the absolute numbers are a FLOOR, not a prediction of real hardware. A
// machine with a GPU will be faster. What the numbers are good for is
// comparison between scenes and catching logic-side hitches, which are the part
// a GPU cannot rescue.

import { Results, ensureOut, forceLevel, isMain, openGame, readArena, runStandalone, sleep } from "./harness.mjs";

const SAMPLE_MS = Number(process.env.PERF_MS || 10000);
// Frames discarded from the start of the title sample. Cold start includes
// image decode and the first paint of every asset, so a hitch there is startup
// cost, not a steady-state defect. It is reported, not failed on.
const WARMUP = 30;

// Thresholds are deliberately loose. The goal is to catch a stutter a player
// would notice, not to grade the machine.
const MAX_SINGLE_FRAME_MS = 100; // anything longer is a visible hitch
const MAX_LONG_FRAMES = 0; // frames over 50ms

async function sampleFrames(page, ms) {
  await page.evaluate(() => {
    window.__perf = { frames: [], on: true, particles: 0, peakParticles: 0 };
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (window.__perf.on) {
        window.__perf.frames.push(now - last);
        const n = window.__ethan?.state?.particles?.length ?? 0;
        window.__perf.peakParticles = Math.max(window.__perf.peakParticles, n);
        window.__perf.particles = n;
      }
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await sleep(ms);
  return page.evaluate(() => {
    window.__perf.on = false;
    return { frames: window.__perf.frames, peakParticles: window.__perf.peakParticles };
  });
}

function stats(frames, { skip = 0 } = {}) {
  const kept = frames.slice(skip);
  const sorted = [...kept].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  const over50 = kept.map((f, i) => (f > 50 ? i + skip : -1)).filter((i) => i >= 0);
  return {
    n: kept.length,
    mean,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted[sorted.length - 1],
    // Where the worst frame sat, so a hitch can be located rather than guessed at.
    maxIndex: frames.indexOf(sorted[sorted.length - 1]),
    over16: kept.filter((f) => f > 16.7).length,
    over33: kept.filter((f) => f > 33).length,
    over50: over50.length,
    over50At: over50.slice(0, 5),
    fps: 1000 / mean,
  };
}

function report(results, label, s, extra = "") {
  results.note(
    `${label}: ${s.fps.toFixed(1)} fps mean, p50 ${s.p50.toFixed(1)} p95 ${s.p95.toFixed(1)} ` +
      `p99 ${s.p99.toFixed(1)} max ${s.max.toFixed(1)} ms | frames ${s.n}, ` +
      `>16.7ms ${s.over16}, >33ms ${s.over33}, >50ms ${s.over50}` +
      (s.over50 ? ` (at frame index ${s.over50At.join(", ")})` : "") +
      extra
  );
  results.check(`${label}: no single frame over ${MAX_SINGLE_FRAME_MS}ms`,
    s.max <= MAX_SINGLE_FRAME_MS, `worst frame ${s.max.toFixed(1)}ms at index ${s.maxIndex}`);
  results.check(`${label}: no long frames over 50ms`, s.over50 <= MAX_LONG_FRAMES,
    `${s.over50} of ${s.n} frames over 50ms` +
      (s.over50 ? `, at frame index ${s.over50At.join(", ")} of ${s.n + WARMUP}` : ""));
}

export async function run({ browser, url, results, outDir }) {
  const { page, errors } = await openGame(browser, url);

  // ── title screen ────────────────────────────────────────────────────────
  const titleRaw = await sampleFrames(page, 4000);
  const cold = stats(titleRaw.frames.slice(0, WARMUP));
  results.note(
    `cold start (first ${WARMUP} frames, reported only): worst ${cold.max.toFixed(1)}ms, ` +
      `frames over 50ms: ${cold.over50} at index ${cold.over50At.join(", ") || "-"}`
  );
  const title = stats(titleRaw.frames, { skip: WARMUP });
  report(results, "title screen (steady state)", title);

  // ── corridor (light scene) ──────────────────────────────────────────────
  await forceLevel(page, 1);
  await page.evaluate(() => {
    const pl = window.__ethan.state.player;
    pl.x = 300;
    pl.y = 456 - pl.h;
  });
  await sleep(400);
  const corridor = stats((await sampleFrames(page, SAMPLE_MS)).frames);
  report(results, "corridor", corridor);

  // ── arena with the boss live and attacking (heavy scene) ────────────────
  const arena = await readArena(page);
  await page.evaluate((a) => {
    const E = window.__ethan;
    const pl = E.state.player;
    pl.x = a.x0 + 300;
    pl.y = a.floor - pl.h;
    pl.vx = 0;
    pl.vy = 0;
  }, arena);
  // Let the boss wake, finish its intro, and get into its attack cycle.
  await sleep(3000);
  const bossState = await page.evaluate(() => {
    const b = window.__ethan.boss;
    return b ? { state: b.state, attack: b.attack, active: b.active } : null;
  });
  results.note(`arena boss at sample start: ${JSON.stringify(bossState)}`);
  const arenaPerf = await sampleFrames(page, SAMPLE_MS);
  const arenaStats = stats(arenaPerf.frames);
  report(results, "arena + boss", arenaStats, `, peak particles ${arenaPerf.peakParticles}`);

  // The heavy scene must not be dramatically worse than the light one, or the
  // boss fight is where the frame budget goes.
  const ratio = arenaStats.p95 / corridor.p95;
  results.check(
    "arena p95 stays within 2x the corridor p95",
    ratio <= 2,
    `arena ${arenaStats.p95.toFixed(1)}ms vs corridor ${corridor.p95.toFixed(1)}ms (${ratio.toFixed(2)}x)`
  );

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  ensureOut();
  await runStandalone(run, { label: "performance" });
}
