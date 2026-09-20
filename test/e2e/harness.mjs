// Shared plumbing for the end-to-end tests.
//
// Two design rules, both learned the hard way:
//
//   1. Every number the tests assert on comes out of the running game, never
//      from a copy kept here. The arena bounds, the dash reach and the boss
//      stat blocks are all read through `window.__ethan`. A hardcoded 0.85 in
//      a harness once kept "passing" for a whole session after the game had
//      moved to a different constant.
//
//   2. The dev server is started with HMR off. A hot reload during a sweep
//      reloads the page and silently invalidates every measurement after it,
//      which produces confident wrong answers rather than errors.
//
// The servers are created through Vite's own API instead of shelling out, so
// there is no child process to leak and no port to guess.

import { build, createServer, preview } from "vite";
import { chromium, firefox, webkit } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG = path.join(ROOT, "vite.config.ts");

// Screenshots and JSON reports land here. Already gitignored.
export const OUT = process.env.SHOT_DIR || path.join(ROOT, "boss-analysis");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
  return OUT;
}

export function isMain(metaUrl) {
  return !!process.argv[1] && pathToFileURL(process.argv[1]).href === metaUrl;
}

async function requireUrl(server, what) {
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error(`${what} started but Vite reported no local URL`);
  return url;
}

/**
 * Run `fn` with process.env.NODE_ENV pinned, then put it back.
 *
 * This exists because Vite's `build()` sets NODE_ENV=production as a side
 * effect and never restores it. A `createServer()` later in the same process
 * then resolves `isProduction: true`, which makes `import.meta.env.DEV` false,
 * which dead-code-eliminates the dev-only test hook.
 *
 * The failure mode is nasty: the app boots, renders and draws perfectly, there
 * are no console errors, and only the hook is missing. It reads as a hung page.
 * Passing `mode: "development"` to `createServer` does NOT fix it, because
 * Vite derives `isProduction` from NODE_ENV rather than from `mode`. Verified:
 * `mode: "development"` still reported `isProduction: true` and no hook.
 */
async function withNodeEnv(value, fn) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

export async function startDevServer() {
  const server = await withNodeEnv("development", () =>
    createServer({
      root: ROOT,
      configFile: CONFIG,
      logLevel: "warn",
      server: {
        // HMR off on purpose: a hot reload mid-run reloads the page and
        // silently invalidates every measurement after it.
        hmr: false,
        host: "127.0.0.1",
        port: 3000,
        strictPort: false,
      },
    })
  );
  await server.listen();
  if (server.config.isProduction) {
    await server.close();
    throw new Error(
      "the dev server resolved isProduction=true, so the test hook is not in " +
        "the bundle. Something set NODE_ENV=production before this ran."
    );
  }
  return { url: await requireUrl(server, "dev server"), close: () => server.close() };
}

export async function startProdServer() {
  const server = await withNodeEnv("production", async () => {
    await build({ root: ROOT, configFile: CONFIG, logLevel: "warn" });
    return preview({
      root: ROOT,
      configFile: CONFIG,
      logLevel: "warn",
      preview: { host: "127.0.0.1", port: 8200, strictPort: false },
    });
  });
  return { url: await requireUrl(server, "preview server"), close: () => server.close() };
}

