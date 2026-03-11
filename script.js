const GRID_SIZE = 20;
const CELL_COUNT = 20;
const BASE_TICK_MS = 140;
const MIN_TICK_MS = 70;
const LEVEL_SCORE_STEP = 50;
const POWERUP_SPAWN_CHANCE = 0.08;
const POWERUP_DURATION_MS = 10000;
const POWERUP_DESPAWN_MS = 6000;

const board = document.getElementById("board");
const ctx = board.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const leaderboardList = document.getElementById("leaderboard-list");
const gamePanel = document.querySelector(".game");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const mapNameEl = document.getElementById("map-name");
const startBtn = document.getElementById("start-btn");
const newBtn = document.getElementById("new-btn");
const continueBtn = document.getElementById("continue-btn");
const clearLeaderboardBtn = document.getElementById("clear-leaderboard-btn");
const resetBtn = document.getElementById("reset-btn");
const menuActions = document.getElementById("menu-actions");
const statusActions = document.getElementById("status-actions");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const skinOptions = document.getElementById("skin-options");
const skinPreview = document.getElementById("skin-preview");

const bestScoreKey = "snake.bestScore";
const bestLevelKey = "snake.bestLevel";
const leaderboardKey = "snake.leaderboard";
const skinKey = "snake.skin";

const directionMap = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const state = {
  snake: [],
  direction: { x: 1, y: 0 },
  pendingDirection: { x: 1, y: 0 },
  food: { x: 0, y: 0 },
  powerUp: null,
  map: null,
  obstacles: [],
  score: 0,
  level: 1,
  running: false,
  paused: false,
  gameOver: false,
  timer: null,
  sessionBestScore: 0,
  skinId: "classic",
  activeEffect: null,
  nextMap: null,
  headAngle: 0,
  targetAngle: 0,
};

const audio = {
  context: null,
  enabled: false,
};

const headImage = new Image();
headImage.src = "snake-head.png";

const skins = [
  {
    id: "classic",
    name: "Classic Green",
    head: "#1f4a29",
    body: "#2f6b3c",
    accent: "#1f4a29",
    style: "smooth",
  },
  {
    id: "neon",
    name: "Neon Blue",
    head: "#00d4ff",
    body: "#0077ff",
    accent: "#00d4ff",
    style: "smooth",
  },
  {
    id: "pixel",
    name: "Retro Pixel",
    head: "#ffb703",
    body: "#fb8500",
    accent: "#ffb703",
    style: "pixel",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    head: "#ff6b6b",
    body: "#ffd93d",
    accent: "#4cc9f0",
    style: "rainbow",
  },
  {
    id: "dark",
    name: "Dark Mode",
    head: "#0f0f0f",
    body: "#1f1f1f",
    accent: "#0f0f0f",
    style: "dark",
  },
];

const maps = [
  {
    id: "classic",
    name: "Classic",
    createObstacles: () => [],
  },
  {
    id: "maze",
    name: "Maze",
    createObstacles: () => {
      const walls = [];
      for (let x = 2; x < 18; x += 1) {
        if (x === 9 || x === 10) continue;
        walls.push({ x, y: 6, solid: true });
        walls.push({ x, y: 13, solid: true });
      }
      for (let y = 2; y < 18; y += 1) {
        if (y === 9 || y === 10) continue;
        walls.push({ x: 6, y, solid: true });
        walls.push({ x: 13, y, solid: true });
      }
      return walls;
    },
  },
  {
    id: "arena",
    name: "Arena",
    createObstacles: () => [
      { x: 4, y: 4, dx: 1, dy: 0, min: 2, max: 17 },
      { x: 15, y: 9, dx: -1, dy: 0, min: 2, max: 17 },
      { x: 9, y: 15, dx: 0, dy: 1, min: 2, max: 17 },
    ],
  },
];

function getBestScore() {
  const stored = Number(localStorage.getItem(bestScoreKey));
  return Number.isFinite(stored) ? stored : 0;
}

function setBestScore(value) {
  localStorage.setItem(bestScoreKey, String(value));
}

function getBestLevel() {
  const stored = Number(localStorage.getItem(bestLevelKey));
  return Number.isFinite(stored) && stored > 0 ? stored : 1;
}

function setBestLevel(value) {
  localStorage.setItem(bestLevelKey, String(value));
}

