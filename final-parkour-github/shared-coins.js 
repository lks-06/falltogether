// =============================================
// SHARED COINS SYSTEM
// Münzen sind für das ganze Team — wenn einer nimmt, ist sie weg für alle
// =============================================

let sharedCoinsChannel = null;
let roomCoinsState = {
  total_collected: 0,
  total_available: 48,
  collected_coins: []
};

const playerCoinsCount = new Map();

function initSharedCoins(roomCode) {
  sharedCoinsChannel = supabaseClient.channel(`coins:${roomCode}`, {
    config: {
      broadcast: { self: true },
    }
  });

  sharedCoinsChannel.on('broadcast', { event: 'coin_collected' }, ({ payload }) => {
    if (!payload) return;
    
    const { level, coin_index, player_id, player_name } = payload;
    
    const alreadyCollected = roomCoinsState.collected_coins.some(
      c => c.level === level && c.coin_index === coin_index
    );
    
    if (!alreadyCollected) {
      roomCoinsState.collected_coins.push({ level, coin_index, player_id });
      roomCoinsState.total_collected++;
      
      const currentCount = playerCoinsCount.get(player_id) || 0;
      playerCoinsCount.set(player_id, currentCount + 1);
      
      updateSharedCoinsUI();
      showToast(`${player_name} hat eine Münze gesammelt! 🪙`);
    }
  });

  sharedCoinsChannel.on('broadcast', { event: 'coins_sync' }, ({ payload }) => {
    if (!payload || payload.player_id === mpPlayerId) return;
    sendCoinsState();
  });

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
      }
    }
    
    updateSharedCoinsUI();
  });

  sharedCoinsChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
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

function onCoinCollected(level, coinIndex, playerName) {
  if (!sharedCoinsChannel) return;
  
  sharedCoinsChannel.send({
    type: 'broadcast',
    event: 'coin_collected',
    payload: {
      level: level,
      coin_index: coinIndex,
      player_id: mpPlayerId,
      player_name: playerName
    }
  });
  
  const alreadyCollected = roomCoinsState.collected_coins.some(
    c => c.level === level && c.coin_index === coinIndex
  );
  
  if (!alreadyCollected) {
    roomCoinsState.collected_coins.push({ level, coin_index, player_id: mpPlayerId });
    roomCoinsState.total_collected++;
    
    const count = playerCoinsCount.get(mpPlayerId) || 0;
    playerCoinsCount.set(mpPlayerId, count + 1);
    
    updateSharedCoinsUI();
  }
}

function isCoinCollected(level, coinIndex) {
  return roomCoinsState.collected_coins.some(
    c => c.level === level && c.coin_index === coinIndex
  );
}

function sendCoinsState() {
  if (!sharedCoinsChannel) return;
  
  sharedCoinsChannel.send({
    type: 'broadcast',
    event: 'coins_state',
    payload: {
      collected_coins: roomCoinsState.collected_coins,
      total_collected: roomCoinsState.total_collected
    }
  });
}

function updateSharedCoinsUI() {
  const teamScoreEl = document.getElementById('teamScore');
  if (teamScoreEl) {
    teamScoreEl.textContent = `Team: ${roomCoinsState.total_collected}/${roomCoinsState.total_available} 🪙`;
  }
  
  const playerStatsEl = document.getElementById('playerStats');
  if (playerStatsEl) {
    let html = '';
    
    const localCoins = playerCoinsCount.get(mpPlayerId) || 0;
    html += `<div class="player-stat local">${mpPlayerName}: ${localCoins} 🪙</div>`;
    
    for (const [id, rp] of remotePlayers) {
      const coins = playerCoinsCount.get(id) || 0;
      html += `<div class="player-stat remote">${rp.name}: ${coins} 🪙</div>`;
    }
    
    playerStatsEl.innerHTML = html;
  }
}

function cleanupSharedCoins() {
  if (sharedCoinsChannel) {
    sharedCoinsChannel.unsubscribe();
    sharedCoinsChannel = null;
  }
  
  roomCoinsState = {
    total_collected: 0,
    total_available: 48,
    collected_coins: []
  };
  
  playerCoinsCount.clear();
}
