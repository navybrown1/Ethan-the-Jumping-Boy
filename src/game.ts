import { assetList } from "./gameAssets";

assetList.ethan = `${import.meta.env.BASE_URL}assets/ethan/spritesheet.webp`;

export function initGame(
  canvas: HTMLCanvasElement,
  btnLeft: HTMLElement | null,
  btnRight: HTMLElement | null,
  btnCrouch: HTMLElement | null,
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
  let musicTempo = 125;
  let musicRoot = 1;

  const THEMES: any = {
    1: { name: "Rainbow Grove", sky: "#7cd8f5", skyLow: "#eafcff", far: "far1", near: "near1", tiles: "tiles1", particles: "petal", tempo: 125, root: 1 },
    2: { name: "Sunset Cliffs", sky: "#ff9a4d", skyLow: "#ffd9a0", far: "far2", near: "near2", tiles: "tiles2", particles: "ember", tempo: 132, root: 0.84 },
    3: { name: "Crystal Caves", sky: "#0b2030", skyLow: "#14304c", far: "far3", near: "near3", tiles: "tiles3", particles: "snow", tempo: 140, root: 0.75 },
    4: { name: "Storm Summit", sky: "#141426", skyLow: "#2c2c46", far: "far4", near: "near4", tiles: "tiles4", particles: "rain", tempo: 150, root: 0.66 }
  };

  const state: any = {
    cameraX: 0,
    targetCameraX: 0,
    score: 0,
    stars: 0,
    time: 0,
    lives: 3,
    particles: [],
    notices: [],
    shake: 0,
    hitstop: 0,
    levelName: "Rainbow Grove",
    currentLevel: 1,
    bgColor: "#7cd8f5",
    player: null,
    platforms: [],
    starsList: [],
    enemies: [],
    powerups: [],
    stalactites: [],
    strikes: [],
    ambient: [],
    ambT: 0,
    wind: { timer: 4, gust: 0, dir: 1 },
    nextStrike: 5,
    combo: 0,
    comboTimer: 0,
    portal: { x: 5140, y: 304, w: 76, h: 116, frame: 0 },
    boss: null,
    banner: { title: "", sub: "", timer: 0 },
    selectLevel: 1,
    tilesKey: "tiles1",
    farKey: "far1",
    nearKey: "near1",
    skyGrad: null
  };

  const playerSpawn = { x: 110, y: 255 };

  function loadProgress(): any {
    try {
      const raw = localStorage.getItem("ethan-deluxe-v1");
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }
  const prog = loadProgress() || { unlocked: 1, stars: [0, 0, 0, 0], bestScore: 0 };

  function saveProgress() {
    try { localStorage.setItem("ethan-deluxe-v1", JSON.stringify(prog)); } catch (e) { /* ignore */ }
  }

  function computeRating() {
    const total = state.starsList.length || 1;
    const pct = state.stars / total;
    return pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
  }

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
    win: () => { tone(520, 0.14, "triangle", 0.04, 1.4); setTimeout(() => tone(700, 0.16, "triangle", 0.04, 1.38), 120); setTimeout(() => tone(980, 0.2, "triangle", 0.04, 1.2), 250); },
    levelUp: () => {
      tone(440, 0.1, "triangle", 0.04, 1.2);
      setTimeout(() => tone(554, 0.1, "triangle", 0.04, 1.2), 100);
      setTimeout(() => tone(659, 0.1, "triangle", 0.04, 1.2), 200);
      setTimeout(() => tone(880, 0.25, "triangle", 0.045, 1.1), 310);
    },
    spring: () => { tone(180, 0.12, "triangle", 0.05, 2.4); setTimeout(() => tone(420, 0.14, "triangle", 0.04, 1.7), 40); },
    power: () => {
      tone(523, 0.09, "triangle", 0.04, 1.1);
      setTimeout(() => tone(659, 0.09, "triangle", 0.04, 1.1), 80);
      setTimeout(() => tone(784, 0.16, "triangle", 0.045, 1.2), 160);
    },
    starPower: () => { tone(300, 0.35, "sawtooth", 0.03, 2.6); },
    thunder: () => { tone(95, 0.5, "sawtooth", 0.06, 0.6); setTimeout(() => tone(55, 0.6, "square", 0.035, 0.5), 40); },
    bossHurt: () => { tone(140, 0.16, "square", 0.05, 0.7); },
    bossDie: () => { tone(300, 0.8, "sawtooth", 0.05, 0.3); setTimeout(() => tone(150, 0.9, "sawtooth", 0.04, 0.4), 120); }
  };

  function applyTheme(level: number) {
    const t = THEMES[level];
    state.levelName = t.name;
    state.bgColor = t.sky;
    state.tilesKey = t.tiles;
    state.farKey = t.far;
    state.nearKey = t.near;
    musicTempo = t.tempo;
    musicRoot = t.root;
  }

  // ─── Level 1: Rainbow Grove ───────────────────────────────────────────────
  function makeLevel1() {
    const p: any[] = [];
    const add = (x: number, y: number, w: number, h = 64, type = 0, opts: any = {}) => {
      const pl: any = { x, y, w, h, type };
      Object.assign(pl, opts);
      if (opts.move) { pl.baseX = x; pl.baseY = y; pl.mt = opts.move.phase || 0; pl.dx = 0; pl.dy = 0; }
      if (opts.crumble) { pl.cs = "idle"; pl.ct = 0; pl.respawn = 0; pl.fallY = 0; }
      if (type === 4) { pl.squash = 0; }
      p.push(pl);
      return pl;
    };

    add(0, 456, 760);
    add(860, 456, 260);
    add(1220, 456, 500);
    add(1820, 456, 320);
    add(2240, 396, 460, 180, 0);
    add(2800, 456, 460);
    add(3360, 456, 420);
    add(3880, 456, 300);
    add(4280, 396, 300, 180, 0);
    add(4680, 456, 460);
    add(5100, 456, 300);

    add(300, 300, 140, 36, 1);
    add(520, 340, 200, 36, 2);
    add(760, 440, 64, 16, 4);
    add(980, 340, 220, 36, 1);
    add(1300, 285, 200, 36, 2);
    add(1600, 340, 200, 36, 1, { move: { axis: "y", amp: 45, speed: 1.4, phase: 1 } });
    add(1900, 350, 200, 36, 2);
    add(2280, 336, 160, 36, 1);
    add(2500, 290, 160, 36, 2);
    add(2700, 330, 180, 36, 1);
    add(3100, 300, 220, 36, 2);
    add(3350, 340, 200, 36, 1, { move: { axis: "y", amp: 45, speed: 1.6 } });
    add(3760, 440, 64, 16, 4);
    add(4100, 350, 200, 36, 2);
    add(4450, 300, 200, 36, 1);
    add(4750, 330, 220, 36, 2);
    add(5050, 300, 200, 36, 1);

    const stars: any[] = [];
    const addStars = (x: number, y: number, count: number, gap = 54) => {
      for (let i = 0; i < count; i++) stars.push({ x: x + i * gap, y, w: 34, h: 34, collected: false, bob: Math.random() * Math.PI * 2 });
    };
    addStars(310, 245, 3);
    addStars(530, 285, 3);
    addStars(995, 285, 4);
    addStars(1310, 230, 4);
    addStars(1610, 285, 3);
    addStars(1910, 295, 4);
    addStars(2290, 280, 3);
    addStars(2510, 235, 4);
    addStars(2710, 275, 3);
    addStars(3110, 245, 4);
    addStars(3360, 285, 3);
    addStars(4110, 295, 4);
    addStars(4460, 245, 3);
    addStars(4760, 275, 4);
    addStars(5060, 245, 3);

    const enemies = [
      enemy("slime", 620, 406, 380, 760, 80),
      enemy("mushroom", 1050, 406, 860, 1120, 66),
      enemy("slime", 1500, 406, 1220, 1720, 84),
      enemy("mushroom", 2000, 406, 1820, 2240, 70),
      enemy("spike", 2400, 396, 2240, 2700, 58),
      enemy("slime", 3000, 406, 2800, 3260, 86),
      enemy("hopper", 3450, 406, 3360, 3780, 78),
      enemy("mushroom", 4000, 406, 3880, 4280, 72),
      enemy("slime", 4400, 396, 4280, 4580, 88),
      enemy("hopper", 5000, 406, 4680, 5400, 82)
    ];

    const powerups = [
      { x: 1320, y: 195, w: 44, h: 44, kind: "mushroom", taken: false, bob: 0 },
      { x: 2330, y: 205, w: 44, h: 44, kind: "star", taken: false, bob: 1 },
      { x: 4200, y: 200, w: 44, h: 44, kind: "flower", taken: false, bob: 2 }
    ];

    state.platforms = p;
    state.starsList = stars;
    state.enemies = enemies;
    state.powerups = powerups;
    state.stalactites = [];
    state.strikes = [];
  }

  // ─── Level 2: Sunset Cliffs ───────────────────────────────────────────────
  // Crumbling bridges over wide gaps, wind-carved mesas, ember skies.
  function makeLevel2() {
    const p: any[] = [];
    const add = (x: number, y: number, w: number, h = 64, type = 0, opts: any = {}) => {
      const pl: any = { x, y, w, h, type };
      Object.assign(pl, opts);
      if (opts.move) { pl.baseX = x; pl.baseY = y; pl.mt = opts.move.phase || 0; pl.dx = 0; pl.dy = 0; }
      if (opts.crumble) { pl.cs = "idle"; pl.ct = 0; pl.respawn = 0; pl.fallY = 0; }
      if (type === 4) { pl.squash = 0; }
      p.push(pl);
      return pl;
    };

    add(0, 456, 700);
    add(700, 420, 110, 30, 1, { crumble: true });
    add(810, 420, 110, 30, 1, { crumble: true });
    add(920, 456, 480);
    add(1400, 420, 120, 30, 1, { crumble: true });
    add(1520, 420, 120, 30, 1, { crumble: true });
    add(1640, 456, 420);
    add(2060, 420, 120, 30, 1, { crumble: true });
    add(2180, 420, 120, 30, 1, { crumble: true });
    add(2300, 396, 500, 180, 0);
    add(2800, 456, 380);
    add(3180, 420, 120, 30, 1, { crumble: true });
    add(3300, 420, 120, 30, 1, { crumble: true });
    add(3420, 456, 400);
    add(3820, 420, 120, 30, 1, { crumble: true });
    add(3940, 420, 120, 30, 1, { crumble: true });
    add(4060, 456, 460);
    add(4620, 396, 360, 180, 0);
    add(5080, 456, 320);

    add(180, 345, 160, 36, 1);
    add(420, 360, 200, 36, 2);
    add(1200, 340, 200, 36, 2, { move: { axis: "x", amp: 100, speed: 1.1, phase: 0, minX: 1050, maxX: 1400 } });
    add(1700, 350, 200, 36, 1);
    add(2150, 320, 180, 36, 2);
    add(2400, 340, 200, 36, 1);
    add(2650, 290, 220, 36, 2);
    add(3050, 330, 200, 36, 1, { move: { axis: "x", amp: 140, speed: 1.2, phase: 2, minX: 2900, maxX: 3200 } });
    add(3500, 345, 200, 36, 2);
    add(3900, 330, 180, 36, 1);
    add(4200, 300, 220, 36, 2);
    add(4500, 340, 200, 36, 1);
    add(4750, 300, 220, 36, 2);
    add(5050, 350, 200, 36, 1);

    const stars: any[] = [];
    const addStars = (x: number, y: number, count: number, gap = 54) => {
      for (let i = 0; i < count; i++) stars.push({ x: x + i * gap, y, w: 34, h: 34, collected: false, bob: Math.random() * Math.PI * 2 });
    };
    addStars(190, 280, 3);
    addStars(430, 300, 3);
    addStars(1210, 250, 4);
    addStars(1710, 275, 3);
    addStars(2160, 265, 4);
    addStars(2410, 285, 3);
    addStars(2660, 235, 4);
    addStars(3060, 280, 3);
    addStars(3510, 265, 4);
    addStars(3910, 275, 3);
    addStars(4210, 245, 4);
    addStars(4510, 285, 3);
    addStars(4760, 245, 4);
    addStars(5060, 265, 3);

    const enemies = [
      enemy("slime", 520, 406, 380, 700, 92),
      enemy("mushroom", 1100, 406, 920, 1400, 78),
      enemy("roller", 1600, 406, 1400, 1640, 140),
      enemy("spike", 1850, 406, 1640, 2060, 70),
      enemy("slime", 2500, 396, 2300, 2800, 96),
      enemy("hopper", 3000, 406, 2800, 3180, 92),
      enemy("mushroom", 3650, 406, 3420, 3820, 86),
      enemy("roller", 4250, 406, 4060, 4520, 155),
      enemy("spike", 4450, 406, 4060, 4520, 74),
      enemy("slime", 5250, 406, 5080, 5400, 100)
    ];

    const powerups = [
      { x: 1250, y: 190, w: 44, h: 44, kind: "star", taken: false, bob: 0 },
      { x: 3700, y: 195, w: 44, h: 44, kind: "flower", taken: false, bob: 1 },
      { x: 4900, y: 195, w: 44, h: 44, kind: "mushroom", taken: false, bob: 2 }
    ];

    state.platforms = p;
    state.starsList = stars;
    state.enemies = enemies;
    state.powerups = powerups;
    state.stalactites = [];
    state.strikes = [];
  }

  // ─── Level 3: Crystal Caves ───────────────────────────────────────────────
  // Ice physics corridors, falling stalactites, lava pools, a vertical secret room.
  function makeLevel3() {
    const p: any[] = [];
    const add = (x: number, y: number, w: number, h = 64, type = 0, opts: any = {}) => {
      const pl: any = { x, y, w, h, type };
      Object.assign(pl, opts);
      if (opts.move) { pl.baseX = x; pl.baseY = y; pl.mt = opts.move.phase || 0; pl.dx = 0; pl.dy = 0; }
      if (opts.crumble) { pl.cs = "idle"; pl.ct = 0; pl.respawn = 0; pl.fallY = 0; }
      if (type === 4) { pl.squash = 0; }
      p.push(pl);
      return pl;
    };

    add(0, 456, 640);
    add(640, 396, 260, 180, 2);
    add(900, 470, 220, 30, 3);
    add(1120, 456, 420);
    add(1540, 456, 300);
    add(1840, 470, 220, 30, 3);
    add(2060, 396, 320, 180, 2);
    add(2380, 456, 300);
    add(2680, 470, 220, 30, 3);
    add(2900, 456, 360);
    add(3260, 396, 300, 180, 0);
    add(3560, 456, 280);
    add(3840, 470, 220, 30, 3);
    add(4060, 456, 460);
    add(4520, 396, 300, 180, 2);
    add(4820, 456, 580);

    add(240, 340, 180, 36, 2);
    add(700, 330, 180, 36, 2, { move: { axis: "y", amp: 55, speed: 1.4 } });
    add(1180, 345, 200, 36, 1);
    add(1450, 280, 220, 36, 2);
    add(2050, 340, 160, 36, 1);
    add(2450, 320, 200, 36, 2);
    add(2700, 300, 200, 36, 2, { move: { axis: "x", amp: 160, speed: 1.3, phase: 1, minX: 2520, maxX: 2900 } });
    add(3200, 340, 180, 36, 1);
    add(3300, 330, 140, 36, 1);
    add(3500, 260, 140, 36, 1);
    add(3700, 190, 140, 36, 1);
    add(3900, 120, 140, 36, 1);
    add(3600, 345, 200, 36, 2);
    add(4100, 345, 200, 36, 1);
    add(4400, 280, 220, 36, 2);
    add(4700, 320, 200, 36, 1);
    add(5000, 290, 220, 36, 2);

    const stars: any[] = [];
    const addStars = (x: number, y: number, count: number, gap = 54) => {
      for (let i = 0; i < count; i++) stars.push({ x: x + i * gap, y, w: 34, h: 34, collected: false, bob: Math.random() * Math.PI * 2 });
    };
    addStars(250, 285, 3);
    addStars(710, 275, 4);
    addStars(1190, 285, 3);
    addStars(1460, 225, 4);
    addStars(2060, 285, 3);
    addStars(2460, 265, 4);
    addStars(2710, 245, 3);
    addStars(3210, 285, 4);
    addStars(3610, 265, 3);
    addStars(3920, 75, 5);
    addStars(4110, 285, 4);
    addStars(4410, 225, 3);
    addStars(4710, 265, 4);
    addStars(5010, 235, 3);

    const enemies = [
      enemy("slime", 480, 406, 300, 640, 100),
      enemy("diver", 780, 396, 640, 900, 120),
      enemy("splitter", 1300, 406, 1120, 1540, 96),
      enemy("roller", 1750, 406, 1540, 1840, 170),
      enemy("slime", 2200, 396, 2060, 2380, 108),
      enemy("diver", 2500, 406, 2380, 2680, 130),
      enemy("hopper", 3100, 406, 2900, 3260, 108),
      enemy("splitter", 3450, 396, 3260, 3560, 100),
      enemy("roller", 4250, 406, 4060, 4520, 180),
      enemy("diver", 4400, 406, 4060, 4520, 132),
      enemy("slime", 5050, 406, 4820, 5400, 112),
      enemy("hopper", 5250, 406, 4820, 5400, 104)
    ];

    const powerups = [
      { x: 1650, y: 195, w: 44, h: 44, kind: "flower", taken: false, bob: 0 },
      { x: 3350, y: 175, w: 44, h: 44, kind: "star", taken: false, bob: 1 },
      { x: 4950, y: 185, w: 44, h: 44, kind: "mushroom", taken: false, bob: 2 }
    ];

    const stalactites = [
      { x: 500, anchorY: 120, groundY: 456, w: 56, h: 90, state: "idle", timer: 2.5, ct: 0, vy: 0, y: 120, respawn: 0 },
      { x: 1350, anchorY: 140, groundY: 456, w: 56, h: 90, state: "idle", timer: 4.5, ct: 0, vy: 0, y: 140, respawn: 0 },
      { x: 2400, anchorY: 120, groundY: 396, w: 56, h: 90, state: "idle", timer: 6, ct: 0, vy: 0, y: 120, respawn: 0 },
      { x: 3650, anchorY: 140, groundY: 456, w: 56, h: 90, state: "idle", timer: 3.5, ct: 0, vy: 0, y: 140, respawn: 0 },
      { x: 4650, anchorY: 120, groundY: 396, w: 56, h: 90, state: "idle", timer: 5.5, ct: 0, vy: 0, y: 120, respawn: 0 }
    ];

    state.platforms = p;
    state.starsList = stars;
    state.enemies = enemies;
    state.powerups = powerups;
    state.stalactites = stalactites;
    state.strikes = [];
  }

  // ─── Level 4: Storm Summit ────────────────────────────────────────────────
  // Wind gusts, lightning strikes, lava pools — and the King Roller boss arena.
  function makeLevel4() {
    const p: any[] = [];
    const add = (x: number, y: number, w: number, h = 64, type = 0, opts: any = {}) => {
      const pl: any = { x, y, w, h, type };
      Object.assign(pl, opts);
      if (opts.move) { pl.baseX = x; pl.baseY = y; pl.mt = opts.move.phase || 0; pl.dx = 0; pl.dy = 0; }
      if (opts.crumble) { pl.cs = "idle"; pl.ct = 0; pl.respawn = 0; pl.fallY = 0; }
      if (type === 4) { pl.squash = 0; }
      p.push(pl);
      return pl;
    };

    add(0, 456, 560);
    add(560, 470, 220, 30, 3);
    add(780, 456, 420);
    add(1200, 456, 320);
    add(1520, 470, 240, 30, 3);
    add(1760, 396, 360, 180, 0);
    add(2120, 456, 380);
    add(2500, 470, 240, 30, 3);
    add(2740, 456, 420);
    add(3160, 396, 320, 180, 2);
    add(3480, 456, 300);
    add(3780, 470, 240, 30, 3);
    add(4020, 456, 460);
    add(4600, 456, 800);

    add(150, 345, 160, 36, 1);
    add(400, 280, 180, 36, 2);
    add(1000, 345, 200, 36, 1);
    add(1350, 320, 200, 36, 2, { move: { axis: "x", amp: 140, speed: 1.5, minX: 1200, maxX: 1520 } });
    add(1900, 340, 200, 36, 1);
    add(2250, 300, 200, 36, 2);
    add(2650, 350, 180, 36, 1);
    add(2900, 300, 200, 36, 2, { move: { axis: "y", amp: 80, speed: 1.5, phase: 2 } });
    add(3400, 340, 180, 36, 1);
    add(3700, 300, 220, 36, 2);
    add(4100, 345, 200, 36, 1);
    add(4400, 290, 220, 36, 2);

    const stars: any[] = [];
    const addStars = (x: number, y: number, count: number, gap = 54) => {
      for (let i = 0; i < count; i++) stars.push({ x: x + i * gap, y, w: 34, h: 34, collected: false, bob: Math.random() * Math.PI * 2 });
    };
    addStars(160, 285, 3);
    addStars(410, 225, 3);
    addStars(1010, 285, 4);
    addStars(1360, 260, 3);
    addStars(1910, 285, 3);
    addStars(2260, 245, 4);
    addStars(2660, 290, 3);
    addStars(2910, 245, 4);
    addStars(3410, 285, 3);
    addStars(3710, 245, 4);
    addStars(4110, 285, 3);
    addStars(4410, 235, 4);

    const enemies = [
      enemy("roller", 500, 406, 300, 560, 150),
      enemy("diver", 950, 406, 780, 1200, 140),
      enemy("spike", 1450, 406, 1200, 1520, 80),
      enemy("roller", 2000, 396, 1760, 2120, 200),
      enemy("splitter", 2350, 406, 2120, 2500, 110),
      enemy("diver", 2900, 406, 2740, 3160, 150),
      enemy("roller", 3350, 396, 3160, 3480, 210),
      enemy("spike", 3850, 406, 3480, 3780, 90),
      enemy("splitter", 4250, 406, 4020, 4480, 115),
      enemy("hopper", 4400, 406, 4020, 4480, 120)
    ];

    const powerups = [
      { x: 1750, y: 190, w: 44, h: 44, kind: "mushroom", taken: false, bob: 0 },
      { x: 3100, y: 185, w: 44, h: 44, kind: "star", taken: false, bob: 1 },
      { x: 4500, y: 180, w: 44, h: 44, kind: "flower", taken: false, bob: 2 }
    ];

    state.platforms = p;
    state.starsList = stars;
    state.enemies = enemies;
    state.powerups = powerups;
    state.stalactites = [];
    state.strikes = [];
    state.boss = {
      active: false, x: 5150, y: 316, w: 140, h: 140,
      hp: 30, maxHp: 30, phase: 1, vx: 0, vy: 0, dir: -1,
      state: "idle", t: 1.2, hurt: 0, dying: 0, minX: 4620, maxX: 5340, minions: []
    };
  }

  function makeLevel() {
    if (state.currentLevel === 1) makeLevel1();
    else if (state.currentLevel === 2) makeLevel2();
    else if (state.currentLevel === 3) makeLevel3();
    else makeLevel4();
    applyTheme(state.currentLevel);
  }

  function enemy(type: string, x: number, y: number, minX: number, maxX: number, speed: number) {
    const sizes: any = {
      slime: [56, 42],
      mushroom: [54, 54],
      bug: [58, 46],
      roller: [48, 48],
      spike: [64, 58],
      hopper: [52, 54],
      diver: [58, 50],
      splitter: [56, 42]
    };
    const [w, h] = sizes[type] || [56, 42];
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
      hurtTimer: 0,
      mini: false,
      grounded: true,
      vy: 0,
      hopT: 1 + Math.random() * 1.2,
      diveT: 2 + Math.random() * 1.5
    };
  }

  function resetGame(startScene = "title") {
    if (startScene === "title") { state.selectLevel = 1; }
    state.currentLevel = state.selectLevel;
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.score = 0;
    state.stars = 0;
    state.time = 0;
    state.lives = 3;
    state.particles = [];
    state.notices = [];
    state.shake = 0;
    state.hitstop = 0;
    state.portal.frame = 0;
    state.ambient = [];
    state.ambT = 0;
    state.wind = { timer: 4, gust: 0, dir: 1 };
    state.nextStrike = 5;
    state.boss = null;
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
      invincible: 0,
      firePower: false,
      hurtTimer: 0,
      state: "idle",
      anim: 0,
      landedTimer: 0,
      dead: false,
      crouching: false,
      fireballTimer: 0,
      throwTimer: 0,
      stompStreak: 0,
      comboTimer: 0,
      standingPlatform: null,
      trailT: 0
    };
    state.fireballs = [];
    state.combo = 0;
    state.comboTimer = 0;
    makeLevel();
    state.banner = { title: `LEVEL ${state.currentLevel}`, sub: state.levelName, timer: 1.8 };
    scene = startScene;
  }

  function nextLevel() {
    if (state.currentLevel >= 4) {
      scene = "win";
      sfx.win();
      return;
    }
    state.currentLevel++;
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.time = 0;
    state.particles = [];
    state.notices = [];
    state.shake = 0;
    state.portal.frame = 0;
    const pl = state.player;
    pl.x = playerSpawn.x;
    pl.y = playerSpawn.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.grounded = false;
    pl.crouching = false;
    pl.h = 70;
    pl.state = "idle";
    pl.dead = false;
    pl.invuln = 1.5;
    pl.hurtTimer = 0;
    pl.fireballTimer = 0;
    pl.throwTimer = 0;
    pl.invincible = 0;
    pl.firePower = false;
    pl.stompStreak = 0;
    pl.comboTimer = 0;
    state.fireballs = [];
    makeLevel();
    state.banner = { title: `LEVEL ${state.currentLevel}`, sub: state.levelName, timer: 1.8 };
    scene = "playing";
    sfx.levelUp();
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
    state.particles = state.particles.filter((p: any) => p.life > 0);

    for (const n of state.notices) {
      n.life -= dt;
      n.y += n.vy * dt;
    }
    state.notices = state.notices.filter((n: any) => n.life > 0);

    for (const a of state.ambient) {
      a.life -= dt;
      a.x += a.vx * dt + Math.sin(a.phase + a.t) * 14 * dt;
      a.y += a.vy * dt;
      a.t += dt;
    }
    state.ambient = state.ambient.filter((a: any) => a.life > 0);
  }

  function spawnAmbient(dt: number) {
    const kind = THEMES[state.currentLevel].particles;
    state.ambT -= dt;
    if (state.ambT > 0) return;
    const cam = state.cameraX;
    if (kind === "petal") {
      state.ambT = 0.5;
      const colors = ["#ffb3c7", "#ffd6e0", "#ffffff"];
      state.ambient.push({ x: cam + Math.random() * VIEW_W, y: -10, vx: (Math.random() - 0.5) * 26, vy: 42 + Math.random() * 36, life: 10, t: 0, phase: Math.random() * 6, size: 4 + Math.random() * 3, kind: "petal", color: colors[Math.floor(Math.random() * 3)] });
    } else if (kind === "ember") {
      state.ambT = 0.28;
      state.ambient.push({ x: cam + Math.random() * VIEW_W, y: VIEW_H + 10, vx: (Math.random() - 0.5) * 20, vy: -34 - Math.random() * 40, life: 4.5, t: 0, phase: Math.random() * 6, size: 2 + Math.random() * 2.4, kind: "ember", color: Math.random() < 0.5 ? "#ff9d3c" : "#ff6b3a" });
    } else if (kind === "snow") {
      state.ambT = 0.14;
      state.ambient.push({ x: cam + Math.random() * VIEW_W, y: -10, vx: (Math.random() - 0.5) * 16, vy: 34 + Math.random() * 34, life: 12, t: 0, phase: Math.random() * 6, size: 2 + Math.random() * 2.4, kind: "snow", color: "#e8fbff" });
    } else {
      state.ambT = 0.02;
      state.ambient.push({ x: cam + Math.random() * VIEW_W, y: -10, vx: -70, vy: 660, life: 0.6, t: 0, phase: 0, size: 1.5, kind: "rain", color: "rgba(200,225,255,0.55)" });
    }
  }

  function startGame() {
    if (scene === "title" || scene === "gameover") {
      resetGame("playing");
    } else if (scene === "complete") {
      nextLevel();
    } else if (scene === "win") {
      resetGame("title");
    }
  }

  function mult() {
    const pl = state.player;
    return Math.min(5, 1 + Math.floor(pl.stompStreak / 2));
  }

  function killEnemy(e: any, pts: number) {
    const pl = state.player;
    e.alive = false;
    if (pl.comboTimer > 0) pl.stompStreak++;
    else pl.stompStreak = 1;
    pl.comboTimer = 2.5;
    const m = mult();
    const gained = pts * m;
    state.score += gained;
    addNotice(m > 1 ? `x${m} +${gained}` : `+${gained}`, e.x + e.w / 2, e.y, "#fff2a9");
    addParticle(e.x + e.w / 2, e.y + e.h / 2, { count: 24, color: "#fff2a9", speed: 160, size: 6, life: 0.55 });
    sfx.stomp();
  }

  function spawnMinis(e: any) {
    for (let i = 0; i < 2; i++) {
      const m = enemy("slime", e.x + i * 20, e.baseY + 60, e.minX, e.maxX, 95 + Math.random() * 30);
      m.mini = true;
      m.w = 36;
      m.h = 28;
      m.baseY = e.baseY + 60;
      m.y = m.baseY;
      state.enemies.push(m);
    }
  }

  function hitPlayer(source: any) {
    const pl = state.player;
    if (pl.invuln > 0 || pl.dead || scene !== "playing" || pl.invincible > 0) return;
    state.lives -= 1;
    pl.firePower = false;
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
    const upgraded = pl.firePower;
    const y = pl.y + pl.h / 2 - 22;
    const x = pl.facing > 0 ? pl.x + pl.w : pl.x - 30;
    state.fireballs.push({
      x, y, w: upgraded ? 44 : 32, h: upgraded ? 44 : 32,
      vx: pl.facing * (upgraded ? 760 : 600),
      facing: pl.facing, alive: true, distance: 0, frame: 0,
      pierce: upgraded ? 2 : 0
    });
  }

  function updatePlayer(dt: number) {
    const pl = state.player;
    pl.wasGrounded = pl.grounded;
    pl.grounded = false;
    pl.standingPlatform = null;

    if (keys.jumpPressed) {
      pl.jumpBuffer = JUMP_BUFFER;
    } else {
      pl.jumpBuffer = Math.max(0, pl.jumpBuffer - dt);
    }

    if (pl.coyote > 0) pl.coyote -= dt;
    if (pl.invuln > 0) pl.invuln -= dt;
    if (pl.invincible > 0) pl.invincible -= dt;
    if (pl.hurtTimer > 0) pl.hurtTimer -= dt;
    if (pl.landedTimer > 0) pl.landedTimer -= dt;
    if (pl.comboTimer > 0) pl.comboTimer -= dt;
    else pl.stompStreak = 0;

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
    const onIce = pl.standingPlatform && pl.standingPlatform.type === 2;

    if (pl.crouching) {
      currentAccel *= 0.5;
      currentMaxSpeed *= 0.35;
    }
    if (onIce) {
      currentAccel *= 1.15;
      currentMaxSpeed *= 1.18;
    }

    if (move !== 0) {
      pl.vx += move * currentAccel * dt;
      pl.facing = move;
    } else {
      let decel = pl.wasGrounded ? GROUND_DECEL : AIR_DECEL;
      if (onIce) decel *= 0.22;
      if (Math.abs(pl.vx) <= decel * dt) pl.vx = 0;
      else pl.vx -= Math.sign(pl.vx) * decel * dt;
    }

    if (state.wind.gust > 0 && state.currentLevel === 4 && scene === "playing" && !pl.dead) {
      pl.vx += state.wind.dir * 175 * dt;
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

    for (const platform of state.platforms) {
      if (platform.type !== 3) continue;
      if (rectsOverlap(pl, platform) && pl.invincible <= 0) {
        hitPlayer(platform);
        addParticle(pl.x + pl.w / 2, pl.y + pl.h, { count: 10, color: "#ff8c3a", speed: 120, size: 5, life: 0.4 });
      }
    }

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

    if (pl.invincible > 0) {
      pl.trailT -= dt;
      if (pl.trailT <= 0) {
        pl.trailT = 0.04;
        const colors = ["#ff6b6b", "#ffd76a", "#7dff6b", "#6bd6ff", "#c77dff"];
        addParticle(pl.x + pl.w / 2, pl.y + pl.h / 2, { count: 1, color: colors[Math.floor(frameTime * 12) % 5], speed: 30, size: 4, life: 0.3, gravity: 0 });
      }
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
      if (platform.type === 3) continue;
      if (platform.crumble && platform.cs !== "idle" && platform.cs !== "shake") continue;
      if (!rectsOverlap(pl, platform)) continue;
      if (pl.vx > 0) pl.x = platform.x - pl.w;
      else if (pl.vx < 0) pl.x = platform.x + platform.w;
      pl.vx = 0;
    }

    pl.y += pl.vy * dt;
    for (const platform of state.platforms) {
      if (platform.type === 3) continue;
      if (platform.crumble && platform.cs !== "idle" && platform.cs !== "shake") continue;
      if (!rectsOverlap(pl, platform)) continue;
      if (pl.vy > 0) {
        pl.y = platform.y - pl.h;
        pl.vy = 0;
        pl.grounded = true;
        pl.standingPlatform = platform;
        if (platform.type === 4) {
          pl.vy = -1050;
          pl.grounded = false;
          pl.standingPlatform = null;
          platform.squash = 0.35;
          addParticle(pl.x + pl.w / 2, pl.y + pl.h, { count: 14, color: "#ffd76a", angle: Math.PI / 2, spread: 2, speed: 140, size: 5, gravity: 300, life: 0.45 });
          sfx.spring();
        }
        if (platform.crumble && platform.cs === "idle") {
          platform.cs = "shake";
          platform.ct = 0.55;
        }
      } else if (pl.vy < 0) {
        pl.y = platform.y + platform.h;
        pl.vy = 90;
      }
    }
  }

  function updatePlatforms(dt: number) {
    const pl = state.player;
    for (const p of state.platforms) {
      if (p.move) {
        p.mt += dt * p.move.speed;
        const prevX = p.x;
        const prevY = p.y;
        if (p.move.axis === "x") {
          const nx = p.baseX + Math.sin(p.mt) * p.move.amp;
          p.x = p.move.minX !== undefined ? clamp(nx, p.move.minX, p.move.maxX - p.w) : nx;
        } else {
          p.y = p.baseY + Math.sin(p.mt) * p.move.amp;
        }
        p.dx = p.x - prevX;
        p.dy = p.y - prevY;
        if (pl.standingPlatform === p) {
          pl.x += p.dx;
          pl.y += p.dy;
        }
      } else {
        p.dx = 0;
        p.dy = 0;
      }
      if (p.type === 4 && p.squash > 0) p.squash -= dt;
      if (p.crumble) {
        if (p.cs === "shake") {
          p.ct -= dt;
          if (p.ct <= 0) { p.cs = "fall"; p.ct = 0; }
        } else if (p.cs === "fall") {
          p.ct += dt;
          p.fallY = p.ct * 300;
          if (p.ct > 1.1) { p.cs = "gone"; p.respawn = 2.6; }
        } else if (p.cs === "gone") {
          p.respawn -= dt;
          if (p.respawn <= 0) { p.cs = "idle"; p.fallY = 0; }
        }
      }
    }
  }

  function updateEnemies(dt: number) {
    const pl = state.player;
    const list = state.boss && state.boss.active ? state.enemies.concat(state.boss.minions) : state.enemies;
    for (const e of list) {
      if (!e.alive) continue;
      e.t += dt;
      e.frame = Math.floor(e.t * 8) % 4;

      if (e.type === "bug" || e.type === "diver") {
        if (e.type === "diver") {
          if (e.diveT > 0) {
            e.diveT -= dt;
            e.x += e.vx * dt;
            e.y = e.baseY + Math.sin(e.t * 3) * 22;
          } else {
            const dx = (pl.x + pl.w / 2) - (e.x + e.w / 2);
            const dy = (pl.y + pl.h / 2) - (e.y + e.h / 2);
            const d = Math.hypot(dx, dy) || 1;
            e.x += (dx / d) * 340 * dt;
            e.y += (dy / d) * 430 * dt;
            if (e.y > e.baseY + 130 || e.y > 430) { e.diveT = 1.8 + Math.random() * 1.4; e.y = e.baseY; }
          }
        } else {
          e.x += e.vx * dt;
          e.y = e.baseY + Math.sin(e.t * 3.5) * 24;
        }
      } else if (e.type === "hopper") {
        e.hopT -= dt;
        if (e.grounded && e.hopT <= 0) { e.vy = -380; e.grounded = false; e.hopT = 1.0 + Math.random() * 0.7; }
        if (!e.grounded) {
          e.vy += GRAVITY * dt;
          e.y += e.vy * dt;
          if (e.y >= e.baseY) { e.y = e.baseY; e.vy = 0; e.grounded = true; }
        }
        e.x += e.vx * dt;
      } else if (e.type === "slime" || e.type === "splitter") {
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
      if (pl.invincible > 0 && scene === "playing") {
        if (e.type === "splitter") spawnMinis(e);
        killEnemy(e, 150);
        continue;
      }
      const plBottom = pl.y + pl.h;
      const enemyTop = e.y;
      const stomp = pl.vy > 80 && plBottom - enemyTop < 30 && pl.y < e.y;
      if (stomp && e.type !== "spike") {
        if (e.type === "splitter") spawnMinis(e);
        killEnemy(e, 150);
        pl.vy = -450;
        state.hitstop = 0.06;
        state.shake = Math.max(state.shake, 0.12);
      } else {
        hitPlayer(e);
      }
    }
  }

  function updateFireballs(dt: number) {
    const pl = state.player;
    for (const fb of state.fireballs) {
      if (!fb.alive) continue;
      fb.x += fb.vx * dt;
      fb.distance += Math.abs(fb.vx * dt);
      fb.frame += dt * 15;

      if (fb.distance > 820) { fb.alive = false; continue; }

      let hitWall = false;
      for (const platform of state.platforms) {
        if (platform.type === 3) continue;
        if (rectsOverlap(fb, platform)) { hitWall = true; break; }
      }
      if (hitWall) {
        fb.alive = false;
        addParticle(fb.x + 16, fb.y + 16, { count: 8, color: "#ff8c00", speed: 80, size: 5, life: 0.3 });
        continue;
      }

      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(fb, e)) {
          e.alive = false;
          const m = mult();
          const gained = 200 * m;
          state.score += gained;
          addNotice(m > 1 ? `x${m} +${gained}` : `+${gained}`, e.x + e.w / 2, e.y, "#ff8c00");
          addParticle(e.x + e.w / 2, e.y + e.h / 2, { count: 30, color: "#ff8c00", speed: 180, size: 6, life: 0.5 });
          if (fb.pierce > 0) { fb.pierce--; } else { fb.alive = false; }
          break;
        }
      }

      const b = state.boss;
      if (b && b.active && !b.dying && fb.alive && rectsOverlap(fb, b)) {
        fb.alive = false;
        b.hp -= 1;
        b.hurt = 0.2;
        state.score += 50;
        addNotice("+50", b.x + b.w / 2, b.y, "#ff8c00");
        if (b.hp <= 0) startBossDeath();
      }
    }
    state.fireballs = state.fireballs.filter((f: any) => f.alive);
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

  function updatePowerups(dt: number) {
    const pl = state.player;
    for (const pu of state.powerups) {
      if (pu.taken) continue;
      pu.bob += dt * 4;
      const hit = { x: pu.x, y: pu.y + Math.sin(pu.bob) * 6, w: pu.w, h: pu.h };
      if (!rectsOverlap(pl, hit)) continue;
      pu.taken = true;
      if (pu.kind === "mushroom") {
        state.lives = Math.min(5, state.lives + 1);
        addNotice("+1 UP", pu.x, pu.y, "#7dff6b");
        addParticle(pu.x + 22, pu.y + 22, { count: 18, color: "#7dff6b", speed: 140, size: 5, life: 0.5 });
        sfx.power();
      } else if (pu.kind === "star") {
        pl.invincible = 6;
        addNotice("INVINCIBLE!", pu.x, pu.y, "#9df5ff");
        addParticle(pu.x + 22, pu.y + 22, { count: 24, color: "#9df5ff", speed: 160, size: 5, life: 0.6 });
        sfx.starPower();
      } else {
        pl.firePower = true;
        addNotice("FIRE FLOWER!", pu.x, pu.y, "#ff8c3a");
        addParticle(pu.x + 22, pu.y + 22, { count: 18, color: "#ff8c3a", speed: 140, size: 5, life: 0.5 });
        sfx.power();
      }
    }
  }

  function updateHazards(dt: number) {
    if (state.currentLevel === 3) {
      const pl = state.player;
      for (const s of state.stalactites) {
        if (s.state === "idle") {
          s.timer -= dt;
          if (s.timer <= 0) { s.state = "shake"; s.ct = 0.65; }
        } else if (s.state === "shake") {
          s.ct -= dt;
          if (Math.random() < 0.2) addParticle(s.x, s.y + 70, { count: 2, color: "#bfefff", speed: 40, size: 3, life: 0.3 });
          if (s.ct <= 0) { s.state = "fall"; s.vy = 0; }
        } else if (s.state === "fall") {
          s.vy += GRAVITY * dt * 0.8;
          s.y += s.vy * dt;
          if (s.y + s.h >= s.groundY) {
            s.state = "gone";
            s.respawn = 4.5;
            state.shake = Math.max(state.shake, 0.1);
            addParticle(s.x, s.y + s.h, { count: 20, color: "#bfefff", speed: 170, size: 5, life: 0.5 });
            const hit = { x: s.x - 16, y: s.y, w: s.w + 32, h: s.h };
            if (rectsOverlap(pl, hit)) hitPlayer(s);
          }
        } else if (s.state === "gone") {
          s.respawn -= dt;
          if (s.respawn <= 0) { s.state = "idle"; s.y = s.anchorY; s.timer = 3 + Math.random() * 4; }
        }
      }
    }

    if (state.currentLevel === 4) {
      const w = state.wind;
      w.timer -= dt;
      if (w.gust > 0) {
        w.gust -= dt;
        if (w.gust <= 0) w.timer = 3.5 + Math.random() * 3;
      } else if (w.timer <= 0) {
        w.gust = 2.2;
        w.dir = Math.random() < 0.5 ? -1 : 1;
      }

      state.nextStrike -= dt;
      if (state.nextStrike <= 0 && scene === "playing") {
        const sx = clamp(state.cameraX + 140 + Math.random() * (VIEW_W - 280), 0, WORLD_W - 200);
        state.strikes.push({ x: sx, state: "telegraph", t: 0.8, hit: false });
        state.nextStrike = 5 + Math.random() * 4;
      }
      for (const st of state.strikes) {
        if (st.state === "telegraph") {
          st.t -= dt;
          if (st.t <= 0) {
            st.state = "bolt";
            st.t = 0.16;
            state.shake = 0.32;
            sfx.thunder();
          }
        } else if (st.state === "bolt") {
          st.t -= dt;
          if (!st.hit) {
            st.hit = true;
            const zone = { x: st.x - 45, y: 0, w: 90, h: 456 };
            if (rectsOverlap(state.player, zone)) hitPlayer(zone);
            addParticle(st.x, 456, { count: 14, color: "#fff8c4", speed: 200, size: 6, life: 0.4, gravity: 200 });
          }
          if (st.t <= 0) st.done = true;
        }
      }
      state.strikes = state.strikes.filter((st: any) => !st.done);
    }
  }

  function startBossDeath() {
    const b = state.boss;
    if (!b || b.dying > 0) return;
    b.dying = 1.6;
    b.state = "dead";
    b.minions.forEach((m: any) => { m.alive = false; });
    state.shake = 0.4;
    sfx.bossDie();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        addParticle(cx, cy, { count: 40, color: ["#ffb12b", "#ff6b3a", "#fff2a9"][i % 3], speed: 260, size: 7, life: 0.7 });
        addParticle(cx, cy, { count: 1, kind: "ring", color: "#ffd76a", size: 60, life: 0.5, speed: 0 });
      }, i * 220);
    }
  }

  function spawnBossMinion() {
    const b = state.boss;
    if (!b || b.dying > 0) return;
    const alive = b.minions.filter((m: any) => m.alive).length;
    if (alive >= 2) return;
    const m = enemy("roller", b.x + (Math.random() < 0.5 ? -80 : 80), 456, b.minX, b.maxX, 120);
    b.minions.push(m);
  }

  function updateBoss(dt: number) {
    const b = state.boss;
    if (!b) return;
    if (!b.active) {
      if (state.currentLevel === 4 && state.player.x > 4600) {
        b.active = true;
        musicTempo = 165;
        state.banner = { title: "KING ROLLER", sub: "Boss Battle!", timer: 1.6 };
        sfx.bossHurt();
      }
      return;
    }
    if (b.dying > 0) {
      b.dying -= dt;
      if (b.dying <= 0) {
        const r = computeRating();
        prog.stars[3] = Math.max(prog.stars[3] || 0, r);
        prog.unlocked = 4;
        prog.bestScore = Math.max(prog.bestScore || 0, state.score);
        saveProgress();
        scene = "win";
        sfx.win();
      }
      return;
    }
    if (b.hurt > 0) b.hurt -= dt;
    b.phase = b.hp > 20 ? 1 : b.hp > 10 ? 2 : 3;

    if (b.state === "idle" || b.state === "stunned") {
      b.y = 456 - b.h;
      b.vx = 0;
      b.t -= dt;
      if (b.state === "idle" && b.t <= 0) {
        const r = Math.random();
        const choices = b.phase === 1 ? [0.75, 0.25, 0] : b.phase === 2 ? [0.5, 0.3, 0.2] : [0.4, 0.3, 0.3];
        if (r < choices[0]) {
          b.state = "charge";
          b.t = 0.5;
          b.dir = state.player.x + state.player.w / 2 < b.x + b.w / 2 ? -1 : 1;
        } else if (r < choices[0] + choices[1]) {
          b.state = "summon";
          b.t = 0.6;
        } else {
          b.state = "slam";
          b.vy = -780;
        }
      }
    } else if (b.state === "charge") {
      if (b.t > 0) {
        b.t -= dt;
        if (Math.random() < 0.25) addParticle(b.x + b.w / 2, b.y + b.h, { count: 2, color: "#ffd76a", speed: 60, size: 4, life: 0.3 });
      } else {
        const spd = [420, 500, 560][b.phase - 1];
        b.vx = b.dir * spd;
        b.x += b.vx * dt;
        if (b.x < b.minX || b.x + b.w > b.maxX) {
          b.x = clamp(b.x, b.minX, b.maxX - b.w);
          b.vx = 0;
          b.state = "stunned";
          b.t = 0.8;
          state.shake = Math.max(state.shake, 0.2);
          addParticle(b.x + b.w / 2, b.y + b.h, { count: 18, color: "#ffd76a", speed: 170, size: 6, life: 0.5 });
        }
      }
    } else if (b.state === "summon") {
      b.t -= dt;
      if (b.t <= 0) {
        spawnBossMinion();
        b.state = "idle";
        b.t = 0.9 + Math.random() * 0.7;
      }
    } else if (b.state === "slam") {
      b.vy += GRAVITY * dt;
      b.y += b.vy * dt;
      if (b.y + b.h >= 456) {
        b.y = 456 - b.h;
        b.vy = 0;
        b.state = "idle";
        b.t = 0.9 + Math.random() * 0.7;
        state.shake = Math.max(state.shake, 0.35);
        addParticle(b.x + b.w / 2, b.y + b.h, { count: 30, color: "#ffb12b", speed: 200, size: 6, life: 0.6 });
        addParticle(b.x + b.w / 2, b.y + b.h, { count: 1, kind: "ring", color: "#ffd76a", size: 70, life: 0.5, speed: 0 });
      }
    }

    const pl = state.player;
    if (pl.invincible <= 0 && rectsOverlap(pl, b) && scene === "playing") {
      const plBottom = pl.y + pl.h;
      const bTop = b.y;
      const stomp = pl.vy > 80 && plBottom - bTop < 34 && pl.y < b.y;
      if (stomp) {
        b.hp -= 3;
        b.hurt = 0.3;
        pl.vy = -520;
        state.hitstop = 0.07;
        state.shake = Math.max(state.shake, 0.22);
        addNotice("-3", b.x + b.w / 2, b.y, "#ffb1c2");
        sfx.bossHurt();
        if (b.hp <= 0) startBossDeath();
      } else {
        hitPlayer(b);
      }
    }
  }

  function updateGoal(dt: number) {
    if (state.currentLevel === 4) return;
    state.portal.frame = (state.portal.frame + dt * 8) % 6;
    const goal = { x: state.portal.x + 14, y: state.portal.y + 10, w: 48, h: 96 };
    if (rectsOverlap(state.player, goal) && scene === "playing") {
      scene = "complete";
      state.score += Math.max(0, Math.floor(600 - state.time * 6));
      const r = computeRating();
      prog.stars[state.currentLevel - 1] = Math.max(prog.stars[state.currentLevel - 1] || 0, r);
      prog.unlocked = Math.max(prog.unlocked, Math.min(4, state.currentLevel + 1));
      prog.bestScore = Math.max(prog.bestScore || 0, state.score);
      saveProgress();
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

    chord = chord.map(f => f * musicRoot);
    bass *= musicRoot;

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
    const stepDuration = (60 / musicTempo) / 4;

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

    if (state.banner.timer > 0) state.banner.timer -= dt;

    if (state.hitstop > 0) {
      state.hitstop -= dt;
      updateParticles(dt);
      return;
    }

    if (scene === "playing") {
      state.time += dt;
      spawnAmbient(dt);
      updatePlatforms(dt);
      updatePlayer(dt);
      updateEnemies(dt);
      updateFireballs(dt);
      updateStars(dt);
      updatePowerups(dt);
      updateHazards(dt);
      updateBoss(dt);
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
    drawStalactites();
    drawStars();
    drawPowerups();
    drawEnemies();
    drawBoss();
    drawFireballs();
    drawPortal();
    drawPlayer();
    drawParticlesWorld();
    drawNoticesWorld();
    ctx.restore();
    drawAmbient();
    drawLightning();
    drawParticlesScreen();
    drawHud();
    drawBanner();
    drawSceneOverlay();

    ctx.restore();
  }

  function drawBackground() {
    if (!state.skyGrad) {
      state.skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      state.skyGrad.addColorStop(0, THEMES[state.currentLevel].sky);
      state.skyGrad.addColorStop(1, THEMES[state.currentLevel].skyLow);
    }
    ctx.fillStyle = state.skyGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const farOffset = -((state.cameraX * 0.12) % 2200);
    for (let x = farOffset - 2200; x < VIEW_W + 2200; x += 2200) {
      ctx.drawImage(images[state.farKey], x, 0, 2200, VIEW_H);
    }

    const nearOffset = -((state.cameraX * 0.3) % 2200);
    for (let x = nearOffset - 2200; x < VIEW_W + 2200; x += 2200) {
      ctx.drawImage(images[state.nearKey], x, 0, 2200, VIEW_H);
    }

    const isDark = state.currentLevel >= 3;
    ctx.globalAlpha = isDark ? 0.75 : 0.35;
    ctx.fillStyle = isDark ? "#b8e8ff" : "#ffffff";
    const dotCount = isDark ? 64 : 42;
    for (let i = 0; i < dotCount; i++) {
      const x = (i * 173 - state.cameraX * 0.08) % (VIEW_W + 200) - 100;
      const y = 24 + (i * 47) % 200;
      ctx.beginPath();
      ctx.arc(x, y, isDark ? 1.4 + (i % 3) * 0.6 : 1.2 + (i % 3), 0, Math.PI * 2);
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

      if (p.type === 4) {
        const f = p.squash > 0.2 ? 0 : p.squash > 0.08 ? 1 : 2;
        ctx.drawImage(images.spring, f * 64, 0, 64, 64, p.x - 4, p.y - 50, 72, 72);
        continue;
      }

      if (p.crumble && p.cs === "gone") continue;
      let drawY = p.y;
      let alpha = 1;
      if (p.crumble && p.cs === "shake") drawY = p.y + (Math.random() - 0.5) * 5;
      if (p.crumble && p.cs === "fall") { drawY = p.y + p.fallY; alpha = 0.7; }
      if (p.crumble && p.cs === "idle" && p.respawn === 0 && p.fallY > 0) { alpha = 0.5; }
      ctx.globalAlpha = alpha;

      const sx = tileFrame(p.type);
      const start = Math.floor(p.x / TILE) * TILE;
      for (let x = start; x < p.x + p.w; x += TILE) {
        const drawX = Math.max(x, p.x);
        const cropLeft = drawX - x;
        const cropW = Math.min(TILE - cropLeft, p.x + p.w - drawX);
        for (let y = drawY; y < drawY + p.h; y += TILE) {
          const cropH = Math.min(TILE, drawY + p.h - y);
          ctx.drawImage(images[state.tilesKey], sx + cropLeft, 0, cropW, cropH, drawX, y, cropW, cropH);
        }
      }
      ctx.globalAlpha = 1;

      if (p.type === 3) {
        const glow = 0.5 + Math.sin(frameTime * 6 + p.x) * 0.3;
        ctx.fillStyle = `rgba(255,140,58,${glow})`;
        ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 6);
      } else if (p.crumble && (p.cs === "shake" || p.cs === "idle")) {
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(p.x + 8, p.y + 4, Math.max(0, p.w - 16), 3);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(p.x + 8, p.y + 4, Math.max(0, p.w - 16), 3);
      }
    }
  }

  function drawStalactites() {
    for (const s of state.stalactites) {
      if (s.state === "gone") continue;
      if (s.x + 80 < state.cameraX || s.x - 80 > state.cameraX + VIEW_W) continue;
      const shakeX = s.state === "shake" ? (Math.random() - 0.5) * 6 : 0;
      const frame = s.state === "shake" ? 1 : 0;
      ctx.drawImage(images.stalactite, frame * 80, 0, 80, 100, s.x - 28 + shakeX, s.y, 56, 90);
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

  function drawPowerups() {
    const cols: any = { mushroom: 0, star: 1, flower: 2 };
    for (const pu of state.powerups) {
      if (pu.taken) continue;
      if (pu.x + 60 < state.cameraX || pu.x - 60 > state.cameraX + VIEW_W) continue;
      const y = pu.y + Math.sin(pu.bob) * 6;
      const pulse = 1 + Math.sin(pu.bob * 1.4) * 0.08;
      ctx.save();
      ctx.translate(pu.x + pu.w / 2, y + pu.h / 2);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = pu.kind === "star" ? "#ffe066" : pu.kind === "flower" ? "#ff8c3a" : "#ff6b6b";
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(images.powerups, cols[pu.kind] * 48, 0, 48, 48, -22, -22, 44, 44);
      ctx.restore();
    }
  }

  function drawEnemies() {
    const rowMap: Record<string, number> = { slime: 0, mushroom: 1, bug: 2, roller: 3, spike: 4, hopper: 5, diver: 6, splitter: 7 };
    const list = state.boss && state.boss.active ? state.enemies.concat(state.boss.minions) : state.enemies;
    for (const e of list) {
      if (!e.alive) continue;
      if (e.x + 80 < state.cameraX || e.x - 80 > state.cameraX + VIEW_W) continue;
      const row = rowMap[e.type] || 0;
      const frame = e.frame % 4;
      const scale = e.mini ? 0.65 : 1;
      const dw = 80 * scale;
      const dh = 80 * scale;
      ctx.save();
      const flip = e.vx < 0;
      if (flip) {
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, -dw / 2, -dh / 2, dw, dh);
      } else {
        ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, e.x + e.w / 2 - dw / 2, e.y + e.h / 2 - dh / 2, dw, dh);
      }
      ctx.restore();
    }
  }

  function drawBoss() {
    const b = state.boss;
    if (!b || !b.active) return;
    if (b.dying > 0 && Math.floor(frameTime * 12) % 2 === 0) return;
    if (b.x + 160 < state.cameraX || b.x - 160 > state.cameraX + VIEW_W) return;
    const row = b.phase >= 3 || b.hurt > 0 ? 1 : 0;
    const frame = b.state === "stunned" ? 2 : Math.floor(frameTime * 10) % 4;
    ctx.save();
    if (b.hurt > 0) ctx.globalAlpha = 0.55;
    ctx.drawImage(images.boss, frame * 128, row * 128, 128, 128, b.x - 10, b.y - 10, 160, 160);
    ctx.restore();
    if (b.state === "charge" && b.t > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(frameTime * 20) * 0.2;
      ctx.fillStyle = "#ffd76a";
      ctx.font = "900 14px ui-rounded, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("!", b.x + b.w / 2, b.y - 16);
      ctx.globalAlpha = 1;
    }
  }

  function drawFireballs() {
    for (const fb of state.fireballs) {
      if (!fb.alive) continue;
      const frame = Math.floor(fb.frame) % 4;
      const size = fb.w || 32;
      ctx.save();
      ctx.translate(fb.x + fb.w / 2, fb.y + fb.h / 2);
      if (fb.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(images.fireball, frame * 64, 0, 64, 64, -size, -size, size * 2, size * 2);
      ctx.restore();
    }
  }

  function drawPortal() {
    if (state.currentLevel === 4) return;
    const f = Math.floor(state.portal.frame) % 6;
    ctx.drawImage(images.portal, f * 96, 0, 96, 128, state.portal.x - 10, state.portal.y - 8, 96, 128);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "800 18px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Finish", state.portal.x + 38, state.portal.y - 14);
  }

  function drawLightning() {
    for (const st of state.strikes) {
      if (st.state === "telegraph") {
        const grow = 1 - st.t / 0.8;
        ctx.fillStyle = "rgba(255,240,180,0.25)";
        ctx.beginPath();
        ctx.arc(st.x, 456, 18 + grow * 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(st.x, 456, 8 + grow * 26, 0, Math.PI * 2);
        ctx.fill();
      } else if (st.state === "bolt") {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.drawImage(images.lightning, 0, 0, 120, 260, st.x - 60, -20, 120, 560);
      }
    }
  }

  function drawAmbient() {
    const par = 0.06;
    for (const a of state.ambient) {
      const sx = a.x - state.cameraX * par;
      if (sx < -60 || sx > VIEW_W + 60) continue;
      if (a.kind === "rain") {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, a.y);
        ctx.lineTo(sx - 4, a.y + 12);
        ctx.stroke();
      } else if (a.kind === "petal") {
        ctx.globalAlpha = clamp(a.life / 10, 0, 1) * 0.8;
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.ellipse(sx, a.y, a.size, a.size * 0.55, a.phase, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (a.kind === "ember") {
        const tw = 0.6 + Math.sin(a.t * 9 + a.phase) * 0.4;
        ctx.globalAlpha = clamp(a.life / 4.5, 0, 1) * tw;
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(sx, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = clamp(a.life / 12, 0, 1) * 0.85;
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(sx, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (state.wind.gust > 0 && state.currentLevel === 4) {
      const dir = state.wind.dir;
      ctx.strokeStyle = "rgba(220,235,255,0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const x = ((i * 173 + frameTime * 640 * dir) % (VIEW_W + 240)) - 120;
        const y = 40 + (i * 61) % (VIEW_H - 100);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 26 * dir, y + 3);
        ctx.stroke();
      }
    }
  }

  function playerSprite() {
    const pl = state.player;
    const facingLeft = pl.facing < 0;

    if (pl.state === "run") {
      return { row: facingLeft ? 2 : 1, frame: Math.floor(pl.anim) % 8, flip: false };
    }
    if (pl.state === "hurt") return { row: 5, frame: Math.floor(pl.anim) % 8, flip: facingLeft };
    if (pl.state === "victory") return { row: 3, frame: Math.floor(pl.anim) % 4, flip: facingLeft };
    if (pl.state === "throw" || pl.state === "crouch_throw") return { row: 7, frame: Math.floor(pl.anim) % 6, flip: facingLeft };
    if (pl.state === "crouch") return { row: 6, frame: Math.floor(pl.anim) % 6, flip: facingLeft };
    if (pl.state === "jump") return { row: 4, frame: Math.min(4, Math.floor(pl.anim) % 5), flip: facingLeft };
    if (pl.state === "fall") return { row: 4, frame: Math.max(2, Math.floor(pl.anim) % 5), flip: facingLeft };
    if (pl.state === "landing") return { row: 4, frame: 4, flip: facingLeft };
    if (pl.state === "review") return { row: 8, frame: Math.floor(pl.anim) % 6, flip: facingLeft };
    if (pl.state === "waiting") return { row: 6, frame: Math.floor(pl.anim) % 6, flip: facingLeft };
    return { row: 0, frame: Math.floor(pl.anim) % 6, flip: facingLeft };
  }

  function drawPlayer() {
    const pl = state.player;
    const sprite = playerSprite();
    const crouching = pl.state === "crouch" || pl.state === "crouch_throw";
    const drawW = crouching ? 92 : 96;
    const drawH = crouching ? 86 : 104;
    const x = pl.x + pl.w / 2 - drawW / 2;
    const y = pl.y + pl.h - drawH + (crouching ? 18 : 8);
    const flashing = pl.invuln > 0 && Math.floor(frameTime * 18) % 2 === 0;
    ctx.save();
    if (pl.invincible > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#9df5ff";
      ctx.beginPath();
      ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, 52 + Math.sin(frameTime * 8) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (flashing) ctx.globalAlpha = 0.52;
    if (sprite.flip) {
      ctx.translate(pl.x + pl.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(images.ethan, sprite.frame * 192, sprite.row * 208, 192, 208, -drawW / 2, y, drawW, drawH);
    } else {
      ctx.drawImage(images.ethan, sprite.frame * 192, sprite.row * 208, 192, 208, x, y, drawW, drawH);
    }
    ctx.restore();
  }

  function drawParticlesWorld() {
    for (const p of state.particles) {
      if (p.kind === "screen") continue;
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = t;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2.2 - t * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
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
    const hearts = Math.max(3, state.lives);
    for (let i = 0; i < hearts; i++) drawHeart(48 + i * 34, 58, i < state.lives);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, 30, 82, 340, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#facc15";
    roundRect(ctx, 30, 82, 340 * clamp(state.cameraX / (WORLD_W - VIEW_W), 0, 1), 8, 4);
    ctx.fill();

    ctx.fillStyle = "rgba(35,24,64,0.36)";
    roundRect(ctx, VIEW_W - 220, 16, 202, 54, 18);
    ctx.fill();
    ctx.fillStyle = "#fff2a9";
    ctx.font = "900 18px ui-rounded, system-ui";
    ctx.textAlign = "right";
    ctx.fillText(`Lv ${state.currentLevel} · ${state.levelName}`, VIEW_W - 24, 39);
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px ui-rounded, system-ui";
    ctx.fillText(`Time ${Math.floor(state.time)}s`, VIEW_W - 24, 60);

    const pl = state.player;
    if (pl && pl.comboTimer > 0 && pl.stompStreak >= 2) {
      const m = mult();
      const pulse = 1 + Math.sin(frameTime * 10) * 0.12;
      ctx.save();
      ctx.translate(VIEW_W / 2, 96);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "#fff2a9";
      ctx.font = "1000 26px ui-rounded, system-ui";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(42,17,54,0.6)";
      ctx.strokeText(`COMBO x${m}`, 0, 0);
      ctx.fillText(`COMBO x${m}`, 0, 0);
      ctx.restore();
    }

    const b = state.boss;
    if (b && b.active && !b.dying) {
      const bw = 300;
      ctx.fillStyle = "rgba(35,24,64,0.5)";
      roundRect(ctx, VIEW_W / 2 - bw / 2, 14, bw, 20, 10);
      ctx.fill();
      const pct = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = "#ff4269";
      roundRect(ctx, VIEW_W / 2 - bw / 2 + 2, 16, (bw - 4) * pct, 16, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "900 13px ui-rounded, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("KING ROLLER", VIEW_W / 2, 46);
    }

    if (mutedBecauseNoGesture && scene !== "loading") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 12px ui-rounded, system-ui";
      ctx.fillText("Press any key to enable sound", VIEW_W / 2, 25);
    }
    ctx.restore();
  }

  function drawBanner() {
    if (state.banner.timer <= 0) return;
    const t = state.banner.timer;
    const alpha = clamp(Math.min(t / 0.4, (1.8 - t) / 0.25), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(18,9,42,0.55)";
    roundRect(ctx, VIEW_W / 2 - 260, 128, 520, 130, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    roundRect(ctx, VIEW_W / 2 - 260, 128, 520, 130, 26);
    ctx.stroke();
    ctx.fillStyle = "#fff2a9";
    ctx.font = "1000 40px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.banner.title, VIEW_W / 2, 190);
    ctx.fillStyle = "#9df5ff";
    ctx.font = "800 20px ui-rounded, system-ui";
    ctx.fillText(state.banner.sub, VIEW_W / 2, 228);
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
      titleText("Ethan the Jumper", "Four worlds of platforming — collect stars, stomp enemies, beat the King Roller.", "← → select level · Enter to start");
      drawLevelSelect();
      drawMiniControls();
    } else if (scene === "gameover") {
      titleText("Game Over", `Final score: ${state.score}. Ethan took a rough landing.`, "Press Enter to try again");
    } else if (scene === "complete") {
      const r = computeRating();
      const starsText = "★".repeat(r) + "☆".repeat(3 - r);
      if (state.currentLevel < 4) {
        titleText(
          `Level ${state.currentLevel} Complete!`,
          `Score ${state.score} · Stars ${state.stars}/${state.starsList.length} · Time ${Math.floor(state.time)}s`,
          `Press Enter for Level ${state.currentLevel + 1}`
        );
        ctx.fillStyle = "#ffd76a";
        ctx.font = "900 30px ui-rounded, system-ui";
        ctx.fillText(starsText, VIEW_W / 2, 430);
      } else {
        titleText(
          "Level 4 Complete!",
          `Score ${state.score} · Stars ${state.stars}/${state.starsList.length} · Time ${Math.floor(state.time)}s`,
          "Press Enter to see your final score"
        );
        ctx.fillStyle = "#ffd76a";
        ctx.font = "900 30px ui-rounded, system-ui";
        ctx.fillText(starsText, VIEW_W / 2, 430);
      }
    } else if (scene === "win") {
      titleText(
        "You Win!",
        `The King Roller has been defeated! Final Score: ${state.score}`,
        "Press Enter to play again"
      );
      ctx.fillStyle = "#ffd76a";
      ctx.font = "900 22px ui-rounded, system-ui";
      const lines = [1, 2, 3, 4].map(i => {
        const s = prog.stars[i - 1] || 0;
        return `L${i} ${"★".repeat(s)}${"☆".repeat(3 - s)}`;
      });
      ctx.fillText(lines.join("   "), VIEW_W / 2, 428);
      ctx.fillStyle = "#fff";
      ctx.font = "700 16px ui-rounded, system-ui";
      ctx.fillText(`Best score: ${prog.bestScore || 0}`, VIEW_W / 2, 455);
    }

    ctx.restore();
  }

  function drawLevelSelect() {
    const unlocked = prog.unlocked || 1;
    for (let i = 0; i < 4; i++) {
      const cx = 210 + i * 150;
      const isUnlocked = i + 1 <= unlocked;
      const isSelected = state.selectLevel === i + 1;
      ctx.fillStyle = isSelected ? "rgba(157,245,255,0.28)" : "rgba(255,255,255,0.08)";
      roundRect(ctx, cx - 64, 208, 128, 130, 18);
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeStyle = isSelected ? "#9df5ff" : "rgba(255,255,255,0.18)";
      roundRect(ctx, cx - 64, 208, 128, 130, 18);
      ctx.stroke();
      ctx.fillStyle = isUnlocked ? "#fff2a9" : "rgba(255,255,255,0.4)";
      ctx.font = "900 20px ui-rounded, system-ui";
      ctx.fillText(`L${i + 1}`, cx, 242);
      ctx.fillStyle = isUnlocked ? "#fff" : "rgba(255,255,255,0.4)";
      ctx.font = "700 15px ui-rounded, system-ui";
      const names = ["Rainbow Grove", "Sunset Cliffs", "Crystal Caves", "Storm Summit"];
      ctx.fillText(names[i], cx, 266);
      if (isUnlocked) {
        const s = prog.stars[i] || 0;
        ctx.fillStyle = "#ffd76a";
        ctx.font = "900 18px ui-rounded, system-ui";
        ctx.fillText("★".repeat(s) + "☆".repeat(3 - s), cx, 298);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "800 15px ui-rounded, system-ui";
        ctx.fillText("LOCKED", cx, 298);
      }
    }
  }

  function titleText(title: string, subtitle: string, prompt: string) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, 120, 100, 720, 300, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, 120, 100, 720, 300, 34);
    ctx.stroke();

    ctx.fillStyle = "#fff2a9";
    ctx.font = "1000 52px ui-rounded, system-ui";
    ctx.fillText(title, VIEW_W / 2, 165);
    ctx.fillStyle = "#fff";
    ctx.font = "700 19px ui-rounded, system-ui";
    wrapText(subtitle, VIEW_W / 2, 215, 560, 28);
    ctx.fillStyle = "#9df5ff";
    ctx.font = "900 22px ui-rounded, system-ui";
    ctx.fillText(prompt, VIEW_W / 2, 360);
  }

  function drawMiniControls() {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 15px ui-rounded, system-ui";
    ctx.fillText("Move: A/D or arrows · Jump: Space/W/Up · Crouch: S/Down", VIEW_W / 2, 385);
    ctx.fillText("Fireball: F/J · Restart: R", VIEW_W / 2, 407);
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
    if (scene === "title") {
      const maxSel = Math.max(1, prog.unlocked || 1);
      if (k === "arrowleft" || k === "a") state.selectLevel = clamp(state.selectLevel - 1, 1, maxSel);
      if (k === "arrowright" || k === "d") state.selectLevel = clamp(state.selectLevel + 1, 1, maxSel);
    }
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

  function bindMobileButton(btn: HTMLElement | null, prop: "left" | "right" | "jump" | "crouch") {
    if (!btn) return;
    const down = (e: Event) => {
      e.preventDefault();
      initAudio();
      mobileState[prop] = true;
      if (prop === "jump" && !keys.jump) keys.jumpPressed = true;
      if (scene === "title" || scene === "gameover" || scene === "complete" || scene === "win") startGame();
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
    };
  }

  function syncMobile() {
    keys.left = keys.left || mobileState.left;
    keys.right = keys.right || mobileState.right;
    keys.jump = keys.jump || mobileState.jump;
    keys.crouch = keys.crouch || mobileState.crouch;
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
  const cleanupCrouch = bindMobileButton(btnCrouch, "crouch");
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

  if (import.meta.env.DEV) {
    (window as any).__ethan = { state, resetGame, nextLevel };
  }

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("pointerdown", onPointerDownAudio);
    cleanupLeft && cleanupLeft();
    cleanupRight && cleanupRight();
    cleanupCrouch && cleanupCrouch();
    cleanupJump && cleanupJump();
  };

}