// Recovery and input regressions. This is not a full human playtest.
import { isMain, openGame, runStandalone, forceLevel, sleep } from './harness.mjs';

export async function run({ browser, url, results }) {
  const { page, errors } = await openGame(browser, url);
  try {
    await forceLevel(page, 1);
    await page.keyboard.down('d');
    await sleep(100);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    results.check('focus loss pauses gameplay', await page.evaluate(() => window.__ethan.state.paused));
    await page.keyboard.press('p');
    await sleep(700);
    results.check('focus loss clears held movement', await page.evaluate(() => Math.abs(window.__ethan.state.player.vx) < 1));
    await page.keyboard.up('d');
    await page.keyboard.press('p');
    await page.locator('canvas').click();
    results.check('tap resumes a paused game', await page.evaluate(() => !window.__ethan.state.paused));
    await forceLevel(page, 1);
    await sleep(100);
    await page.evaluate(() => {
      const s = window.__ethan.state;
      s.player.y = 900;
      s.player.invuln = 0;
      s.player.invincible = 0;
      s.player.superTimer = 0;
      s.lives = 3;
    });
    await sleep(150);
    const recovered = await page.evaluate(() => {
      const s = window.__ethan.state, p = s.player;
      return { lives: s.lives, safe: s.platforms.some(q => q.type !== 3 && !q.move && !q.crumble && p.x >= q.x && p.x + p.w <= q.x + q.w && Math.abs(p.y + p.h - q.y) < 3) };
    });
    results.check('a fall costs one heart and returns to solid ground', recovered.lives === 2 && recovered.safe, JSON.stringify(recovered));
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await sleep(80);
    results.check('visible pause control pauses play', await page.evaluate(() => window.__ethan.state.paused));
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    results.check('visible resume control resumes play', await page.evaluate(() => !window.__ethan.state.paused));
    const mutedBefore = await page.evaluate(() => window.__ethan.audio.muted);
    await page.getByRole('button', { name: /^Sound / }).click();
    results.check('visible sound control changes mute state', await page.evaluate(() => window.__ethan.audio.muted) !== mutedBefore);
    await page.keyboard.down('d');
    await sleep(100);
    results.check('toolbar focus does not trap movement keys', await page.evaluate(() => window.__ethan.state.player.vx > 30));
    await page.keyboard.up('d');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(100);
    await page.evaluate(() => {
      const s = window.__ethan.state;
      s.particles = [];
      s.player.invincible = 3;
    });
    await sleep(250);
    results.check('motion preference changes stop the star trail without reloading', await page.evaluate(() => window.__ethan.state.particles.length === 0));
    results.check('fairness flow has no browser errors', errors.length === 0, errors.join(' | '));
  } finally { await page.close(); }
  return results.report();
}
if (isMain(import.meta.url)) await runStandalone(run, { label: 'fairness' });
