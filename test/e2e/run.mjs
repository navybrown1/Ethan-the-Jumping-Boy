// End-to-end test runner.
//
//   npm run test:e2e                    everything (production smoke + subpath + arena + touch + audio + traversal + bosses + perf)
//   npm run test:e2e -- --only=prod     production bundle smoke test only
//   npm run test:e2e -- --only=subpath  serving the built files from a subpath (GitHub Pages) only
//   npm run test:e2e -- --only=arena    arena runway geometry only
//   npm run test:e2e -- --only=touch    phone layout and touch input only
//   npm run test:e2e -- --only=audio    audio gating, mixing and recovery only
//   npm run test:e2e -- --only=traverse level traversability only
//   npm run test:e2e -- --only=flash    photosensitivity (WCAG 2.3.1 flash rate) only
//   npm run test:e2e -- --only=boss     no-powers boss verification only
//   npm run test:e2e -- --only=perf     frame-time measurement only
//   npm run test:e2e -- --levels=1,4    just two bosses
//
// The two phases need different servers. The arena and boss tests read the
// dev-only test hook, so they run against a Vite dev server with HMR off. The
// production smoke test deliberately runs against the built files over a plain
// static server, because the point is to check what actually ships.
//
// Exits non-zero if any check fails, so it can be wired into CI as-is.

import { Results, ensureOut, launchBrowser, startDevServer, startProdServer } from "./harness.mjs";
import * as arenaRunway from "./arena-runway.mjs";
import * as audio from "./audio.mjs";
import * as bossNoPowers from "./boss-nopowers.mjs";
import * as performance from "./performance.mjs";
import * as photosensitivity from "./photosensitivity.mjs";
import * as prodSmoke from "./prod-smoke.mjs";
import * as subpath from "./subpath.mjs";
import * as touchInput from "./touch-input.mjs";
import * as traversal from "./traversal.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const only = flag("only", "all");
const want = (name) => only === "all" || only === name;

if (flag("levels", null)) process.env.LEVELS = flag("levels", null);
if (flag("run-ms", null)) process.env.RUN_MS = flag("run-ms", null);

const outDir = ensureOut();
const browser = await launchBrowser();
const phases = [];

async function phase(label, startServer, modules) {
  const server = await startServer();
  try {
    const url = process.env.GAME_URL || server.url;
    console.log(`\n${"=".repeat(64)}\n${label}  (${url})\n${"=".repeat(64)}`);
    const results = new Results(label);
    for (const mod of modules) {
      await mod.run({ browser, url, results, outDir });
    }
    phases.push({ label, ok: results.failed.length === 0, results });
  } catch (err) {
    // A thrown error is a failure, not a crash. Report it and keep going so one
    // broken phase does not hide the state of the others.
    console.error(`\n${label} threw: ${err.message}`);
    phases.push({ label, ok: false, results: null, error: err });
  } finally {
    await server.close();
  }
}

try {
  // Both of these read the built files rather than the dev server. They share
  // one phase so `dist/` is built exactly once: a second `build()` in the same
  // process wipes `dist/assets` again, and that churn is what trips the
  // sandbox's bulk-delete guard.
  const prodModules = [];
  if (want("prod")) prodModules.push(prodSmoke);
  if (want("subpath")) prodModules.push(subpath);
  if (prodModules.length) await phase("production (built files)", startProdServer, prodModules);
  if (
    want("arena") ||
    want("boss") ||
    want("perf") ||
    want("touch") ||
    want("audio") ||
    want("traverse") ||
    want("flash")
  ) {
    const modules = [];
    if (want("arena")) modules.push(arenaRunway);
    if (want("touch")) modules.push(touchInput);
    if (want("audio")) modules.push(audio);
    if (want("traverse")) modules.push(traversal);
    if (want("flash")) modules.push(photosensitivity);
    if (want("boss")) modules.push(bossNoPowers);
    if (want("perf")) modules.push(performance);
    await phase("gameplay (dev server)", startDevServer, modules);
  }
} finally {
  await browser.close();
}

console.log(`\n${"=".repeat(64)}\nSUMMARY\n${"=".repeat(64)}`);
let total = 0;
let passed = 0;
for (const p of phases) {
  total += p.results ? p.results.rows.length : 1;
  passed += p.results ? p.results.rows.length - p.results.failed.length : 0;
  console.log(`  ${p.ok ? "PASS" : "FAIL"}  ${p.label}${p.error ? ` (${p.error.message})` : ""}`);
}
console.log(`\n${passed}/${total} checks passed`);
console.log(`artifacts: ${outDir}`);
process.exitCode = phases.every((p) => p.ok) ? 0 : 1;
