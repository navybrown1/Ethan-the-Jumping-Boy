// Reduced motion, verified as a difference rather than as a branch.
//
// The game reads `(prefers-reduced-motion: reduce)` at init and on change.
// Reading the source proves the branches exist; it does not prove
// they change anything. So this runs the same scenario twice, once with the
// setting on and once with it off, and asserts the two runs differ. A check
// that only looked at the reduced-motion run would pass on a game that ignored
// the setting entirely and happened to be calm.
//
// Scope, stated honestly. Two of the four call sites are observable from game
// state:
//
//   particles are capped        addParticle clamps count to 6
//   the star-power trail        skipped entirely
//
// The other two are rendering-only and this test cannot see them:
//
//   screen shake                `shakeAmt = reducedMotion ? 0 : 1` scales the
//                               camera transform; `state.shake` is unchanged
//   the idle bob                offsets the drawn sprite, not the entity
//
// Those remain unverified and are called out rather than quietly implied.

import { isMain, openGame, runStandalone, forceLevel, sleep } from "./harness.mjs";

/** Turn on star power and count the trail particles it produces. */
async function trailParticles(page) {
  await forceLevel(page, 1);
  await page.evaluate(() => {
    const E = window.__ethan;
    E.state.particles.length = 0;
    E.state.player.invincible = 5;
    // Refreshed on a timer because a single hit would end the run, and the
    // point here is the trail, not survival.
    window.__star = setInterval(() => { E.state.player.invincible = 5; }, 100);
  });
  await sleep(1200);
  const out = await page.evaluate(() => {
    clearInterval(window.__star);
    return {
      particles: window.__ethan.state.particles.length,
      matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });
  return out;
}

export async function run({ browser, url, results }) {
  const errors = [];

  const on = await openGame(browser, url, { reducedMotion: "reduce" });
  errors.push(...on.errors.map((e) => `[reduced] ${e}`));
  const reduce = await trailParticles(on.page);
  results.check(
    "the page really reports prefers-reduced-motion: reduce",
    reduce.matches === true,
    `matchMedia=${reduce.matches}`
  );
  results.check(
    "with reduced motion the star trail spawns no particles",
    reduce.particles === 0,
    `${reduce.particles} particles`
  );
  await on.page.close();

  const off = await openGame(browser, url);
  errors.push(...off.errors.map((e) => `[default] ${e}`));
  const normal = await trailParticles(off.page);
  results.check(
    "without reduced motion the same scenario does spawn particles",
    normal.particles > 0,
    `${normal.particles} particles`
  );
  await off.page.close();

  // The differential is the assertion. If both runs were zero, the setting
  // would be untested; if both were non-zero, it would be ignored.
  results.check(
    "the setting changes behaviour rather than merely existing",
    normal.particles > reduce.particles,
    `reduced ${reduce.particles} vs default ${normal.particles}`
  );

  results.check("no console errors in either mode", errors.length === 0, errors.slice(0, 3).join(" | "));
  return results.report();
}

if (isMain(import.meta.url)) {
  await runStandalone(run, { label: "reduced motion" });
}
