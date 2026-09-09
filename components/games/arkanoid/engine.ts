// ===== components/games/arkanoid/engine.ts =====
// Port de references/templates/started-games/04-arkanoid/game.js: misma lógica
// de juego, encapsulada en una factory sin estado de módulo global.

import { LEVELS } from "./levels";
import {
    EXPLOSION_FRAMES,
    EXPLOSION_DURATION,
    drawSprite,
    drawFrame,
} from "./sprites";

export type ArkanoidEngine = {
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

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";

type Block = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    alive: boolean;
};

type Explosion = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    elapsed: number;
};

function collideAABB(
    ball: { x: number; y: number; w: number; h: number },
    block: Block,
) {
    return (
        ball.x < block.x + block.w &&
        ball.x + ball.w > block.x &&
        ball.y < block.y + block.h &&
        ball.y + ball.h > block.y
    );
}

export function createArkanoidEngine(canvas: HTMLCanvasElement): ArkanoidEngine {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

    // ── Sprites ──
    let ssImg: HTMLCanvasElement | null = null;
    let spritesReady = false;

    function loadSpritesheet() {
        const rawImg = new Image();
        rawImg.onload = () => {
            const oc = document.createElement("canvas");
            oc.width = rawImg.width;
            oc.height = rawImg.height;
            const octx = oc.getContext("2d");
            if (octx) {
                octx.drawImage(rawImg, 0, 0);
                ssImg = oc;
                spritesReady = true;
            }
        };
        rawImg.onerror = () => {
            console.error("Failed to load spritesheet");
        };
        rawImg.src = SPRITESHEET_SRC;
    }

    // ── Input ──
    const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

    function onKeyDown(e: KeyboardEvent) {
        if (e.code in keys) {
            e.preventDefault();
            keys[e.code] = true;
        }
    }
    function onKeyUp(e: KeyboardEvent) {
        if (e.code in keys) keys[e.code] = false;
    }
    function onMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const mouseX = (e.clientX - rect.left) * scaleX;
        paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
    }

    // ── Estado del juego ──
    const paddle = { x: 0, y: 560, w: 81, h: 14 };
    const ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
    let blocks: Block[] = [];
    let explosions: Explosion[] = [];
    let lives = 3;
    let score = 0;
    let gameState: "playing" | "gameover" = "playing";
    let currentLevel = 1;

    let scoreCb: (score: number) => void = () => {};
    let livesCb: (lives: number) => void = () => {};
    let levelCb: (level: number) => void = () => {};
    let gameOverCb: () => void = () => {};

    let running = false;
    let rafId = 0;
    let lastTime: number | null = null;

    function initPaddle() {
        paddle.x = (W - paddle.w) / 2;
    }

    function initBall() {
        const speed = LEVELS[currentLevel - 1].speed;
        ball.x = paddle.x + (paddle.w - ball.w) / 2;
        ball.y = paddle.y - ball.h;
        ball.vx = BASE_BALL_VX * speed;
        ball.vy = BASE_BALL_VY * speed;
    }

    function loadLevel(n: number) {
        currentLevel = n;
        const level = LEVELS[n - 1];
        blocks = level.blocks.map((b) => ({
            x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
            y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
            w: BLOCK_W,
            h: BLOCK_H,
            color: b.color,
            alive: true,
        }));
        explosions = [];
        ball.x = paddle.x + (paddle.w - ball.w) / 2;
        ball.y = paddle.y - ball.h;
        ball.vx = BASE_BALL_VX * level.speed;
        ball.vy = BASE_BALL_VY * level.speed;
        levelCb(currentLevel);
    }

    function initGame() {
        lives = 3;
        score = 0;
        gameState = "playing";
        initPaddle();
        loadLevel(1);
    }

    // ── Update ──
    function update(dt: number) {
        if (gameState !== "playing") return;

        // Paddle (teclado)
        if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
        if (keys.ArrowRight)
            paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

        // Ball movement
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Wall bounces (left, right, top)
        if (ball.x <= 0) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
        }
        if (ball.x + ball.w >= W) {
            ball.x = W - ball.w;
            ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
        }

        // Paddle bounce
        if (
            ball.vy > 0 &&
            ball.x + ball.w > paddle.x &&
            ball.x < paddle.x + paddle.w &&
            ball.y + ball.h >= paddle.y &&
            ball.y + ball.h <= paddle.y + paddle.h + 8
        ) {
            ball.y = paddle.y - ball.h;
            ball.vy = -Math.abs(ball.vy);
        }

        // Block collisions (uno por frame)
        for (const block of blocks) {
            if (!block.alive) continue;
            if (collideAABB(ball, block)) {
                block.alive = false;
                explosions.push({
                    x: block.x,
                    y: block.y,
                    w: block.w,
                    h: block.h,
                    color: block.color,
                    elapsed: 0,
                });
                score += 10;
                scoreCb(score);
                ball.vy = -ball.vy;
                if (blocks.every((b) => !b.alive)) {
                    if (currentLevel < 5) {
                        loadLevel(currentLevel + 1);
                    } else {
                        gameState = "gameover";
                    }
                }
                break;
            }
        }

        // Explosions
        for (const exp of explosions) exp.elapsed += dt * 1000;
        explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

        // Ball lost
        if (ball.y > H) {
            lives--;
            livesCb(lives);
            if (lives <= 0) {
                lives = 0;
                gameState = "gameover";
            } else {
                initBall();
            }
        }
    }

    // ── Draw ──
    function drawBlockOrFallback(block: Block) {
        if (spritesReady && ssImg) {
            drawSprite(ctx!, ssImg, "block_" + block.color, block.x, block.y, block.w, block.h);
        } else {
            ctx!.fillStyle = block.color;
            ctx!.fillRect(block.x, block.y, block.w, block.h);
        }
    }

    function drawExplosionOrFallback(exp: Explosion) {
        if (spritesReady && ssImg) {
            const frameIndex = Math.min(
                Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
                3,
            );
            drawFrame(ctx!, ssImg, EXPLOSION_FRAMES[exp.color][frameIndex], exp.x, exp.y, exp.w, exp.h);
        } else {
            ctx!.fillStyle = exp.color;
            ctx!.fillRect(exp.x, exp.y, exp.w, exp.h);
        }
    }

    function drawPaddleOrFallback() {
        if (spritesReady && ssImg) {
            drawSprite(ctx!, ssImg, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
        } else {
            ctx!.fillStyle = "#fff";
            ctx!.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
        }
    }

    function drawBallOrFallback(x: number, y: number, w: number, h: number) {
        if (spritesReady && ssImg) {
            drawSprite(ctx!, ssImg, "ball", x, y, w, h);
        } else {
            ctx!.fillStyle = "#fff";
            ctx!.fillRect(x, y, w, h);
        }
    }

    function draw() {
        ctx!.fillStyle = "#000";
        ctx!.fillRect(0, 0, W, H);

        for (const block of blocks) {
            if (block.alive) drawBlockOrFallback(block);
        }

        for (const exp of explosions) drawExplosionOrFallback(exp);

        drawPaddleOrFallback();
        drawBallOrFallback(ball.x, ball.y, ball.w, ball.h);

        if (gameState === "playing") {
            ctx!.fillStyle = "#fff";
            ctx!.font = "bold 18px monospace";
            ctx!.textAlign = "left";
            ctx!.textBaseline = "top";
            ctx!.fillText("Score: " + score, 10, 10);
            ctx!.textAlign = "center";
            ctx!.fillText("Nivel: " + currentLevel, W / 2, 10);
            const ballSize = 16;
            const ballSpacing = 4;
            for (let i = 0; i < lives; i++) {
                const bx = W - 10 - (lives - i) * (ballSize + ballSpacing);
                drawBallOrFallback(bx, 10, ballSize, ballSize);
            }
        }
    }

    // ── Loop principal ──
    function loop(ts: number) {
        if (lastTime === null) lastTime = ts;
        const dt = Math.min((ts - lastTime) / 1000, 0.05);
        lastTime = ts;

        update(dt);
        draw();

        if (gameState === "gameover") {
            running = false;
            gameOverCb();
            return;
        }

        rafId = requestAnimationFrame(loop);
    }

    function start() {
        if (running) return;
        running = true;
        lastTime = null;
        scoreCb(score);
        livesCb(lives);
        levelCb(currentLevel);
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
    }

    function destroy() {
        stop();
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("mousemove", onMouseMove);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);

    loadSpritesheet();
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