function getLeaderboard() {
  const raw = localStorage.getItem(leaderboardKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function setLeaderboard(entries) {
  localStorage.setItem(leaderboardKey, JSON.stringify(entries));
}

function getRandomMap() {
  return maps[Math.floor(Math.random() * maps.length)];
}

function rollNextMap() {
  state.nextMap = getRandomMap();
  updateMapName();
}

function getSavedSkin() {
  const stored = localStorage.getItem(skinKey);
  const valid = skins.find((skin) => skin.id === stored);
  return valid ? valid.id : "classic";
}

function setSavedSkin(id) {
  localStorage.setItem(skinKey, id);
}

function resetState(startLevel, map) {
  state.snake = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
  ];
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };
  state.level = startLevel;
  state.score = (startLevel - 1) * LEVEL_SCORE_STEP;
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.map = map;
  state.obstacles = map.createObstacles();
  state.food = spawnFood(state.snake);
  state.powerUp = null;
  state.activeEffect = null;
  state.targetAngle = getDirectionAngle(state.direction);
  state.headAngle = state.targetAngle;
  updateScore();
  updateEffectUI();
  updateMapName();
}

function getActiveSkin() {
  return skins.find((skin) => skin.id === state.skinId) || skins[0];
}

function updateSkinPreview() {
  const skin = getActiveSkin();
  skinPreview.className = "skin-preview";
  skinPreview.classList.add(skin.style);
  const segments = skinPreview.querySelectorAll(".segment");
  segments.forEach((segment, index) => {
    if (skin.style === "rainbow") {
      return;
    }
    const color = index === 0 ? skin.head : skin.body;
    segment.style.background = color;
  });
}

function renderSkinOptions() {
  skinOptions.innerHTML = "";
  skins.forEach((skin) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = skin.name;
    if (skin.id === state.skinId) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      state.skinId = skin.id;
      setSavedSkin(skin.id);
      renderSkinOptions();
      updateSkinPreview();
    });
    skinOptions.appendChild(button);
  });
}

function updateScore() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  const best = Math.max(getBestScore(), state.score);
  bestEl.textContent = String(best);
  if (state.score > getBestScore()) {
    setBestScore(state.score);
  }
  if (state.level > getBestLevel()) {
    setBestLevel(state.level);
  }
}

function updateMapName() {
  if (state.running && state.map) {
    mapNameEl.textContent = state.map.name;
  } else if (state.nextMap) {
    mapNameEl.textContent = state.nextMap.name;
  }
}

function updateEffectUI() {
  const bar = document.getElementById("status-bar");
  const nameEl = document.getElementById("effect-name");
  const timerEl = document.getElementById("effect-timer");
  if (!state.activeEffect) {
    nameEl.textContent = "None";
    timerEl.textContent = "0s";
    bar.classList.remove("active");
    return;
  }
  nameEl.textContent = state.activeEffect.label;
  const remainingMs = Math.max(0, state.activeEffect.expiresAt - Date.now());
  timerEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;
  bar.classList.add("active");
}

function updateLeaderboardUI(entries, highlightKey = "") {
  leaderboardList.innerHTML = "";
  if (entries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No scores yet.";
    leaderboardList.appendChild(item);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    const entryKey = `${entry.score}-${entry.level}-${entry.date}`;
    if (highlightKey && entryKey === highlightKey) {
      item.classList.add("highlight");
    }
    const date = new Date(entry.date);
    const dateLabel = Number.isNaN(date.getTime())
      ? ""
      : ` \u2022 ${date.toLocaleDateString()}`;
    item.textContent = `Score ${entry.score} (Lv ${entry.level})${dateLabel}`;
    leaderboardList.appendChild(item);
  });
}

function setOverlay(title, subtitle, showMenu = false) {
  overlayTitle.textContent = title;
  overlaySubtitle.textContent = subtitle;
  if (showMenu) {
    menuActions.classList.remove("hidden");
    statusActions.classList.add("hidden");
  } else {
    menuActions.classList.add("hidden");
    statusActions.classList.remove("hidden");
  }
  overlay.classList.remove("hidden");
}

