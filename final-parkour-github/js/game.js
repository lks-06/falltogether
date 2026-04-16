// =============================================
// SPIELLOGIK
// =============================================

// --- DOM-Elemente ---
const world = document.getElementById('world');
const wrapper = document.getElementById('gameWrapper');
const scoreEl = document.getElementById('score');
const remainingEl = document.getElementById('remaining');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const ammoEl = document.getElementById('ammo');
const infoEl = document.getElementById('info');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const countdownEl = document.getElementById('countdown');
const countText = document.getElementById('countText');
const gameOver = document.getElementById('gameOver');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverText = document.getElementById('gameOverText');
const roomCodeEl = document.getElementById('roomCode');

// --- Spieler erstellen ---
let player = document.createElement('div');
player.className = 'player';
world.appendChild(player);

let goalEl = null;
let platforms = [], coins = [], obstacles = [], spikes = [], ladders = [], birds = [];
let monsters = [], projectiles = [];
let droppedPiles = new Map(); // dropId -> {x, y, count, level, el, countEl}
let score = 0, lives = CONFIG.startLives, level = 1;
let ammo = 0;
let playerX = CONFIG.startX, playerY = CONFIG.startY, velY = 0, velX = 0;
let facingRight = true;
let gameActive = false, countdownActive = false;
let keys = { left: false, right: false, up: false, down: false };
let camX = 0, camY = 0;
let onLadder = false, jumpsLeft = CONFIG.maxJumps;
let prevUpPressed = false, dropThroughTimer = 0;
let monsterHitCooldown = 0, fireCooldown = 0;

// --- Multiplayer: URL-Parameter lesen ---
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const playerName = urlParams.get('name') || localStorage.getItem('parkour_name') || 'Spieler';

if (roomCodeEl && roomCode) {
  roomCodeEl.textContent = roomCode;
}

const copyBtn = document.getElementById('copyRoom');
if (copyBtn && roomCode) {
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      copyBtn.textContent = 'Kopiert!';
      setTimeout(() => copyBtn.textContent = 'Kopieren', 1500);
    });
  });
}

if (!roomCode) {
  window.location.href = 'index.html';
}

// --- Level bauen ---
function makeDiv(cls, x, y, w, h) {
  const d = document.createElement('div');
  d.className = cls;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  if (w) d.style.width = w + 'px';
  if (h) d.style.height = h + 'px';
  world.appendChild(d);
  return d;
}

