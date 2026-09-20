// Subpath hosting test.
//
// The game is meant to ship as static files on GitHub Pages. A GitHub Pages
// *project* site is not served from the domain root: it lives at
// https://<user>.github.io/<repo>/. Every URL the app emits therefore has to
// carry that prefix, and there are two independent places it can get it wrong:
//
//   1. index.html, where Vite writes the script and stylesheet tags. With the
//      default `base` of "/" these are emitted root-absolute, so at a subpath
//      the browser asks for https://<user>.github.io/assets/index-*.js and gets
//      a 404. The page is blank white and there is nothing in the game to
//      blame, because the game never loads.
//
//   2. At runtime, where `import.meta.env.BASE_URL` builds the sprite and boss
//      atlas URLs. If `base` is "/" then BASE_URL is "/" and the atlases 404
//      even once the bundle loads.
//
// Neither shows up when you serve `dist/` from a root, which is what every
// other test here does, so the failure is invisible until the day it is
// deployed. This test serves the real built files from a subpath and watches
// the actual network.
//
// The sharp check is `requests outside the prefix`: rather than only asserting
// the assets we thought of, it asserts that *nothing at all* was requested
// outside the deployed prefix. Any root-absolute URL trips it, including ones
// added later by someone who has not read this file.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT, isMain, openGame, runStandalone, sleep } from "./harness.mjs";

// Deliberately the real repository name, since that is what GitHub Pages will
// use. Any prefix would catch the same bugs, but using the true one means the
// test also documents the intended URL.
const PREFIX = "/Ethan-the-Jumping-Boy";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

/**
 * Serve `dist/` from a subpath, the way GitHub Pages serves a project site.
 * Anything requested outside the prefix is a 404, which is exactly what the
 * real host would do, so a root-absolute URL fails here rather than quietly
 * succeeding.
 */
function serveDistUnder(prefix) {
  const dist = path.join(ROOT, "dist");
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const notFound = (why) => {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(why);
    };
    if (!urlPath.startsWith(prefix)) return notFound("outside the deployed prefix");
    let rel = urlPath.slice(prefix.length);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.join(dist, rel);
    // Refuse to walk out of dist even if the URL tries.
    if (!file.startsWith(dist)) return notFound("path traversal");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound("not found");
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
}

/** The URLs Vite emitted into index.html, so we can judge them on their own. */
function emittedAssetUrls() {
  const html = fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf8");
  return [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith("data:") && !u.startsWith("http"));
}

export async function run({ browser, results }) {
  const index = path.join(ROOT, "dist", "index.html");
  if (!fs.existsSync(index)) {
    results.check("dist/index.html exists", false, "run a build first (npm run build)");
    return false;
  }

  // 1. Static: what the build wrote into index.html.
  const emitted = emittedAssetUrls();
  const absolute = emitted.filter((u) => u.startsWith("/"));
  results.check(
    "index.html emits no root-absolute asset URL",
    absolute.length === 0,
    absolute.length ? absolute.join(" ") : `${emitted.length} relative: ${emitted.join(" ")}`
  );

  // 2. Runtime: serve those files from a subpath and watch the real network.
  const server = serveDistUnder(PREFIX);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}${PREFIX}/`;

  const requests = [];
  const responses = [];
  const failed = [];
  try {
    const { page, errors } = await openGame(browser, base, {
      requireHook: false,
      onPage: (p) => {
        p.on("request", (r) => requests.push(r.url()));
        p.on("response", (r) => {
          responses.push({ url: r.url(), status: r.status() });
          if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
        });
        p.on("requestfailed", (r) => failed.push(`FAILED ${r.url()}`));
      },
    });

    await sleep(2500);
    await page.keyboard.press("Enter");
    await sleep(2500);

    const outside = requests.filter((u) => !u.startsWith(base) && !u.startsWith("data:"));
    results.check(
      "nothing is requested outside the deployed prefix",
      outside.length === 0,
      outside.length ? outside.slice(0, 4).join(" ") : `${requests.length} requests, all under ${PREFIX}/`
    );

    results.check("no request failed", failed.length === 0, failed.slice(0, 4).join(" | "));

    const stats = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return null;
      const g = c.getContext("2d");
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return { w: c.width, h: c.height, distinctColours: seen.size };
    });
    // A blank canvas is what a 404 on the bundle looks like from here.
    results.check(
      "the game boots and draws from a subpath",
      !!stats && stats.w > 0 && stats.distinctColours > 50,
      stats ? `${stats.w}x${stats.h}, ${stats.distinctColours} distinct colours` : "no canvas"
    );

    // The atlases and the Ethan spritesheet are loaded at boot from URLs the
    // game builds out of BASE_URL, so this is the check that covers the second
    // failure mode rather than the first. It reads the URLs the game itself
    // asked for instead of reconstructing them here, because a URL this test
    // builds could be correct while the game's is not.
    const sprites = responses.filter((r) => r.url.includes("/assets/") && !r.url.endsWith(".js") && !r.url.endsWith(".css"));
    const atlasHits = sprites.filter((r) => r.url.includes("/assets/bosses/"));
    const sheetHits = sprites.filter((r) => r.url.includes("/assets/ethan/"));
    results.check(
      "the game requested its sprite and atlas assets",
      atlasHits.length >= 4 && sheetHits.length >= 1,
      `${atlasHits.length} atlas, ${sheetHits.length} sheet requests`
    );
    results.check(
      "every sprite asset the game asked for loaded",
      sprites.length > 0 && sprites.every((r) => r.status === 200),
      sprites.length
        ? sprites.map((r) => `${r.status} ${r.url.split("/").pop()}`).join(" ")
        : "the game requested no sprite assets at all"
    );

    results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  } finally {
    await new Promise((r) => server.close(r));
  }

  return results.report();
}

if (isMain(import.meta.url)) {
  // `prod: true` builds dist/ and starts a preview server we then ignore, which
  // keeps this file runnable on its own with `node test/e2e/subpath.mjs`.
  await runStandalone(run, { prod: true, label: "subpath hosting" });
}
