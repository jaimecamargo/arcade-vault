// ===== components/games/vibora/engine.ts =====
// Motor propio de SNAKE (sin template de referencia — SPEC 09), mismo contrato
// de factory que Asteroids/Tetris/Arkanoid: estado mutable en el closure, sin
// estado de módulo global.

import { FRUIT_ATLAS, FRUIT_POINTS, FRUIT_SHEET_SRC } from "./sprites";

export type ViboraEngine = {
  start(): void;
  stop(): void;
  destroy(): void;
  onScoreChange(cb: (score: number) => void): void;
  onLivesChange(cb: (lives: number) => void): void;
  onLevelChange(cb: (level: number) => void): void;
  onGameOver(cb: () => void): void;
};

const CELL = 25;
const COLS = 32;
const ROWS = 24;
const W = COLS * CELL; // 800
const H = ROWS * CELL; // 600

const SNAKE_BODY_COLOR = "#00ff88"; // var(--green)
const SNAKE_HEAD_COLOR = "#baffdf"; // tono más claro para distinguir la cabeza
const FRUIT_FALLBACK_COLOR = "#ff4d4d";

type Point = { x: number; y: number }; // coordenadas de cuadrícula, no de píxel
type FruitKey = keyof typeof FRUIT_ATLAS;

const FRUIT_KEYS = Object.keys(FRUIT_ATLAS) as FruitKey[];

const DIRECTIONS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function isOpposite(a: Point, b: Point) {
  return a.x === -b.x && a.y === -b.y;
}

