// =============================================
// MULTIPLAYER-LOGIK (OPTIMIERT FÜR ECHTZEIT)
// Broadcast für Echtzeit-Positionen (30Hz)
// Presence für Beitreten/Verlassen
// =============================================

// --- State ---
let mpChannel = null;
let mpPlayerId = crypto.randomUUID();
let mpPlayerName = 'Spieler';
let mpPlayerColor = '#ff8a80';
let mpRoomCode = null;
const remotePlayers = new Map();
let mpInitialized = false;

// --- Callbacks (werden von game.js gesetzt) ---
let onRemoteLevelUp = null;

// --- Initialisierung ---
function initMultiplayer(roomCode, playerName) {
  mpRoomCode = roomCode;
  mpPlayerName = playerName || 'Spieler';
  
  // Farbe zuweisen
  const colorIndex = Math.abs(hashCode(mpPlayerId)) % CONFIG.playerColors.length;
  mpPlayerColor = CONFIG.playerColors[colorIndex];
  
  mpChannel = supabaseClient.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: mpPlayerId }
    }
  });

  // ===== BROADCAST: Echtzeit-Positionen =====
  mpChannel.on('broadcast', { event: 'pos' }, ({ payload }) => {
    if (!payload || payload.id === mpPlayerId) return;
    
    const id = payload.id;
    if (remotePlayers.has(id)) {
      const rp = remotePlayers.get(id);
      rp.targetX = payload.x;
      rp.targetY = payload.y;
      rp.level = payload.level;
      rp.facingLeft = payload.facingLeft;
      rp.onLadder = payload.onLadder;
      rp.lastSeen = Date.now();
    } else {
      // Neuer Spieler — erstelle ihn sofort (auch aus Broadcast!)
      createRemotePlayer(id, payload);
    }
  });

  // ===== BROADCAST: Level-Wechsel =====
  mpChannel.on('broadcast', { event: 'level_up' }, ({ payload }) => {
    if (onRemoteLevelUp && payload && payload.level) {
      onRemoteLevelUp(payload.level);
    }
  });

  // ===== BROADCAST: Spieler fragt "wer ist da?" (neuer Spieler joinent) =====
  mpChannel.on('broadcast', { event: 'who' }, ({ payload }) => {
    if (!payload || payload.id === mpPlayerId) return;
    // Sofort unsere Position senden damit der neue Spieler uns sieht
    sendPosition(true);
  });

  // ===== BROADCAST: Alle Positionen auf Anfrage =====
  mpChannel.on('broadcast', { event: 'sync_pos' }, ({ payload }) => {
    if (!payload || payload.id === mpPlayerId) return;
    // Ein anderer Spieler hat Position angefordert, wir senden
    sendPosition(true);
  });

  // ===== PRESENCE: Beitreten/Verlassen =====
  mpChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    if (key === mpPlayerId) return;
    const data = newPresences[0];
    if (!data) return;
    if (!remotePlayers.has(key)) {
      createRemotePlayer(key, data);
      showToast((data.name || 'Spieler') + ' ist beigetreten!');
    }
    updatePlayerCount();
  });

  mpChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    if (key === mpPlayerId) return;
    const name = remotePlayers.get(key)?.name || leftPresences[0]?.name || 'Spieler';
    removeRemotePlayer(key);
    showToast(name + ' hat den Raum verlassen');
    updatePlayerCount();
  });

  mpChannel.on('presence', { event: 'sync' }, () => {
    const state = mpChannel.presenceState();
    let newPlayersFound = false;
    
    // Erstelle Spieler die wir noch nicht kennen
    for (const [id, presences] of Object.entries(state)) {
      if (id === mpPlayerId) continue;
      const data = presences[0];
      if (!data) continue;
      if (!remotePlayers.has(id)) {
        createRemotePlayer(id, data);
        newPlayersFound = true;
      }
    }
    
    // Wenn neue Spieler gefunden wurden, fordere deren aktuelle Positionen an
    if (newPlayersFound) {
      setTimeout(() => {
        mpChannel.send({
          type: 'broadcast',
          event: 'sync_pos',
          payload: { id: mpPlayerId }
        });
      }, 100);
    }
    
    updatePlayerCount();
  });

  // ===== Channel abonnieren =====
  mpChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      mpInitialized = true;
      
      // Presence tracken (für join/leave Erkennung)
      await mpChannel.track({
        name: mpPlayerName,
        color: mpPlayerColor,
        x: CONFIG.startX,
        y: CONFIG.startY,
        level: 1
      });

      // "Wer ist da?" senden — alle anderen antworten mit ihrer Position
      setTimeout(() => {
        mpChannel.send({
          type: 'broadcast',
          event: 'who',
          payload: { id: mpPlayerId }
        });
      }, 300);
    }
  });

  // Aufräumen: Spieler die lange nicht mehr gesendet haben entfernen
  setInterval(() => {
    const now = Date.now();
    for (const [id, rp] of remotePlayers) {
      if (rp.lastSeen && now - rp.lastSeen > 3000) {  // Verkürzt von 8s auf 3s
        removeRemotePlayer(id);
        updatePlayerCount();
      }
    }
  }, 2000);
}