function setStatusButton(label) {
  startBtn.textContent = label;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function spawnFood(snake) {
  const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
  state.obstacles.forEach((obs) => occupied.add(`${obs.x},${obs.y}`));
  let spot = null;
  while (!spot) {
    const candidate = {
      x: Math.floor(Math.random() * CELL_COUNT),
      y: Math.floor(Math.random() * CELL_COUNT),
    };
    if (!occupied.has(`${candidate.x},${candidate.y}`)) {
      spot = candidate;
    }
  }
  return spot;
}

function spawnPowerUp(snake, food) {
  if (state.powerUp || Math.random() > POWERUP_SPAWN_CHANCE) return;
  const occupied = new Set(
    snake
      .map((seg) => `${seg.x},${seg.y}`)
      .concat(`${food.x},${food.y}`)
      .concat(state.obstacles.map((obs) => `${obs.x},${obs.y}`)),
  );
  let spot = null;
  while (!spot) {
    const candidate = {
      x: Math.floor(Math.random() * CELL_COUNT),
      y: Math.floor(Math.random() * CELL_COUNT),
    };
    if (!occupied.has(`${candidate.x},${candidate.y}`)) {
      spot = candidate;
    }
  }

  const types = [
    { id: "speed", label: "Speed Boost", color: "#ff9f1c" },
    { id: "slow", label: "Slow Motion", color: "#3a86ff" },
    { id: "double", label: "Double Score", color: "#9b5de5" },
  ];
  const pick = types[Math.floor(Math.random() * types.length)];
  state.powerUp = {
    ...pick,
    x: spot.x,
    y: spot.y,
    spawnedAt: Date.now(),
  };
}

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function setDirection(nextDir) {
  if (!nextDir) return;
  if (isOpposite(nextDir, state.direction)) return;
  state.pendingDirection = nextDir;
}

function getLevelFromScore(score) {
  return Math.floor(score / LEVEL_SCORE_STEP) + 1;
}

function getTickMs(level) {
  const speed = BASE_TICK_MS - (level - 1) * 8;
  return Math.max(MIN_TICK_MS, speed);
}

function updateSpeed() {
  if (!state.timer) return;
  clearInterval(state.timer);
  state.timer = setInterval(step, getTickMs(state.level) * getEffectSpeedMultiplier());
}

function getEffectSpeedMultiplier() {
  if (!state.activeEffect) return 1;
  if (state.activeEffect.id === "speed") return 0.7;
  if (state.activeEffect.id === "slow") return 1.4;
  return 1;
}

function getDirectionAngle(direction) {
  if (direction.x === 1) return 0;
  if (direction.x === -1) return Math.PI;
  if (direction.y === 1) return Math.PI / 2;
  return -Math.PI / 2;
}

function lerpAngle(current, target, t) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

function updateMovingObstacles() {
  if (!state.map || state.map.id !== "arena") return;
  state.obstacles.forEach((obs) => {
    if (obs.dx !== 0) {
      obs.x += obs.dx;
      if (obs.x <= obs.min || obs.x >= obs.max) {
        obs.dx *= -1;
        obs.x = Math.max(obs.min, Math.min(obs.max, obs.x));
      }
    } else if (obs.dy !== 0) {
      obs.y += obs.dy;
      if (obs.y <= obs.min || obs.y >= obs.max) {
        obs.dy *= -1;
        obs.y = Math.max(obs.min, Math.min(obs.max, obs.y));
      }
    }
  });
}

function ensureAudio() {
  if (audio.context) return;
  audio.context = new (window.AudioContext || window.webkitAudioContext)();
  audio.enabled = true;
}

function playTone({ freq, duration = 0.08, type = "square", volume = 0.15 }) {
  if (!audio.enabled || !audio.context) return;
  const ctxAudio = audio.context;
  const oscillator = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctxAudio.destination);
  oscillator.start();
  oscillator.stop(ctxAudio.currentTime + duration);
}

function playSound(effect) {
  if (!audio.enabled) return;
  if (effect === "eat") {
    playTone({ freq: 520, duration: 0.07, type: "square", volume: 0.12 });
  } else if (effect === "level") {
    playTone({ freq: 620, duration: 0.08, type: "triangle", volume: 0.15 });
    setTimeout(() => playTone({ freq: 780, duration: 0.08, type: "triangle", volume: 0.12 }), 90);
  } else if (effect === "gameover") {
    playTone({ freq: 220, duration: 0.12, type: "sawtooth", volume: 0.18 });
  }
}

function triggerLevelUp() {
  gamePanel.classList.remove("level-up");
  void gamePanel.offsetWidth;
  gamePanel.classList.add("level-up");
  setTimeout(() => gamePanel.classList.remove("level-up"), 520);
}

