// ===== components/games/types.ts — contrato común para juegos reales =====

export type GamePlayerProps = {
  paused: boolean;
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(): void;
};
