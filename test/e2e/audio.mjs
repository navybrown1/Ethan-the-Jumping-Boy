// Audio QA.
//
// Nothing in this suite previously measured sound, so every claim about it was
// an assumption. This file instruments the Web Audio API from before the page
// boots and asserts on what the game actually builds.
//
// The instrument wraps AudioContext.prototype rather than the game's own
// functions, for one reason: the game holds its context in a closure variable
// with no accessor, so the only honest way to observe what it does is to watch
// the platform calls it makes. That also means these numbers cannot drift from
// the implementation, because they are the implementation's own calls.
//
// The most important check here is the suspended-context recovery in phase H.
// Every sound path in game.ts returns early while the context reads
// "suspended", and `initAudio` used to construct a context without ever
// resuming one. A context that came up suspended therefore stayed suspended
// forever and the game was silently mute with no way back. Phase H suspends a
// live context and asserts the game recovers.

import { openGame, runStandalone, isMain, sleep } from "./harness.mjs";

/**
 * Installs window.__audioProbe before any page script runs.
 *
 * Counts contexts, oscillators, gains, resume calls and animation frames.
 * Oscillator and gain are counted separately on purpose: `tone` and `musicTone`
 * each pair exactly one oscillator with exactly one gain, so a divergence
 * between the two counts means some code path built a node it never used.
 */
const instrument = () => {
  const rec = {
    contexts: 0,
    osc: 0,
    gain: 0,
    resumeCalls: 0,
    frames: 0,
    stateAtCreate: null,
    ctx: null,
  };
  window.__audioProbe = rec;

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const proto = AC.prototype;

  const origOsc = proto.createOscillator;
  const origGain = proto.createGain;
  const origResume = proto.resume;

  proto.createOscillator = function (...args) {
    rec.osc++;
    return origOsc.apply(this, args);
  };
  proto.createGain = function (...args) {
    rec.gain++;
    return origGain.apply(this, args);
  };
  proto.resume = function (...args) {
    rec.resumeCalls++;
    return origResume.apply(this, args);
  };

  // Count animation frames so "music is not retriggered every frame" can be
  // stated as a ratio instead of an opinion.
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) {
    return origRAF.call(window, function (t) {
      rec.frames++;
      return cb(t);
    });
  };

  window.AudioContext = class InstrumentedAudioContext extends AC {
    constructor(...args) {
      super(...args);
      rec.contexts++;
      rec.stateAtCreate = this.state;
      rec.ctx = this;
    }
  };
};

const readProbe = (page) =>
  page.evaluate(() => {
    const p = window.__audioProbe;
    return {
      contexts: p.contexts,
      osc: p.osc,
      gain: p.gain,
      resumeCalls: p.resumeCalls,
      frames: p.frames,
      stateAtCreate: p.stateAtCreate,
    };
  });

const readAudio = (page) => page.evaluate(() => window.__ethan.audio);
const readPaused = (page) => page.evaluate(() => window.__ethan.state.paused);
const setPaused = (page, v) =>
  page.evaluate((x) => {
    window.__ethan.state.paused = x;
  }, v);

/** Oscillators created over a window of `ms`, plus frames, for rate maths. */
async function sample(page, ms) {
  const before = await readProbe(page);
  await sleep(ms);
  const after = await readProbe(page);
  return {
    osc: after.osc - before.osc,
    gain: after.gain - before.gain,
    frames: after.frames - before.frames,
    ms,
  };
}