function buildLevel() {
  const levelData = LEVELS[level];
  [...world.querySelectorAll('.platform,.coin,.obstacle,.spike,.ladder,.goal,.bird,.monster,.monster-hp-bg,.monster-name,.projectile')].forEach(e => e.remove());
  platforms = []; coins = []; obstacles = []; spikes = []; ladders = []; birds = [];
  monsters = []; projectiles = [];

  // Coin-Piles beim Level-Wechsel wieder an die world anhaengen und sichtbarkeit aktualisieren
  for (const [dropId, pile] of droppedPiles) {
    if (!pile.el.isConnected) {
      world.appendChild(pile.el);
    }
    pile.el.style.display = (pile.level === level) ? '' : 'none';
  }

  levelData.platforms.forEach((p, i) => {
    const type = p[4] || '';  // z.B. "ground", "stone", "ice", etc.
    const cls = type ? 'platform platform-' + type : 'platform';
    makeDiv(cls, p[0], p[1], p[2], p[3]);
    platforms.push({ x: p[0], y: p[1], w: p[2], h: p[3], solidGround: i < 4 });
  });

  levelData.ladders.forEach(l => {
    makeDiv('ladder', l[0], l[1], 18, l[2]);
    ladders.push({ x: l[0], y: l[1], w: 18, h: l[2] });
  });

  levelData.obstacles.forEach(o => {
    makeDiv('obstacle', ...o);
    obstacles.push({ x: o[0], y: o[1], w: o[2], h: o[3] });
  });

  levelData.spikes.forEach(s => {
    makeDiv('spike', s[0], s[1], 0, 0);
    spikes.push({ x: s[0], y: s[1], w: 20, h: 24 });
  });

  levelData.coins.forEach((c, i) => {
    let cx = c[0], cy = c[1];

    // Muenzen nicht direkt ueber roten Bloecken platzieren — sonst zu schwer zu holen
    for (const o of obstacles) {
      const xOverlap = cx + 16 > o.x - 18 && cx < o.x + o.w + 18;
      const verticallyNear = (cy + 16) >= o.y - 55 && (cy + 16) <= o.y + 10;
      if (xOverlap && verticallyNear) {
        // Zur Seite verschieben, weg vom Obstacle
        if (cx + 8 < o.x + o.w / 2) {
          cx = o.x - 38;
        } else {
          cx = o.x + o.w + 24;
        }
        // In Weltgrenzen halten
        cx = Math.max(10, Math.min(cx, CONFIG.worldWidth - 26));
        break;
      }
    }

    const alreadyTaken = typeof isCoinCollected === 'function' && isCoinCollected(level, i);
    let el = makeDiv('coin', cx, cy, 16, 16);
    const collected = alreadyTaken;
    if (collected) el.style.display = 'none';
    coins.push({ x: cx, y: cy, w: 16, h: 16, el, collected });
  });

  // Monster
  const monsterData = levelData.monsters || [];
  monsterData.forEach(m => {
    const [mx, my, range, hp, name] = m;
    const isBoss = !!name;
    const w = isBoss ? 44 : 30;
    const h = isBoss ? 40 : 28;
    const cls = isBoss ? 'monster monster-boss' : 'monster';
    const el = makeDiv(cls, mx, my, w, h);

    // HP-Bar (Hintergrund + Fuellung)
    const hpBg = document.createElement('div');
    hpBg.className = 'monster-hp-bg';
    hpBg.style.left = mx + 'px';
    hpBg.style.top = (my - 10) + 'px';
    hpBg.style.width = w + 'px';
    const hpFill = document.createElement('div');
    hpFill.className = 'monster-hp-fill';
    hpFill.style.width = '100%';
    hpBg.appendChild(hpFill);
    world.appendChild(hpBg);

    // Name-Label (nur fuer Bosse)
    let nameEl = null;
    if (name) {
      nameEl = document.createElement('div');
      nameEl.className = 'monster-name';
      nameEl.textContent = name;
      nameEl.style.left = (mx + w / 2) + 'px';
      nameEl.style.top = (my - 26) + 'px';
      world.appendChild(nameEl);
    }

    monsters.push({
      x: mx, y: my, w, h,
      startX: mx, range, vx: CONFIG.monsterSpeed,
      hp, maxHp: hp, name: name || null,
      el, hpBg, hpFill, nameEl,
      alive: true
    });
  });

  goalEl = makeDiv('goal', levelData.goal[0], levelData.goal[1], 36, 44);
  updateRemaining();
  updateAmmoUI();
}

function updateAmmoUI() {
  if (ammoEl) ammoEl.textContent = ammo;
}

function updateRemaining() {
  remainingEl.textContent = coins.filter(c => !c.collected).length;
}

// --- Vögel ---
function spawnBird() {
  const y = 180 + Math.random() * 1000;
  const fromLeft = Math.random() > 0.5;
  const x = fromLeft ? -60 : CONFIG.worldWidth + 60;
  const speed = fromLeft
    ? (CONFIG.birdMinSpeed + Math.random() * (CONFIG.birdMaxSpeed - CONFIG.birdMinSpeed))
    : -(CONFIG.birdMinSpeed + Math.random() * (CONFIG.birdMaxSpeed - CONFIG.birdMinSpeed));
  const el = document.createElement('div');
  el.className = 'bird';
  if (speed < 0) el.style.transform = 'scaleX(-1)';
  world.appendChild(el);
  birds.push({ x, y, w: 34, h: 20, speed, el });
}

// --- Kollision ---
function rects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// --- Spieler zurücksetzen ---
function resetPlayer() {
  playerX = CONFIG.startX;
  playerY = CONFIG.startY;
  velX = 0;
  velY = 0;
  jumpsLeft = CONFIG.maxJumps;
  keys.up = false;
  keys.down = false;
  dropThroughTimer = 0;
}

