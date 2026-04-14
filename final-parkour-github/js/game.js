// =============================================
// MULTIPLAYER-LOGIK
// =============================================

let mpChannel = null;
let mpPlayerId = crypto.randomUUID();
let mpPlayerName = 'Spieler';
let mpPlayerColor = '#ff8a80';
let mpRoomCode = null;
const remotePlayers = new Map();

let onRemoteLevelUp = null;

let _lastPosX = CONFIG.startX;
let _lastPosY = CONFIG.startY;
let _lastLevel = 1;
let _lastFacingLeft = false;
let _lastOnLadder = false;
let lastBroadcast = 0;

function initMultiplayer(roomCode, playerName) {
  mpRoomCode = roomCode;
  mpPlayerName = playerName || 'Spieler';

  const colorIndex = Math.abs(hashCode(mpPlayerId)) % CONFIG.playerColors.length;
  mpPlayerColor = CONFIG.playerColors[colorIndex];

  mpChannel = supabaseClient.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: mpPlayerId }
    }
  });

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
      createRemotePlayer(id, payload);
    }
  });

  mpChannel.on('broadcast', { event: 'level_up' }, ({ payload }) => {
    if (onRemoteLevelUp && payload && payload.level) {
      onRemoteLevelUp(payload.level);
    }
  });

  mpChannel.on('broadcast', { event: 'hello' }, ({ payload }) => {
    if (!payload || payload.id === mpPlayerId) return;
    sendPosition(true);
  });

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

    for (const [id, presences] of Object.entries(state)) {
      if (id === mpPlayerId) continue;

      const data = presences[0];
      if (!data) continue;

      if (!remotePlayers.has(id)) {
        createRemotePlayer(id, data);
      }
    }

    updatePlayerCount();
  });

  mpChannel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await mpChannel.track({
        name: mpPlayerName,
        color: mpPlayerColor,
        x: CONFIG.startX,
        y: CONFIG.startY,
        level: 1
      });

      setTimeout(() => {
        mpChannel.send({
          type: 'broadcast',
          event: 'hello',
          payload: { id: mpPlayerId }
        });
      }, 500);
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, rp] of remotePlayers) {
      if (rp.lastSeen && now - rp.lastSeen > 8000) {
        removeRemotePlayer(id);
      }
    }
    updatePlayerCount();
  }, 3000);
}

function sendPosition(force) {
  if (!mpChannel) return;

  if (!force) {
    const now = Date.now();
    if (now - lastBroadcast < CONFIG.syncRate) return;
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

function broadcastPosition(x, y, velX, currentLevel, isOnLadder) {
  _lastPosX = x;
  _lastPosY = y;
  _lastLevel = currentLevel;
  _lastFacingLeft = velX < 0;
  _lastOnLadder = isOnLadder;
  sendPosition(false);
}

function broadcastLevelUp(newLevel) {
  if (!mpChannel) return;

  mpChannel.send({
    type: 'broadcast',
    event: 'level_up',
    payload: { level: newLevel }
  });
}

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
    el,
    label,
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

function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;

  rp.el.remove();
  rp.label.remove();
  remotePlayers.delete(id);
}

function renderRemotePlayers(currentLevel) {
  for (const [, rp] of remotePlayers) {
    if (rp.level !== currentLevel) {
      rp.el.style.display = 'none';
      rp.label.style.display = 'none';
      continue;
    }

    rp.el.style.display = '';
    rp.label.style.display = '';

    rp.currentX += (rp.targetX - rp.currentX) * CONFIG.interpolationFactor;
    rp.currentY += (rp.targetY - rp.currentY) * CONFIG.interpolationFactor;

    rp.el.style.left = rp.currentX + 'px';
    rp.el.style.top = rp.currentY + 'px';
    rp.el.style.transform = rp.facingLeft ? 'scaleX(-1)' : '';

    rp.label.style.left = (rp.currentX + CONFIG.playerWidth / 2) + 'px';
    rp.label.style.top = (rp.currentY - 16) + 'px';
  }
}

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

function updatePlayerCount() {
  const countEl = document.getElementById('playerCount');
  if (countEl) {
    countEl.textContent = remotePlayers.size + 1;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

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
