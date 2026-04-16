// =============================================
// SHARED COINS SYSTEM
// Münzen sind für das ganze Team — wenn einer nimmt, ist sie weg für alle
// =============================================

let sharedCoinsChannel = null;
let sharedCoinsReady = false;
let roomCoinsState = {
  total_collected: 0,
  total_available: 48,
  collected_coins: []
};

const playerCoinsCount = new Map();

function initSharedCoins(roomCode) {
  sharedCoinsChannel = supabaseClient.channel(`coins:${roomCode}`, {
    config: {
      broadcast: { self: false }
    }
  });

  // Anderer Spieler hat eine Münze gesammelt → bei uns auch verstecken
  sharedCoinsChannel.on('broadcast', { event: 'coin_collected' }, ({ payload }) => {
    if (!payload) return;

    const { level: coinLevel, coin_index, player_id, player_name } = payload;

    const alreadyCollected = roomCoinsState.collected_coins.some(
      c => c.level === coinLevel && c.coin_index === coin_index
    );

    if (!alreadyCollected) {
      roomCoinsState.collected_coins.push({ level: coinLevel, coin_index, player_id });
      roomCoinsState.total_collected++;

      const currentCount = playerCoinsCount.get(player_id) || 0;
      playerCoinsCount.set(player_id, currentCount + 1);

      // Münze im lokalen Spiel verstecken
      hideLocalCoin(coinLevel, coin_index);

      updateSharedCoinsUI();
    }
  });

  // Ein Spieler fragt nach dem aktuellen Stand
  sharedCoinsChannel.on('broadcast', { event: 'coins_sync' }, ({ payload }) => {
    if (!payload || payload.player_id === mpPlayerId) return;
    sendCoinsState();
  });

  // Ein Spieler hat einen Muenz-Haufen fallen gelassen (Tod)
  sharedCoinsChannel.on('broadcast', { event: 'coin_drop' }, ({ payload }) => {
    if (!payload) return;
    if (typeof createDroppedPile === 'function') {
      createDroppedPile(payload.dropId, payload.x, payload.y, payload.count, payload.level);
    }
  });

  // Ein Spieler hat einen Muenz-Haufen aufgesammelt
  sharedCoinsChannel.on('broadcast', { event: 'coin_pickup' }, ({ payload }) => {
    if (!payload) return;
    if (typeof removeDroppedPile === 'function') {
      removeDroppedPile(payload.dropId);
    }
  });

  // Antwort mit gesamtem Münz-Stand (wenn wir beitreten)
  sharedCoinsChannel.on('broadcast', { event: 'coins_state' }, ({ payload }) => {
    if (!payload) return;

    for (const coin of payload.collected_coins) {
      const alreadyKnown = roomCoinsState.collected_coins.some(
        c => c.level === coin.level && c.coin_index === coin.coin_index
      );

      if (!alreadyKnown) {
        roomCoinsState.collected_coins.push(coin);
        roomCoinsState.total_collected++;

        const count = playerCoinsCount.get(coin.player_id) || 0;
        playerCoinsCount.set(coin.player_id, count + 1);

        // Münze im lokalen Spiel verstecken
        hideLocalCoin(coin.level, coin.coin_index);
      }
    }

    updateSharedCoinsUI();
  });

  sharedCoinsChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      sharedCoinsReady = true;
      // Frage andere Spieler nach bereits gesammelten Münzen
      setTimeout(() => {
        sharedCoinsChannel.send({
          type: 'broadcast',
          event: 'coins_sync',
          payload: { player_id: mpPlayerId }
        });
      }, 500);
    }
  });
}

// Münze im lokalen Spiel verstecken (wenn ein anderer Spieler sie gesammelt hat)
function hideLocalCoin(coinLevel, coinIndex) {
  // Nur wenn wir im gleichen Level sind
  if (typeof level === 'undefined' || typeof coins === 'undefined') return;
  if (coinLevel !== level) return;

  if (coinIndex >= 0 && coinIndex < coins.length) {
    const c = coins[coinIndex];
    if (c && !c.collected) {
      c.collected = true;
      c.el.style.display = 'none';
      if (typeof updateRemaining === 'function') {
        updateRemaining();
      }
    }
  }
}

