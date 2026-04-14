// =============================================
// LEVEL-DATEN
// Hier kannst du die Level anpassen!
// Jede Plattform ist: [x, y, breite, höhe]
// Jede Leiter ist:    [x, y, höhe]
// Jedes Hindernis:    [x, y, breite, höhe]
// Jeder Stachel:      [x, y]
// Jede Münze:         [x, y]
// Ziel:               [x, y]
// =============================================

const BASE_LEVEL = {
  // --- Plattformen (Böden zum Draufstehen) ---
  platforms: [
    // Erdgeschoss (ganz unten)
    [0, 1740, 520, 60],
    [620, 1740, 220, 60],
    [930, 1700, 260, 60],
    [1280, 1640, 210, 60],
    [1570, 1580, 260, 60],
    [1880, 1510, 180, 60],

    // 1. Etage (kleine Plattformen)
    [80, 1580, 180, 20],
    [320, 1520, 160, 20],
    [560, 1460, 180, 20],
    [800, 1400, 180, 20],
    [1030, 1340, 160, 20],
    [1250, 1280, 160, 20],
    [1470, 1210, 160, 20],
    [1700, 1140, 180, 20],

    // 2. Etage
    [120, 1320, 130, 20],
    [300, 1250, 140, 20],
    [500, 1180, 140, 20],
    [690, 1110, 130, 20],
    [870, 1040, 130, 20],
    [1060, 980, 130, 20],
    [1240, 920, 160, 20],
    [1450, 860, 150, 20],

    // 3. Etage (oben, nahe am Ziel)
    [150, 1000, 140, 20],
    [360, 930, 140, 20],
    [560, 860, 140, 20],
    [770, 790, 140, 20],
    [980, 730, 140, 20],
    [1190, 660, 140, 20],
    [1400, 600, 180, 20]
  ],

  // --- Leitern (zum Hochklettern) ---
  ladders: [
    // Leitern zwischen Erdgeschoss und 1. Etage
    [150, 1560, 140],
    [390, 1500, 140],
    [610, 1440, 140],
    [855, 1380, 140],
    [1080, 1320, 140],
    [1300, 1260, 140],
    [1520, 1190, 140],
    [1760, 1120, 140],

    // Leitern zwischen 1. und 2. Etage
    [185, 1300, 200],
    [395, 1230, 200],
    [600, 1160, 200],
    [790, 1090, 200],
    [970, 1020, 200],
    [1160, 960, 200],
    [1365, 900, 200],

    // Leitern zwischen 2. und 3. Etage
    [210, 980, 190],
    [420, 910, 190],
    [620, 840, 190],
    [830, 770, 190],
    [1040, 710, 190],
    [1250, 640, 190]
  ],

  // --- Hindernisse (rote Blöcke, sofort tot) ---
  obstacles: [
    // Bei den Leitern der 1. Etage
    [120, 1558, 22, 22],
    [360, 1498, 22, 22],
    [610, 1438, 22, 22],
    [850, 1378, 22, 22],
    [1075, 1318, 22, 22],
    [1295, 1258, 22, 22],
    [1515, 1188, 22, 22],

    // Bei den Leitern der 2. Etage
    [170, 1298, 22, 22],
    [350, 1228, 22, 22],
    [550, 1158, 22, 22],
    [740, 1088, 22, 22],
    [920, 1018, 22, 22],
    [1110, 958, 22, 22],
    [1290, 898, 22, 22],

    // Bei den Leitern der 3. Etage
    [210, 978, 22, 22],
    [420, 908, 22, 22],
    [620, 838, 22, 22],
    [830, 768, 22, 22],
    [1040, 708, 22, 22]
  ],

  // --- Stacheln (Dreiecke, sofort tot) ---
  spikes: [
    // Auf dem Erdgeschoss
    [525, 1716], [545, 1716], [565, 1716],
    [845, 1716], [865, 1716], [885, 1716],
    [1495, 1616], [1515, 1616], [1535, 1616],
    [2065, 1486], [2085, 1486],

    // Auf den Etagen
    [260, 1296], [280, 1296],
    [445, 1226], [465, 1226],
    [640, 1156], [660, 1156],
    [835, 1086], [855, 1086],
    [1420, 896], [1440, 896],

    // Zusätzliche Stacheln unten
    [1130, 1716], [1150, 1716], [1170, 1716]
  ],

  // --- Münzen (zum Einsammeln) ---
  coins: [
    // 1. Etage Münzen (immer paarweise)
    [110, 1542], [180, 1542],
    [340, 1482], [410, 1482],
    [590, 1422], [660, 1422],
    [830, 1362], [900, 1362],
    [1050, 1302], [1120, 1302],
    [1270, 1242], [1340, 1242],
    [1490, 1172], [1560, 1172],
    [1730, 1102], [1800, 1102],

    // 2. Etage Münzen
    [150, 1282], [220, 1282],
    [330, 1212], [400, 1212],
    [530, 1142], [600, 1142],
    [720, 1072], [790, 1072],
    [900, 1002], [970, 1002],
    [1090, 942], [1160, 942],
    [1260, 882], [1330, 882],

    // 3. Etage Münzen
    [180, 962], [250, 962],
    [390, 892], [460, 892],
    [590, 822], [660, 822],
    [800, 752], [870, 752],
    [1010, 692], [1080, 692],
    [1220, 622], [1290, 622],
    [1460, 562], [1530, 562]
  ],

  // --- Ziel (grüne Flagge) ---
  goal: [1640, 520]
};

