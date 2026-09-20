// Touch input tests.
//
// A phone is the device most likely to play this, and it is the one the desktop
// test suite cannot reach. These run at a real phone viewport with a coarse
// pointer so `pointer: coarse` media queries and the touch paths are live.
//
// The assertion that matters is tap-to-select: before this existed, the keyboard
// was the only thing that moved `state.selectLevel`, so a touch player could only
// ever start whichever level happened to be selected.

import { Results, ensureOut, forceLevel, isMain, openGame, readArena, runStandalone, sleep } from "./harness.mjs";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };

export async function run({ browser, url, results, outDir }) {
  const { page, errors } = await openGame(browser, url, PHONE);

  // ── the on-screen controls must actually be reachable ───────────────────
  const controls = await page.evaluate(() => {
    const el = document.querySelector(".mobile-controls");
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      display: cs.display,
      buttons: [...el.querySelectorAll("button")].map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      }),
      vh: window.innerHeight,
    };
  });
  results.check("touch controls are visible on a coarse pointer", controls.display !== "none", `display: ${controls.display}`);
  results.check("every control button is at least 44px tall",
    controls.buttons.every((b) => b.h >= 44),
    controls.buttons.map((b) => `${b.label}:${b.h}`).join(" "));
  results.check("every control button is fully on screen",
    controls.buttons.every((b) => b.top >= 0 && b.bottom <= controls.vh),
    controls.buttons.map((b) => `${b.label}:${b.top}..${b.bottom}`).join(" "));

  // ── the canvas and the controls must not be separated by a dead band ────
  // This was the actual complaint: `space-between` split a 390x844 phone into a
  // 204px canvas at the top, a 126px control block at the bottom, and 490px of
  // nothing in between. Both .game-wrap and canvas are touch-action: none, so
  // page overflow here is also unreachable rather than merely untidy.
  const layout = await page.evaluate(() => {
    const c = document.querySelector("#game").getBoundingClientRect();
    const m = document.querySelector(".mobile-controls").getBoundingClientRect();
    return {
      canvasBottom: Math.round(c.bottom),
      controlsTop: Math.round(m.top),
      controlsBottom: Math.round(m.bottom),
      canvasTop: Math.round(c.top),
      canvasLeft: Math.round(c.left),
      canvasRight: Math.round(c.right),
      vw: window.innerWidth,
      vh: window.innerHeight,
      docH: document.documentElement.scrollHeight,
    };
  });
  const gap = layout.controlsTop - layout.canvasBottom;
  results.check("the controls sit right below the canvas",
    gap >= 0 && gap <= 40,
    `${gap}px gap (was 490px before the fix)`);
  results.check("the controls stay in the bottom band",
    layout.vh - layout.controlsBottom <= 30,
    `${layout.vh - layout.controlsBottom}px below the controls`);
  results.check("the canvas is fully on screen",
    layout.canvasTop >= 0 && layout.canvasLeft >= 0 && layout.canvasRight <= layout.vw,
    `x ${layout.canvasLeft}..${layout.canvasRight} of ${layout.vw}, top ${layout.canvasTop}`);
  results.check("the page does not overflow the viewport",
    layout.docH <= layout.vh,
    `document ${layout.docH} vs viewport ${layout.vh}`);

  // ── the on-canvas legend must not print keyboard keys on a touch device ──
  const inputKind = await page.evaluate(() => ({
    coarse: window.__ethan.coarsePointer,
    uiScale: +window.__ethan.uiScale.toFixed(2),
  }));
  results.check("the game detects a coarse pointer", inputKind.coarse === true, `uiScale ${inputKind.uiScale}`);

  // ── tap-to-select a level ───────────────────────────────────────────────
  const geom = await page.evaluate(() => {
    const c = document.querySelector("#game").getBoundingClientRect();
    return {
      rect: { left: c.left, top: c.top, width: c.width, height: c.height },
      viewW: window.__ethan.viewW,
      viewH: window.__ethan.viewH,
      cards: window.__ethan.levelCards,
    };
  });

  // Map a logical canvas point to a CSS viewport point. Straight scale: the
  // canvas is a fixed 960x540 world fitted to its CSS box.
  const toScreen = (lx, ly) => ({
    x: geom.rect.left + (lx / geom.viewW) * geom.rect.width,
    y: geom.rect.top + (ly / geom.viewH) * geom.rect.height,
  });
  const centreOf = (card) => toScreen(card.x + card.w / 2, card.y + card.h / 2);

  results.check("the game exposes four level cards", geom.cards.length === 4, `${geom.cards.length} cards`);

  // Locked card first: with only level 1 unlocked, tapping card 3 must do
  // nothing. Starting level 1 silently would be worse than no response.
  await page.evaluate(() => { window.__ethan.prog.unlocked = 1; });
  await sleep(200);
  const locked = centreOf(geom.cards[2]);
  await page.mouse.click(locked.x, locked.y);
  await sleep(600);
  const afterLocked = await page.evaluate(() => ({ scene: window.__ethan.scene, sel: window.__ethan.state.selectLevel }));
  results.check("tapping a locked card does not start the game",
    afterLocked.scene === "title" && afterLocked.sel === 1,
    `scene ${afterLocked.scene}, selectLevel ${afterLocked.sel}`);

  // Now unlock everything and tap card 3. It should start level 3 directly.
  await page.evaluate(() => { window.__ethan.prog.unlocked = 4; });
  await sleep(200);
  const card3 = centreOf(geom.cards[2]);
  await page.mouse.click(card3.x, card3.y);
  await sleep(1200);
  const started = await page.evaluate(() => ({
    scene: window.__ethan.scene,
    level: window.__ethan.state.currentLevel,
  }));
  results.check("tapping an unlocked card starts that level",
    started.scene === "playing" && started.level === 3,
    `scene ${started.scene}, level ${started.level}`);

  // ── the game must be playable with the on-screen buttons ────────────────
  // Move to the arena first. This is an input-layer test, so it must not be
  // measuring the level geometry: the first version of this ran where the player
  // happened to be standing on level 3, which was directly under the platform at
  // x 240..420. The gap under it is 80px and the player is 70px tall, so a jump
  // there dies after 10px and the button looked broken when it was not. The
  // arena is the one place in the game verified to have nothing overhanging it.
  const arena = await readArena(page);
  await forceLevel(page, 1);
  await page.evaluate((a) => {
    const pl = window.__ethan.state.player;
    pl.x = a.x0 + 130;
    pl.y = a.floor - pl.h;
    pl.vx = 0;
    pl.vy = 0;
    const b = window.__ethan.boss;
    if (b) { b.minX = a.x1 + 400; b.maxX = a.x1 + 600; b.x = a.x1 + 400; b.speed = 0; b.vx = 0; b.t = 1e9; b.state = "idle"; }
    window.__ethan.state.enemies.forEach((e) => { e.alive = false; });
  }, arena);
  await sleep(500);

  const before = await page.evaluate(() => {
    const p = window.__ethan.state.player;
    return { x: Math.round(p.x), y: Math.round(p.y) };
  });
  const right = page.locator("#btn-right");
  const box = await right.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(900);
  await page.mouse.up();
  await sleep(150);
  const after = await page.evaluate(() => {
    const p = window.__ethan.state.player;
    return { x: Math.round(p.x), vx: Math.round(p.vx) };
  });
  results.check("holding the on-screen right button moves the player",
    after.x > before.x + 100,
    `x ${before.x} -> ${after.x}`);

  // Let the player come to rest so the jump starts from a known floor position.
  await sleep(500);
  const jump = page.locator("#btn-jump");
  const jbox = await jump.boundingBox();
  const groundY = await page.evaluate(() => Math.round(window.__ethan.state.player.y));
  await page.mouse.move(jbox.x + jbox.width / 2, jbox.y + jbox.height / 2);
  await page.mouse.down();
  await sleep(150);
  const airborne = await page.evaluate(() => {
    const p = window.__ethan.state.player;
    return { y: Math.round(p.y), grounded: p.grounded };
  });
  await page.mouse.up();
  results.check("tapping the on-screen jump button leaves the ground",
    airborne.y < groundY - 20 && !airborne.grounded,
    `y ${groundY} -> ${airborne.y}, grounded ${airborne.grounded}`);

  results.check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await page.screenshot({ path: `${outDir}/touch-input-phone.png` });
  await page.close();
  return results.report();
}

if (isMain(import.meta.url)) {
  ensureOut();
  await runStandalone(run, { label: "touch input" });
}
