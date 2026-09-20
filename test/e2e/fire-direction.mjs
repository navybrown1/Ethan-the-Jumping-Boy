// Fire direction and throw-pose regression.
//
// The projectile used to travel correctly while Ethan's throw row rendered
// with the opposite facing. This test checks both contracts from the live
// game: the fireball's velocity/spawn side and the sprite descriptor used by
// the renderer during the throw window.

import {
  forceLevel,
  isMain,
  launchBrowser,
  openGame,
  parkBossOutside,
  readArena,
  runStandalone,
  sleep,
} from "./harness.mjs";

export async function run({ browser, url, results }) {
  const { page } = await openGame(browser, url);
  const arena = await readArena(page);
  await forceLevel(page, 1, { clearPowerups: false, parkAt: 240 });
  const parked = await parkBossOutside(page, arena);
  if (parked) {
    results.check(
      "the boss is out of the way for projectile direction checks",
      parked.x > arena.x1,
      `boss x=${Math.round(parked.x)} arena end=${arena.x1}`
    );
  } else {
    // Guardians are intentionally inactive until their level encounter is
    // reached. That is a valid state for this isolated projectile test, and it
    // also means there is no body that can consume the sampled fireball.
    results.note("the level guardian is inactive, so projectile samples cannot collide");
  }

  await page.evaluate(() => {
    const E = window.__ethan;
    const pl = E.state.player;
    pl.firePower = true;
    pl.fireballTimer = 0;
    pl.throwTimer = 0;
    pl.vx = 0;
    pl.vy = 0;
    pl.x = E.arena.x0 + 260;
    pl.y = E.arena.floor - pl.h;
    pl.grounded = true;
    pl.wasGrounded = true;
    E.state.fireballs = [];
  });

  async function fireWhileMoving(key) {
    await page.keyboard.down(key);
    await sleep(120);
    await page.keyboard.down("f");
    // Keep the fire key down long enough for a frame to consume it, then read
    // during the 0.2s throw pose before the animation can fall back to run.
    await sleep(55);
    await page.keyboard.up("f");
    const sample = await page.evaluate(() => {
      const E = window.__ethan;
      const pl = E.state.player;
      const fb = E.state.fireballs.find((f) => f.alive);
      return {
        player: { x: pl.x, w: pl.w, facing: pl.facing, state: pl.state },
        sprite: E.playerSprite,
        fireball: fb
          ? { x: fb.x, w: fb.w, vx: fb.vx, facing: fb.facing, alive: fb.alive }
          : null,
      };
    });
    await page.keyboard.up(key);
    await sleep(60);
    return sample;
  }

  const right = await fireWhileMoving("ArrowRight");
  results.check(
    "right fire uses positive velocity and the right spawn side",
    right.player.facing === 1 && right.fireball?.vx > 0 &&
      right.fireball.x > right.player.x + right.player.w - 8,
    JSON.stringify(right)
  );
  results.check(
    "right throw uses the right-facing atlas pose without mirroring",
    right.player.state === "throw" && right.sprite.row === 1 && right.sprite.flip === false,
    JSON.stringify({ state: right.player.state, sprite: right.sprite })
  );
  results.check(
    "right fireball facing matches the player",
    right.fireball?.facing === right.player.facing,
    JSON.stringify({ player: right.player.facing, fireball: right.fireball?.facing })
  );

  await page.evaluate(() => {
    const E = window.__ethan;
    const pl = E.state.player;
    pl.fireballTimer = 0;
    pl.throwTimer = 0;
    pl.vx = 0;
    pl.vy = 0;
    pl.x = E.arena.x0 + 600;
    pl.y = E.arena.floor - pl.h;
    pl.facing = 1;
    pl.grounded = true;
    pl.wasGrounded = true;
    E.state.fireballs = [];
  });

  const left = await fireWhileMoving("ArrowLeft");
  results.check(
    "left fire uses negative velocity and the left spawn side",
    left.player.facing === -1 && left.fireball?.vx < 0 &&
      left.fireball.x + left.fireball.w < left.player.x + 8,
    JSON.stringify(left)
  );
  results.check(
    "left throw mirrors the right-authored atlas pose",
    left.player.state === "throw" && left.sprite.row === 1 && left.sprite.flip === true,
    JSON.stringify({ state: left.player.state, sprite: left.sprite })
  );
  results.check(
    "left fireball facing matches the player",
    left.fireball?.facing === left.player.facing,
    JSON.stringify({ player: left.player.facing, fireball: left.fireball?.facing })
  );
}

if (isMain(import.meta.url)) {
  await runStandalone(run, { label: "fire-direction" });
}