// =============================================
// LEVEL-GENERATOR
// Erzeugt schwerere Versionen des Basis-Levels
// =============================================

function cloneLevel(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function transformLevel(base, n) {
  const lvl = cloneLevel(base);
  const lift = (n - 1) * 110;
  const tighten = (n - 1) * 6;

  lvl.platforms = lvl.platforms.map((p, i) => [
    p[0],
    Math.max(160, p[1] - lift - (i % 3) * 8),
    Math.max(90, p[2] - (i % 4 === 0 ? tighten : 0)),
    p[3]
  ]);

  lvl.ladders = lvl.ladders.map((l, i) => [
    l[0],
    Math.max(130, l[1] - lift - (i % 2) * 6),
    l[2] + (n >= 3 ? 15 : 0)
  ]);

  lvl.obstacles = lvl.obstacles.map((o, i) => [
    o[0],
    Math.max(130, o[1] - lift - (i % 3) * 8),
    22 + (n >= 4 && i % 3 === 0 ? 4 : 0),
    o[3]
  ]);

  lvl.spikes = lvl.spikes.map((s, i) => [
    s[0],
    Math.max(130, s[1] - lift - (i % 4) * 8)
  ]);

  lvl.coins = lvl.coins.map((c, i) => [
    c[0],
    Math.max(90, c[1] - lift - (i % 3) * 8)
  ]);

  lvl.goal = [lvl.goal[0], Math.max(80, lvl.goal[1] - lift - 20)];

  // Zusätzliche Gefahren pro Level
  if (n >= 2) {
    lvl.spikes.push([710, Math.max(120, 960 - lift)], [730, Math.max(120, 960 - lift)]);
  }
  if (n >= 3) {
    lvl.obstacles.push([1580, Math.max(120, 1040 - lift), 26, 22], [1740, Math.max(120, 980 - lift), 26, 22]);
  }
  if (n >= 4) {
    lvl.spikes.push([980, Math.max(120, 690 - lift)], [1000, Math.max(120, 690 - lift)], [1020, Math.max(120, 690 - lift)]);
  }
  if (n >= 5) {
    lvl.obstacles.push([1260, Math.max(120, 860 - lift), 28, 22], [1410, Math.max(120, 800 - lift), 28, 22]);
  }
  if (n >= 6) {
    lvl.spikes.push([1650, Math.max(120, 500 - lift)], [1670, Math.max(120, 500 - lift)]);
    lvl.obstacles.push([1860, Math.max(120, 920 - lift), 30, 22]);
  }

  return lvl;
}

// Alle Level generieren (Index 0 ist leer, Level 1-6)
const LEVELS = [
  null,
  cloneLevel(BASE_LEVEL),
  transformLevel(BASE_LEVEL, 2),
  transformLevel(BASE_LEVEL, 3),
  transformLevel(BASE_LEVEL, 4),
  transformLevel(BASE_LEVEL, 5),
  transformLevel(BASE_LEVEL, 6)
];