function onCoinCollected(coinLevel, coinIndex, playerNameLocal) {
  if (!sharedCoinsChannel || !sharedCoinsReady) return;

  try {
    sharedCoinsChannel.send({
      type: 'broadcast',
      event: 'coin_collected',
      payload: {
        level: coinLevel,
        coin_index: coinIndex,
        player_id: mpPlayerId,
        player_name: playerNameLocal
      }
    });
  } catch (e) {
    // Channel noch nicht bereit, kein Problem
    return;
  }

  const alreadyCollected = roomCoinsState.collected_coins.some(
    c => c.level === coinLevel && c.coin_index === coinIndex
  );

  if (!alreadyCollected) {
    roomCoinsState.collected_coins.push({ level: coinLevel, coin_index: coinIndex, player_id: mpPlayerId });
    roomCoinsState.total_collected++;

    const count = playerCoinsCount.get(mpPlayerId) || 0;
    playerCoinsCount.set(mpPlayerId, count + 1);

    updateSharedCoinsUI();
  }
}

function isCoinCollected(coinLevel, coinIndex) {
  return roomCoinsState.collected_coins.some(
    c => c.level === coinLevel && c.coin_index === coinIndex
  );
}

// Broadcast: Muenz-Haufen fallen gelassen
function broadcastCoinDrop(dropId, x, y, count, dropLevel) {
  if (!sharedCoinsChannel || !sharedCoinsReady) return;
  try {
    sharedCoinsChannel.send({
      type: 'broadcast',
      event: 'coin_drop',
      payload: { dropId, x, y, count, level: dropLevel, player_id: mpPlayerId }
    });
  } catch (e) { /* ignore */ }
}

// Broadcast: Muenz-Haufen aufgesammelt
function broadcastCoinPickup(dropId) {
  if (!sharedCoinsChannel || !sharedCoinsReady) return;
  try {
    sharedCoinsChannel.send({
      type: 'broadcast',
      event: 'coin_pickup',
      payload: { dropId, picker_id: mpPlayerId }
    });
  } catch (e) { /* ignore */ }
}

function sendCoinsState() {
  if (!sharedCoinsChannel || !sharedCoinsReady) return;

  try {
    sharedCoinsChannel.send({
      type: 'broadcast',
      event: 'coins_state',
      payload: {
        collected_coins: roomCoinsState.collected_coins,
        total_collected: roomCoinsState.total_collected
      }
    });
  } catch (e) {
    // Ignorieren
  }
}

function updateSharedCoinsUI() {
  const teamScoreEl = document.getElementById('teamScore');
  if (teamScoreEl) {
    teamScoreEl.textContent = 'Team: ' + roomCoinsState.total_collected + '/' + roomCoinsState.total_available;
  }

  const playerStatsEl = document.getElementById('playerStats');
  if (playerStatsEl) {
    let html = '';

    const localCoins = playerCoinsCount.get(mpPlayerId) || 0;
    html += '<div class="player-stat local">' + mpPlayerName + ': ' + localCoins + '</div>';

    for (const [id, rp] of remotePlayers) {
      const rpCoins = playerCoinsCount.get(id) || 0;
      html += '<div class="player-stat remote">' + rp.name + ': ' + rpCoins + '</div>';
    }

    playerStatsEl.innerHTML = html;
  }
}

function cleanupSharedCoins() {
  if (sharedCoinsChannel) {
    sharedCoinsChannel.unsubscribe();
    sharedCoinsChannel = null;
  }

  sharedCoinsReady = false;
  roomCoinsState = {
    total_collected: 0,
    total_available: 48,
    collected_coins: []
  };

  playerCoinsCount.clear();
}
