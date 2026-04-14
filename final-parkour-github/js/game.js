// =============================================
// SPIELLOGIK (MIT SHARED COINS)
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
let platforms, coins, obstacles, spikes, ladders, birds;

let score = 0, lives = CONFIG.startLives, level = 1;
let playerX = CONFIG.startX, playerY = CONFIG.startY, velY = 0, velX = 0;
let gameActive = false, countdownActive = false;
let keys = { left: false, right: false, up: false, down: false };
let camX = 0, camY = 0;
let onLadder = false, touchingGoal = false, jumpsLeft = CONFIG.maxJumps;
let prevUpPressed = false, dropThroughTimer = 0;

// --- Multiplayer URL-Parameter lesen ---
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const playerName = urlParams.get('name') || localStorage.getItem('parkourname') || 'Spieler';

// Spieler & Raum-Code anzeigen
if (roomCodeEl && roomCode) {
  roomCodeEl.textContent = roomCode;
}

// Kopier-Button
const copyBtn = document.getElementById('copyRoom');
if (copyBtn && roomCode) {
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      copyBtn.textContent = 'Kopiert!';
      setTimeout(() => {
        copyBtn.textContent = 'Kopieren';
      }, 1500);
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

  // Alte Elemente löschen
  world.querySelectorAll('.plat