function step() {
  if (!state.running || state.paused || state.gameOver) return;

  if (state.powerUp && Date.now() - state.powerUp.spawnedAt > POWERUP_DESPAWN_MS) {
    state.powerUp = null;
  }

  if (state.activeEffect && Date.now() >= state.activeEffect.expiresAt) {
    state.activeEffect = null;
    updateSpeed();
  }

  updateMovingObstacles();

  state.direction = state.pendingDirection;
  state.targetAngle = getDirectionAngle(state.direction);
  const head = state.snake[0];
  const next = { x: head.x + state.direction.x, y: head.y + state.direction.y };

  const hitWall =
    next.x < 0 ||
    next.x >= CELL_COUNT ||
    next.y < 0 ||
    next.y >= CELL_COUNT;
  if (hitWall) {
    endGame();
    return;
  }

  const hitSelf = state.snake.some((seg) => seg.x === next.x && seg.y === next.y);
  if (hitSelf) {
    endGame();
    return;
  }

  const hitObstacle = state.obstacles.some((obs) => obs.x === next.x && obs.y === next.y);
  if (hitObstacle) {
    endGame();
    return;
  }

  const newSnake = [next, ...state.snake];
  if (next.x === state.food.x && next.y === state.food.y) {
    const multiplier = state.activeEffect && state.activeEffect.id === "double" ? 2 : 1;
    state.score += 10 * multiplier;
    const nextLevel = getLevelFromScore(state.score);
    if (nextLevel !== state.level) {
      state.level = nextLevel;
      updateSpeed();
      triggerLevelUp();
      playSound("level");
    }
    state.food = spawnFood(newSnake);
    playSound("eat");
  } else {
    newSnake.pop();
  }

  if (state.powerUp && next.x === state.powerUp.x && next.y === state.powerUp.y) {
    state.activeEffect = {
      id: state.powerUp.id,
      label: state.powerUp.label,
      expiresAt: Date.now() + POWERUP_DURATION_MS,
    };
    state.powerUp = null;
    updateSpeed();
  }

  state.snake = newSnake;
  const obstacleHit = state.obstacles.some((obs) =>
    state.snake.some((seg) => seg.x === obs.x && seg.y === obs.y),
  );
  if (obstacleHit) {
    endGame();
    return;
  }
  updateScore();
  updateEffectUI();
  spawnPowerUp(state.snake, state.food);
  draw();
}

function drawCell(x, y, color, radius = 6) {
  const padding = 1;
  const size = GRID_SIZE - padding * 2;
  const px = x * GRID_SIZE + padding;
  const py = y * GRID_SIZE + padding;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(px, py, size, size, radius);
  ctx.fill();
}

function drawGrid() {
  ctx.clearRect(0, 0, board.width, board.height);
  ctx.fillStyle = "#faf8f4";
  ctx.fillRect(0, 0, board.width, board.height);

  ctx.strokeStyle = "#ece6db";
  ctx.lineWidth = 1;
  for (let i = 0; i <= CELL_COUNT; i += 1) {
    const pos = i * GRID_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, board.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(board.width, pos);
    ctx.stroke();
  }
}