// --- Coin-Haufen: erstellen / entfernen ---
function createDroppedPile(dropId, x, y, count, pileLevel) {
  if (droppedPiles.has(dropId)) return;
  // Nur im aktuellen Level sichtbar
  const el = document.createElement('div');
  el.className = 'coin-pile';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const countEl = document.createElement('div');
  countEl.className = 'coin-pile-count';
  countEl.textContent = count;
  el.appendChild(countEl);
  if (pileLevel !== level) el.style.display = 'none';
  world.appendChild(el);
  droppedPiles.set(dropId, { x, y, count, level: pileLevel, el, countEl });
}

function removeDroppedPile(dropId) {
  const pile = droppedPiles.get(dropId);
  if (!pile) return;
  if (pile.el) pile.el.remove();
  droppedPiles.delete(dropId);
}

// Eigene Muenzen beim Tod fallen lassen
function dropAmmoAsPile() {
  if (ammo <= 0) return;
  const count = ammo;
  ammo = 0;
  updateAmmoUI();
  const dropId = mpPlayerId + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  // Haufen leicht ueber dem Spieler, damit er nicht in einer Plattform verschwindet
  const px = playerX + (CONFIG.playerWidth / 2) - 16;
  const py = Math.max(40, playerY);
  createDroppedPile(dropId, px, py, count, level);
  if (typeof broadcastCoinDrop === 'function') {
    broadcastCoinDrop(dropId, px, py, count, level);
  }
}

// --- Leben verlieren ---
function loseLife() {
  // Zuerst: Muenzen am Todesort fallen lassen
  dropAmmoAsPile();

  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) {
    gameActive = false;
    gameOver.classList.remove('hidden');
    gameOverTitle.textContent = 'Game Over';
    gameOverText.textContent = 'Du bist zu oft gestorben.';
  } else {
    resetPlayer();
    infoEl.textContent = 'Muenzen verloren! Hol sie dir zurueck.';
    setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 1200);
  }
}

// --- Kamera ---
function updateCamera() {
  const vw = wrapper.clientWidth, vh = wrapper.clientHeight;
  camX += ((playerX - vw * CONFIG.cameraOffsetX) - camX) * CONFIG.cameraDamping;
  camY += ((playerY - vh * CONFIG.cameraOffsetY) - camY) * CONFIG.cameraDamping;
  camX = Math.max(0, Math.min(camX, CONFIG.worldWidth - vw));
  camY = Math.max(0, Math.min(camY, CONFIG.worldHeight - vh));
  world.style.transform = `translate(${-camX}px,${-camY}px)`;
}

// --- Countdown ---
function startCountdown() {
  countdownActive = true;
  gameActive = false;
  countdownEl.classList.remove('hidden');
  let n = 3;
  countText.textContent = n;
  const t = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(t);
      countdownEl.classList.add('hidden');
      countdownActive = false;
      gameActive = true;
    } else {
      countText.textContent = n;
    }
  }, 1000);
}

// --- Leiter-Check ---
function onLadderNow() {
  return ladders.find(l =>
    playerX + CONFIG.playerWidth > l.x &&
    playerX < l.x + l.w &&
    playerY + CONFIG.playerHeight > l.y &&
    playerY < l.y + l.h + 12
  );
}

// --- Springen ---
function jump() {
  if (countdownActive || !gameActive) return;
  const ladderNow = onLadderNow();
  if (ladderNow) {
    velY = -CONFIG.jumpPower;
    onLadder = false;
    keys.up = false;
    jumpsLeft = 1;
    playerY -= 6;
    return;
  }
  if (jumpsLeft > 0) {
    velY = -CONFIG.jumpPower;
    jumpsLeft--;
  }
}

// --- Muenze verschiessen ---
function fire() {
  if (countdownActive || !gameActive) return;
  if (fireCooldown > 0) return;
  if (ammo <= 0) {
    infoEl.textContent = 'Keine Muenzen zum Verschiessen!';
    setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 900);
    return;
  }
  ammo--;
  updateAmmoUI();
  fireCooldown = CONFIG.fireCooldown;

  const dir = facingRight ? 1 : -1;
  const startX = playerX + (facingRight ? CONFIG.playerWidth : -CONFIG.projectileSize);
  const startY = playerY + CONFIG.playerHeight / 2 - CONFIG.projectileSize / 2;
  const el = makeDiv('projectile', startX, startY, CONFIG.projectileSize, CONFIG.projectileSize);
  projectiles.push({
    x: startX, y: startY,
    w: CONFIG.projectileSize, h: CONFIG.projectileSize,
    vx: dir * CONFIG.projectileSpeed,
    vy: -2, // leichter Bogen
    el
  });
}

