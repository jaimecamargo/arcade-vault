# SPEC 08 — Juego real: ARKANOID

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-09
> **Objetivo:** Agregar ARKANOID al catálogo como juego real (`id: "arkanoid"`), portando `references/templates/started-games/04-arkanoid/` (game.js + levels.js + spritesheet) al patrón de registro genérico de SPEC 05 y a las tablas `games`/`scores` de Supabase de SPEC 06.

## Scope

**In:**

- Nueva fila en `public.games` (Supabase): `id: "arkanoid"`, `title: "ARKANOID"`, `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-arkanoid"`, `short`/`long` según el copy confirmado en el Modelo de datos.
- `components/games/arkanoid/engine.ts`: port de `game.js` a TypeScript dentro de `createArkanoidEngine(canvas): ArkanoidEngine`, con `start()`, `stop()`, `destroy()`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`. Sin estado de módulo global — todo el `let`/objeto mutable a nivel de módulo del original (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `keys`, `lastTime`) vive en el closure de la factory.
- `components/games/arkanoid/levels.ts`: port de `levels.js` (`LEVELS`, array de 5 niveles con `blocks[]` + `speed`), con un tipo exportado real.
- `components/games/arkanoid/sprites.ts`: port de `assets/spritesheet.js` (tablas `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, helpers `drawSprite`/`drawFrame`), adaptado para cargar la imagen dentro de la factory del motor (sin estado de módulo `ssImg`/`ssLoaded` global — ver Modelo de datos).
- `public/games/arkanoid/spritesheet-breakout.png`: copia del binario del spritesheet, servido desde `/games/arkanoid/spritesheet-breakout.png`.
- `components/games/arkanoid/ArkanoidCanvas.tsx`: Client Component que implementa `GamePlayerProps`, mismo patrón de 52 líneas que `AsteroidsCanvas.tsx` (efecto de montaje con cleanup vía `destroy()`, efecto separado sobre `[paused]` que llama `stop()`/`start()`).
- Registro: una línea de import y una entrada `arkanoid: ArkanoidCanvas` en `components/games/registry.ts`, manteniendo orden alfabético (`arkanoid`, `asteroids`, `tetris`).
- Bloque CSS `.cover-arkanoid` en `app/globals.css`, al final de la sección de portadas, antes del comentario `/* ===== detail screen ===== */`, con motivo visual propio (parrilla de bloques / arco de paleta), en tono magenta, visualmente distinto de `.cover-bricks` ya existente. Se invoca `/frontend-design` para esta pieza.
- Canvas lógico fijo 800×600: el tablero de Arkanoid ya es 800×600 en el original — mapeo 1:1, sin letterboxing ni recomposición de layout.
- Controles: mover la paleta con **mouse** (`mousemove` sobre el canvas, con el mismo cálculo de `scaleX` que el original para compensar el stretch CSS) **y** con `ArrowLeft`/`ArrowRight` (`e.code`) simultáneamente, igual que el original.
- Scoring idéntico al original: 10 puntos por bloque roto, acumulado a través de los 5 niveles, vía `onScore`.
- Vidas reales vía `onLives`: inicia en 3; al caer la pelota se descuenta una y se reposiciona sobre la paleta; al llegar a 0 se dispara game over.
- Nivel real vía `onLevel`: 5 niveles discretos (`currentLevel` 1–5), cada uno con su propio patrón de bloques y multiplicador de velocidad de pelota (`×1.00` a `×1.46`), tomado de `LEVELS[n-1].speed`.
- Game over unificado: tanto quedarse sin vidas como romper todos los bloques del nivel 5 (condición de "victoria" en el original) disparan `onGameOver()` con el score final — el contrato de SPEC 05 no distingue un estado de victoria separado.
- Sin audio — se descartan `ball-bounce.mp3` y `break-sound.mp3` del template (decisión confirmada, ver Decisiones).

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a `components/game-player-screen.tsx`, `components/games/types.ts`, `lib/supabase/types.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- Cualquier otro juego del catálogo (`asteroids`, `tetris`, ni las filas decorativas existentes).
- RLS en Supabase — sigue deshabilitado; riesgo ya aceptado en SPEC 06.
- Controles táctiles / móviles.
- Audio / efectos de sonido (`ball-bounce.mp3`, `break-sound.mp3` del template) — descartados en este spec.
- Selector de nivel por click en el overlay de pausa (presente en el template original) — se elimina; la pausa la controla exclusivamente `game-player-screen.tsx` vía la prop `paused`, y ese overlay ya no existe.
- Tecla `P`/`Escape` de pausa propia del template — se elimina, mismo motivo.
- Overlay propio de "GAME OVER" / "¡Completaste el juego!" dibujado en canvas — se elimina; React muestra su propio modal de fin de partida vía `onGameOver()`.
- Rutas nuevas — `/juegos/[id]/jugar` sigue siendo genérica.

## Modelo de datos

No se introducen tablas ni columnas nuevas. Se reutilizan `GameRow` y `ScoreRow` de `lib/supabase/types.ts` sin cambios (SPEC 06). Solo crece la tabla `games` con una fila más:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'arkanoid', 'ARKANOID',
  'Rompe la parrilla de bloques a puro rebote antes de quedarte sin vidas.',
  'Controla la paleta con el mouse o con las flechas ← → y evita que la pelota caiga. Cada bloque roto suma puntos; supera los 5 niveles, cada uno más rápido que el anterior, antes de agotar tus 3 vidas.',
  'ARCADE', 'cover-arkanoid', 'magenta'
);
```

