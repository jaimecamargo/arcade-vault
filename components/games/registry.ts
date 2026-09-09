// ===== components/games/registry.ts — registro genérico de juegos reales =====
// Única pieza que conoce qué juegos del catálogo tienen implementación real.
// /juegos/[id]/jugar la consulta de forma genérica en vez de acumular un `if` por juego.

import type { ComponentType } from "react";
import type { GamePlayerProps } from "./types";
import ArkanoidCanvas from "./arkanoid/ArkanoidCanvas";
import AsteroidsCanvas from "./asteroids/AsteroidsCanvas";
import TetrisCanvas from "./tetris/TetrisCanvas";
import ViboraCanvas from "./vibora/ViboraCanvas";

export const GAME_REGISTRY: Record<string, ComponentType<GamePlayerProps>> = {
  arkanoid: ArkanoidCanvas,
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  vibora: ViboraCanvas,
};