function allCoinsCollected() {
  return coins.every(c => c.collected);
}

// --- Level wechseln ---
function switchToLevel(newLevel) {
  if (newLevel > CONFIG.totalLevels || newLevel <= level) return;
  level = newLevel;
  levelEl.textContent = level;
  buildLevel();
  resetPlayer();
  startCountdown();
  infoEl.textContent = 'Level ' + level + ' startet';
  setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 1200);
}

// --- Multiplayer: Level-Sync empfangen ---
onRemoteLevelUp = function(newLevel) {
  switchToLevel(newLevel);
  showToast('Nächstes Level!');
};

// --- Vögel spawnen ---
setInterval(() => {
  if (gameActive && !countdownActive && birds.length < CONFIG.maxBirds && Math.random() < CONFIG.birdSpawnChance) {
    spawnBird();
  }
}, CONFIG.birdSpawnInterval);

// --- Haupt-Update ---
function update() {
  if (dropThroughTimer > 0) dropThroughTimer--;

  const standingPlatformTop = platforms.find(p =>
    playerX + CONFIG.playerWidth > p.x &&
    playerX < p.x + p.w &&
    Math.abs((playerY + CONFIG.playerHeight) - p.y) <= 6
  );
  const ladderAtFeet = ladders.find(l =>
    playerX + CONFIG.playerWidth > l.x &&
    playerX < l.x + l.w &&
    Math.abs((playerY + CONFIG.playerHeight) - l.y) <= 10
  );

  if (keys.down && standingPlatformTop && !standingPlatformTop.solidGround && !ladderAtFeet && !onLadder && dropThroughTimer <= 0) {
    playerY += 8;
    velY = 2;
    dropThroughTimer = 18;
  }

  if (!gameActive || countdownActive) {
    // Auch während Countdown: Position senden damit andere uns sehen
    broadcastPosition(playerX, playerY, velX, level, onLadder);
    updateCamera();
    render();
    return;
  }

  // Bewegung
  velX = keys.left ? -CONFIG.moveSpeed : keys.right ? CONFIG.moveSpeed : 0;
  if (velX > 0) facingRight = true;
  else if (velX < 0) facingRight = false;
  playerX += velX;

  // Cooldowns
  if (monsterHitCooldown > 0) monsterHitCooldown--;
  if (fireCooldown > 0) fireCooldown--;

  // Leiter
  let ladder = onLadderNow();
  onLadder = !!ladder && velY >= 0;

  if (onLadder) {
    const ladderTop = ladder.y;
    const atTop = playerY <= ladderTop - 10;
    const standingOnTop = platforms.some(pl =>
      playerX + CONFIG.playerWidth > pl.x &&
      playerX < pl.x + pl.w &&
      Math.abs((playerY + CONFIG.playerHeight) - pl.y) <= 6 &&
      ladder.x + ladder.w > pl.x &&
      ladder.x < pl.x + pl.w
    );
    const upJustPressed = keys.up && !prevUpPressed;
    if ((atTop || standingOnTop) && upJustPressed) {
      jump();
    } else {
      if (keys.up) { playerY -= CONFIG.climbSpeed; velY = 0; }
      if (keys.down) { playerY += CONFIG.climbSpeed; velY = 0; }
      if (!keys.up && !keys.down) { velY = 0; }
    }
  } else {
    velY += CONFIG.gravity;
    playerY += velY;
  }

  // Plattform-Kollision
  for (const p of platforms) {
    const r = { x: playerX, y: playerY, w: CONFIG.playerWidth, h: CONFIG.playerHeight };
    if (dropThroughTimer <= 0 && !onLadder && rects(r, p) && velY >= 0 && playerY + CONFIG.playerHeight - velY <= p.y + 8) {
      playerY = p.y - CONFIG.playerHeight;
      velY = 0;
      jumpsLeft = CONFIG.maxJumps;
    }
  }

  // Gefahren-Kollision
  const pr = { x: playerX, y: playerY, w: CONFIG.playerWidth, h: CONFIG.playerHeight };
  for (const s of spikes) {
    if (rects(pr, s)) { loseLife(); prevUpPressed = keys.up; updateCamera(); render(); return; }
  }
  for (const o of obstacles) {
    if (rects(pr, o)) { loseLife(); prevUpPressed = keys.up; updateCamera(); render(); return; }
  }
  if (playerY > CONFIG.worldHeight - 20) {
    loseLife(); prevUpPressed = keys.up; updateCamera(); render(); return;
  }

  // Münzen einsammeln
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (!c.collected && rects(pr, c)) {
      c.collected = true;
      c.el.style.display = 'none';
      score++;
      scoreEl.textContent = score;
      ammo++;
      updateAmmoUI();
      updateRemaining();
      // Shared Coins: Anderen Spielern mitteilen
      try {
        if (typeof onCoinCollected === 'function') {
          onCoinCollected(level, i, mpPlayerName);
        }
      } catch (e) { /* shared-coins Fehler soll Spiel nicht crashen */ }
    }
  }

  // Vögel bewegen & Kollision
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.x += b.speed;
    b.el.style.left = b.x + 'px';
    b.el.style.top = b.y + 'px';
    if (rects(pr, b)) {
      loseLife(); prevUpPressed = keys.up; updateCamera(); render(); return;
    }
    if (b.x < -120 || b.x > CONFIG.worldWidth + 120) {
      b.el.remove();
      birds.splice(i, 1);
    }
  }

  // Coin-Haufen aufsammeln
  for (const [dropId, pile] of droppedPiles) {
    if (pile.level !== level) continue;
    const pileRect = { x: pile.x, y: pile.y, w: 32, h: 32 };
    if (rects(pr, pileRect)) {
      ammo += pile.count;
      updateAmmoUI();
      removeDroppedPile(dropId);
      if (typeof broadcastCoinPickup === 'function') {
        broadcastCoinPickup(dropId);
      }
      infoEl.textContent = '+' + pile.count + ' Muenzen zurueck!';
      setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 900);
    }
  }

  // Monster bewegen & Kollision
  for (const m of monsters) {
    if (!m.alive) continue;
    m.x += m.vx;
    if (m.x < m.startX) { m.x = m.startX; m.vx = Math.abs(m.vx); }
    if (m.x > m.startX + m.range) { m.x = m.startX + m.range; m.vx = -Math.abs(m.vx); }

    m.el.style.left = m.x + 'px';
    m.el.style.top = m.y + 'px';
    m.el.style.transform = m.vx < 0 ? 'scaleX(-1)' : '';

    // HP-Bar ueber Monster positionieren
    m.hpBg.style.left = m.x + 'px';
    m.hpBg.style.top = (m.y - 10) + 'px';
    m.hpBg.style.width = m.w + 'px';
    m.hpFill.style.width = Math.max(0, (m.hp / m.maxHp) * 100) + '%';

    if (m.nameEl) {
      m.nameEl.style.left = (m.x + m.w / 2) + 'px';
      m.nameEl.style.top = (m.y - 26) + 'px';
    }

    // Kollision mit Spieler
    if (monsterHitCooldown <= 0 && rects(pr, m)) {
      monsterHitCooldown = CONFIG.monsterDamageCooldown;
      loseLife();
      prevUpPressed = keys.up;
      updateCamera();
      render();
      return;
    }
  }

  // Projektile bewegen & Kollision
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.vy += CONFIG.projectileGravity;
    p.y += p.vy;
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';

    let hit = false;

    // Trifft Monster?
    for (const m of monsters) {
      if (!m.alive) continue;
      if (rects(p, m)) {
        m.hp -= CONFIG.monsterHitPerShot;
        hit = true;
        if (m.hp <= 0) {
          m.alive = false;
          m.el.remove();
          m.hpBg.remove();
          if (m.nameEl) m.nameEl.remove();
          if (m.name) {
            infoEl.textContent = m.name + ' wurde besiegt!';
            setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 1500);
          }
        }
        break;
      }
    }

    // Trifft Plattform oder out of bounds?
    if (!hit) {
      for (const pl of platforms) {
        if (rects(p, pl)) { hit = true; break; }
      }
    }
    if (!hit && (p.x < -50 || p.x > CONFIG.worldWidth + 50 || p.y > CONFIG.worldHeight + 50)) {
      hit = true;
    }

    if (hit) {
      p.el.remove();
      projectiles.splice(i, 1);
    }
  }

  // Ziel erreicht?
  const goalData = LEVELS[level].goal;
  if (rects(pr, { x: goalData[0], y: goalData[1], w: 36, h: 44 })) {
    if (allCoinsCollected()) {
      if (level < CONFIG.totalLevels) {
        const newLevel = level + 1;
        broadcastLevelUp(newLevel);
        switchToLevel(newLevel);
      } else {
        gameActive = false;
        gameOver.classList.remove('hidden');
        gameOverTitle.textContent = 'Geschafft!';
        gameOverText.textContent = 'Ihr habt alle ' + CONFIG.totalLevels + ' Level geschafft!';
      }
    } else {
      goalEl.style.background = '#ff5555';
      setTimeout(() => goalEl.style.background = '#20c95a', 200);
    }
  }

  // Grenzen
  playerX = Math.max(0, Math.min(playerX, CONFIG.worldWidth - CONFIG.playerWidth));
  playerY = Math.max(0, Math.min(playerY, CONFIG.worldHeight - CONFIG.playerHeight));

  prevUpPressed = keys.up;

  // Multiplayer: Position senden
  broadcastPosition(playerX, playerY, velX, level, onLadder);

  updateCamera();
  render();
}

