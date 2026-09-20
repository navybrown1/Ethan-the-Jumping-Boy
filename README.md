# Ethan the Jumping Boy

A browser platformer built around Ethan, four themed worlds, collectible stars, power-ups, hazards, bosses, and persistent level progression.

## What is in the game

- Four worlds: Rainbow Grove, Sunset Cliffs, Crystal Caves, and Storm Summit
- Level checkpoints: clearing a world banks the score and makes the next world the restart point
- Every fresh level starts with full hearts
- Three world guardian bosses plus the final Tempest Sovereign boss
- Mushroom: Super Ethan shield, movement boost, jump boost, and a heart
- Star Power: temporary invincibility and turbo speed
- Fire Flower: unlocks rapid piercing fireballs
- Every 10 collectible stars triggers Star Rush, restores a heart, and awards a score bonus
- Keyboard and touch controls, including a mobile Fire button
- Local progress saving for unlocked levels, ratings, and best score

## Controls

- Move: A / D or arrow keys
- Jump: W / Up / Space
- Crouch: S / Down
- Fire after collecting a Fire Flower: F / J
- Restart current checkpoint: R
- Pause: P, Esc, or the Pause button. Tap the paused canvas or Resume to continue.
- Mute: M or the Sound button (setting is remembered)
- Focus loss pauses play and clears held controls to prevent unintended movement.
- Falls return Ethan to his last stable foothold with two seconds of recovery protection.
- Reduced motion follows your system preference, including changes during play.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
npm run test:e2e
npm run test:xbrowser:all
```

Install matching test browsers with `npx playwright-core install chrome firefox webkit`
(`--with-deps` on Linux). `npm run test:e2e -- --only=fairness` runs recovery/input regressions.
The Game quality workflow runs type checks, unit tests, production/subpath checks,
gameplay checks, and the three-engine matrix on pull requests and main.

Production: `npm run build` creates `dist/`. Keep Vite's relative `base: "./"`.
Vercel hosts the public game; the legacy Pages workflow is still present pending
owner approval to remove it. The new quality workflow does not deploy.

Coverage limits: automated traversal and boss tests do not replace a human
four-world playtest. Windows WebKit does not validate real Safari/iOS audio.
The flash test samples average luminance, so a pass is not a complete WCAG audit.

## Fairness and presentation update

- Adventure-style frame, illustrated world selection, readable HUD and platform rims.
- Final boss kneels to a visibly reachable height for a 4.2-second punish window.
  Dodge, then jump onto the marked top. Recovery protection no longer disables stomps.
- Defeated bosses dissolve and leave the renderer; victory waits for the sequence.
  Reduced motion uses a fade without the rising/shrinking effect.
- Low ceilings above six gap take-offs were raised, with their star trails moved.
- Recovery tests cover blur, touch resume, visible controls and live reduced motion.
- Final-boss tests cover an unpowered ground jump, protected stomps, dissolve,
  renderer removal and persisted victory. Run with `npm run test:e2e -- --only=final`.
- Set `BOSS_REACTION_MS=150` and `LEVELS=4` when running `npm run test:boss`
  to check the final fight with a slower bot. This remains automated coverage.

Use Full screen in the toolbar to expand the game and controls together. Exit with the toolbar button or your browser's Escape gesture. Browsers without the Fullscreen API show the control disabled. Run the fullscreen regression with npm run test:e2e -- --only=fullscreen.
