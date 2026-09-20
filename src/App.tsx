/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { initGame } from "./game";

export default function App() {
  const shellRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const btnLeftRef = useRef<HTMLButtonElement>(null);
  const btnRightRef = useRef<HTMLButtonElement>(null);
  const btnCrouchRef = useRef<HTMLButtonElement>(null);
  const btnJumpRef = useRef<HTMLButtonElement>(null);
  const btnFireRef = useRef<HTMLButtonElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const soundRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement === shellRef.current) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
      canvasRef.current?.focus({ preventScroll: true });
    } catch {
      setFullscreenError("Full screen could not open. You can keep playing here.");
    }
  }

  useEffect(() => {
    if (canvasRef.current) {
      const cleanup = initGame(
        canvasRef.current,
        btnLeftRef.current,
        btnRightRef.current,
        btnCrouchRef.current,
        btnJumpRef.current,
        btnFireRef.current,
        { pause: pauseRef.current, sound: soundRef.current }
      );
      return cleanup;
    }
  }, []);

  return (
    <main ref={shellRef} className="shell" aria-label="Ethan the Jumping Boy game">
      <section className="hero">
        <div>
          <p className="eyebrow">A little hero. A great big adventure.</p>
          <h1>Ethan <span>the Jumping Boy</span></h1>
        </div>
        {/* Two legends, one per input type. The keyboard text is useless on a
            phone and the touch text is useless on a desktop, so CSS picks. */}
        <p className="hint hint-keyboard">Move with A/D, crouch with S, jump with Space/W. Grab a Fire Flower, then shoot with F/J or FIRE. R restarts your current checkpoint. P pauses, M toggles sound.</p>
        <p className="hint hint-touch">Use the buttons below: ◀ ▶ to move, ▼ to crouch, Jump to jump. Grab a Fire Flower to unlock Fire. Tap the game once to start sound.</p>
      </section>

      <div className="game-toolbar" aria-label="Game controls">
        <span className="journey-label">THE FOUR-WORLD JOURNEY</span>
        <div>
          <button ref={pauseRef} type="button" disabled>Pause</button>
          <button ref={soundRef} type="button" aria-pressed="false">Sound on</button>
          <button type="button" onClick={toggleFullscreen} disabled={!fullscreenSupported}
            aria-pressed={fullscreen} title={fullscreenSupported ? "Expand the game to your screen" : "Full screen is unavailable in this browser"}>
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>
      {fullscreenError && <p className="fullscreen-error" role="status">{fullscreenError}</p>}

      <div className="game-wrap">
        <canvas ref={canvasRef} id="game" width="960" height="540" tabIndex={0} role="img" aria-label="Ethan adventure. Arrow keys move, Space jumps, P pauses. Tap a world to start.">Your browser needs canvas support to play Ethan the Jumping Boy.</canvas>
      </div>

      <div className="mobile-controls" aria-hidden="false">
        <button ref={btnLeftRef} id="btn-left" aria-label="Move left">◀</button>
        <button ref={btnRightRef} id="btn-right" aria-label="Move right">▶</button>
        <button ref={btnCrouchRef} id="btn-crouch" className="crouch" aria-label="Crouch">▼</button>
        <button ref={btnJumpRef} id="btn-jump" className="jump" aria-label="Jump">Jump</button>
        <button ref={btnFireRef} id="btn-fire" className="fire" aria-label="Fire power">Fire</button>
      </div>
    </main>
  );
}