// ── Factory ───────────────────────────────────────────────────────────────────
export function createViboraEngine(canvas: HTMLCanvasElement): ViboraEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // ── Sprites ──
  let fruitImg: HTMLImageElement | null = null;
  let spritesReady = false;

  function loadSprites() {
    const img = new Image();
    img.onload = () => {
      spritesReady = true;
    };
    img.onerror = () => {
      console.error("Failed to load fruits spritesheet");
    };
    img.src = FRUIT_SHEET_SRC;
    fruitImg = img;
  }

  // ── Estado del motor (closure, sin estado de módulo) ──
  let snake: Point[]; // [0] = cabeza
  let dir: Point; // dirección actual aplicada
  let queuedDir: Point | null; // próximo cambio de dirección pendiente, 1 por paso
  let fruit: { pos: Point; key: FruitKey } | null;
  let score: number;
  let fruitsEaten: number;
  let level: number;
  let moveInterval: number; // ms entre pasos de cuadrícula
  let accumMs: number; // acumulador de tiempo desde el último paso
  let lastTime: number | null;
  let gameOver: boolean;
  let rafId = 0;
  let running = false;

  let scoreCb: (score: number) => void = () => {};
  let livesCb: (lives: number) => void = () => {};
  let levelCb: (level: number) => void = () => {};
  let gameOverCb: () => void = () => {};

  function randomFreeCell(): Point {
    let p: Point;
    do {
      p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function spawnFruit() {
    const key = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    fruit = { pos: randomFreeCell(), key };
  }

  function initGame() {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ];
    dir = { x: 1, y: 0 };
    queuedDir = null;
    score = 0;
    fruitsEaten = 0;
    level = 1;
    moveInterval = 150;
    accumMs = 0;
    lastTime = null;
    gameOver = false;
    spawnFruit();
  }

  function endGame() {
    gameOver = true;
    livesCb(0);
    gameOverCb();
  }

  function step() {
    if (queuedDir) {
      dir = queuedDir;
      queuedDir = null;
    }

    const head = snake[0];
    const next: Point = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      endGame();
      return;
    }

    const eating = !!fruit && next.x === fruit.pos.x && next.y === fruit.pos.y;
    // Si no come, la cola se libera en este mismo paso (avanza junto con la
    // cabeza) — no cuenta como colisión pisarla. Si come, la cola no se
    // libera (la serpiente crece), así que sigue contando.
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === next.x && s.y === next.y)) {
      endGame();
      return;
    }

    snake.unshift(next);

    if (eating) {
      score += FRUIT_POINTS[fruit!.key];
      scoreCb(score);
      fruitsEaten++;
      const newLevel = Math.floor(fruitsEaten / 5) + 1;
      if (newLevel !== level) {
        level = newLevel;
        levelCb(level);
      }
      moveInterval = Math.max(60, 150 - (level - 1) * 15);
      spawnFruit();
      // sin pop: la fruta comida alarga la serpiente un segmento
    } else {
      snake.pop();
    }
  }

  // ── Dibujo ──
  function drawCell(x: number, y: number, color: string, inset: number) {
    ctx!.fillStyle = color;
    const px = x * CELL;
    const py = y * CELL;
    ctx!.beginPath();
    ctx!.roundRect(px + inset, py + inset, CELL - inset * 2, CELL - inset * 2, 6);
    ctx!.fill();
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      drawCell(seg.x, seg.y, i === 0 ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR, 1);
    }
  }

  function drawFruit() {
    if (!fruit) return;
    if (!spritesReady || !fruitImg) {
      drawCell(fruit.pos.x, fruit.pos.y, FRUIT_FALLBACK_COLOR, 3);
      return;
    }
    const frame = FRUIT_ATLAS[fruit.key];
    // object-fit: contain manual — preserva el aspect ratio original de la
    // fruta, centrado en la celda.
    const scale = Math.min(CELL / frame.w, CELL / frame.h);
    const dw = frame.w * scale;
    const dh = frame.h * scale;
    const cx = fruit.pos.x * CELL + CELL / 2;
    const cy = fruit.pos.y * CELL + CELL / 2;
    ctx!.drawImage(fruitImg, frame.x, frame.y, frame.w, frame.h, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function drawGrid() {
    ctx!.strokeStyle = "rgba(255,255,255,0.05)";
    ctx!.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx!.beginPath();
      ctx!.moveTo(c * CELL, 0);
      ctx!.lineTo(c * CELL, H);
      ctx!.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.beginPath();
      ctx!.moveTo(0, r * CELL);
      ctx!.lineTo(W, r * CELL);
      ctx!.stroke();
    }
  }

  function drawHUD() {
    ctx!.fillStyle = "#fff";
    ctx!.textAlign = "left";
    ctx!.textBaseline = "alphabetic";

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("SCORE", 20, 30);
    ctx!.font = "18px monospace";
    ctx!.fillText(String(score), 20, 52);

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("LEVEL", 20, 82);
    ctx!.font = "18px monospace";
    ctx!.fillText(String(level), 20, 104);

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("LENGTH", 20, 134);
    ctx!.font = "18px monospace";
    ctx!.fillText(String(snake.length), 20, 156);

    ctx!.font = "bold 12px monospace";
    ctx!.fillText("CONTROLS", 20, H - 68);
    ctx!.font = "12px monospace";
    ctx!.fillText("↑ ↓ ← → mover", 20, H - 48);
    ctx!.fillText("evita bordes y tu cola", 20, H - 30);
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H);
    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();
    drawHUD();
  }

  // ── Loop principal ──
  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    // Clampa dt (mismo criterio que Asteroids/Tetris) para que una pausa
    // larga no acumule varios pasos de cuadrícula de golpe al reanudar.
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    accumMs += dt * 1000;
    while (accumMs >= moveInterval && !gameOver) {
      accumMs -= moveInterval;
      step();
    }

    draw();

    if (gameOver) {
      running = false;
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  // ── Input ──
  const TRACKED_CODES = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

  function onKeyDown(e: KeyboardEvent) {
    if (TRACKED_CODES.has(e.code)) e.preventDefault();
    if (!running || gameOver) return;
    const newDir = DIRECTIONS[e.code];
    if (!newDir) return;
    // Descarta un giro de 180° contra la dirección actualmente aplicada
    // (dir), no contra la última tecla presionada — evita chocar contra el
    // primer segmento del cuello en el mismo paso.
    if (isOpposite(newDir, dir)) return;
    queuedDir = newDir;
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = null;
    accumMs = 0;
    scoreCb(score);
    livesCb(1);
    levelCb(level);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function destroy() {
    stop();
    window.removeEventListener("keydown", onKeyDown);
  }

  window.addEventListener("keydown", onKeyDown);

  loadSprites();
  initGame();

  return {
    start,
    stop,
    destroy,
    onScoreChange(cb) {
      scoreCb = cb;
    },
    onLivesChange(cb) {
      livesCb = cb;
    },
    onLevelChange(cb) {
      levelCb = cb;
    },
    onGameOver(cb) {
      gameOverCb = cb;
    },
  };
}
