from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Patch target not found: {label}")
    if text.count(old) != 1:
        raise RuntimeError(f"Patch target not unique ({text.count(old)}): {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, new_block: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"Start marker not found: {label}")
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f"End marker not found: {label}")
    return text[:a] + new_block.rstrip() + "\n\n" + text[b:]


game_path = Path("src/game.ts")
app_path = Path("src/App.tsx")
css_path = Path("src/index.css")
readme_path = Path("README.md")

game = game_path.read_text(encoding="utf-8")

# Constants and controls.
game = replace_once(
    game,
    "  const JUMP_BUFFER = 0.15;\n",
    "  const JUMP_BUFFER = 0.15;\n  const FULL_HEARTS = 3;\n  const MAX_HEARTS = 5;\n",
    "heart constants",
)

game = replace_once(
    game,
    "  btnCrouch: HTMLElement | null,\n  btnJump: HTMLElement | null\n) {",
    "  btnCrouch: HTMLElement | null,\n  btnJump: HTMLElement | null,\n  btnFire: HTMLElement | null\n) {",
    "initGame fire button parameter",
)

game = replace_once(
    game,
    "  const mobileState = { left: false, right: false, jump: false, crouch: false, fireball: false };",
    "  const mobileState = { left: false, right: false, jump: false, crouch: false, fireball: false };",
    "mobile state present",
)

# Checkpoint and guardian state.
game = replace_once(
    game,
    "    boss: null,\n    banner: { title: \"\", sub: \"\", timer: 0 },\n    selectLevel: 1,",
    "    boss: null,\n    guardian: null,\n    banner: { title: \"\", sub: \"\", timer: 0 },\n    selectLevel: 1,\n    checkpointLevel: 1,\n    checkpointScore: 0,",
    "checkpoint state",
)

# Theme gradient must be rebuilt when worlds change.
game = replace_once(
    game,
    "    musicTempo = t.tempo;\n    musicRoot = t.root;\n  }",
    "    musicTempo = t.tempo;\n    musicRoot = t.root;\n    state.skyGrad = null;\n  }",
    "theme gradient reset",
)

# Add world guardians and make each pre-final world end with a boss encounter.
old_make_level = """  function makeLevel() {
    if (state.currentLevel === 1) makeLevel1();
    else if (state.currentLevel === 2) makeLevel2();
    else if (state.currentLevel === 3) makeLevel3();
    else makeLevel4();
    applyTheme(state.currentLevel);
  }
"""
new_make_level = """  function makeGuardian(level: number) {
    const defs: any = {
      1: { name: \"GROVE GOLIATH\", spriteType: \"slime\", hp: 6, w: 146, h: 112, speed: 118, color: \"#7dff6b\", style: \"bouncer\" },
      2: { name: \"EMBER CRUSHER\", spriteType: \"roller\", hp: 8, w: 142, h: 142, speed: 190, color: \"#ff9d3c\", style: \"charger\" },
      3: { name: \"CRYSTAL TITAN\", spriteType: \"splitter\", hp: 10, w: 156, h: 122, speed: 145, color: \"#9df5ff\", style: \"titan\" }
    };
    const d = defs[level];
    if (!d) return null;
    return {
      ...d,
      active: false,
      alive: true,
      x: level === 2 ? 4760 : 4860,
      y: 456 - d.h,
      groundY: 456,
      minX: level === 2 ? 4680 : 4760,
      maxX: level === 2 ? 5010 : 5110,
      vx: d.speed,
      vy: 0,
      hopT: 0.9,
      chargeT: 1.3,
      hurt: 0,
      maxHp: d.hp,
      phase: 1
    };
  }

  function makeLevel() {
    if (state.currentLevel === 1) makeLevel1();
    else if (state.currentLevel === 2) makeLevel2();
    else if (state.currentLevel === 3) makeLevel3();
    else makeLevel4();
    applyTheme(state.currentLevel);
    state.guardian = state.currentLevel < 4 ? makeGuardian(state.currentLevel) : null;
  }
"""
game = replace_once(game, old_make_level, new_make_level, "guardian level setup")