export async function run({ browser, url, results: r }) {
  const { page, errors } = await openGame(browser, url, { initScript: instrument });

  // ---------------------------------------------------------------- phase A
  // No gesture yet. The browser is launched with autoplay allowed, so if sound
  // appeared here it would be the game failing to gate on a user gesture, not
  // the browser blocking it.
  r.note("phase A: before any user gesture");
  await sleep(1200);
  const a = await readProbe(page);
  const aAudio = await readAudio(page);
  r.check("no AudioContext is built before a gesture", a.contexts === 0, `contexts=${a.contexts}`);
  r.check("no sound before a gesture", a.osc === 0, `oscillators=${a.osc}`);
  r.check("the enable-sound hint is showing", aAudio.gated === true, `gated=${aAudio.gated}`);

  // ---------------------------------------------------------------- phase B
  r.note("phase B: first gesture starts audio");
  await page.keyboard.press("Enter");
  await sleep(900);
  const b = await readProbe(page);
  const bAudio = await readAudio(page);
  r.check("exactly one AudioContext is built", b.contexts === 1, `contexts=${b.contexts}`);
  r.check("the context reached running", bAudio.state === "running", `state=${bAudio.state}`);
  r.check("the enable-sound hint is cleared", bAudio.gated === false, `gated=${bAudio.gated}`);
  r.check("sound is audible after the gesture", b.osc > 0, `oscillators=${b.osc}`);

  // ---------------------------------------------------------------- phase C
  r.note("phase C: music is scheduled, not retriggered per frame");
  const c = await sample(page, 2000);
  const oscPerSec = (c.osc / c.ms) * 1000;
  const fps = (c.frames / c.ms) * 1000;
  r.note(`${oscPerSec.toFixed(1)} oscillators/s against ${fps.toFixed(1)} frames/s`);
  r.check("music is playing", oscPerSec > 2, `${oscPerSec.toFixed(1)}/s`);
  r.check(
    "music is not retriggered every frame",
    oscPerSec < 40,
    `${oscPerSec.toFixed(1)}/s vs ${fps.toFixed(0)} frames/s`
  );
  const cProbe = await readProbe(page);
  r.check(
    "every oscillator is paired with exactly one gain",
    cProbe.osc === cProbe.gain,
    `osc=${cProbe.osc} gain=${cProbe.gain}`
  );

  // ---------------------------------------------------------------- phase D
  r.note("phase D: mute silences the game");
  await page.keyboard.press("m");
  await sleep(120);
  const dAudio = await readAudio(page);
  r.check("M toggles mute on", dAudio.muted === true, `muted=${dAudio.muted}`);
  const d = await sample(page, 1200);
  r.check("muted produces no sound at all", d.osc === 0, `oscillators=${d.osc}`);
  await page.keyboard.press("m");
  await sleep(120);
  const d2Audio = await readAudio(page);
  const d2 = await sample(page, 900);
  r.check("unmute restores sound", d2Audio.muted === false && d2.osc > 0, `muted=${d2Audio.muted} oscillators=${d2.osc}`);

  // ---------------------------------------------------------------- phase E
  r.note("phase E: pausing stops music");
  await setPaused(page, true);
  await sleep(400);
  const e = await sample(page, 900);
  r.check("a paused game schedules no notes", e.osc === 0, `oscillators=${e.osc}`);
  await setPaused(page, false);
  const e2 = await sample(page, 900);
  r.check("unpausing resumes music", e2.osc > 0, `oscillators=${e2.osc}`);

  // ---------------------------------------------------------------- phase F
  // Music is paused for this phase so any oscillator created can only have come
  // from the sound effect under test.
  r.note("phase F: every sound effect actually makes a sound");
  const names = await page.evaluate(() => window.__ethan.sfxNames);
  r.check("the sfx table is populated", names.length >= 12, `entries=${names.length}`);
  await setPaused(page, true);
  await sleep(400);
  const dead = [];
  for (const name of names) {
    const before = await readProbe(page);
    await page.evaluate((n) => window.__ethan.playSfx(n), name);
    await sleep(90);
    const after = await readProbe(page);
    if (after.osc <= before.osc) dead.push(name);
  }
  r.check(
    `all ${names.length} sound effects produce sound`,
    dead.length === 0,
    dead.length ? `silent: ${dead.join(", ")}` : names.join(", ")
  );
  await setPaused(page, false);
  await sleep(200);

  // ---------------------------------------------------------------- phase G
  r.note("phase G: losing focus pauses the game");
  await page.evaluate(() => {
    window.__ethan.state.paused = false;
    window.dispatchEvent(new Event("blur"));
  });
  await sleep(80);
  const g1 = await readPaused(page);
  r.check("blur pauses play", g1 === true, `paused=${g1}`);
  await page.evaluate(() => {
    window.__ethan.state.paused = false;
    // document.hidden is a getter on the prototype; shadowing it on the
    // instance is enough to drive the game's real visibilitychange handler.
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(80);
  const g2 = await readPaused(page);
  r.check("a hidden tab pauses play", g2 === true, `paused=${g2}`);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  // ---------------------------------------------------------------- phase H
  // The regression test for the dead-audio path.
  r.note("phase H: a suspended context must be recoverable");
  await page.evaluate(() => {
    window.__ethan.state.paused = false;
  });
  const suspended = await page.evaluate(async () => {
    await window.__audioProbe.ctx.suspend();
    return window.__audioProbe.ctx.state;
  });
  r.check("the context can be suspended", suspended === "suspended", `state=${suspended}`);
  const h1 = await sample(page, 700);
  r.check("a suspended context is silent", h1.osc === 0, `oscillators=${h1.osc}`);
  await page.keyboard.press("ArrowRight");
  await sleep(500);
  const hAudio = await readAudio(page);
  r.check("a gesture resumes the suspended context", hAudio.state === "running", `state=${hAudio.state}`);
  const h2 = await sample(page, 900);
  r.check("sound returns after recovery", h2.osc > 0, `oscillators=${h2.osc}`);

  const finalProbe = await readProbe(page);
  r.check("no AudioContext was leaked", finalProbe.contexts === 1, `contexts=${finalProbe.contexts}`);

  // ---------------------------------------------------------------- phase I
  // Last, because it reloads the page.
  r.note("phase I: mute survives a reload");
  await page.keyboard.press("m");
  await sleep(150);
  const beforeReload = await readAudio(page);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !!window.__ethan, null, { timeout: 20000, polling: 100 });
  await sleep(300);
  const afterReload = await readAudio(page);
  r.check(
    "the mute setting is remembered across a reload",
    beforeReload.muted === true && afterReload.muted === true,
    `before=${beforeReload.muted} after=${afterReload.muted}`
  );
  // Leave the profile unmuted so a later phase or a human run is not silent.
  await page.keyboard.press("m");
  await sleep(120);
  const restored = await readAudio(page);
  r.check("unmuting persists too", restored.muted === false, `muted=${restored.muted}`);

  r.check("no console errors during the audio run", errors.length === 0, errors.slice(0, 3).join(" | "));

  return r.report();
}

if (isMain(import.meta.url)) {
  runStandalone(run, { label: "audio" });
}