function render() {
  player.style.left = playerX + 'px';
  player.style.top = playerY + 'px';
  player.style.transform = velX < 0 ? 'scaleX(-1)' : '';
  renderRemotePlayers(level);
}

function loop() {
  update();
  requestAnimationFrame(loop);
}

// --- Steuerung: Touch & Maus ---
function bindHold(btn, key) {
  btn.addEventListener('touchstart', e => { e.preventDefault(); keys[key] = true; }, { passive: false });
  btn.addEventListener('touchend', e => { e.preventDefault(); keys[key] = false; }, { passive: false });
  btn.addEventListener('touchcancel', e => { e.preventDefault(); keys[key] = false; }, { passive: false });
  btn.addEventListener('mousedown', () => keys[key] = true);
  btn.addEventListener('mouseup', () => keys[key] = false);
  btn.addEventListener('mouseleave', () => keys[key] = false);
}

bindHold(document.getElementById('leftBtn'), 'left');
bindHold(document.getElementById('rightBtn'), 'right');

document.getElementById('upBtn').addEventListener('touchstart', e => {
  e.preventDefault();
  if (onLadderNow()) { keys.up = true; } else { jump(); }
}, { passive: false });
document.getElementById('upBtn').addEventListener('touchend', e => { e.preventDefault(); keys.up = false; }, { passive: false });
document.getElementById('upBtn').addEventListener('mousedown', () => {
  if (onLadderNow()) { keys.up = true; } else { jump(); }
});
document.getElementById('upBtn').addEventListener('mouseup', () => keys.up = false);