Estado interno del motor (dentro del closure de `createArkanoidEngine`, sin estado de módulo):

```ts
let paddle: { x: number; y: number; w: number; h: number };
let ball: {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
};
let blocks: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    alive: boolean;
}[];
let explosions: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    elapsed: number;
}[];
let lives: number;
let score: number;
let gameState: "playing" | "gameover";
let currentLevel: number;
let lastTime: number | null;
let rafId: number;
let spritesReady: boolean; // true cuando el spritesheet terminó de cargar
```

`levels.ts` exporta:

```ts
export type ArkanoidLevel = {
    speed: number;
    blocks: { col: number; row: number; color: string }[];
};
export const LEVELS: ArkanoidLevel[]; // 5 niveles
```

`sprites.ts` exporta las tablas `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` y los helpers `drawSprite(ctx, ssImg, name, x, y, w, h)` / `drawFrame(ctx, ssImg, frame, x, y, w, h)`, recibiendo la imagen ya cargada como parámetro en vez de leerla de una variable de módulo (a diferencia del original), para que el ciclo de carga viva dentro de la factory del motor.

## Plan de implementación

1. Insertar la fila `arkanoid` en `public.games` (Supabase) y verificar con un `SELECT` de vuelta que los siete campos quedaron correctos.
2. Copiar `assets/spritesheet-breakout.png` a `public/games/arkanoid/spritesheet-breakout.png`.
3. Crear `components/games/arkanoid/levels.ts`: portar `levels.js` (`LEVELS`) con el tipo `ArkanoidLevel` exportado.
4. Crear `components/games/arkanoid/sprites.ts`: portar `assets/spritesheet.js` (tablas `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, helpers `drawSprite`/`drawFrame`), adaptando la carga de la imagen para que no dependa de estado de módulo (`ssImg`/`ssLoaded` originales).
5. Crear `components/games/arkanoid/engine.ts`: portar `game.js` completo (`initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update`, `draw`, HUD propio de score/vidas/nivel) dentro de `createArkanoidEngine(canvas)`, con el estado del Modelo de datos movido al closure. Se elimina `drawPauseOverlay` y su listener de `click` (selector de nivel), la tecla `P`/`Escape` de pausa, y `drawOverlay` de game-over/victoria — al llegar a `gameState === 'gameover'` (por 0 vidas o por completar el nivel 5) el motor se detiene, llama `onLives(0)` si corresponde y `onGameOver()`, sin dibujar overlay propio ni reiniciar. Listeners de teclado en `window` y de mouse en el `canvas` recibido, agregados en el cuerpo de la factory y removidos en `destroy()`.
6. Crear `components/games/arkanoid/ArkanoidCanvas.tsx` replicando la estructura de `AsteroidsCanvas.tsx`: efecto de montaje (crea el motor, conecta los 4 callbacks, `start()`, cleanup con `destroy()`) y efecto `[paused]` (`stop()`/`start()`).
7. Registrar en `components/games/registry.ts`: import de `ArkanoidCanvas` + entrada `arkanoid: ArkanoidCanvas`, manteniendo orden alfabético (`arkanoid`, `asteroids`, `tetris`).
8. Agregar el bloque `.cover-arkanoid` en `app/globals.css` (vía `/frontend-design` para el motivo visual, en magenta), antes del comentario `/* ===== detail screen ===== */`.
9. Correr `npx eslint .` y `npm run build`, corrigiendo lo que reporten.
10. Verificación manual end-to-end en `/juegos/arkanoid/jugar` siguiendo el checklist de la Fase 13 del skill `add-game` (catálogo, detalle, jugabilidad, persistencia del score, regresión de `rocas`/`asteroids`/`tetris`/otros juegos decorativos), incluyendo que el spritesheet cargue sin 404 en la pestaña de red.

## Criterios de aceptación

- [ ] `arkanoid` aparece como tarjeta jugable en `/biblioteca` con su propia portada (`.cover-arkanoid`) y en las tabs de `/salon`.
- [ ] `/juegos/arkanoid` muestra la ficha de detalle con la descripción larga y el mensaje de leaderboard vacío "Sé el primero en entrar al salón de la fama" (sin scores todavía).
- [ ] `/juegos/arkanoid/jugar` renderiza el Arkanoid real dentro del CRT (paleta, pelota, parrilla de bloques con sprites), no el stub decorativo `game-arena`.
- [ ] El canvas llena el CRT de borde a borde sin letterboxing ni scrollbars.
- [ ] El spritesheet (`/games/arkanoid/spritesheet-breakout.png`) carga sin un 404 en la pestaña de red, y los bloques/paleta/pelota se dibujan con sprites reales (no formas primitivas de fallback) una vez cargado.
- [ ] La paleta se mueve con el mouse y con `ArrowLeft`/`ArrowRight` simultáneamente, sin salirse del canvas ni scrollear la página.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) se actualiza en tiempo real: Vidas baja de 3 a 0 al perder la pelota repetidamente, Nivel sube al romper todos los bloques de un nivel.
- [ ] El HUD propio del juego (Score, Nivel, vidas restantes) sigue dibujado en el canvas, igual que el prototipo original.
- [ ] PAUSA congela la pelota, la paleta y las entradas; REANUDAR continúa sin salto de `dt` ni la pelota teletransportada.
- [ ] Al llegar a 0 vidas se dispara automáticamente el modal de fin de juego con el puntaje final.
- [ ] Al romper todos los bloques del nivel 5 también se dispara el modal de fin de juego con el puntaje final (sin overlay propio de "¡Completaste el juego!").
- [ ] El botón FIN fuerza el modal en cualquier momento.
- [ ] Guardar el puntaje en el modal inserta el score en Supabase (`game_id: 'arkanoid'`) y aparece en `/juegos/arkanoid` y en `/salon` al recargar.
- [ ] JUGAR DE NUEVO reinicia desde cero (nivel 1, score 0, 3 vidas, parrilla completa) — sin fuga de estado de módulo.
- [ ] Los juegos decorativos (ej. `/juegos/rocas/jugar`) y los juegos reales existentes (`asteroids`, `tetris`) siguen funcionando sin cambios.
- [ ] Agregar `arkanoid` no requirió condicionales hardcodeadas por juego en `components/game-player-screen.tsx`, ni ningún cambio a ese archivo.
- [ ] `npx eslint .` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** `id: "arkanoid"`, `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-arkanoid"` — confirmados por el usuario contra `GAME_REGISTRY`, la tabla `games` en vivo (solo `asteroids`/`yellow` y `tetris`/`cyan` existen) y `app/globals.css`, sin colisiones.
- **Sí:** sin audio — se descartan `ball-bounce.mp3` y `break-sound.mp3` presentes en el template. Confirmado por el usuario, siguiendo el precedente de Asteroids/SPEC 05 de no incluir sonido en el MVP portado.
- **Sí:** control de paleta dual (mouse + teclado) se conserva tal cual el original — ambos mecanismos coexistían sin conflicto en `game.js` y no agregan superficie nueva de riesgo.
- **Sí:** el "ganar" (romper todos los bloques del nivel 5) se colapsa en la misma señal `onGameOver()` que perder por 0 vidas, en vez de introducir un quinto callback o un estado de victoria distinto — el contrato `GamePlayerProps` de SPEC 05 es fijo y solo tiene `onGameOver`. Se pierde el mensaje distintivo "¡Completaste el juego!" dibujado en canvas; el modal genérico de fin de partida (con el puntaje final) ya comunica el resultado.
- **Sí:** se elimina el selector de nivel por click en el overlay de pausa del template original (botones 1–5) — esa UI vivía en el `drawPauseOverlay()` propio del juego, que se elimina por completo porque `game-player-screen.tsx` ya dibuja su propio overlay "EN PAUSA" genérico; mantener ambos overlays superpuestos sería confuso y el segundo no puede recibir clicks del canvas de la misma forma.
- **Sí:** se elimina la tecla `P`/`Escape` de pausa propia del template — la pausa la controla exclusivamente `game-player-screen.tsx` vía la prop `paused`, igual que en SPEC 05 y SPEC 07.
- **Sí:** el spritesheet se sirve como archivo estático desde `public/games/arkanoid/`, y las tablas de datos (`SPRITES`, `EXPLOSION_FRAMES`, helpers) se portan como código TypeScript en `components/games/arkanoid/sprites.ts` — el binario va a `public/`, la data de sprites vive junto al motor.
- **No:** sin controles táctiles/móviles — fuera de alcance en toda la plataforma hasta ahora (SPEC 05, SPEC 07).
- **No:** sin RLS en este spec — riesgo ya aceptado en SPEC 06, no se toca.

## Riesgos

| Riesgo                                                                                                                                                                    | Mitigación                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta/desmonta el efecto de montaje dos veces en desarrollo, duplicando el `requestAnimationFrame` o los listeners de teclado/mouse.                    | `destroy()` cancela el `rafId` pendiente y remueve los listeners `keydown`/`keyup`/`mousemove` de esa instancia, igual que `AsteroidsEngine` (SPEC 05) y `TetrisEngine` (SPEC 07).     |
| Un `id` de Supabase (`arkanoid`) desalineado con la clave de `GAME_REGISTRY` haría que la página caiga silenciosamente al stub decorativo `game-arena` sin error visible. | Verificar carácter por carácter en la Fase 9 del skill `add-game` antes de dar la tarea por terminada; incluido como criterio de aceptación explícito.                                 |
| El spritesheet se carga de forma asíncrona (`Image.onload`); si el motor dibuja antes de que termine de cargar, los primeros frames no tendrían sprites que dibujar.      | Cada `draw*` verifica `spritesReady` antes de dibujar con el spritesheet, con fallback a una forma primitiva (rectángulo de color) para que los primeros frames rendericen sin tronar. |
| `dt` sin clamp tras una pausa larga podría hacer que la pelota atraviese la paleta o las paredes de golpe al reanudar.                                                    | `loop(ts)` clampa `dt` igual que en `engine.ts` de Asteroids/Tetris (`Math.min((ts-lastTime)/1000, 0.05)`) y `lastTime` se resetea a `null` en `start()`.                              |

## Qué **no** está en este spec

- Cualquier otro juego del catálogo.
- Controles táctiles / móviles.
- Audio / efectos de sonido.
- RLS en Supabase.
- Cambios a `game-player-screen.tsx`, `types.ts` o `lib/supabase/*`.

Cada uno de estos, si se implementa, va en su propio spec.