// --- Position senden via Broadcast (OPTIMIERT: 30Hz statt 15Hz, ~33ms) ---
let lastBroadcast = 0;
const BROADCAST_INTERVAL = 33;  // ~30Hz für smoothere Remote-Bewegung

function sendPosition(force) {
  if (!mpChannel || !mpInitialized) return;
  
  if (!force) {
    const now = Date.now();
    // Sende IMMER wenn genug Zeit vergangen ist, egal ob game läuft
    if (now - lastBroadcast < BROADCAST_INTERVAL) return;
    lastBroadcast = now;
  }

  mpChannel.send({
    type: 'broadcast',
    event: 'pos',
    payload: {
      id: mpPlayerId,
      x: _lastPosX,
      y: _lastPosY,
      level: _lastLevel,
      name: mpPlayerName,
      color: mpPlayerColor,
      facingLeft: _lastFacingLeft,
      onLadder: _lastOnLadder
    }
  });
}

// Zwischengespeicherte Position (wird von broadcastPosition aktualisiert)
let _lastPosX = CONFIG.startX;
let _lastPosY = CONFIG.startY;
let _lastLevel = 1;
let _lastFacingLeft = false;
let _lastOnLadder = false;

function broadcastPosition(x, y, velX, currentLevel, isOnLadder) {
  _lastPosX = x;
  _lastPosY = y;
  _lastLevel = currentLevel;
  _lastFacingLeft = velX < 0;
  _lastOnLadder = isOnLadder;
  
  // Sende wenn bereit (nie blockiert von gameActive!)
  sendPosition(false);
}

// --- Level-Up broadcasten ---
function broadcastLevelUp(newLevel) {
  if (!mpChannel || !mpInitialized) return;
  mpChannel.send({
    type: 'broadcast',
    event: 'level_up',
    payload: { level: newLevel }
  });
}

// --- Remote-Spieler erstellen ---
function createRemotePlayer(id, data) {
  if (remotePlayers.has(id)) return;

  const world = document.getElementById('world');
  
  const el = document.createElement('div');
  el.className = 'player remote-player';
  el.style.background = data.color || '#82b1ff';
  el.style.borderColor = darkenColor(data.color || '#82b1ff');
  world.appendChild(el);

  const label = document.createElement('div');
  label.className = 'player-label';
  label.textContent = data.name || 'Spieler';
  world.appendChild(label);

  remotePlayers.set(id, {
    el: el,
    label: label,
    targetX: data.x || CONFIG.startX,
    targetY: data.y || CONFIG.startY,
    currentX: data.x || CONFIG.startX,
    currentY: data.y || CONFIG.startY,
    level: data.level || 1,
    name: data.name || 'Spieler',
    color: data.color || '#82b1ff',
    facingLeft: false,
    onLadder: false,
    lastSeen: Date.now()
  });
}

// --- Remote-Spieler entfernen ---
function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (rp) {
    rp.el.remove();
    rp.label.remove();
    remotePlayers.delete(id);
  }
}

// --- Remote-Spieler rendern (OPTIMIERT: smoothere Interpolation) ---
function renderRemotePlayers(currentLevel) {
  for (const [id, rp] of remotePlayers) {
    if (rp.level !== currentLevel) {
      rp.el.style.display = 'none';
      rp.label.style.display = 'none';
      continue;
    }

    rp.el.style.display = '';
    rp.label.style.display = '';

    // Smoothere Interpolation für flüssigere Bewegung
    rp.currentX += (rp.targetX - rp.currentX) * CONFIG.interpolationFactor;
    rp.currentY += (rp.targetY - rp.currentY) * CONFIG.interpolationFactor;

    rp.el.style.left = rp.currentX + 'px';
    rp.el.style.top = rp.currentY + 'px';
    rp.el.style.transform = rp.facingLeft ? 'scaleX(-1)' : '';

    rp.label.style.left = (rp.currentX + CONFIG.playerWidth / 2) + 'px';
    rp.label.style.top = (rp.currentY - 16) + 'px';
  }
}

// --- Aufräumen ---
function cleanupMultiplayer() {
  if (mpChannel) {
    mpChannel.untrack();
    mpChannel.unsubscribe();
    mpChannel = null;
  }

  for (const [id] of remotePlayers) {
    removeRemotePlayer(id);
  }
  
  mpInitialized = false;
}

// --- HUD ---
function updatePlayerCount() {
  const countEl = document.getElementById('playerCount');
  if (countEl) {
    countEl.textContent = remotePlayers.size + 1;
  }
}

// --- Toast ---
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

// --- Hilfsfunktionen ---
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function darkenColor(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 50);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 50);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 50);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}
