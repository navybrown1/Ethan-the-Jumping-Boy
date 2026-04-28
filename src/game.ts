import { assetList } from "./gameAssets";

export function initGame(
  canvas: HTMLCanvasElement,
  btnLeft: HTMLElement | null,
  btnRight: HTMLElement | null,
  btnJump: HTMLElement | null
) {
  const ctx = canvas.getContext("2d")!;
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;
  const WORLD_W = 5400;
  const WORLD_H = 760;
  const TILE = 64;

  const GRAVITY = 1780;
  const MAX_SPEED = 295;
  const ACCEL = 2500;
  const GROUND_DECEL = 2300;
  const AIR_DECEL = 520;
  const JUMP_V = -670;
  const JUMP_CUT = 0.48;
  const COYOTE_TIME = 0.12;
  const JUMP_BUFFER = 0.15;

  const images: Record<string, HTMLImageElement> = {};
  const keys = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    jumpReleased: false,
    crouch: false,
    fireball: false
  };

  const mobileState = { left: false, right: false, jump: false, crouch: false, fireball: false };
  let scene = "loading";
  let last = performance.now();
  let frameTime = 0;
  let audio: AudioContext | null = null;
  let mutedBecauseNoGesture = true;

  const state = {
    cameraX: 0,
    targetCameraX: 0,
    score: 0,
    stars: 0,
    time: 0,
    lives: 3,
    particles: [] as any[],
    notices: [] as any[],
    shake: 0,
    levelName: "Rainbow Grove",
    player: null as any,
    platforms: [] as any[],
    starsList: [] as any[],
    enemies: [] as any[],
    fireballs: [] as any[],
    portal: { x: 5140, y: 304, w: 76, h: 116, frame: 0 }
  };

  const playerSpawn = { x: 110, y: 255 };

  function loadImage(name: string, src: string): Promise<[string, HTMLImageElement]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve([name, img]);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function rectsOverlap(a: any, b: any) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function center(rect: any) {
    return { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
  }

  function initAudio() {
    if (audio) return;
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    audio = new AudioCtor();
    mutedBecauseNoGesture = false;
  }

  function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.035, slide = 1) {
    if (!audio || audio.state === "suspended") return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const sfx = {
    jump: () => { tone(320, 0.13, "triangle", 0.045, 1.6); },
    shoot: () => { tone(500, 0.1, "square", 0.04, 0.5); },
    star: () => { tone(760, 0.08, "sine", 0.035, 1.34); setTimeout(() => tone(980, 0.08, "sine", 0.025, 1.2), 45); },
    stomp: () => { tone(210, 0.11, "square", 0.035, 0.62); },
    hurt: () => { tone(180, 0.2, "sawtooth", 0.035, 0.45); },
    win: () => { tone(520, 0.14, "triangle", 0.04, 1.4); setTimeout(() => tone(700, 0.16, "triangle", 0.04, 1.38), 120); setTimeout(() => tone(980, 0.2, "triangle", 0.04, 1.2), 250); }
  };

  function makeLevel() {
    const p: any[] = [];
    const add = (x: number, y: number, w: number, h = 64, type = 0) => p.push({ x, y, w, h, type });

    add(0, 456, 860, 120, 0);
    add(960, 456, 520, 120, 0);
    add(1600, 456, 460, 120, 0);
    add(2220, 456, 680, 120, 0);
    add(3040, 456, 610, 120, 0);
    add(3790, 456, 490, 120, 0);
    add(4400, 456, 900, 120, 0);

    add(260, 300, 140, 96, 1);
    add(410, 342, 220, 36, 1);
    add(760, 300, 220, 36, 1);
    add(1160, 338, 220, 36, 2);
    add(1510, 286, 250, 36, 1);
    add(1900, 335, 240, 36, 2);
    add(2320, 320, 180, 36, 1);
    add(2600, 268, 220, 36, 1);
    add(2950, 350, 230, 36, 2);
    add(3290, 295, 240, 36, 1);
    add(3680, 335, 240, 36, 2);
    add(4060, 300, 200, 36, 1);
    add(4620, 335, 260, 36, 2);
    add(4940, 300, 180, 36, 1);

    const stars: any[] = [];
    const addStars = (x: number, y: number, count: number, gap = 54) => {
      for (let i = 0; i < count; i++) stars.push({ x: x + i * gap, y, w: 34, h: 34, collected: false, bob: Math.random() * Math.PI * 2 });
    };
    addStars(260, 415, 3);
    addStars(430, 285, 4);
    addStars(770, 244, 4);
    addStars(1170, 280, 4);
    addStars(1530, 230, 5);
    addStars(1960, 278, 3);
    addStars(2325, 263, 3);
    addStars(2630, 210, 4);
    addStars(2965, 292, 4);
    addStars(3310, 238, 5);
    addStars(3710, 278, 3);
    addStars(4070, 244, 4);
    addStars(4625, 278, 5);
    addStars(4955, 238, 3);

    const enemies = [
      enemy("slime", 610, 406, 500, 790, 78),
      enemy("mushroom", 1040, 406, 985, 1360, 64),
      enemy("roller", 1740, 406, 1630, 1990, 120),
      enemy("bug", 2110, 305, 1900, 2180, 70),
      enemy("slime", 2410, 406, 2240, 2840, 82),
      enemy("bug", 3130, 300, 2980, 3500, 82),
      enemy("mushroom", 3440, 406, 3070, 3610, 72),
      enemy("roller", 3970, 406, 3810, 4240, 130),
      enemy("slime", 4520, 406, 4410, 4890, 85),
      enemy("bug", 4880, 265, 4620, 5120, 90)
    ];

    state.platforms = p;
    state.starsList = stars;
    state.enemies = enemies;
  }

  function enemy(type: string, x: number, y: number, minX: number, maxX: number, speed: number) {
    const sizes: any = {
      slime: [56, 42],
      mushroom: [54, 54],
      bug: [58, 46],
      roller: [48, 48]
    };
    const [w, h] = sizes[type];
    return {
      type,
      x,
      y: y - h,
      baseY: y - h,
      w,
      h,
      minX,
      maxX,
      speed,
      vx: speed,
      alive: true,
      t: Math.random() * 10,
      frame: 0,
      hurtTimer: 0
    };
  }

  function resetGame(startScene = "title") {
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.score = 0;
    state.stars = 0;
    state.time = 0;
    state.lives = 3;
    state.particles = [];
    state.notices = [];
    state.shake = 0;
    state.portal.frame = 0;
    state.player = {
      x: playerSpawn.x,
      y: playerSpawn.y,
      w: 44,
      h: 70,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      wasGrounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHold: 0,
      invuln: 0,
      hurtTimer: 0,
      state: "idle",
      anim: 0,
      landedTimer: 0,
      dead: false,
      crouching: false,
      fireballTimer: 0,
      throwTimer: 0
    };
    state.fireballs = [];
    makeLevel();
    scene = startScene;
  }

  function addParticle(x: number, y: number, opts: any = {}) {
    const count = opts.count || 1;
    for (let i = 0; i < count; i++) {
      const a = (opts.angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (opts.spread ?? Math.PI);
      const speed = (opts.speed ?? 110) * (0.55 + Math.random() * 0.9);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - (opts.lift ?? 0),
        life: opts.life ?? 0.55,
        maxLife: opts.life ?? 0.55,
        size: opts.size ?? 6,
        kind: opts.kind || "spark",
        color: opts.color || "#fff2a9",
        gravity: opts.gravity ?? 460
      });
    }
  }

  function addNotice(text: string, x: number, y: number, color = "#fff2a9") {
    state.notices.push({ text, x, y, vy: -32, life: 0.8, maxLife: 0.8, color });
  }

  function updateParticles(dt: number) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const n of state.notices) {
      n.life -= dt;
      n.y += n.vy * dt;
    }
    state.notices = state.notices.filter(n => n.life > 0);
  }

  function startGame() {
    if (scene === "title" || scene === "gameover" || scene === "complete") {
      resetGame("playing");
    }
  }

  function hitPlayer(source: any) {
    const pl = state.player;
    if (pl.invuln > 0 || pl.dead || scene !== "playing") return;
    state.lives -= 1;
    pl.invuln = 1.25;
    pl.hurtTimer = 0.45;
    pl.vx = source && center(source).x < center(pl).x ? 280 : -280;
    pl.vy = -380;
    state.shake = 0.18;
    addParticle(pl.x + pl.w * 0.5, pl.y + pl.h * 0.45, { count: 18, color: "#ff7088", speed: 130, size: 5, life: 0.48 });
    addNotice("-1 heart", pl.x, pl.y - 12, "#ffb1c2");
    sfx.hurt();
    if (state.lives <= 0) {
      pl.dead = true;
      setTimeout(() => { if (scene === "playing") scene = "gameover"; }, 450);
    }
  }

  function jump() {
    const pl = state.player;
    pl.vy = JUMP_V;
    pl.grounded = false;
    pl.coyote = 0;
    pl.jumpBuffer = 0;
    pl.jumpHold = 0.18;
    addParticle(pl.x + pl.w * 0.5, pl.y + pl.h, { count: 10, color: "#e9d8b8", angle: Math.PI / 2, spread: 1.8, speed: 80, size: 5, gravity: 240, life: 0.35 });
    sfx.jump();
  }

  function checkCeilingClearance(pl: any) {
    const standingRect = { x: pl.x, y: pl.y + pl.h - 70, w: pl.w, h: 70 };
    for (const platform of state.platforms) {
      if (rectsOverlap(standingRect, platform)) return false;
    }
    return true;
  }

  function spawnFireball(pl: any) {
    const y = pl.y + pl.h / 2 - 20;
    const x = pl.facing > 0 ? pl.x + pl.w : pl.x - 20;
    state.fireballs.push({
      x, y, w: 32, h: 32, vx: pl.facing * 600, facing: pl.facing, alive: true, distance: 0, frame: 0
    });
  }

  function updatePlayer(dt: number) {
    const pl = state.player;
    pl.wasGrounded = pl.grounded;
    pl.grounded = false;

    if (keys.jumpPressed) {
      pl.jumpBuffer = JUMP_BUFFER;
    } else {
      pl.jumpBuffer = Math.max(0, pl.jumpBuffer - dt);
    }

    if (pl.coyote > 0) pl.coyote -= dt;
    if (pl.invuln > 0) pl.invuln -= dt;
    if (pl.hurtTimer > 0) pl.hurtTimer -= dt;
    if (pl.landedTimer > 0) pl.landedTimer -= dt;

    const tryCrouch = keys.crouch && (pl.crouching || pl.wasGrounded);
    if (tryCrouch && !pl.crouching) {
      pl.crouching = true;
      pl.y += (70 - 44);
      pl.h = 44;
    } else if (!tryCrouch && pl.crouching) {
      if (checkCeilingClearance(pl)) {
        pl.crouching = false;
        pl.y -= (70 - 44);
        pl.h = 70;
      }
    }

    let move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    let currentAccel = ACCEL;
    let currentMaxSpeed = MAX_SPEED;

    if (pl.crouching) {
      currentAccel *= 0.5;
      currentMaxSpeed *= 0.35;
    }

    if (move !== 0) {
      pl.vx += move * currentAccel * dt;
      pl.facing = move;
    } else {
      const decel = pl.wasGrounded ? GROUND_DECEL : AIR_DECEL;
      if (Math.abs(pl.vx) <= decel * dt) pl.vx = 0;
      else pl.vx -= Math.sign(pl.vx) * decel * dt;
    }

    pl.vx = clamp(pl.vx, -currentMaxSpeed, currentMaxSpeed);
    pl.vy += GRAVITY * dt;
    pl.vy = Math.min(pl.vy, 980);

    if (keys.fireball && pl.fireballTimer <= 0 && !pl.dead && scene === "playing") {
      pl.fireballTimer = 0.4;
      pl.throwTimer = 0.2;
      sfx.shoot();
      spawnFireball(pl);
    }
    if (pl.fireballTimer > 0) pl.fireballTimer -= dt;
    if (pl.throwTimer > 0) pl.throwTimer -= dt;

    if (pl.jumpBuffer > 0 && (pl.wasGrounded || pl.coyote > 0) && !pl.crouching) {
      jump();
    }

    if (keys.jumpReleased && pl.vy < -140) {
      pl.vy *= JUMP_CUT;
      pl.jumpHold = 0;
    }

    moveAndCollide(pl, dt);

    if (!pl.wasGrounded && pl.grounded) {
      pl.landedTimer = 0.1;
      addParticle(pl.x + pl.w * 0.5, pl.y + pl.h, { count: 12, color: "#ddc5a6", angle: Math.PI / 2, spread: 2.4, speed: 90, size: 5, gravity: 300, life: 0.38 });
    }

    if (pl.grounded) pl.coyote = COYOTE_TIME;

    if (pl.y > WORLD_H) {
      hitPlayer({ x: pl.x - 50, y: pl.y, w: 20, h: 20 });
      pl.x = Math.max(100, state.cameraX + 120);
      pl.y = 160;
      pl.vy = 0;
    }

    if (pl.hurtTimer > 0) pl.state = "hurt";
    else if (pl.throwTimer > 0) pl.state = pl.crouching ? "crouch_throw" : "throw";
    else if (pl.crouching) pl.state = "crouch";
    else if (!pl.grounded && pl.vy < 0) pl.state = "jump";
    else if (!pl.grounded && pl.vy >= 0) pl.state = "fall";
    else if (pl.landedTimer > 0) pl.state = "landing";
    else if (Math.abs(pl.vx) > 18) pl.state = "run";
    else pl.state = "idle";

    pl.anim += dt * (pl.state === "run" ? 13 : 7);
  }

  function moveAndCollide(pl: any, dt: number) {
    pl.x += pl.vx * dt;
    pl.x = clamp(pl.x, 0, WORLD_W - pl.w);
    for (const platform of state.platforms) {
      if (!rectsOverlap(pl, platform)) continue;
      if (pl.vx > 0) pl.x = platform.x - pl.w;
      else if (pl.vx < 0) pl.x = platform.x + platform.w;
      pl.vx = 0;
    }

    pl.y += pl.vy * dt;
    for (const platform of state.platforms) {
      if (!rectsOverlap(pl, platform)) continue;
      if (pl.vy > 0) {
        pl.y = platform.y - pl.h;
        pl.vy = 0;
        pl.grounded = true;
      } else if (pl.vy < 0) {
        pl.y = platform.y + platform.h;
        pl.vy = 90;
      }
    }
  }

  function updateEnemies(dt: number) {
    const pl = state.player;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      e.frame = Math.floor(e.t * 8) % 4;
      if (e.type === "bug") {
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 3.5) * 24;
      } else if (e.type === "slime") {
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 5) * 5;
      } else {
        e.x += e.vx * dt;
      }

      if (e.x < e.minX || e.x + e.w > e.maxX) {
        e.vx *= -1;
        e.x = clamp(e.x, e.minX, e.maxX - e.w);
      }

      if (!rectsOverlap(pl, e)) continue;
      const plBottom = pl.y + pl.h;
      const enemyTop = e.y;
      const stomp = pl.vy > 80 && plBottom - enemyTop < 30 && pl.y < e.y;
      if (stomp) {
        e.alive = false;
        pl.vy = -450;
        state.score += 150;
        addNotice("+150", e.x + e.w / 2, e.y, "#fff2a9");
        addParticle(e.x + e.w / 2, e.y + e.h / 2, { count: 24, color: "#fff2a9", speed: 160, size: 6, life: 0.55 });
        sfx.stomp();
      } else {
        hitPlayer(e);
      }
    }
  }

  function updateStars(dt: number) {
    const pl = state.player;
    for (const star of state.starsList) {
      if (star.collected) continue;
      star.bob += dt * 5;
      const hit = { x: star.x, y: star.y + Math.sin(star.bob) * 5, w: star.w, h: star.h };
      if (!rectsOverlap(pl, hit)) continue;
      star.collected = true;
      state.score += 25;
      state.stars += 1;
      addNotice("+25", star.x, star.y, "#fff2a9");
      addParticle(star.x + 17, star.y + 17, { count: 16, color: "#fff2a9", speed: 145, size: 4.5, life: 0.45 });
      sfx.star();
    }
  }

  function updateGoal(dt: number) {
    state.portal.frame = (state.portal.frame + dt * 8) % 6;
    const goal = { x: state.portal.x + 14, y: state.portal.y + 10, w: 48, h: 96 };
    if (rectsOverlap(state.player, goal) && scene === "playing") {
      scene = "complete";
      state.score += Math.max(0, Math.floor(600 - state.time * 6));
      addParticle(goal.x + 24, goal.y + 50, { count: 70, color: "#96ffff", speed: 260, size: 7, life: 1.15, gravity: 120 });
      sfx.win();
    }
  }

  function updateCamera(dt: number) {
    const pl = state.player;
    const lookAhead = pl.facing > 0 ? 130 : -60;
    state.targetCameraX = clamp(pl.x - VIEW_W * 0.38 + lookAhead, 0, WORLD_W - VIEW_W);
    state.cameraX = lerp(state.cameraX, state.targetCameraX, Math.min(1, dt * 5.5));
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  }

  function updateFireballs(dt: number) {
    for (const fb of state.fireballs) {
      if (!fb.alive) continue;
      fb.x += fb.vx * dt;
      fb.distance += Math.abs(fb.vx * dt);
      fb.frame += dt * 15;
      
      if (fb.distance > 800) { fb.alive = false; continue; }
      
      let hitWall = false;
      for (const platform of state.platforms) {
        if (rectsOverlap(fb, platform)) {
           hitWall = true; break;
        }
      }
      if (hitWall) {
         fb.alive = false;
         addParticle(fb.x + 16, fb.y + 16, { count: 8, color: "#ff8c00", speed: 80, size: 5, life: 0.3 });
         continue;
      }
      
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(fb, e)) {
           fb.alive = false;
           e.alive = false;
           state.score += 200;
           addNotice("+200", e.x + e.w / 2, e.y, "#ff8c00");
           addParticle(e.x + e.w / 2, e.y + e.h / 2, { count: 30, color: "#ff8c00", speed: 180, size: 6, life: 0.5 });
           break;
        }
      }
    }
    state.fireballs = state.fireballs.filter((f: any) => f.alive);
  }

  let musicStep = 0;
  let nextNoteTime = 0;

  function musicTone(freq: number, duration: number, type: OscillatorType, gainGain: number, slide: number, time: number) {
    if (!audio || audio.state === "suspended") return;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), time + duration);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gainGain, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(audio.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playMusicStep(step: number, time: number) {
     const bar = Math.floor(step / 16) % 4;
     const subStep = step % 16;
      
     let chord = [261.63, 329.63, 392.00];
     let bass = 130.81;
     
     if (bar === 1) { chord = [349.23, 440.00, 523.25]; bass = 174.61; }
     else if (bar === 2) { chord = [392.00, 493.88, 587.33]; bass = 196.00; }
     else if (bar === 3) { chord = [261.63, 329.63, 392.00]; bass = 130.81; }
     
     if (subStep === 0 || subStep === 3 || subStep === 8 || subStep === 11) {
        musicTone(bass, 0.15, "triangle", 0.05, 1, time);
     }
     if (subStep % 2 === 0) {
        const note = chord[(subStep / 2) % 3] * 2; 
        musicTone(note, 0.1, "square", 0.015, 1, time);
     }
  }

  function scheduleMusic() {
    if (!audio || audio.state === "suspended") return;
    const tempo = 125;
    const stepDuration = (60 / tempo) / 4; 
    
    if (nextNoteTime === 0 || nextNoteTime < audio.currentTime) {
      nextNoteTime = audio.currentTime + 0.05;
    }

    while (nextNoteTime < audio.currentTime + 0.1) {
      if (scene === "playing") {
        playMusicStep(musicStep, nextNoteTime);
      }
      nextNoteTime += stepDuration;
      musicStep = (musicStep + 1) % 64;
    }
  }

  function update(dt: number) {
    frameTime += dt;
    scheduleMusic();
    if (scene === "playing") {
      state.time += dt;
      updatePlayer(dt);
      updateEnemies(dt);
      updateFireballs(dt);
      updateStars(dt);
      updateGoal(dt);
      updateCamera(dt);
    } else if (scene === "complete") {
      state.player.state = "victory";
      state.player.anim += dt * 7;
      updateCamera(dt);
    }
    updateParticles(dt);
    keys.jumpPressed = false;
    keys.jumpReleased = false;
  }

  function draw() {
    ctx.save();
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * 10 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.translate(shakeX, shakeY);

    drawBackground();
    ctx.save();
    ctx.translate(-Math.round(state.cameraX), 0);
    drawPlatforms();
    drawStars();
    drawEnemies();
    drawFireballs();
    drawPortal();
    drawPlayer();
    drawParticlesWorld();
    drawNoticesWorld();
    ctx.restore();
    drawParticlesScreen();
    drawHud();
    drawSceneOverlay();

    ctx.restore();
  }

  function drawBackground() {
    const bg = images.background;
    ctx.fillStyle = "#81e8ff";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const offset = -((state.cameraX * 0.16) % 2200);
    for (let x = offset - 2200; x < VIEW_W + 2200; x += 2200) {
      ctx.drawImage(bg, x, 0, 2200, VIEW_H);
    }

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 42; i++) {
      const x = (i * 173 - state.cameraX * 0.08) % (VIEW_W + 200) - 100;
      const y = 24 + (i * 47) % 180;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tileFrame(type: number) {
    return clamp(type, 0, 3) * 64;
  }

  function drawPlatforms() {
    const cam = state.cameraX;
    const minX = cam - 80;
    const maxX = cam + VIEW_W + 80;
    for (const p of state.platforms) {
      if (p.x > maxX || p.x + p.w < minX) continue;
      const sx = tileFrame(p.type);
      const start = Math.floor(p.x / TILE) * TILE;
      for (let x = start; x < p.x + p.w; x += TILE) {
        const drawX = Math.max(x, p.x);
        const cropLeft = drawX - x;
        const cropW = Math.min(TILE - cropLeft, p.x + p.w - drawX);
        const drawW = cropW;
        for (let y = p.y; y < p.y + p.h; y += TILE) {
          const cropH = Math.min(TILE, p.y + p.h - y);
          ctx.drawImage(images.tiles, sx + cropLeft, 0, cropW, cropH, drawX, y, drawW, cropH);
        }
      }

      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(p.x + 8, p.y + 4, Math.max(0, p.w - 16), 3);
    }
  }

  function drawStars() {
    const frame = Math.floor(frameTime * 10) % 6;
    for (const star of state.starsList) {
      if (star.collected) continue;
      if (star.x + 60 < state.cameraX || star.x - 60 > state.cameraX + VIEW_W) continue;
      const y = star.y + Math.sin(star.bob) * 5;
      
      ctx.drawImage(images.collectibles, frame * 48, 0, 48, 48, star.x - 7, y - 7, 48, 48);
    }
  }

  function drawEnemies() {
    const rowMap: Record<string, number> = { slime: 0, mushroom: 1, bug: 2, roller: 3 };
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.x + 80 < state.cameraX || e.x - 80 > state.cameraX + VIEW_W) continue;
      const row = rowMap[e.type] || 0;
      const frame = e.frame % 4;
      ctx.save();
      const flip = e.vx < 0;
      if (flip) {
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, -40, -40, 80, 80);
      } else {
        ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, e.x + e.w / 2 - 40, e.y + e.h / 2 - 40, 80, 80);
      }
      ctx.restore();
    }
  }

  function drawFireballs() {
    for (const fb of state.fireballs) {
      if (!fb.alive) continue;
      const frame = Math.floor(fb.frame) % 4;
      ctx.save();
      ctx.translate(fb.x + fb.w/2, fb.y + fb.h/2);
      if (fb.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(images.fireball, frame * 64, 0, 64, 64, -32, -32, 64, 64);
      ctx.restore();
    }
  }

  function playerFrame() {
    const pl = state.player;
    if (pl.state === "hurt") return 8;
    if (pl.state === "victory") return 9;
    if (pl.state === "throw" || pl.state === "crouch_throw") return 11;
    if (pl.state === "crouch") return 10;
    if (pl.state === "jump") return 6;
    if (pl.state === "fall") return 7;
    if (pl.state === "landing") return 1;
    if (pl.state === "run") return 2 + (Math.floor(pl.anim) % 4);
    return Math.floor(pl.anim) % 2;
  }

  function drawPlayer() {
    const pl = state.player;
    const f = playerFrame();
    const drawW = 96;
    const drawH = 96;
    const x = pl.x + pl.w / 2 - drawW / 2;
    const y = pl.y + pl.h - drawH + 8;
    const flashing = pl.invuln > 0 && Math.floor(frameTime * 18) % 2 === 0;
    ctx.save();
    if (flashing) ctx.globalAlpha = 0.52;
    if (pl.facing < 0) {
      ctx.translate(pl.x + pl.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(images.ethan, f * 96, 0, 96, 96, -drawW / 2, y, drawW, drawH);
    } else {
      ctx.drawImage(images.ethan, f * 96, 0, 96, 96, x, y, drawW, drawH);
    }
    ctx.restore();
  }

  function drawPortal() {
    const f = Math.floor(state.portal.frame) % 6;
    ctx.drawImage(images.portal, f * 96, 0, 96, 128, state.portal.x - 10, state.portal.y - 8, 96, 128);
    
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "800 18px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Finish", state.portal.x + 38, state.portal.y - 14);
  }

  function drawParticlesWorld() {
    for (const p of state.particles) {
      if (p.kind === "screen") continue;
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticlesScreen() {
    for (const p of state.particles) {
      if (p.kind !== "screen") continue;
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawNoticesWorld() {
    ctx.font = "900 20px ui-rounded, system-ui";
    ctx.textAlign = "center";
    for (const n of state.notices) {
      ctx.globalAlpha = clamp(n.life / n.maxLife, 0, 1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(42,17,54,0.55)";
      ctx.fillStyle = n.color;
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHeart(x: number, y: number, filled: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.2, 1.2);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -5, -24, 9, 0, 25);
    ctx.bezierCurveTo(24, 9, 12, -5, 0, 6);
    ctx.closePath();
    ctx.fillStyle = filled ? "#ff4269" : "rgba(255,255,255,0.22)";
    ctx.strokeStyle = "rgba(65,24,65,0.35)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHud() {
    ctx.save();
    ctx.fillStyle = "rgba(35,24,64,0.36)";
    roundRect(ctx, 18, 16, 360, 64, 20);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "900 20px ui-rounded, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`Score ${state.score}`, 34, 42);
    ctx.fillText(`Stars ${state.stars}/${state.starsList.length}`, 190, 42);
    for (let i = 0; i < 3; i++) drawHeart(48 + i * 34, 58, i < state.lives);

    ctx.fillStyle = "rgba(35,24,64,0.36)";
    roundRect(ctx, VIEW_W - 210, 16, 192, 54, 18);
    ctx.fill();
    ctx.fillStyle = "#fff2a9";
    ctx.font = "900 18px ui-rounded, system-ui";
    ctx.textAlign = "right";
    ctx.fillText(`${state.levelName}`, VIEW_W - 34, 39);
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px ui-rounded, system-ui";
    ctx.fillText(`Time ${Math.floor(state.time)}s`, VIEW_W - 34, 60);

    if (mutedBecauseNoGesture && scene !== "loading") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 12px ui-rounded, system-ui";
      ctx.fillText("Press any key to enable sound", VIEW_W / 2, 25);
    }
    ctx.restore();
  }

  function drawSceneOverlay() {
    if (scene === "playing") return;
    ctx.save();
    ctx.fillStyle = "rgba(18, 9, 42, 0.58)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";

    if (scene === "loading") {
      titleText("Loading Ethan the Jumper", "Preparing stars, slimes, and jump magic...", "Please wait");
    } else if (scene === "title") {
      titleText("Ethan the Jumper", "A colorful platform adventure with smooth jumps, stars, enemies, and a glowing portal.", "Press Enter or Space to start");
      drawMiniControls();
    } else if (scene === "gameover") {
      titleText("Game Over", `Final score: ${state.score}. Ethan took a rough landing.`, "Press Enter to try again");
    } else if (scene === "complete") {
      titleText("Level Complete", `Score ${state.score} · Stars ${state.stars}/${state.starsList.length} · Time ${Math.floor(state.time)}s`, "Press Enter to play again");
    }

    ctx.restore();
  }

  function titleText(title: string, subtitle: string, prompt: string) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, 170, 116, 620, 300, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, 170, 116, 620, 300, 34);
    ctx.stroke();

    ctx.fillStyle = "#fff2a9";
    ctx.font = "1000 58px ui-rounded, system-ui";
    ctx.fillText(title, VIEW_W / 2, 195);
    ctx.fillStyle = "#fff";
    ctx.font = "700 19px ui-rounded, system-ui";
    wrapText(subtitle, VIEW_W / 2, 245, 520, 28);
    ctx.fillStyle = "#9df5ff";
    ctx.font = "900 22px ui-rounded, system-ui";
    ctx.fillText(prompt, VIEW_W / 2, 352);
  }

  function drawMiniControls() {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 15px ui-rounded, system-ui";
    ctx.fillText("Move: A/D or arrows · Jump: Space/W/Up · Crouch: S/Down", VIEW_W / 2, 382);
    ctx.fillText("Fireball: F/J · Restart: R", VIEW_W / 2, 404);
  }

  function wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function handleKeyDown(e: KeyboardEvent) {
    initAudio();
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "w", "s", "f", "j", "r", "enter"].includes(k)) e.preventDefault();
    if (k === "arrowleft" || k === "a") keys.left = true;
    if (k === "arrowright" || k === "d") keys.right = true;
    if (k === "arrowdown" || k === "s") keys.crouch = true;
    if (k === "f" || k === "j") keys.fireball = true;
    if (k === "arrowup" || k === "w" || k === " ") {
      if (!keys.jump) keys.jumpPressed = true;
      keys.jump = true;
      if (scene === "title") startGame();
    }
    if (k === "enter") startGame();
    if (k === "r") resetGame("playing");
  }

  function handleKeyUp(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") keys.left = false;
    if (k === "arrowright" || k === "d") keys.right = false;
    if (k === "arrowdown" || k === "s") keys.crouch = false;
    if (k === "f" || k === "j") keys.fireball = false;
    if (k === "arrowup" || k === "w" || k === " ") {
      if (keys.jump) keys.jumpReleased = true;
      keys.jump = false;
    }
  }

  function bindMobileButton(btn: HTMLElement | null, prop: "left" | "right" | "jump") {
    if (!btn) return;
    const down = (e: Event) => {
      e.preventDefault();
      initAudio();
      mobileState[prop] = true;
      if (prop === "jump" && !keys.jump) keys.jumpPressed = true;
      if (scene === "title" || scene === "gameover" || scene === "complete") startGame();
      syncMobile();
    };
    const up = (e: Event) => {
      e.preventDefault();
      if (prop === "jump" && keys.jump) keys.jumpReleased = true;
      mobileState[prop] = false;
      syncMobile();
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
    
    return () => {
      btn.removeEventListener("pointerdown", down);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      btn.removeEventListener("pointerleave", up);
    }
  }

  function syncMobile() {
    keys.left = keys.left || mobileState.left;
    keys.right = keys.right || mobileState.right;
    keys.jump = keys.jump || mobileState.jump;
  }

  let rafId: number;
  let running = true;

  function loop(now: number) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    syncMobile();
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp, { passive: false });
  const onPointerDownAudio = () => initAudio();
  window.addEventListener("pointerdown", onPointerDownAudio, { once: true });
  
  const cleanupLeft = bindMobileButton(btnLeft, "left");
  const cleanupRight = bindMobileButton(btnRight, "right");
  const cleanupJump = bindMobileButton(btnJump, "jump");

  Promise.all(Object.entries(assetList).map(([name, src]) => loadImage(name, src)))
    .then(entries => {
      for (const [name, img] of entries) images[name] = img;
      resetGame("title");
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    })
    .catch(err => {
      console.error(err);
      scene = "loading";
      ctx.fillStyle = "#120921";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Asset loading failed.", VIEW_W / 2, VIEW_H / 2);
    });

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("pointerdown", onPointerDownAudio);
    cleanupLeft && cleanupLeft();
    cleanupRight && cleanupRight();
    cleanupJump && cleanupJump();
  };
}
