const GRID_SIZE = 20;
const CELL_COUNT = 20;
const TICK_MS = 120;

const board = document.getElementById("board");
const ctx = board.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");

const bestScoreKey = "snake.bestScore";

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
  score: 0,
  running: false,
  paused: false,
  gameOver: false,
  timer: null,
};

function getBestScore() {
  const stored = Number(localStorage.getItem(bestScoreKey));
  return Number.isFinite(stored) ? stored : 0;
}

function setBestScore(value) {
  localStorage.setItem(bestScoreKey, String(value));
}

function resetState() {
  state.snake = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
  ];
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };
  state.score = 0;
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.food = spawnFood(state.snake);
  updateScore();
}

function updateScore() {
  scoreEl.textContent = String(state.score);
  const best = Math.max(getBestScore(), state.score);
  bestEl.textContent = String(best);
  if (state.score > getBestScore()) {
    setBestScore(state.score);
  }
}

function setOverlay(title, subtitle, showButton = true) {
  overlayTitle.textContent = title;
  overlaySubtitle.textContent = subtitle;
  startBtn.style.display = showButton ? "inline-flex" : "none";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function spawnFood(snake) {
  const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
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

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function setDirection(nextDir) {
  if (!nextDir) return;
  if (isOpposite(nextDir, state.direction)) return;
  state.pendingDirection = nextDir;
}

function step() {
  if (!state.running || state.paused || state.gameOver) return;

  state.direction = state.pendingDirection;
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

  const newSnake = [next, ...state.snake];
  if (next.x === state.food.x && next.y === state.food.y) {
    state.score += 10;
    state.food = spawnFood(newSnake);
  } else {
    newSnake.pop();
  }

  state.snake = newSnake;
  updateScore();
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
  state.snake.forEach((segment, index) => {
    const color = index === 0 ? "#1f4a29" : "#2f6b3c";
    drawCell(segment.x, segment.y, color, index === 0 ? 8 : 6);
  });
}

function drawFood() {
  drawCell(state.food.x, state.food.y, "#d74b4b", 8);
}

function draw() {
  drawGrid();
  drawFood();
  drawSnake();
}

function startGame() {
  if (state.timer) clearInterval(state.timer);
  resetState();
  state.running = true;
  state.paused = false;
  hideOverlay();
  draw();
  state.timer = setInterval(step, TICK_MS);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    setOverlay("Paused", "Press space or resume to continue.", false);
  } else {
    hideOverlay();
  }
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  setOverlay("Game Over", "Press restart to play again.", false);
}

function handleKey(event) {
  const nextDir = directionMap[event.key];
  if (nextDir) {
    event.preventDefault();
    if (!state.running && !state.gameOver) {
      startGame();
    }
    setDirection(nextDir);
  } else if (event.key === " ") {
    event.preventDefault();
    togglePause();
  } else if (event.key === "Enter") {
    if (state.gameOver) {
      startGame();
    }
  }
}

function handleControlClick(event) {
  const button = event.target.closest("button[data-dir]");
  if (!button) return;
  const dir = button.dataset.dir;
  const mapping = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  if (!state.running && !state.gameOver) {
    startGame();
  }
  setDirection(mapping[dir]);
}

function handlePauseButton() {
  if (!state.running) return;
  togglePause();
}

function handleRestart() {
  startGame();
}

function init() {
  board.width = GRID_SIZE * CELL_COUNT;
  board.height = GRID_SIZE * CELL_COUNT;
  bestEl.textContent = String(getBestScore());
  resetState();
  draw();
  setOverlay("Press Start", "Use arrow keys or WASD.");

  document.addEventListener("keydown", handleKey);
  document.querySelector(".controls").addEventListener("click", handleControlClick);
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", handlePauseButton);
  restartBtn.addEventListener("click", handleRestart);
}

init();
