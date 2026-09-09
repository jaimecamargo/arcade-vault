// ===== components/games/tetris/engine.ts =====
// Port de references/templates/started-games/03-tetris/game.js: misma lógica
// de juego, encapsulada en una factory sin estado de módulo global.

export type TetrisEngine = {
  start(): void;
  stop(): void;
  destroy(): void;
  onScoreChange(cb: (score: number) => void): void;
  onLivesChange(cb: (lives: number) => void): void;
  onLevelChange(cb: (level: number) => void): void;
  onGameOver(cb: () => void): void;
};

const W = 800;
const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const NB = 30;

// Tablero centrado horizontalmente, ocupa el alto completo del canvas.
const BOARD_X = 250;
const BOARD_Y = 0;

// Preview desalineado a propósito: no comparte el centro vertical del tablero.
const PREVIEW_X = 610;
const PREVIEW_Y = 40;

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Piece = { type: number; shape: number[][]; x: number; y: number };

// ── Factory ───────────────────────────────────────────────────────────────────
export function createTetrisEngine(canvas: HTMLCanvasElement): TetrisEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // ── Estado del motor (closure, sin estado de módulo) ──
  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let gameOver: boolean;
  let lastTime: number | null;
  let dropAccum: number;
  let dropInterval: number;
  let rafId = 0;

  let running = false;

  let scoreCb: (score: number) => void = () => {};
  let livesCb: (lives: number) => void = () => {};
  let levelCb: (level: number) => void = () => {};
  let gameOverCb: () => void = () => {};

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      scoreCb(score);
      const newLevel = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(100, 1000 - (level - 1) * 90);
        levelCb(level);
      }
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    scoreCb(score);
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      scoreCb(score);
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      gameOver = true;
      livesCb(0);
      gameOverCb();
    }
  }

  // ── Dibujo ──
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex]!;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx!.strokeStyle = "rgba(255,255,255,0.08)";
    ctx!.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx!.beginPath();
      ctx!.moveTo(c * BLOCK, 0);
      ctx!.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx!.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.beginPath();
      ctx!.moveTo(0, r * BLOCK);
      ctx!.lineTo(COLS * BLOCK, r * BLOCK);
      ctx!.stroke();
    }
  }

  function drawBoard() {
    ctx!.save();
    ctx!.translate(BOARD_X, BOARD_Y);

    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx!, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) drawBlock(ctx!, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx!, current.x + c, current.y + r, current.shape[r][c], BLOCK);

    ctx!.restore();
  }

  function drawNext() {
    ctx!.save();
    ctx!.translate(PREVIEW_X, PREVIEW_Y);

    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, 4 * NB, 4 * NB);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) drawBlock(ctx!, offX + c, offY + r, shape[r][c], NB);

    ctx!.restore();
  }

  function drawHUD() {
    ctx!.fillStyle = "#fff";
    ctx!.textAlign = "left";
    ctx!.textBaseline = "alphabetic";

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("SCORE", 20, 40);
    ctx!.font = "20px monospace";
    ctx!.fillText(score.toLocaleString(), 20, 66);

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("LINES", 20, 110);
    ctx!.font = "20px monospace";
    ctx!.fillText(String(lines), 20, 136);

    ctx!.font = "bold 14px monospace";
    ctx!.fillText("LEVEL", 20, 180);
    ctx!.font = "20px monospace";
    ctx!.fillText(String(level), 20, 206);

    ctx!.font = "bold 13px monospace";
    ctx!.fillText("NEXT", PREVIEW_X, PREVIEW_Y - 12);

    ctx!.font = "bold 13px monospace";
    ctx!.fillText("CONTROLS", PREVIEW_X, PREVIEW_Y + 4 * NB + 34);
    ctx!.font = "13px monospace";
    const controls = ["← → mover", "↑ / X rotar", "↓ bajar", "SPACE caída"];
    controls.forEach((line, i) => {
      ctx!.fillText(line, PREVIEW_X, PREVIEW_Y + 4 * NB + 58 + i * 20);
    });
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H);
    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, W, H);

    drawBoard();
    drawNext();
    drawHUD();
  }

  // ── Loop principal ──
  function loop(ts: number) {
    if (lastTime === null) lastTime = ts;
    // Clampa dt (mismo criterio que Asteroids: 0.05s ≈ 50ms) para que una
    // pausa larga no dispare dropAccum y haga caer la pieza varias filas.
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;

    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }

    if (gameOver) {
      running = false;
      return;
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ── Input ──
  const TRACKED_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyX"]);

  function onKeyDown(e: KeyboardEvent) {
    if (TRACKED_CODES.has(e.code)) e.preventDefault();
    if (!running || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    lastTime = null;
    next = randomPiece();
    spawn();
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = null;
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