// These tests drive the Chrome that is already on the machine via
// `channel: "chrome"`, so playwright-core never downloads a browser.
//
// The throttling flags are not optional. The game runs on requestAnimationFrame,
// and Chromium throttles rAF hard for a tab it considers backgrounded or
// occluded. Reusing one browser across two phases makes the second page the
// second tab, and it then sits there with a loaded document, no console errors,
// and a game loop that never ticks. That failure is indistinguishable from a
// hung page, so it is worth removing at the source.
const LAUNCH_ARGS = [
  "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

/**
 * Launch a browser. Defaults to the system Chrome; pass "firefox" for the
 * second engine.
 *
 * The two are not interchangeable and the differences are not cosmetic:
 *
 *   * The LAUNCH_ARGS are Chromium switches. Firefox ignores or rejects them,
 *     so it launches bare.
 *   * Chrome comes from the system install via channel:"chrome". Firefox is a
 *     playwright-managed download, so it needs `npx playwright-core install
 *     firefox` once. The cached builds on a machine are usually pinned to a
 *     *different* playwright version and cannot be reused: a firefox-1522 from
 *     an older install launches but then dies on `Browser.setDefaultViewport`,
 *     which this playwright does not send. Check the build number matches
 *     before assuming a cached engine is usable.
 */
export async function launchBrowser(engine = process.env.BROWSER_ENGINE || "chrome") {
  // Both of these are playwright-managed downloads, not system installs.
  const managed = {
    firefox: [firefox, "Firefox"],
    webkit: [webkit, "WebKit"],
  };
  if (managed[engine]) {
    const [type, label] = managed[engine];
    try {
      return await type.launch();
    } catch (err) {
      throw new Error(
        `Could not launch ${label}. It is a playwright-managed download, not a ` +
          `system install, so run: npx playwright-core install ${engine}\n` +
          `Underlying error: ${err.message}`
      );
    }
  }
  if (engine !== "chrome") throw new Error(`unknown engine: ${engine}`);
  try {
    return await chromium.launch({ channel: "chrome", args: LAUNCH_ARGS });
  } catch (err) {
    throw new Error(
      "Could not launch Chrome. These tests use the system Chrome install " +
        "(playwright-core channel:\"chrome\") and do not download a browser.\n" +
        `Underlying error: ${err.message}`
    );
  }
}

/**
 * Open the game and start collecting console errors.
 * `requireHook` waits for the dev-only test hook; production builds do not
 * have it, so the production smoke test passes false.
 */
export async function openGame(browser, url, opts = {}) {
  const { viewport, hasTouch, isMobile, deviceScaleFactor, requireHook = true, initScript, onPage, reducedMotion } = opts;
  const page = await browser.newPage({
    viewport: viewport || { width: 1280, height: 800 },
    ...(hasTouch ? { hasTouch: true } : {}),
    ...(isMobile ? { isMobile: true } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    // Set the initial preference before boot; live preference changes are
    // covered separately in fairness.mjs.
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  // Attach extra listeners (request/response taps, mainly) before navigating,
  // since anything registered after `goto` has already missed the document and
  // its first few fetches.
  if (onPage) await onPage(page);
  // Runs before any page script, which is the only way to observe things the
  // game touches during module init. Accepts one function or an array of them.
  for (const script of Array.isArray(initScript) ? initScript : [initScript]) {
    if (script) await page.addInitScript(script);
  }
  await page.goto(url, { waitUntil: "load" });
  // Only one page should ever be in front, so make sure it is this one.
  await page.bringToFront();
  if (requireHook) {
    try {
      // `polling: 100` rather than the default rAF polling. The hook is set by
      // the game's own rAF loop, and polling on rAF means a throttled tab waits
      // on the very thing that is throttled.
      await page.waitForFunction(() => !!window.__ethan, null, { timeout: 20000, polling: 100 });
    } catch (err) {
      // A bare "Timeout 20000ms exceeded" tells you nothing. Whatever the page
      // was complaining about while the hook failed to appear is the answer, so
      // it goes in the message.
      throw new Error(
        `the test hook never appeared at ${url}.\n` +
          `  console errors: ${errors.length ? errors.slice(0, 8).join("\n                  ") : "none"}\n` +
          `  url: ${page.url()}\n` +
          `  is another dev server already holding the port? ` +
          `check with: netstat -ano | grep LISTENING | grep :3000`
      );
    }
  }
  return { page, errors };
}

/** Arena bounds, read from the game so they cannot drift from a local copy. */
export const readArena = (page) => page.evaluate(() => window.__ethan.arena);

/**
 * Put the game into a known level with the player parked on the floor.
 *
 * `resetGame("playing")` re-derives checkpointLevel from selectLevel, so on a
 * fresh browser profile both have to be set or the game quietly runs level 1
 * while the caller believes it asked for level 4. The returned level is the
 * real one, and callers are expected to assert on it.
 */
export async function forceLevel(page, level, { parkAt = 130, clearPowerups = true } = {}) {
  const actual = await page.evaluate(
    ({ lv, park, clear }) => {
      const E = window.__ethan;
      E.prog.unlocked = Math.max(E.prog.unlocked || 1, lv);
      if (clear) E.state.powerups.forEach((p) => { p.taken = true; });
      E.state.selectLevel = lv;
      E.state.checkpointLevel = lv;
      E.state.checkpointScore = 0;
      E.resetGame("playing");
      if (clear) E.state.powerups.forEach((p) => { p.taken = true; });
      const pl = E.state.player;
      pl.x = E.arena.x0 + park;
      pl.y = E.arena.floor - pl.h;
      pl.vx = 0;
      pl.vy = 0;
      window.__dmgLog = [];
      window.__stompLog = [];
      window.__hitLog = [];
      return E.state.currentLevel;
    },
    { lv: level, park: parkAt, clear: clearPowerups }
  );
  if (actual !== level) {
    throw new Error(`asked for level ${level}, game loaded level ${actual}`);
  }
  return actual;
}

/**
 * Move the boss's whole patrol band out of the arena and freeze it there, for
 * tests that measure the level rather than the encounter.
 *
 * Freezing its speed is not enough. An idle boss body-blocks: stepBoss shoves
 * the player at 360px/s on contact and skips the damage because `idle` is in
 * its harmless set. A boss parked in the middle of the runway therefore looks
 * exactly like an invisible wall in a walk test, which is a false positive
 * that costs an hour. Moving `minX`/`maxX` is safe because the game sets them
 * once at spawn and only reads them afterwards.
 *
 * Returns the resulting position so the caller can assert the boss really is
 * out of the way instead of trusting this worked.
 */
export async function parkBossOutside(page, arena, pad = 400) {
  return page.evaluate(
    ({ a, p }) => {
      const E = window.__ethan;
      const b = E.boss;
      if (!b) return null;
      b.minX = a.x1 + p;
      b.maxX = a.x1 + p + 200;
      b.x = a.x1 + p;
      b.dir = 1;
      b.speed = 0;
      b.vx = 0;
      b.t = 1e9; // never reaches its next attack
      b.state = "idle";
      if (b.minions) b.minions.length = 0;
      // Anything the boss queued up before being parked would still be live.
      E.state.shockwaves.length = 0;
      E.state.strikes.length = 0;
      return { x: b.x, minX: b.minX, maxX: b.maxX, w: b.w };
    },
    { a: arena, p: pad }
  );
}

/** Timestamped key state, so a test never sends a redundant keydown/up. */
export function keyDriver(page) {
  const down = { left: false, right: false, jump: false };
  const map = { jump: " ", left: "ArrowLeft", right: "ArrowRight" };
  return {
    down,
    async set(name, want) {
      if (down[name] === want) return;
      down[name] = want;
      if (want) await page.keyboard.down(map[name]);
      else await page.keyboard.up(map[name]);
    },
    async releaseAll() {
      for (const n of ["left", "right", "jump"]) await this.set(n, false);
    },
  };
}

export class Results {
  constructor(label) {
    this.label = label;
    this.rows = [];
  }

  check(name, ok, detail = "") {
    const pass = !!ok;
    this.rows.push({ name, ok: pass, detail });
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}${detail ? " - " + detail : ""}`);
    return pass;
  }

  note(msg) {
    console.log(`  ... ${msg}`);
  }

  get failed() {
    return this.rows.filter((r) => !r.ok);
  }

  report() {
    const n = this.rows.length;
    console.log(`\n${this.label}: ${n - this.failed.length}/${n} checks passed`);
    for (const f of this.failed) {
      console.log(`  FAILED: ${f.name}${f.detail ? " - " + f.detail : ""}`);
    }
    return this.failed.length === 0;
  }
}

/**
 * Boot whatever the test needs, run it, tear it down.
 * A test module is `run(ctx)` returning a boolean; this wrapper is what makes
 * each one runnable on its own with `node test/e2e/<file>.mjs`.
 */
export async function runStandalone(run, { prod = false, label = "test", engine } = {}) {
  const server = prod ? await startProdServer() : await startDevServer();
  const browser = await launchBrowser(engine);
  try {
    const url = process.env.GAME_URL || server.url;
    console.log(`${label} against ${url} [${browser.browserType().name()}]\n`);
    const ok = await run({ browser, url, results: new Results(label), outDir: ensureOut() });
    process.exitCode = ok ? 0 : 1;
    return ok;
  } finally {
    await browser.close();
    await server.close();
  }
}
