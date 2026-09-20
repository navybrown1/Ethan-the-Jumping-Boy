// Focused contact/render tests; full no-power fights live in boss-nopowers.mjs.
import { isMain, openGame, runStandalone, forceLevel, sleep } from './harness.mjs';

async function placeStomp(page, { invuln = 0, hp = 34 } = {}) {
  await forceLevel(page, 4);
  await page.evaluate(({ invuln, hp }) => {
    const E = window.__ethan, b = E.state.boss, p = E.state.player;
    b.active = true; b.state = 'stagger'; b.stagger = 5;
    b.h = b.hBase * .7; b.y = b.groundY - b.h; b.hp = hp;
    p.x = b.x + b.w / 2 - p.w / 2;
    p.y = b.y - p.h - 2; p.vy = 180; p.vx = 0;
    p.invuln = invuln; p.firePower = false; p.invincible = 0; p.superTimer = 0;
    E.state.cameraX = b.x - 400;
  }, { invuln, hp });
}

export async function run({ browser, url, results }) {
  const { page, errors } = await openGame(browser, url);
  try {
    await forceLevel(page, 4);
    await page.evaluate(() => {
      const E = window.__ethan, b = E.state.boss, p = E.state.player;
      b.active = true; b.state = 'stagger'; b.stagger = b.staggerTime;
      p.x = b.x - 120; p.y = b.groundY - p.h; p.vx = 0; p.vy = 0;
    });
    await sleep(350); // Allow a reaction beat before approaching from the floor.
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down(' ');
    // Wait for contact rather than assuming a frame rate puts it at exactly 600ms.
    await page.waitForFunction(() => window.__ethan.state.boss.hp < window.__ethan.state.boss.maxHp,
      undefined, { timeout: 1200 }).catch(() => {});
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up(' ');
    const groundJump = await page.evaluate(() => {
      const E = window.__ethan;
      const b = E.state.boss, p = E.state.player;
      return { hp: b.hp, maxHp: b.maxHp, x: p.x, y: p.y, vy: p.vy,
        noPowers: !p.firePower && p.invincible <= 0 && p.superTimer <= 0 };
    });
    results.check('ordinary ground jump reaches the final weak point without powers',
      groundJump.hp < groundJump.maxHp && groundJump.noPowers, JSON.stringify(groundJump));
    await placeStomp(page, { invuln: 1 });
    const before = await page.evaluate(() => window.__ethan.state.boss.hp);
    await sleep(180);
    results.check('recovery protection does not disable a valid unpowered stomp', await page.evaluate(() => window.__ethan.state.boss.hp) < before);
    await placeStomp(page, { hp: 1 });
    await page.evaluate(() => {
      window.__bossDraws = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        if (args[0]?.src?.includes('storm_atlas')) window.__bossDraws.push({ alpha: this.globalAlpha, at: performance.now() });
        return original.apply(this, args);
      };
    });
    await sleep(1300);
    results.check('defeat visibly dissolves the boss', await page.evaluate(() => window.__bossDraws.slice(-8).some(d => d.alpha < .5)));
    await page.waitForFunction(() => window.__ethan.scene === 'win', undefined, { timeout: 6000 });
    const count = await page.evaluate(() => window.__bossDraws.length);
    await sleep(200);
    results.check('defeated boss is removed from rendering', await page.evaluate(() => window.__bossDraws.length) === count);
    results.check('victory saves level-four progress', await page.evaluate(() => window.__ethan.prog.stars[3] >= 1));
    results.check('final boss flow has no browser errors', errors.length === 0, errors.join(' | '));
  } finally { await page.close(); }
  return results.report();
}
if (isMain(import.meta.url)) await runStandalone(run, { label: 'final boss' });