# Restart logic now uses a level checkpoint plus a score checkpoint.
reset_block = """  function resetGame(startScene = \"title\") {
    if (startScene === \"title\") {
      state.selectLevel = 1;
      state.checkpointLevel = 1;
      state.checkpointScore = 0;
    } else if (scene === \"title\") {
      state.checkpointLevel = state.selectLevel;
      state.checkpointScore = 0;
    }

    state.currentLevel = startScene === \"playing\" ? state.checkpointLevel : state.selectLevel;
    state.selectLevel = state.currentLevel;
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.score = startScene === \"playing\" ? state.checkpointScore : 0;
    state.stars = 0;
    state.time = 0;
    state.lives = FULL_HEARTS;
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
    state.guardian = null;
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
      superTimer: 0,
      starRush: 0,
      hurtTimer: 0,
      state: \"idle\",
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
    state.banner = {
      title: `LEVEL ${state.currentLevel}`,
      sub: startScene === \"playing\" && state.checkpointLevel > 1 ? `${state.levelName} · Checkpoint` : state.levelName,
      timer: 1.8
    };
    scene = startScene;
  }
"""
game = replace_between(game, "  function resetGame(startScene = \"title\") {", "  function nextLevel() {", reset_block, "resetGame")

next_level_block = """  function nextLevel() {
    if (state.currentLevel >= 4) {
      scene = \"win\";
      sfx.win();
      return;
    }

    state.checkpointScore = state.score;
    state.currentLevel++;
    state.selectLevel = state.currentLevel;
    state.checkpointLevel = state.currentLevel;
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.time = 0;
    state.stars = 0;
    state.lives = FULL_HEARTS;
    state.particles = [];
    state.notices = [];
    state.shake = 0;
    state.hitstop = 0;
    state.portal.frame = 0;
    state.ambient = [];
    state.ambT = 0;
    state.wind = { timer: 4, gust: 0, dir: 1 };
    state.nextStrike = 5;
    const pl = state.player;
    pl.x = playerSpawn.x;
    pl.y = playerSpawn.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.grounded = false;
    pl.crouching = false;
    pl.h = 70;
    pl.state = \"idle\";
    pl.dead = false;
    pl.invuln = 1.5;
    pl.hurtTimer = 0;
    pl.fireballTimer = 0;
    pl.throwTimer = 0;
    pl.invincible = 0;
    pl.firePower = false;
    pl.superTimer = 0;
    pl.starRush = 0;
    pl.stompStreak = 0;
    pl.comboTimer = 0;
    state.fireballs = [];
    state.boss = null;
    state.guardian = null;
    makeLevel();
    state.banner = { title: `LEVEL ${state.currentLevel}`, sub: `${state.levelName} · CHECKPOINT SAVED`, timer: 2.2 };
    scene = \"playing\";
    sfx.levelUp();
  }
"""
game = replace_between(game, "  function nextLevel() {", "  function addParticle(", next_level_block, "nextLevel")

start_game_block = """  function startGame() {
    if (scene === \"title\") {
      state.checkpointLevel = state.selectLevel;
      state.checkpointScore = 0;
      resetGame(\"playing\");
    } else if (scene === \"gameover\") {
      resetGame(\"playing\");
    } else if (scene === \"complete\") {
      nextLevel();
    } else if (scene === \"win\") {
      resetGame(\"title\");
    }
  }
"""
game = replace_between(game, "  function startGame() {", "  function mult() {", start_game_block, "startGame")

# Mushroom shield and stronger damage feedback.
hit_block = """  function hitPlayer(source: any) {
    const pl = state.player;
    if (pl.invuln > 0 || pl.dead || scene !== \"playing\" || pl.invincible > 0) return;

    if (pl.superTimer > 0) {
      pl.superTimer = 0;
      pl.invuln = 1.5;
      pl.hurtTimer = 0.22;
      pl.vx = source && center(source).x < center(pl).x ? 240 : -240;
      pl.vy = -320;
      state.shake = 0.13;
      addParticle(pl.x + pl.w * 0.5, pl.y + pl.h * 0.45, { count: 28, color: \"#7dff6b\", speed: 180, size: 6, life: 0.58 });
      addNotice(\"SUPER SHIELD!\", pl.x + pl.w / 2, pl.y - 16, \"#7dff6b\");
      sfx.power();
      return;
    }

    state.lives -= 1;
    pl.firePower = false;
    pl.invuln = 1.25;
    pl.hurtTimer = 0.45;
    pl.vx = source && center(source).x < center(pl).x ? 280 : -280;
    pl.vy = -380;
    state.shake = 0.18;
    addParticle(pl.x + pl.w * 0.5, pl.y + pl.h * 0.45, { count: 18, color: \"#ff7088\", speed: 130, size: 5, life: 0.48 });
    addNotice(\"-1 heart\", pl.x, pl.y - 12, \"#ffb1c2\");
    sfx.hurt();
    if (state.lives <= 0) {
      pl.dead = true;
      setTimeout(() => { if (scene === \"playing\") scene = \"gameover\"; }, 450);
    }
  }
"""
game = replace_between(game, "  function hitPlayer(source: any) {", "  function jump() {", hit_block, "hitPlayer")

