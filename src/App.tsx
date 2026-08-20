/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { initGame } from "./game";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const btnLeftRef = useRef<HTMLButtonElement>(null);
  const btnRightRef = useRef<HTMLButtonElement>(null);
  const btnCrouchRef = useRef<HTMLButtonElement>(null);
  const btnJumpRef = useRef<HTMLButtonElement>(null);
  const btnFireRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const cleanup = initGame(
        canvasRef.current,
        btnLeftRef.current,
        btnRightRef.current,
        btnCrouchRef.current,
        btnJumpRef.current,
        btnFireRef.current
      );
      return cleanup;
    }
  }, []);

  return (
    <main className="shell" aria-label="Ethan the Jumper game">
      <section className="hero">
        <div>
          <p className="eyebrow">Original browser platformer</p>
          <h1>Ethan the Jumping Boy</h1>
        </div>
        <p className="hint">Move with A/D, crouch with S, jump with Space/W. Grab a Fire Flower, then shoot with F/J or FIRE. R restarts your current checkpoint.</p>
      </section>

      <div className="game-wrap">
        <canvas ref={canvasRef} id="game" width="960" height="540" role="img" aria-label="Playable 2D platformer game canvas"></canvas>
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
