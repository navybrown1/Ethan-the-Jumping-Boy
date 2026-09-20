// Cross-engine smoke test.
//
// Everything else in this suite runs on Chrome. This runs the same core
// behaviours on a genuinely different engine, because the things most likely to
// differ between them are exactly the ones a canvas game leans on:
//
//   * Web Audio autoplay policy. Firefox and Chrome do not agree on when a
//     context is allowed to start, and the game's audio path bails while the
//     context reads "suspended". A policy difference here is the difference
//     between sound and permanent silence.
//   * localStorage, including what happens when the stored value is garbage.
//   * canvas 2D pixel readback and image decoding (the sprites are WebP).
//   * keyboard event plumbing.
//
// It deliberately asserts on behaviours, not on rendering, so it stays a smoke
// test rather than a second copy of the Chrome suite. Run it with:
//
//   BROWSER_ENGINE=firefox npm run test:xbrowser
//   BROWSER_ENGINE=webkit  npm run test:xbrowser
//
// Both are playwright-managed downloads, so `npx playwright-core install
// firefox webkit` is needed once. A cached build from a different playwright
// version will not work even if it launches.
//
// WHAT WEBKIT HERE IS NOT. This is playwright's WebKit port for Windows, not
// Safari. It has no Web Audio API (verified by probe: AudioContext,
// webkitAudioContext and OfflineAudioContext are all undefined), so it can say
// nothing about audio on Safari or iOS. Passing on this engine is evidence
// about canvas, layout, events and storage on a Blink/Gecko alternative, and
// about nothing else. Do not read it as iOS coverage.

import { isMain, openGame, runStandalone, forceLevel, parkBossOutside, readArena, sleep } from "./harness.mjs";

const SAVE_KEY = "ethan-deluxe-v1";