game = replace_once(
    game,
    "    pl.vy = JUMP_V;",
    "    const jumpBoost = pl.superTimer > 0 ? 1.09 : pl.starRush > 0 ? 1.04 : 1;\n    pl.vy = JUMP_V * jumpBoost;",
    "jump boost",
)

# Timers, speed buffs, and Flower-gated fireballs.
game = replace_once(
    game,
    "    if (pl.invincible > 0) pl.invincible -= dt;\n    if (pl.hurtTimer > 0) pl.hurtTimer -= dt;",
    "    if (pl.invincible > 0) pl.invincible -= dt;\n    if (pl.superTimer > 0) pl.superTimer -= dt;\n    if (pl.starRush > 0) pl.starRush -= dt;\n    if (pl.hurtTimer > 0) pl.hurtTimer -= dt;",
    "power timers",
)

game = replace_once(
    game,
    "    if (onIce) {\n      currentAccel *= 1.15;\n      currentMaxSpeed *= 1.18;\n    }",
    "    if (onIce) {\n      currentAccel *= 1.15;\n      currentMaxSpeed *= 1.18;\n    }\n    if (pl.superTimer > 0) {\n      currentAccel *= 1.12;\n      currentMaxSpeed *= 1.16;\n    }\n    if (pl.starRush > 0) {\n      currentAccel *= 1.18;\n      currentMaxSpeed *= 1.2;\n    }\n    if (pl.invincible > 0) {\n      currentAccel *= 1.25;\n      currentMaxSpeed *= 1.35;\n    }",
    "speed powerups",
)

game = replace_once(
    game,
    "    if (keys.fireball && pl.fireballTimer <= 0 && !pl.dead && scene === \"playing\") {\n      pl.fireballTimer = 0.4;",
    "    if (keys.fireball && pl.firePower && pl.fireballTimer <= 0 && !pl.dead && scene === \"playing\") {\n      pl.fireballTimer = 0.24;",
    "flower-gated fireball",
)

# Make the Flower projectile feel substantially upgraded.
game = replace_once(
    game,
    "      x, y, w: upgraded ? 44 : 32, h: upgraded ? 44 : 32,\n      vx: pl.facing * (upgraded ? 760 : 600),\n      facing: pl.facing, alive: true, distance: 0, frame: 0,\n      pierce: upgraded ? 2 : 0",
    "      x, y, w: upgraded ? 48 : 32, h: upgraded ? 48 : 32,\n      vx: pl.facing * (upgraded ? 820 : 600),\n      facing: pl.facing, alive: true, distance: 0, frame: 0,\n      pierce: upgraded ? 3 : 0",
    "fireball upgrade",
)

# Normal collectible stars now create periodic Star Rush rewards.
star_block = """  function updateStars(dt: number) {
    const pl = state.player;
    for (const star of state.starsList) {
      if (star.collected) continue;
      star.bob += dt * 5;
      const hit = { x: star.x, y: star.y + Math.sin(star.bob) * 5, w: star.w, h: star.h };
      if (!rectsOverlap(pl, hit)) continue;
      star.collected = true;
      state.score += 25;
      state.stars += 1;
      addNotice(\"+25\", star.x, star.y, \"#fff2a9\");
      addParticle(star.x + 17, star.y + 17, { count: 16, color: \"#fff2a9\", speed: 145, size: 4.5, life: 0.45 });
      sfx.star();

      if (state.stars % 10 === 0) {
        state.lives = Math.min(MAX_HEARTS, state.lives + 1);
        pl.starRush = Math.max(pl.starRush, 4.5);
        state.score += 250;
        state.banner = { title: \"10 STAR RUSH!\", sub: \"Heart restored · Speed boost · +250\", timer: 1.8 };
        addParticle(pl.x + pl.w / 2, pl.y + pl.h / 2, { count: 34, color: \"#ffd76a\", speed: 210, size: 6, life: 0.7 });
        sfx.levelUp();
      }
    }
  }
"""
game = replace_between(game, "  function updateStars(dt: number) {", "  function updatePowerups(dt: number) {", star_block, "updateStars")