function drawSnake() {
  const skin = getActiveSkin();
  state.snake.forEach((segment, index) => {
    if (headImage.complete) {
      const padding = 1;
      const size = GRID_SIZE - padding * 2;
      const px = segment.x * GRID_SIZE + padding;
      const py = segment.y * GRID_SIZE + padding;
      if (index === 0) {
        state.headAngle = lerpAngle(state.headAngle, state.targetAngle, 0.25);
        const angle = state.headAngle;
        ctx.save();
        ctx.translate(px + size / 2, py + size / 2);
        ctx.rotate(angle);
        ctx.drawImage(headImage, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(headImage, px, py, size, size);
      }
      return;
    }

    let color = index === 0 ? skin.head : skin.body;
    let radius = index === 0 ? 8 : 6;
    if (skin.style === "pixel") {
      radius = 2;
    } else if (skin.style === "rainbow") {
      const rainbow = ["#ff6b6b", "#ffd93d", "#4cc9f0", "#5efc8d", "#b5179e"];
      color = rainbow[index % rainbow.length];
    }
    drawCell(segment.x, segment.y, color, radius);
  });
}

function drawFood() {
  drawCell(state.food.x, state.food.y, "#d74b4b", 8);
}

function drawPowerUp() {
  if (!state.powerUp) return;
  drawCell(state.powerUp.x, state.powerUp.y, state.powerUp.color, 8);
}

function drawObstacles() {
  state.obstacles.forEach((obs) => {
    const color = state.map && state.map.id === "arena" ? "#8d99ae" : "#7c6f64";
    drawCell(obs.x, obs.y, color, 3);
  });
}

function draw() {
  drawGrid();
  drawObstacles();
  drawFood();
  drawPowerUp();
  drawSnake();
}

function startGame(startLevel = 1, selectedMap = null) {
  if (state.timer) clearInterval(state.timer);
  state.sessionBestScore = getBestScore();
  const map = selectedMap || state.nextMap || getRandomMap();
  resetState(startLevel, map);
  state.running = true;
  state.paused = false;
  hideOverlay();
  draw();
  state.timer = setInterval(step, getTickMs(state.level));
  rollNextMap();
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    setStatusButton("Resume");
    setOverlay("Paused", "Press space or resume to continue.");
  } else {
    hideOverlay();
  }
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  setStatusButton("Restart");
  setOverlay("Game Over", "Press restart to play again.");
  playSound("gameover");
  const isNewHighScore = state.score > state.sessionBestScore;
  const entry = {
    score: state.score,
    level: state.level,
    date: new Date().toISOString(),
  };
  const highlightKey = isNewHighScore
    ? `${entry.score}-${entry.level}-${entry.date}`
    : "";
  const leaderboard = [entry, ...getLeaderboard()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  setLeaderboard(leaderboard);
  updateLeaderboardUI(leaderboard, highlightKey);
}

function handleKey(event) {
  const nextDir = directionMap[event.key];
  if (nextDir) {
    event.preventDefault();
    ensureAudio();
    if (!state.running && !state.gameOver) {
      startGame(1);
    }
    setDirection(nextDir);
  } else if (event.key === " ") {
    event.preventDefault();
    ensureAudio();
    togglePause();
  } else if (event.key === "Enter") {
    ensureAudio();
    if (state.gameOver) {
      startGame(1);
    }
  }
}

function handleControlClick(event) {
  const button = event.target.closest("button[data-dir]");
  if (!button) return;
  ensureAudio();
  const dir = button.dataset.dir;
  const mapping = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  if (!state.running && !state.gameOver) {
    startGame(1);
  }
  setDirection(mapping[dir]);
}

function handlePauseButton() {
  if (!state.running) return;
  ensureAudio();
  togglePause();
}

function handleRestart() {
  ensureAudio();
  startGame(1);
}

function handleNewGame() {
  ensureAudio();
  startGame(1);
}

function handleContinue() {
  ensureAudio();
  startGame(getBestLevel());
}

function handleClearLeaderboard() {
  localStorage.removeItem(leaderboardKey);
  updateLeaderboardUI([]);
}

function handleResetProgress() {
  localStorage.removeItem(bestScoreKey);
  localStorage.removeItem(bestLevelKey);
  localStorage.removeItem(leaderboardKey);
  localStorage.removeItem(skinKey);
  bestEl.textContent = "0";
  levelEl.textContent = "1";
  scoreEl.textContent = "0";
  state.skinId = "classic";
  renderSkinOptions();
  updateSkinPreview();
  setOverlay("Progress Reset", "Start a new game to play.", true);
  updateLeaderboardUI([]);
  rollNextMap();
  updateMenuVisibility();
}

function updateMenuVisibility() {
  const bestLevel = getBestLevel();
  if (bestLevel > 1) {
    continueBtn.disabled = false;
    continueBtn.textContent = `Continue (Level ${bestLevel})`;
  } else {
    continueBtn.disabled = true;
    continueBtn.textContent = "Continue";
  }
}

function init() {
  board.width = GRID_SIZE * CELL_COUNT;
  board.height = GRID_SIZE * CELL_COUNT;
  bestEl.textContent = String(getBestScore());
  state.skinId = getSavedSkin();
  renderSkinOptions();
  updateSkinPreview();
  rollNextMap();
  resetState(1, state.nextMap);
  draw();
  updateMenuVisibility();
  updateLeaderboardUI(getLeaderboard());
  setOverlay("Welcome Back", "Pick where you want to start.", true);

  document.addEventListener("keydown", handleKey);
  document.querySelector(".controls").addEventListener("click", handleControlClick);
  startBtn.addEventListener("click", handleRestart);
  newBtn.addEventListener("click", handleNewGame);
  continueBtn.addEventListener("click", handleContinue);
  clearLeaderboardBtn.addEventListener("click", handleClearLeaderboard);
  resetBtn.addEventListener("click", handleResetProgress);
  pauseBtn.addEventListener("click", handlePauseButton);
  restartBtn.addEventListener("click", handleRestart);
}

init();