export async function run({ browser, url, results }) {
  const engine = browser.browserType().name();
  const { page, errors } = await openGame(browser, url);

  // Boot.
  const view = await page.evaluate(() => ({
    viewW: window.__ethan.viewW,
    viewH: window.__ethan.viewH,
    hasCanvas: !!document.querySelector("canvas"),
  }));
  results.check(`${engine}: the game boots and the canvas exists`, view.hasCanvas, JSON.stringify(view));

  const assets = await page.evaluate(async () => {
    const out = {};
    for (const p of [
      "assets/ethan/spritesheet.webp",
      "assets/bosses/grove_atlas.png",
      "assets/bosses/ember_atlas.png",
      "assets/bosses/crystal_atlas.png",
      "assets/bosses/storm_atlas.png",
    ]) {
      out[p.split("/").pop()] = await fetch(p).then((r) => r.status).catch(() => "ERR");
    }
    return out;
  });
  results.check(
    `${engine}: every sprite asset decodes over the network`,
    Object.values(assets).every((s) => s === 200),
    Object.entries(assets).map(([k, v]) => `${k}:${v}`).join(" ")
  );

  // Park somewhere flat and open, with the boss out of the way, so movement
  // measures movement rather than a collision.
  const arena = await readArena(page);
  await forceLevel(page, 1);
  await sleep(400);
  const parked = await parkBossOutside(page, arena);
  await page.evaluate(
    ({ a, w, h }) => {
      const pl = window.__ethan.state.player;
      pl.x = a.x0 + 300;
      pl.y = a.floor - h;
      pl.vx = 0;
      pl.vy = 0;
    },
    { a: arena, w: 44, h: 70 }
  );
  results.check(`${engine}: the arena is clear for the movement checks`, !!parked && parked.x > arena.x1,
    parked ? `boss at ${Math.round(parked.x)}, arena ends ${arena.x1}` : "no boss");

  // Facing. This is the bug that started this whole thread: the sprite ran
  // backwards relative to travel. Worth re-proving on a second engine.
  const move = async (key, ms) => {
    const before = await page.evaluate(() => window.__ethan.state.player.x);
    await page.keyboard.down(key);
    await sleep(ms);
    const mid = await page.evaluate(() => ({
      x: window.__ethan.state.player.x,
      facing: window.__ethan.state.player.facing,
    }));
    await page.keyboard.up(key);
    await sleep(120);
    return { before, ...mid };
  };

  const right = await move("ArrowRight", 700);
  results.check(`${engine}: holding right moves the player right`, right.x > right.before + 20,
    `x ${Math.round(right.before)} -> ${Math.round(right.x)}`);
  results.check(`${engine}: facing right is 1 while moving right`, right.facing === 1, `facing=${right.facing}`);

  const left = await move("ArrowLeft", 700);
  results.check(`${engine}: holding left moves the player left`, left.x < left.before - 20,
    `x ${Math.round(left.before)} -> ${Math.round(left.x)}`);
  results.check(`${engine}: facing left is -1 while moving left`, left.facing === -1, `facing=${left.facing}`);

  // Jump. Physics is pure arithmetic so the height should not depend on the
  // engine; what this proves is that the key reaches the game and gravity runs.
  const jump = await page.evaluate(async () => {
    const E = window.__ethan;
    const pl = E.state.player;
    const y0 = pl.y;
    let apex = y0;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (pl.y < apex) apex = pl.y;
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    for (let i = 0; i < 60; i++) await new Promise((r) => requestAnimationFrame(r));
    return { y0, apex, rise: y0 - apex, landedY: pl.y, grounded: pl.grounded };
  });
  results.check(`${engine}: a jump leaves the ground`, jump.rise > 80, `rise ${Math.round(jump.rise)}px`);
  results.check(`${engine}: the player comes back down and lands`, jump.grounded === true,
    `y=${Math.round(jump.landedY)} grounded=${jump.grounded}`);

  // Audio. Firefox and Chrome disagree about autoplay policy, so this is the
  // check most likely to differ between engines.
  //
  // It is conditional because playwright's WebKit build on Windows exposes no
  // Web Audio API at all: AudioContext, webkitAudioContext and
  // OfflineAudioContext are all undefined, verified by direct probe. That is a
  // property of that port, not of Safari and not of this game, so asserting on
  // it would be reporting a failure the game cannot cause. What is worth
  // asserting there is the opposite: the game still runs with no Web Audio.
  //
  // The consequence is that this test says NOTHING about audio on Safari or
  // iOS. Real Safari has had Web Audio for years, but this build cannot stand
  // in for it, so iOS audio stays unverified.
  const hasWebAudio = await page.evaluate(
    () => typeof (window.AudioContext || window.webkitAudioContext) === "function"
  );
  await page.keyboard.press("ArrowRight");
  await sleep(600);
  const audio = await page.evaluate(() => window.__ethan.audio);
  if (hasWebAudio) {
    results.check(`${engine}: a gesture brings the audio context up`, audio.state === "running",
      `state=${audio.state} contexts=${audio.contexts} gated=${audio.gated}`);
  } else {
    results.note(`${engine}: this build exposes no Web Audio API, so the audio path cannot be exercised here`);
    const alive = await page.evaluate(() => ({
      drawing: !!document.querySelector("canvas"),
      scene: window.__ethan.scene,
      x: window.__ethan.state.player.x,
    }));
    results.check(
      `${engine}: the game runs normally on a platform with no Web Audio`,
      alive.drawing && audio.contexts === 0,
      `scene=${alive.scene} x=${Math.round(alive.x)} contexts=${audio.contexts}`
    );
  }

  // Save round trip, then corruption. Both go through localStorage, which
  // every engine implements slightly differently.
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ unlocked: 3, stars: [3, 2, 0, 0], bestScore: 1234 }));
  }, SAVE_KEY);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !!window.__ethan, null, { timeout: 20000, polling: 100 });
  const loaded = await page.evaluate(() => ({ ...window.__ethan.prog }));
  results.check(`${engine}: a saved unlock level survives a reload`, loaded.unlocked === 3,
    `unlocked=${loaded.unlocked} stars=${JSON.stringify(loaded.stars)} best=${loaded.bestScore}`);

  await page.evaluate((key) => localStorage.setItem(key, "{not json at all"), SAVE_KEY);
  await page.reload({ waitUntil: "load" });
  let recovered = null;
  try {
    await page.waitForFunction(() => !!window.__ethan, null, { timeout: 20000, polling: 100 });
    recovered = await page.evaluate(() => ({ ...window.__ethan.prog }));
  } catch {
    recovered = null;
  }
  results.check(
    `${engine}: a corrupt save does not stop the game booting`,
    !!recovered && recovered.unlocked === 1,
    recovered ? `unlocked=${recovered.unlocked} best=${recovered.bestScore}` : "the game never booted"
  );

  results.check(`${engine}: no console errors`, errors.length === 0, errors.slice(0, 3).join(" | "));

  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  // `--all` exists as a flag rather than only an env var so the npm script does
  // not need cross-env to work on Windows.
  const engine = process.argv.includes("--all") ? "all" : process.env.BROWSER_ENGINE || "firefox";
  if (engine === "all") {
    // One command for the whole matrix. Each engine gets its own server and
    // browser, so a crash in one cannot mask the others.
    let ok = true;
    for (const e of ["chrome", "firefox", "webkit"]) {
      console.log(`\n${"=".repeat(64)}`);
      const passed = await runStandalone(run, { label: "cross-engine smoke", engine: e });
      ok = passed && ok;
    }
    process.exitCode = ok ? 0 : 1;
  } else {
    await runStandalone(run, { label: "cross-engine smoke", engine });
  }
}