power_block = """  function updatePowerups(dt: number) {
    const pl = state.player;
    for (const pu of state.powerups) {
      if (pu.taken) continue;
      pu.bob += dt * 4;
      const hit = { x: pu.x, y: pu.y + Math.sin(pu.bob) * 6, w: pu.w, h: pu.h };
      if (!rectsOverlap(pl, hit)) continue;
      pu.taken = true;

      if (pu.kind === \"mushroom\") {
        state.lives = Math.min(MAX_HEARTS, state.lives + 1);
        pl.superTimer = 12;
        state.score += 300;
        state.banner = { title: \"SUPER ETHAN!\", sub: \"Shield · Jump boost · Speed boost · +1 heart\", timer: 2.0 };
        addNotice(\"SUPER MODE!\", pu.x, pu.y, \"#7dff6b\");
        addParticle(pu.x + 22, pu.y + 22, { count: 32, color: \"#7dff6b\", speed: 190, size: 6, life: 0.7 });
        sfx.power();
      } else if (pu.kind === \"star\") {
        pl.invincible = 8;
        state.score += 400;
        state.banner = { title: \"STAR POWER!\", sub: \"Invincible · Turbo speed · Touch enemies to smash them\", timer: 2.0 };
        addNotice(\"INVINCIBLE 8s!\", pu.x, pu.y, \"#9df5ff\");
        addParticle(pu.x + 22, pu.y + 22, { count: 42, color: \"#9df5ff\", speed: 220, size: 6, life: 0.8 });
        sfx.starPower();
      } else {
        pl.firePower = true;
        state.score += 350;
        state.banner = { title: \"FIRE FLOWER!\", sub: \"Rapid piercing fireballs unlocked · F / J / FIRE\", timer: 2.0 };
        addNotice(\"FIRE POWER!\", pu.x, pu.y, \"#ff8c3a\");
        addParticle(pu.x + 22, pu.y + 22, { count: 34, color: \"#ff8c3a\", speed: 200, size: 6, life: 0.7 });
        sfx.power();
      }
    }
  }
"""
game = replace_between(game, "  function updatePowerups(dt: number) {", "  function updateHazards(dt: number) {", power_block, "updatePowerups")

# Guardian boss combat.
guardian_code = """  function damageGuardian(amount: number, x: number, y: number) {
    const g = state.guardian;
    if (!g || !g.active || !g.alive || g.hurt > 0) return;
    g.hp -= amount;
    g.hurt = 0.2;
    state.hitstop = 0.06;
    state.shake = Math.max(state.shake, 0.2);
    addNotice(`-${amount}`, x, y, g.color);
    addParticle(x, y, { count: 26, color: g.color, speed: 190, size: 6, life: 0.6 });
    sfx.bossHurt();

    if (g.hp <= 0) {
      g.alive = false;
      state.score += 1200 + state.currentLevel * 300;
      state.shake = 0.45;
      state.banner = { title: `${g.name} DEFEATED!`, sub: \"Portal unlocked · Boss bonus awarded\", timer: 2.4 };
      addParticle(g.x + g.w / 2, g.y + g.h / 2, { count: 80, color: g.color, speed: 280, size: 8, life: 1.0 });
      addParticle(g.x + g.w / 2, g.y + g.h / 2, { count: 1, kind: \"ring\", color: \"#fff2a9\", size: 85, life: 0.8, speed: 0 });
      sfx.bossDie();
    }
  }

  function updateGuardian(dt: number) {
    const g = state.guardian;
    if (!g || !g.alive || state.currentLevel >= 4) return;
    const pl = state.player;

    if (!g.active) {
      if (pl.x > 4480) {
        g.active = true;
        state.enemies.forEach((e: any) => { if (e.x > 4520) e.alive = false; });
        state.banner = { title: g.name, sub: `WORLD ${state.currentLevel} BOSS · ${g.maxHp} HP`, timer: 2.2 };
        state.shake = 0.22;
        sfx.bossHurt();
      }
      return;
    }

    if (g.hurt > 0) g.hurt -= dt;
    g.phase = g.hp <= Math.ceil(g.maxHp / 2) ? 2 : 1;
    const rage = g.phase === 2 ? 1.3 : 1;

    if (g.style === \"bouncer\" || g.style === \"titan\") {
      g.hopT -= dt;
      if (g.y + g.h >= g.groundY - 1 && g.hopT <= 0) {
        g.vy = g.style === \"titan\" ? -610 : -520;
        g.hopT = g.style === \"titan\" ? 1.05 : 1.3;
      }
      g.vy += GRAVITY * dt;
      g.y += g.vy * dt;
      if (g.y + g.h >= g.groundY) {
        if (g.vy > 500 && g.style === \"titan\") {
          state.shake = Math.max(state.shake, 0.25);
          addParticle(g.x + g.w / 2, g.groundY, { count: 22, color: g.color, speed: 180, size: 6, life: 0.55 });
        }
        g.y = g.groundY - g.h;
        g.vy = 0;
      }
    } else {
      g.y = g.groundY - g.h;
      g.chargeT -= dt;
      if (g.chargeT <= 0) {
        g.vx = Math.sign(g.vx || 1) * g.speed * 2.15;
        g.chargeT = 1.4;
        addParticle(g.x + g.w / 2, g.y + g.h, { count: 12, color: g.color, speed: 110, size: 5, life: 0.4 });
      }
    }

    const targetSpeed = g.speed * rage;
    if (Math.abs(g.vx) > targetSpeed * 1.25) g.vx *= Math.pow(0.2, dt);
    else g.vx = Math.sign(g.vx || 1) * targetSpeed;
    g.x += g.vx * dt;
    if (g.x < g.minX || g.x + g.w > g.maxX) {
      g.x = clamp(g.x, g.minX, g.maxX - g.w);
      g.vx *= -1;
    }

    if (!rectsOverlap(pl, g)) return;
    if (pl.invincible > 0) {
      damageGuardian(2, g.x + g.w / 2, g.y + 20);
      pl.vx = -Math.sign(g.vx || 1) * 250;
      return;
    }

    const stomp = pl.vy > 90 && pl.y + pl.h - g.y < 42 && pl.y < g.y;
    if (stomp) {
      damageGuardian(1, g.x + g.w / 2, g.y + 10);
      pl.vy = -560;
    } else {
      hitPlayer(g);
    }
  }

"""
game = replace_once(game, "  function updateHazards(dt: number) {", guardian_code + "  function updateHazards(dt: number) {", "guardian update")

