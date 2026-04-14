// =============================================
// SPIELKONFIGURATION
// Hier kannst du alle Werte anpassen!
// =============================================

const CONFIG = {
  // ----- Welt -----
  worldWidth: 2200,
  worldHeight: 1800,

  // ----- Spieler -----
  playerWidth: 26,
  playerHeight: 34,
  gravity: 0.42,          // Schwerkraft (höher = schneller fallen)
  moveSpeed: 3.6,         // Laufgeschwindigkeit
  jumpPower: 10.5,        // Sprunghöhe
  climbSpeed: 3,          // Klettergeschwindigkeit auf Leitern
  maxJumps: 2,            // Doppelsprung (2 = einmal vom Boden + einmal in der Luft)
  startX: 80,             // Startposition X
  startY: 1660,           // Startposition Y
  startLives: 3,          // Leben am Anfang

  // ----- Kamera -----
  cameraDamping: 0.14,    // Wie schnell die Kamera folgt (0.01 = träge, 0.5 = sofort)
  cameraOffsetX: 0.35,    // Spieler-Position im Bild (0 = links, 0.5 = mitte)
  cameraOffsetY: 0.62,    // Spieler-Position im Bild (0 = oben, 1 = unten)

  // ----- Vögel -----
  birdSpawnInterval: 2600, // ms zwischen Vogel-Spawns
  birdSpawnChance: 0.7,    // Wahrscheinlichkeit pro Intervall (0-1)
  maxBirds: 4,             // Maximale Anzahl gleichzeitiger Vögel
  birdMinSpeed: 2,
  birdMaxSpeed: 3.6,

  // ----- Multiplayer -----
  syncRate: 66,             // ms zwischen Position-Updates (~15Hz)
  interpolationFactor: 0.2, // Glätte der Remote-Spieler-Bewegung (0.05 = sehr glatt, 0.5 = direkt)

  // Farben für Mitspieler (der lokale Spieler behält seine Farbe aus CSS)
  playerColors: [
    '#82b1ff', // Blau
    '#b9f6ca', // Grün
    '#ffe57f', // Gelb
    '#ea80fc', // Lila
    '#80d8ff', // Cyan
    '#ff80ab', // Pink
    '#ccff90', // Limette
    '#ffab91', // Orange
  ],

  // ----- Level -----
  totalLevels: 6
};