bindHold(document.getElementById('downBtn'), 'down');

// Feuer-Button (Muenzen verschiessen)
const fireBtn = document.getElementById('fireBtn');
if (fireBtn) {
  fireBtn.addEventListener('touchstart', e => { e.preventDefault(); fire(); }, { passive: false });
  fireBtn.addEventListener('mousedown', () => fire());
}

// --- Steuerung: Tastatur ---
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w') {
    if (onLadderNow()) keys.up = true; else jump();
  }
  if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
  if (e.key === ' ') jump();
  if (e.key === 'f' || e.key === 'F' || e.key === 'x' || e.key === 'X') fire();
});

window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
  if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
});

// --- Aufräumen beim Verlassen ---
window.addEventListener('beforeunload', () => {
  cleanupMultiplayer();
  if (typeof cleanupSharedCoins === 'function') cleanupSharedCoins();
});

// --- Spiel starten ---
let gameStarted = false;
startBtn.addEventListener('click', () => {
  if (gameStarted) return;
  gameStarted = true;
  startScreen.classList.add('hidden');

  // Multiplayer initialisieren
  initMultiplayer(roomCode, playerName);
  if (typeof initSharedCoins === 'function') {
    initSharedCoins(roomCode);
  }

  buildLevel();
  resetPlayer();
  render();
  gameActive = false;
  startCountdown();
  loop();
});