# Fireballs can hurt guardians and are more effective against the final boss.
game = replace_once(
    game,
    "          e.alive = false;\n          const m = mult();",
    "          if (e.type === \"splitter\") spawnMinis(e);\n          e.alive = false;\n          const m = mult();",
    "fireball splitter behavior",
)

game = replace_once(
    game,
    "      const b = state.boss;\n      if (b && b.active && !b.dying && fb.alive && rectsOverlap(fb, b)) {\n        fb.alive = false;\n        b.hp -= 1;\n        b.hurt = 0.2;\n        state.score += 50;\n        addNotice(\"+50\", b.x + b.w / 2, b.y, \"#ff8c00\");\n        if (b.hp <= 0) startBossDeath();\n      }",
    "      const g = state.guardian;\n      if (g && g.active && g.alive && fb.alive && rectsOverlap(fb, g)) {\n        fb.alive = false;\n        damageGuardian(1, fb.x + fb.w / 2, fb.y + fb.h / 2);\n        state.score += 75;\n      }\n\n      const b = state.boss;\n      if (b && b.active && !b.dying && fb.alive && rectsOverlap(fb, b)) {\n        fb.alive = false;\n        b.hp -= 2;\n        b.hurt = 0.2;\n        state.score += 100;\n        addNotice(\"FIRE -2\", b.x + b.w / 2, b.y, \"#ff8c00\");\n        if (b.hp <= 0) startBossDeath();\n      }",
    "fireball boss damage",
)

# Portal cannot finish the stage until its world guardian is defeated.
game = replace_once(
    game,
    "  function updateGoal(dt: number) {\n    if (state.currentLevel === 4) return;",
    "  function updateGoal(dt: number) {\n    if (state.currentLevel === 4) return;\n    if (state.guardian && state.guardian.alive) return;",
    "boss-gated goal",
)

# Update order includes guardians.
game = replace_once(
    game,
    "      updatePowerups(dt);\n      updateHazards(dt);\n      updateBoss(dt);",
    "      updatePowerups(dt);\n      updateHazards(dt);\n      updateGuardian(dt);\n      updateBoss(dt);",
    "guardian update loop",
)

# Draw guardians in the world.
game = replace_once(
    game,
    "    drawEnemies();\n    drawBoss();",
    "    drawEnemies();\n    drawGuardian();\n    drawBoss();",
    "guardian draw call",
)

