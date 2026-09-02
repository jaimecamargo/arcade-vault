"use client";

import { useEffect, useRef } from "react";
import { createAsteroidsEngine, type AsteroidsEngine } from "./engine";
import type { GamePlayerProps } from "../types";

export default function AsteroidsCanvas({
  paused,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: GamePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createAsteroidsEngine(canvas);
    engineRef.current = engine;

    engine.onScoreChange(onScore);
    engine.onLivesChange(onLives);
    engine.onLevelChange(onLevel);
    engine.onGameOver(onGameOver);
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.stop();
    else engine.start();
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
