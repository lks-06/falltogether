// =============================================
// MULTIPLAYER-LOGIK
// Supabase Realtime Presence für Echtzeit-Sync
// =============================================

// --- State ---
let mpChannel = null;
let mpPlayerId = crypto.randomUUID();
let mpPlayerName = 'Spieler';
let mpPlayerColor = '#ff8a80';
let mpRoomCode = null;
const remotePlayers = new Map();

// --- Callbacks (werden von game.js gesetzt) ---
let onRemoteLevelUp = null; // function(newLevel) - wird aufgerufen wenn ein anderer Spieler Level aufsteigt

// --- Initialisierung ---
function initMultiplayer(roomCode, playerName) {
  mpRoomCode = roomCode;
  mpPlayerName = playerName || 'Spieler';

  // Farbe zuweisen basierend auf playerId-Hash
  const colorIndex = Math.abs(hashCode(mpPlayerId)) % CONFIG.playerColors.length;
  mpPlayerColor = CONFIG.playerColors[colorIndex];

  mpChannel = supabaseClient.channel(`room:${roomCode}`, {
    config: { presence: { key: mpPlayerId } }
  });

  // Presence Sync: alle Spieler-Positionen aktualisieren
  // Dies ist der Haupt-Handler — erstellt neue Spieler UND aktualisiert Positionen
  mpChannel.on('presence', { event: 'sync' }, () => {
    const state = mpChannel.presenceState();

    // Alle Spieler im State durchgehen
    const activeIds = new Set();
    for (const [id, presences] of Object.entries(state)) {
      if (id === mpPlayerId) continue;
      activeIds.add(id);
      const data = presences[0];
      if (!data) continue;

      if (remotePlayers.has(id)) {
        // Bestehenden Spieler aktualisieren
        const rp = remotePlayers.get(id);
        rp.targetX = data.x;
        rp.targetY = data.y;
        rp.level = data.level;
        rp.facingLeft = data.facingLeft;
        rp.onLadder = data.onLadder;
      } else {
        // Neuen Spieler erstellen (z.B. wenn jemand später beitritt)
        createRemotePlayer(id, data);
        showToast((data.name || 'Spieler') + ' ist beigetreten!');
      }
    }

    // Spieler entfernen die nicht mehr im State sind
    for (const [id, rp] of remotePlayers) {
      if (!activeIds.has(id)) {
        showToast((rp.name || 'Spieler') + ' hat den Raum verlassen');
        removeRemotePlayer(id);
      }
    }

    updatePlayerCount();
  });

  // Spieler beigetreten (Backup — sync handler erstellt sie auch)
  mpChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    if (key === mpPlayerId) return;
    const data = newPresences[0];
    if (!data || remotePlayers.has(key)) return;

    createRemotePlayer(key, data);
    showToast((data.name || 'Spieler') + ' ist beigetreten!');
    updatePlayerCount();
  });

  // Spieler verlassen (Backup — sync handler räumt auch auf)
  mpChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    if (key === mpPlayerId) return;
    if (!remotePlayers.has(key)) return;
    const name = leftPresences[0]?.name || 'Spieler';
    removeRemotePlayer(key);
    showToast(name + ' hat den Raum verlassen');
    updatePlayerCount();
  });

  // Broadcast: Level-Wechsel
  mpChannel.on('broadcast', { event: 'level_up' }, ({ payload }) => {
    if (onRemoteLevelUp && payload && payload.level) {
      onRemoteLevelUp(payload.level);
    }
  });

  // Channel abonnieren und eigenen Status tracken
  mpChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await mpChannel.track({
        x: CONFIG.startX,
        y: CONFIG.startY,
        level: 1,
        name: mpPlayerName,
        color: mpPlayerColor,
        facingLeft: false,
        onLadder: false
      });
    }
  });
}

// --- Position broadcasten (throttled) ---
let lastBroadcast = 0;
function broadcastPosition(x, y, velX, currentLevel, isOnLadder) {
  if (!mpChannel) return;
  const now = Date.now();
  if (now - lastBroadcast < CONFIG.syncRate) return;
  lastBroadcast = now;

  mpChannel.track({
    x: x,
    y: y,
    level: currentLevel,
    name: mpPlayerName,
    color: mpPlayerColor,
    facingLeft: velX < 0,
    onLadder: isOnLadder
  });
}

// --- Level-Up broadcasten ---
function broadcastLevelUp(newLevel) {
  if (!mpChannel) return;
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

  // Spieler-Div
  const el = document.createElement('div');
  el.className = 'player remote-player';
  el.style.background = data.color || '#82b1ff';
  el.style.borderColor = darkenColor(data.color || '#82b1ff');
  world.appendChild(el);

  // Namenslabel
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
    onLadder: false
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

// --- Remote-Spieler rendern (im Game-Loop aufrufen) ---
function renderRemotePlayers(currentLevel) {
  for (const [id, rp] of remotePlayers) {
    // Nur Spieler im gleichen Level anzeigen
    if (rp.level !== currentLevel) {
      rp.el.style.display = 'none';
      rp.label.style.display = 'none';
      continue;
    }

    rp.el.style.display = '';
    rp.label.style.display = '';

    // Smooth interpolation
    rp.currentX += (rp.targetX - rp.currentX) * CONFIG.interpolationFactor;
    rp.currentY += (rp.targetY - rp.currentY) * CONFIG.interpolationFactor;

    rp.el.style.left = rp.currentX + 'px';
    rp.el.style.top = rp.currentY + 'px';

    // Blickrichtung
    rp.el.style.transform = rp.facingLeft ? 'scaleX(-1)' : '';

    // Label über dem Kopf zentrieren
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
}

// --- Spieleranzahl im HUD aktualisieren ---
function updatePlayerCount() {
  const countEl = document.getElementById('playerCount');
  if (countEl) {
    countEl.textContent = remotePlayers.size + 1; // +1 für den lokalen Spieler
  }
}

// --- Toast-Nachricht anzeigen ---
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