draw_guardian = """  function drawGuardian() {
    const g = state.guardian;
    if (!g || !g.active || !g.alive) return;
    const rowMap: Record<string, number> = { slime: 0, mushroom: 1, bug: 2, roller: 3, spike: 4, hopper: 5, diver: 6, splitter: 7 };
    const row = rowMap[g.spriteType] || 0;
    const frame = Math.floor(frameTime * (g.phase === 2 ? 13 : 9)) % 4;
    ctx.save();
    if (g.hurt > 0 && Math.floor(frameTime * 24) % 2 === 0) ctx.globalAlpha = 0.42;
    const glow = 0.14 + Math.sin(frameTime * 6) * 0.05;
    ctx.globalAlpha *= 1;
    ctx.fillStyle = g.color;
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.ellipse(g.x + g.w / 2, g.y + g.h / 2, g.w * 0.62, g.h * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = g.hurt > 0 && Math.floor(frameTime * 24) % 2 === 0 ? 0.48 : 1;
    if (g.vx < 0) {
      ctx.translate(g.x + g.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, -g.w / 2 - 12, g.y - 14, g.w + 24, g.h + 28);
    } else {
      ctx.drawImage(images.enemies, frame * 80, row * 80, 80, 80, g.x - 12, g.y - 14, g.w + 24, g.h + 28);
    }
    ctx.restore();
  }

"""
game = replace_once(game, "  function drawBoss() {", draw_guardian + "  function drawBoss() {", "drawGuardian function")

# Powerups advertise what they do before pickup.
game = replace_once(
    game,
    "      ctx.drawImage(images.powerups, cols[pu.kind] * 48, 0, 48, 48, -22, -22, 44, 44);\n      ctx.restore();",
    "      ctx.drawImage(images.powerups, cols[pu.kind] * 48, 0, 48, 48, -22, -22, 44, 44);\n      ctx.restore();\n      ctx.fillStyle = \"rgba(255,255,255,0.88)\";\n      ctx.font = \"900 11px ui-rounded, system-ui\";\n      ctx.textAlign = \"center\";\n      const label = pu.kind === \"mushroom\" ? \"SUPER\" : pu.kind === \"star\" ? \"8s STAR\" : \"FIRE\";\n      ctx.fillText(label, pu.x + pu.w / 2, y + 58);",
    "powerup labels",
)

# Portal lock feedback.
game = replace_once(
    game,
    "    ctx.fillStyle = \"rgba(255,255,255,0.5)\";\n    ctx.font = \"800 18px ui-rounded, system-ui\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(\"Finish\", state.portal.x + 38, state.portal.y - 14);",
    "    const locked = !!(state.guardian && state.guardian.alive);\n    ctx.fillStyle = locked ? \"#ffb1c2\" : \"rgba(255,255,255,0.72)\";\n    ctx.font = \"900 18px ui-rounded, system-ui\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(locked ? \"BOSS LOCKED\" : \"Finish\", state.portal.x + 38, state.portal.y - 14);",
    "portal lock label",
)

# Active power auras around Ethan.
game = replace_once(
    game,
    "    if (pl.invincible > 0) {\n      ctx.globalAlpha = 0.3;",
    "    if (pl.superTimer > 0) {\n      ctx.globalAlpha = 0.22;\n      ctx.fillStyle = \"#7dff6b\";\n      ctx.beginPath();\n      ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, 48 + Math.sin(frameTime * 7) * 4, 0, Math.PI * 2);\n      ctx.fill();\n      ctx.globalAlpha = 1;\n    }\n    if (pl.firePower) {\n      ctx.globalAlpha = 0.18;\n      ctx.fillStyle = \"#ff8c3a\";\n      ctx.beginPath();\n      ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, 44 + Math.sin(frameTime * 9) * 4, 0, Math.PI * 2);\n      ctx.fill();\n      ctx.globalAlpha = 1;\n    }\n    if (pl.invincible > 0) {\n      ctx.globalAlpha = 0.3;",
    "player power auras",
)

