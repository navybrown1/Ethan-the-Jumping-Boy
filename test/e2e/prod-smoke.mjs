// Production smoke test.
//
// Builds, serves `dist/` over a plain static server, and asserts two separate
// classes of thing:
//
//   * the shipped bundle is clean - no credential strings, and none of the
//     dev-only forensics or the test hook survived tree-shaking
//   * the app actually runs from those files - boots, draws, and fetches
//     every boss atlas over the network
//
// It reads the network and the pixels rather than game state, because the test
// hook is compiled out of production. That is the point: asserting on
// `window.__ethan` here would prove nothing about what users get.

import { ROOT, isMain, openGame, runStandalone, sleep } from "./harness.mjs";
import fs from "node:fs";
import path from "node:path";

// Strings that must not appear in a public bundle. The first is a credential;
// the rest are dev-only diagnostics that would leak game internals and bloat
// the payload.
const FORBIDDEN = [
  "GEMINI_API_KEY",
  "process.env.GEMINI",
  "__ethan",
  "__dmgLog",
  "__stompLog",
  "__hitLog",
  "devLog",
  "bossSheetAsset",
];

function bundleHygiene(results) {
  const dir = path.join(ROOT, "dist", "assets");
  if (!fs.existsSync(dir)) {
    results.check("dist/assets exists", false, "run a build first");
    return;
  }
  const js = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  const blobs = js.map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
  const all = blobs.join("\n");
  const bytes = js.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);

  for (const needle of FORBIDDEN) {
    results.check(`bundle excludes "${needle}"`, !all.includes(needle));
  }
  results.check("no sourcemap is published", !fs.readdirSync(dir).some((f) => f.endsWith(".map")));
  results.note(`bundle ${js.join(", ")} (${(bytes / 1024).toFixed(1)} kB on disk)`);
}

export async function run({ browser, url, results }) {
  bundleHygiene(results);

  const { page, errors } = await openGame(browser, url, { requireHook: false });
  await sleep(2500);

  const hasHook = await page.evaluate(() => typeof window.__ethan !== "undefined");
  results.check("dev-only test hook is absent from the production bundle", !hasHook);

  // Drive the title screen into the game, then look at the pixels.
  await page.keyboard.press("Enter");
  await sleep(2500);

  const stats = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return { w: c.width, h: c.height, distinctColours: seen.size };
  });
  results.check("canvas is present and sized", !!stats && stats.w > 0 && stats.h > 0, JSON.stringify(stats));
  // A blank or single-colour canvas means the render loop is not running. The
  // real scenes sample in the hundreds of distinct colours.
  results.check("canvas is actually drawing", !!stats && stats.distinctColours > 50,
    `${stats ? stats.distinctColours : 0} distinct sampled colours`);

  const atlas = await page.evaluate(async () => {
    const out = {};
    for (const k of ["grove", "ember", "crystal", "storm"]) {
      out[k] = await fetch(`/assets/bosses/${k}_atlas.png`).then((r) => r.status).catch(() => "ERR");
    }
    return out;
  });
  results.check("all four boss atlases are reachable",
    Object.values(atlas).every((s) => s === 200),
    Object.entries(atlas).map(([k, v]) => `${k}:${v}`).join(" "));

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  await runStandalone(run, { prod: true, label: "production smoke" });
}
