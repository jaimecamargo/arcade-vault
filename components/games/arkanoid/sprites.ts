export type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };

export const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
    red: [
        { sx: 256, sy: 176, sw: 32, sh: 16 },
        { sx: 288, sy: 176, sw: 32, sh: 16 },
        { sx: 320, sy: 176, sw: 32, sh: 16 },
        { sx: 352, sy: 176, sw: 32, sh: 16 },
    ],
    cyan: [
        { sx: 256, sy: 192, sw: 32, sh: 16 },
        { sx: 288, sy: 192, sw: 32, sh: 16 },
        { sx: 320, sy: 192, sw: 32, sh: 16 },
        { sx: 352, sy: 192, sw: 32, sh: 16 },
    ],
    green: [
        { sx: 256, sy: 208, sw: 32, sh: 16 },
        { sx: 288, sy: 208, sw: 32, sh: 16 },
        { sx: 320, sy: 208, sw: 32, sh: 16 },
        { sx: 352, sy: 208, sw: 32, sh: 16 },
    ],
    magenta: [
        { sx: 256, sy: 224, sw: 32, sh: 16 },
        { sx: 288, sy: 224, sw: 32, sh: 16 },
        { sx: 320, sy: 224, sw: 32, sh: 16 },
        { sx: 352, sy: 224, sw: 32, sh: 16 },
    ],
    yellow: [
        { sx: 256, sy: 240, sw: 32, sh: 16 },
        { sx: 288, sy: 240, sw: 32, sh: 16 },
        { sx: 320, sy: 240, sw: 32, sh: 16 },
        { sx: 352, sy: 240, sw: 32, sh: 16 },
    ],
    hotpink: [
        { sx: 256, sy: 256, sw: 32, sh: 16 },
        { sx: 288, sy: 256, sw: 32, sh: 16 },
        { sx: 320, sy: 256, sw: 32, sh: 16 },
        { sx: 352, sy: 256, sw: 32, sh: 16 },
    ],
    gray: [
        { sx: 256, sy: 176, sw: 32, sh: 16 },
        { sx: 288, sy: 176, sw: 32, sh: 16 },
        { sx: 320, sy: 176, sw: 32, sh: 16 },
        { sx: 352, sy: 176, sw: 32, sh: 16 },
    ],
};

export const EXPLOSION_DURATION = 150;

export const SPRITES: {
    paddle: SpriteFrame;
    ball: SpriteFrame;
    blocks: Record<string, SpriteFrame>;
} = {
    paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
    ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
    blocks: {
        gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
        red: { sx: 32, sy: 176, sw: 32, sh: 16 },
        yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
        cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
        magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
        hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
        green: { sx: 32, sy: 208, sw: 32, sh: 16 },
    },
};

export function drawFrame(
    ctx: CanvasRenderingContext2D,
    ssImg: CanvasImageSource,
    frame: SpriteFrame,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export function drawSprite(
    ctx: CanvasRenderingContext2D,
    ssImg: CanvasImageSource,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    let sp: SpriteFrame | undefined;
    if (name.startsWith("block_")) {
        sp = SPRITES.blocks[name.slice(6)];
    } else if (name === "paddle" || name === "ball") {
        sp = SPRITES[name];
    }
    if (!sp) return;
    ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}