# HUD boss bars plus readable active-power badges.
old_boss_hud = """    const b = state.boss;
    if (b && b.active && !b.dying) {
      const bw = 300;
      ctx.fillStyle = \"rgba(35,24,64,0.5)\";
      roundRect(ctx, VIEW_W / 2 - bw / 2, 14, bw, 20, 10);
      ctx.fill();
      const pct = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = \"#ff4269\";
      roundRect(ctx, VIEW_W / 2 - bw / 2 + 2, 16, (bw - 4) * pct, 16, 8);
      ctx.fill();
      ctx.fillStyle = \"#fff\";
      ctx.font = \"900 13px ui-rounded, system-ui\";
      ctx.textAlign = \"center\";
      ctx.fillText(\"KING ROLLER\", VIEW_W / 2, 46);
    }
"""
new_boss_hud = """    const g = state.guardian;
    const b = state.boss;
    const activeBoss = g && g.active && g.alive ? g : b && b.active && !b.dying ? b : null;
    if (activeBoss) {
      const bw = 320;
      ctx.fillStyle = \"rgba(35,24,64,0.62)\";
      roundRect(ctx, VIEW_W / 2 - bw / 2, 14, bw, 20, 10);
      ctx.fill();
      const pct = clamp(activeBoss.hp / activeBoss.maxHp, 0, 1);
      ctx.fillStyle = activeBoss.color || \"#ff4269\";
      roundRect(ctx, VIEW_W / 2 - bw / 2 + 2, 16, (bw - 4) * pct, 16, 8);
      ctx.fill();
      ctx.fillStyle = \"#fff\";
      ctx.font = \"900 13px ui-rounded, system-ui\";
      ctx.textAlign = \"center\";
      ctx.fillText(activeBoss.name || \"KING ROLLER\", VIEW_W / 2, 46);
    }

    if (pl) {
      const badges: { text: string; color: string }[] = [];
      if (pl.superTimer > 0) badges.push({ text: `SUPER ${Math.ceil(pl.superTimer)}s`, color: \"#7dff6b\" });
      if (pl.invincible > 0) badges.push({ text: `STAR ${Math.ceil(pl.invincible)}s`, color: \"#9df5ff\" });
      if (pl.starRush > 0) badges.push({ text: `RUSH ${Math.ceil(pl.starRush)}s`, color: \"#ffd76a\" });
      if (pl.firePower) badges.push({ text: \"FIRE READY\", color: \"#ff9d3c\" });
      let bx = VIEW_W / 2 - (badges.length * 94) / 2;
      for (const badge of badges) {
        ctx.fillStyle = \"rgba(18,9,42,0.68)\";
        roundRect(ctx, bx, 58, 88, 25, 12);
        ctx.fill();
        ctx.fillStyle = badge.color;
        ctx.font = \"900 11px ui-rounded, system-ui\";
        ctx.textAlign = \"center\";
        ctx.fillText(badge.text, bx + 44, 75);
        bx += 94;
      }
    }
"""
game = replace_once(game, old_boss_hud, new_boss_hud, "boss and power HUD")

# Better checkpoint language on Game Over.
game = replace_once(
    game,
    "      titleText(\"Game Over\", `Final score: ${state.score}. Ethan took a rough landing.`, \"Press Enter to try again\");",
    "      titleText(\"Game Over\", `Checkpoint: Level ${state.checkpointLevel} · Score banked: ${state.checkpointScore}.`, `Press Enter to restart Level ${state.checkpointLevel} with full hearts`);",
    "game over checkpoint text",
)

# Mobile fire support, including sticky-touch cleanup.
game = replace_once(
    game,
    "  function bindMobileButton(btn: HTMLElement | null, prop: \"left\" | \"right\" | \"jump\" | \"crouch\") {",
    "  function bindMobileButton(btn: HTMLElement | null, prop: \"left\" | \"right\" | \"jump\" | \"crouch\" | \"fireball\") {",
    "mobile fire binding type",
)

game = replace_once(
    game,
    "      mobileState[prop] = false;\n      syncMobile();",
    "      mobileState[prop] = false;\n      if (prop === \"left\") keys.left = false;\n      if (prop === \"right\") keys.right = false;\n      if (prop === \"jump\") keys.jump = false;\n      if (prop === \"crouch\") keys.crouch = false;\n      if (prop === \"fireball\") keys.fireball = false;\n      syncMobile();",
    "mobile release unsticks controls",
)

game = replace_once(
    game,
    "    keys.crouch = keys.crouch || mobileState.crouch;\n  }",
    "    keys.crouch = keys.crouch || mobileState.crouch;\n    keys.fireball = keys.fireball || mobileState.fireball;\n  }",
    "mobile fire sync",
)

