import { isMain, openGame, runStandalone, sleep } from './harness.mjs';

export async function run({ browser, url, results }) {
  const { page, errors } = await openGame(browser, url);
  try {
    const button = page.getByRole('button', { name: 'Full screen', exact: true });
    results.check('fullscreen control is visible', await button.count() === 1 && await button.isVisible());
    if (!await button.count()) return results.report();
    await button.click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    results.check('fullscreen includes canvas and touch controls', await page.evaluate(() => {
      const root = document.fullscreenElement;
      return !!root?.querySelector('canvas') && !!root?.querySelector('.mobile-controls');
    }));
    await sleep(100);
    results.check('fullscreen canvas fits the viewport', await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }));
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await button.waitFor({ state: 'visible' });
    results.check('exit restores the fullscreen control', await button.isVisible());
    results.check('fullscreen has no browser errors', errors.length === 0, errors.join(' | '));
  } finally { await page.close(); }
  return results.report();
}
if (isMain(import.meta.url)) await runStandalone(run, { label: 'fullscreen' });
