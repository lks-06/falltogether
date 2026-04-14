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
const infoEl = document.getElementById('info');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const countdown = document.getElementById('countdown');
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
let score = 0, lives = CONFIG.startLives, level = 1;
let playerX = CONFIG.startX, playerY = CONFIG.startY, velY = 0, velX = 0;
let gameActive = false, countdownActive = false;
let keys = { left: false, right: false, up: false, down: false };
let camX = 0, camY = 0;
let onLadder = false, touchingGoal = false, jumpsLeft = CONFIG.maxJumps;
let prevUpPressed = false, dropThroughTimer = 0;

// --- Multiplayer: URL-Parameter lesen ---
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const playerName = urlParams.get('name') || localStorage.getItem('parkour_name') || 'Spieler';

// Raum-Code anzeigen
if (roomCodeEl && roomCode) {
  roomCodeEl.textContent = roomCode;
}

// Kopier-Button
const copyBtn = document.getElementById('copyRoom');
if (copyBtn && roomCode) {
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      copyBtn.textContent = 'Kopiert!';
      setTimeout(() => copyBtn.textContent = 'Kopieren', 1500);
    });
  });
}

// Kein Raum-Code → zurück zur Lobby
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
  [...world.querySelectorAll('.platform,.coin,.obstacle,.spike,.ladder,.goal,.bird')].forEach(e => e.remove());
  platforms = []; coins = []; obstacles = []; spikes = []; ladders = []; birds = [];

  levelData.platforms.forEach((p, i) => {
    makeDiv('platform', ...p);
    platforms.push({ x: p[0], y: p[1], w: p[2], h: p[3], solidGround: i === 0 });
  });

  // Leitern (mit expliziter Breite)
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

  levelData.coins.forEach(c => {
    let el = makeDiv('coin', c[0], c[1], 16, 16);
    coins.push({ x: c[0], y: c[1], w: 16, h: 16, el, collected: false });
  });

  goalEl = makeDiv('goal', levelData.goal[0], levelData.goal[1], 36, 44);
  updateRemaining();
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

// --- Leben verlieren ---
function loseLife() {
  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) {
    gameActive = false;
    gameOver.classList.remove('hidden');
    gameOverTitle.textContent = 'Game Over';
    gameOverText.textContent = 'Du bist zu oft gestorben.';
  } else {
    resetPlayer();
    infoEl.textContent = 'Von vorne gestartet!';
    setTimeout(() => infoEl.textContent = 'Sammle alle Münzen und erreiche dann das Ziel', 900);
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
  countdown.classList.remove('hidden');
  let n = 3;
  countText.textContent = n;
  const t = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(t);
      countdown.classList.add('hidden');
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
    playerY = playerY - 6;
    return;
  }
  if (jumpsLeft > 0) {
    velY = -CONFIG.jumpPower;
    jumpsLeft--;
  }
}

function allCoinsCollected() {
  return coins.every(c => c.collected);
}

// --- Level wechseln (auch für Multiplayer) ---
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
    updateCamera();
    render();
    return;
  }

  // Bewegung
  velX = keys.left ? -CONFIG.moveSpeed : keys.right ? CONFIG.moveSpeed : 0;
  playerX += velX;

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
  for (const c of coins) {
    if (!c.collected && rects(pr, c)) {
      c.collected = true;
      c.el.style.display = 'none';
      score++;
      scoreEl.textContent = score;
      updateRemaining();
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

  // Ziel erreicht?
  const goalData = LEVELS[level].goal;
  if (rects(pr, { x: goalData[0], y: goalData[1], w: 36, h: 44 })) {
    if (allCoinsCollected()) {
      if (level < CONFIG.totalLevels) {
        const newLevel = level + 1;
        broadcastLevelUp(newLevel); // Andere Spieler informieren
        switchToLevel(newLevel);
      } else {
        gameActive = false;
        gameOver.classList.remove('hidden');
        gameOverTitle.textContent = 'Geschafft!';
        gameOverText.textContent = 'Ihr habt alle ' + CONFIG.totalLevels + ' schweren Level geschafft!';
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
  // Blickrichtung
  player.style.transform = velX < 0 ? 'scaleX(-1)' : '';
  // Remote-Spieler rendern
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

// --- Steuerung: Tastatur ---
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w') {
    if (onLadderNow()) keys.up = true; else jump();
  }
  if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
  if (e.key === ' ') jump();
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
});

// --- Spiel starten ---
let gameStarted = false;
startBtn.addEventListener('click', () => {
  if (gameStarted) return;
  gameStarted = true;
  startScreen.classList.add('hidden');

  // Multiplayer initialisieren
  initMultiplayer(roomCode, playerName);

  buildLevel();
  resetPlayer();
  render();
  gameActive = false;
  startCountdown();
  loop();
});