game = replace_once(
    game,
    "  const cleanupCrouch = bindMobileButton(btnCrouch, \"crouch\");\n  const cleanupJump = bindMobileButton(btnJump, \"jump\");",
    "  const cleanupCrouch = bindMobileButton(btnCrouch, \"crouch\");\n  const cleanupJump = bindMobileButton(btnJump, \"jump\");\n  const cleanupFire = bindMobileButton(btnFire, \"fireball\");",
    "mobile fire cleanup setup",
)

game = replace_once(
    game,
    "    cleanupCrouch && cleanupCrouch();\n    cleanupJump && cleanupJump();",
    "    cleanupCrouch && cleanupCrouch();\n    cleanupJump && cleanupJump();\n    cleanupFire && cleanupFire();",
    "mobile fire cleanup",
)

# Debug surface exposes checkpoint and guardian state for quick validation.
game = replace_once(
    game,
    "    (window as any).__ethan = { state, resetGame, nextLevel };",
    "    (window as any).__ethan = { state, resetGame, nextLevel, damageGuardian };",
    "debug guardian hook",
)

game_path.write_text(game, encoding="utf-8")

# React mobile Fire button.
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    "  const btnJumpRef = useRef<HTMLButtonElement>(null);",
    "  const btnJumpRef = useRef<HTMLButtonElement>(null);\n  const btnFireRef = useRef<HTMLButtonElement>(null);",
    "App fire ref",
)
app = replace_once(
    app,
    "        btnCrouchRef.current,\n        btnJumpRef.current\n      );",
    "        btnCrouchRef.current,\n        btnJumpRef.current,\n        btnFireRef.current\n      );",
    "App fire argument",
)
app = replace_once(
    app,
    "        <p className=\"hint\">Move with A/D, Crouch with S. Jump with Space/W. Fireball with F/J. Restart with R.</p>",
    "        <p className=\"hint\">Move with A/D, crouch with S, jump with Space/W. Grab a Fire Flower, then shoot with F/J or FIRE. R restarts your current checkpoint.</p>",
    "App hint",
)
app = replace_once(
    app,
    "        <button ref={btnJumpRef} id=\"btn-jump\" className=\"jump\" aria-label=\"Jump\">Jump</button>",
    "        <button ref={btnJumpRef} id=\"btn-jump\" className=\"jump\" aria-label=\"Jump\">Jump</button>\n        <button ref={btnFireRef} id=\"btn-fire\" className=\"fire\" aria-label=\"Fire power\">Fire</button>",
    "App fire button",
)
app_path.write_text(app, encoding="utf-8")

# Controls layout and Fire styling.
css = css_path.read_text(encoding="utf-8")
css = replace_once(
    css,
    "  grid-template-columns: 78px 78px 78px 1fr;",
    "  grid-template-columns: 72px 72px 72px 1fr 1fr;",
    "five mobile controls",
)
css = replace_once(
    css,
    ".mobile-controls .crouch {\n  background-color: #7c3aed;\n  box-shadow: 0 0 20px rgba(124, 58, 237, 0.45);\n}\n",
    ".mobile-controls .crouch {\n  background-color: #7c3aed;\n  box-shadow: 0 0 20px rgba(124, 58, 237, 0.45);\n}\n\n.mobile-controls .fire {\n  background-color: #f97316;\n  color: #fff7ed;\n  box-shadow: 0 0 32px rgba(249, 115, 22, 0.5);\n}\n",
    "fire button style",
)
css = replace_once(
    css,
    "  .hint {\n    text-align: center;\n    margin-top: 10px;\n  }\n}",
    "  .hint {\n    text-align: center;\n    margin-top: 10px;\n  }\n\n  .mobile-controls {\n    grid-template-columns: repeat(3, 1fr);\n    gap: 10px;\n  }\n\n  .mobile-controls .jump,\n  .mobile-controls .fire {\n    grid-column: span 1;\n  }\n}",
    "responsive control layout",
)
css_path.write_text(css, encoding="utf-8")

# Replace generic AI Studio README with an actual game README.
readme_path.write_text("""# Ethan the Jumping Boy

A browser platformer built around Ethan, four themed worlds, collectible stars, power-ups, hazards, bosses, and persistent level progression.

## What is in the game

- Four worlds: Rainbow Grove, Sunset Cliffs, Crystal Caves, and Storm Summit
- Level checkpoints: clearing a world banks the score and makes the next world the restart point
- Every fresh level starts with full hearts
- Three world guardian bosses plus the final King Roller boss
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
- Start or continue: Enter

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```
""", encoding="utf-8")

print("Epic gameplay patch applied successfully.")
