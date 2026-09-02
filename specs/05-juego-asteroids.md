# SPEC 05 — Juego real: ASTEROIDS

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-09-02
> **Objective:** Agregar al catálogo un juego nuevo, "ASTEROIDS" (`id: "asteroids"`), portando el prototipo funcional de `references/templates/started-games/02-asteroids/game.js` a un motor real dentro de la pantalla Reproductor, e introducir un mecanismo genérico de registro para que cada juego real quede aislado en su propia carpeta sin tocar la página compartida `/juegos/[id]/jugar`.

## Por qué existe este spec

SPEC 01 dejó la pantalla Reproductor (`/juegos/[id]/jugar`) como pura simulación visual para los 8 juegos del catálogo: puntaje que sube solo, "enemigos" decorativos con CSS, sin lógica real de ningún juego. Este spec agrega el primer juego real, **ASTEROIDS**, como una entrada nueva del catálogo (`lib/data.ts`) — no reemplaza ni reutiliza la entrada existente `rocas`, que permanece intacta con su simulador decorativo. Además de portar el gameplay, este spec introduce el mecanismo con el que se conectarán los próximos juegos reales: un registro (`components/games/registry.ts`) que la página `/juegos/[id]/jugar` consulta de forma genérica, en vez de acumular un `if` por juego. Cada juego real vive aislado en su propia carpeta (`components/games/<id>/`) y se "enchufa" agregando una línea al registro.

## Scope

**In:**

- Nueva entrada en `GAMES` (`lib/data.ts`):
    ```ts
    {
      id: "asteroids",
      title: "ASTEROIDS",
      short: "Dispara y esquiva una lluvia interminable de rocas espaciales.",
      long: "Pilota una nave triangular a la deriva en el vacío absoluto. Rota, propulsa y dispara para pulverizar asteroides que se fragmentan en trozos cada vez más pequeños; recoge el power-up de disparo triple y sobrevive tantos niveles como puedas.",
      cat: "SHOOTER",
      cover: "cover-asteroids",
      color: "cyan",
      best: 38700,
      plays: "9.8K",
    }
    ```
    Aparece en la Biblioteca (`/`), en `/juegos/asteroids` (detalle, con leaderboard de `seededScores` igual que el resto) y como tab en `/salon`, igual que cualquier otro juego del catálogo.
- Clase CSS `.cover-asteroids` en `app/globals.css`, siguiendo el mismo patrón que las portadas existentes (`.cover-rocas`, `.cover-invaders`, etc.), visualmente distinta de `.cover-rocas` para no parecer una tarjeta duplicada.
- Mecanismo genérico de registro de juegos:
    - `components/games/types.ts`: tipo común `GamePlayerProps = { paused: boolean; onScore(score: number): void; onLives(lives: number): void; onLevel(level: number): void; onGameOver(): void }`, la interfaz que cualquier juego real debe implementar.
    - `components/games/registry.ts`: `GAME_REGISTRY: Record<string, React.ComponentType<GamePlayerProps>>`, mapeando `"asteroids"` a su componente de canvas. Es la única pieza que conoce qué juegos tienen implementación real.
    - `app/juegos/[id]/jugar/page.tsx` sigue siendo la única ruta (`[id]` genérico, sin rutas dedicadas por juego); busca `GAME_REGISTRY[game.id]` y, si existe, renderiza ese componente conectado al HUD/pausa/modal reales; si no existe, sigue mostrando el `game-arena` decorativo y el ciclo de puntaje simulado de SPEC 01 exactamente como hoy. Agregar un futuro juego real no requiere tocar esta página más que registrar su componente.
- Motor de juego portado a TypeScript en `components/games/asteroids/engine.ts`: encapsula toda la lógica de `game.js` (nave, balas, asteroides de 3 tamaños que se dividen al ser destruidos, partículas de explosión, power-up de disparo triple, colisiones, niveles, vidas, invencibilidad temporal al reaparecer) en una función factory sin estado de módulo global, con métodos `start()`, `stop()`, `destroy()` y callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- Componente `components/games/asteroids/AsteroidsCanvas.tsx` (Client Component, implementa `GamePlayerProps`): monta un `<canvas>` dentro del `.crt-screen` existente, instancia el motor en un `useEffect` con cleanup (`destroy()` al desmontar), y traduce sus callbacks a las props `onScore`/`onLives`/`onLevel`/`onGameOver`.
- Controles de teclado: flecha izquierda/derecha rota la nave, flecha arriba propulsa, Espacio dispara — igual que el prototipo original.
- Pausa como comando unidireccional del contenedor hacia el motor: el botón PAUSA vive en `app/juegos/[id]/jugar/page.tsx` (React); al hacer click cambia su propio estado `paused`, que se pasa como prop a `AsteroidsCanvas`. El motor no decide pausar por sí mismo ni escucha una tecla de pausa propia; `AsteroidsCanvas` traduce el cambio de la prop a `stop()`/`start()` sobre el motor, deteniendo el bucle (deja de llamar a `update`) y manteniendo el último frame dibujado bajo el overlay "EN PAUSA" ya existente. REANUDAR lo retoma donde quedó.
- Notificación unidireccional del motor hacia React: puntaje, vidas, nivel y fin de juego llegan exclusivamente vía los callbacks del motor (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`); React nunca lee el estado del motor por polling.
- Botón FIN fuerza el fin de partida inmediato (equivalente a perder todas las vidas), deteniendo el motor y mostrando en el modal existente el puntaje alcanzado hasta ese momento.
- Botón SALIR: mismo comportamiento actual (navega a `/juegos/asteroids` sin guardar), desmontando el motor de forma limpia.
- Guardar puntaje reutiliza `saveScore({ game: "asteroids", score, name })` de `lib/scores.ts`, sin cambios en esa función.
- El juego completo vive físicamente dentro del elemento `<canvas>`: nave, asteroides, balas, partículas, power-up y el HUD propio del juego (puntaje, nivel, vidas e indicador de disparo triple, dibujados como en el prototipo original) se dibujan únicamente ahí, y el canvas se dimensiona para llenar por completo el `.crt-screen`. Ningún elemento HTML fuera del canvas representa objetos del juego.
- Los dos HUD conviven: el HUD propio del juego (dibujado en el canvas, inmersivo, parte de la pantalla del juego) se mantiene tal cual el prototipo original; además, el motor notifica los mismos datos a React (vía callbacks) para que el HUD superior del sitio (Jugador/Puntuación/Vidas/Nivel, fuera del canvas) también los refleje en tiempo real. No se elimina ninguno de los dos.
- El canvas no dibuja su propia pantalla de "GAME OVER" ni reinicia la partida internamente al presionar Espacio (como sí hace el prototipo original): al perder la última vida, el motor se detiene y notifica `onGameOver` a React, que es quien muestra el modal de fin de juego existente y controla el reinicio.
- Resolución interna del canvas fija en 800×600 (4:3, igual que `.crt-screen`), escalada por CSS a 100% del contenedor.
- Se conserva el power-up de disparo triple presente en `game.js` (no documentado en su README pero parte del gameplay), sin cambios de balance.

**Out of scope (for future specs):**

- Los 8 juegos ya existentes del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`): ninguno se toca ni se registra en `GAME_REGISTRY`; todos siguen usando el simulador decorativo de SPEC 01, sin cambios. Esto incluye explícitamente a `rocas`, que **no** se reemplaza ni se fusiona con `asteroids` — son juegos distintos del catálogo.
- Controles táctiles / móviles.
- Leaderboard real: la tabla de mejores puntuaciones en `/juegos/[id]` y `/salon` siguen usando `seededScores` (datos con semilla), no leen `av_scores`. Ya quedó fuera de alcance desde SPEC 04.
- Reordenar o destacar visualmente la tarjeta de `asteroids` en la Biblioteca; se integra al grid existente como cualquier otro juego.
- Audio / efectos de sonido (el prototipo original tampoco los tiene).
- Cualquier cambio a `lib/scores.ts`, `lib/user-context.tsx` o la integración de Supabase (SPEC 04).
- Modificar los archivos en `references/templates/started-games/02-asteroids/` — quedan intactos como referencia; el port vive enteramente en `components/games/asteroids/`.

## Data model

No se introduce ningún modelo de datos persistente ni cambia `lib/scores.ts`; solo crece el catálogo estático `GAMES` con una entrada más (ver Scope). El motor mantiene su propio estado en memoria (nave, asteroides, balas, partículas, power-ups, score, vidas, nivel) dentro de la instancia creada por `AsteroidsCanvas`; nada se persiste salvo lo que ya hace `saveScore` al guardar el puntaje final.

```ts
// components/games/types.ts
export type GamePlayerProps = {
    paused: boolean;
    onScore(score: number): void;
    onLives(lives: number): void;
    onLevel(level: number): void;
    onGameOver(): void;
};

// components/games/registry.ts
export const GAME_REGISTRY: Record<
    string,
    React.ComponentType<GamePlayerProps>
>;

// components/games/asteroids/engine.ts
type AsteroidsEngine = {
    start(): void;
    stop(): void;
    destroy(): void;
    onScoreChange(cb: (score: number) => void): void;
    onLivesChange(cb: (lives: number) => void): void;
    onLevelChange(cb: (level: number) => void): void;
    onGameOver(cb: () => void): void;
};

function createAsteroidsEngine(canvas: HTMLCanvasElement): AsteroidsEngine;
```

## Implementation plan

1. Agregar la entrada `asteroids` a `GAMES` en `lib/data.ts` (ver Scope) y la clase `.cover-asteroids` en `app/globals.css`, siguiendo el patrón visual de las portadas existentes.
2. Crear `components/games/types.ts` con el tipo `GamePlayerProps`.
3. Crear `components/games/asteroids/engine.ts`: portar `game.js` a TypeScript dentro de `createAsteroidsEngine(canvas)`, moviendo todo el estado de módulo (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, etc.) a variables internas de la factory. Se conserva íntegra la lógica de juego y su render (clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, tamaños/velocidades/puntos por asteroide, división al impactar, invencibilidad, power-up de disparo triple, y `drawHUD` con el puntaje/nivel/vidas/indicador de disparo triple dibujados en el canvas). Se elimina únicamente `drawOverlay` de game-over y el reinicio automático por Espacio en el estado `gameover` (`initGame()` al presionar Espacio) — al llegar a ese estado el motor se detiene solo y dispara `onGameOver`; el reinicio de la partida lo controla React. Los listeners de teclado (`keydown`/`keyup`) se agregan al crear la instancia y se remueven en `destroy()`.
4. Crear `components/games/asteroids/AsteroidsCanvas.tsx` (Client Component que implementa `GamePlayerProps`): renderiza `<canvas width={800} height={600}>` con estilos para llenar `.crt-screen` (`position: absolute; inset: 0; width: 100%; height: 100%`), instancia `createAsteroidsEngine` en un `useEffect` (cleanup llama `destroy()`), conecta `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` del motor a las props `onScore`/`onLives`/`onLevel`/`onGameOver`, y llama `start()`/`stop()` según la prop `paused`.
5. Crear `components/games/registry.ts` con `GAME_REGISTRY = { asteroids: AsteroidsCanvas }`.
6. Actualizar `app/juegos/[id]/jugar/page.tsx`: buscar `const RealGame = GAME_REGISTRY[game.id]`; si existe, renderizar `<RealGame key={playCount} paused={paused} onScore={setScore} onLives={setLives} onLevel={setLevel} onGameOver={endGame} />` en vez del `game-arena` decorativo. `playCount` es un contador de React que se incrementa en `restart()` (botón "JUGAR DE NUEVO" del modal); al cambiar la `key`, React desmonta la instancia anterior (limpia el motor vía `destroy()`) y monta una nueva desde cero, sin necesidad de un método `restart()` en el motor. El botón FIN detiene el motor (además de `setOver(true)`) forzando el fin de partida. Si no existe un componente registrado (los 8 juegos ya existentes), la pantalla sigue exactamente igual que hoy (`game-arena` + ciclo de puntaje simulado). El resto de la pantalla (HUD, botones, modal, `saveScore`) no cambia de estructura.
7. Probar manualmente en el navegador (`npm run dev`): confirmar que `asteroids` aparece en la Biblioteca, en `/juegos/asteroids` y en las tabs de `/salon`; jugar una partida completa en `/juegos/asteroids/jugar` — rotar, propulsar, disparar, perder vidas, pasar de nivel, recoger el power-up de disparo triple, perder la última vida — confirmar que PAUSA congela el juego y REANUDAR lo retoma, que FIN corta la partida con el puntaje correcto, y que guardar el puntaje lo persiste en `localStorage` (`av_scores`). Confirmar también que los 8 juegos existentes (incluido `rocas`) en `/juegos/<id>/jugar` siguen mostrando el simulador decorativo sin cambios.
8. Correr `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/`, resolviendo cualquier error antes de dar la tarea por terminada.

## Acceptance criteria

- [ ] `asteroids` aparece como tarjeta jugable en la Biblioteca (`/`), con su propia portada (`.cover-asteroids`), y en las tabs de `/salon`.
- [ ] `/juegos/asteroids` muestra su ficha de detalle (portada, descripción, leaderboard con semilla) igual que cualquier otro juego del catálogo.
- [ ] `/juegos/asteroids/jugar` muestra el juego de Asteroids real y jugable dentro del `crt-screen` (nave controlable con flechas, disparo con Espacio, asteroides que se dividen al ser destruidos).
- [ ] El HUD superior del sitio (Puntuación/Vidas/Nivel) refleja en tiempo real el estado del motor, no un ciclo simulado.
- [ ] El HUD propio del juego (puntaje, nivel, vidas, indicador de disparo triple) sigue dibujado dentro del canvas, igual que en el prototipo original — conviven ambos HUD, ninguno reemplaza al otro.
- [ ] El botón PAUSA (única forma de pausar; sin atajo de teclado propio del juego) congela el juego y muestra el overlay "EN PAUSA" ya existente; REANUDAR lo retoma exactamente donde quedó.
- [ ] Perder las 3 vidas dispara automáticamente el modal de fin de juego con el puntaje final alcanzado.
- [ ] El botón FIN corta la partida en curso, detiene el motor y abre el modal de fin de juego con el puntaje alcanzado hasta ese momento.
- [ ] Guardar el puntaje en el modal invoca `saveScore({ game: "asteroids", score, name })` sin cambios en `lib/scores.ts`, persistiendo en `localStorage` bajo `av_scores`.
- [ ] El botón SALIR desmonta el motor de juego sin errores en consola (sin bucles de `requestAnimationFrame` colgados) y navega a `/juegos/asteroids`.
- [ ] El elemento `<canvas>` llena por completo el `.crt-screen` y contiene todo el gameplay visible, incluido el HUD propio del juego; no hay elementos HTML representando objetos del juego (nave, asteroides, balas, etc.).
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia una partida nueva del motor desde cero (nave, asteroides, puntaje, vidas y nivel iniciales), no solo el estado de React.
- [ ] Los 8 juegos ya existentes (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`) siguen mostrando el simulador decorativo de SPEC 01 sin ningún cambio visible.
- [ ] Agregar `asteroids` no requirió condicionales hardcodeadas por juego en `app/juegos/[id]/jugar/page.tsx`: la página consulta `GAME_REGISTRY[game.id]` de forma genérica.
- [ ] El power-up de disparo triple sigue apareciendo y funcionando igual que en el prototipo original.
- [ ] `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/` terminan sin errores.

## Decisions

- **Sí:** se agrega un juego nuevo, `id: "asteroids"`, al catálogo — no se reutiliza ni se reemplaza la entrada existente `rocas`, que permanece intacta con su simulador decorativo. Confirmado por el usuario.
- **Sí:** el `id` y el título mostrado quedan en inglés, `"ASTEROIDS"`, sin traducir, siguiendo la grafía del prototipo (`references/templates/started-games/02-asteroids/`) tal como lo escribió el usuario. Es la única entrada del catálogo con título en inglés; el resto de campos de copy (`short`, `long`) quedan en español para no romper el tono del resto del catálogo.
- **Sí:** se introduce un registro genérico de juegos (`components/games/registry.ts`) consultado por la única ruta `/juegos/[id]/jugar`, en vez de condicionales hardcodeadas por juego. Confirmado por el usuario ("tiene que haber una ruta genérica para mantener cada juego de forma aislada") — cada juego real vive aislado en `components/games/<id>/` y se conecta agregando una entrada al registro, sin tocar la página compartida ni a los demás juegos.
- **Sí:** el juego mantiene su propio HUD dibujado en el canvas (puntaje, nivel, vidas, indicador de disparo triple), igual que el prototipo original, y además notifica los mismos datos a React para que el HUD superior del sitio también los refleje. Los dos HUD conviven — no se elimina el del canvas. Confirmado por el usuario ("no borraríamos el hub del juego, utilizaríamos los dos"), revirtiendo la decisión original de esta misma spec.
- **Sí:** la pantalla de "GAME OVER" y el reinicio de partida sí quedan exclusivamente en React (modal existente); el motor no dibuja su propio game-over ni reinicia por Espacio como el prototipo original — solo se detiene y notifica `onGameOver`. Esto evita dos pantallas de fin de partida compitiendo entre sí.
- **Sí:** el reinicio ("JUGAR DE NUEVO") remonta `RealGame` cambiando su prop `key` en vez de agregar un método `restart()` al motor — React desmonta la instancia anterior (`destroy()`) y monta una nueva, reutilizando el mismo ciclo de vida que ya limpia listeners y `requestAnimationFrame`.
- **Sí:** el motor se porta a TypeScript, encapsulado en una factory sin estado de módulo global. Confirmado por el usuario — el original usa variables globales (`ship`, `bullets`, `score`...) que no soportan bien montar/desmontar un componente React (ej. Strict Mode en desarrollo, o navegar a SALIR y volver a entrar).
- **Sí:** la pausa es un comando que el contenedor de React envía al motor a través de la prop `paused`; el motor no tiene lógica propia de pausa ni escucha una tecla de pausa. Confirmado por el usuario.
- **Sí:** el motor solo se comunica hacia React vía callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`); React nunca consulta el estado interno del motor directamente. Confirmado por el usuario.
- **Sí:** el juego completo se dibuja físicamente dentro del elemento `<canvas>`, dimensionado para llenar el `.crt-screen`; no se usan elementos HTML superpuestos para representar objetos del juego. Confirmado por el usuario.
- **Sí:** solo controles de teclado (flechas + Espacio), igual que el prototipo original. Controles táctiles quedan fuera de este spec pese al tag "TÁCTIL" decorativo en la pantalla de detalle.
- **Sí:** se conserva el power-up de disparo triple del prototipo, sin cambios de balance.
- **No:** no se toca la tabla de mejores puntuaciones de `/juegos/[id]` ni `/salon` — siguen usando `seededScores`; migrar el leaderboard a datos reales ya quedó fuera de alcance desde SPEC 04.
- **No:** no se registra ningún otro juego en `GAME_REGISTRY` en este spec — los 8 juegos existentes (incluido `rocas`) quedan sin implementación real, cada uno con su propio spec futuro.
- **No:** no se agregan controles táctiles ni se cambia el tag "TÁCTIL" de la pantalla de detalle.
- **No:** no se modifica `lib/scores.ts`, `lib/user-context.tsx` ni la integración de Supabase.

## Risks

| Risk                                                                                                                                                                                           | Mitigation                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode en desarrollo monta/desmonta efectos dos veces, lo que podría duplicar el bucle `requestAnimationFrame` o los listeners de teclado del motor si no se limpian bien.          | El motor expone `destroy()` explícito, llamado en el cleanup del `useEffect` de `AsteroidsCanvas`, que cancela el `requestAnimationFrame` pendiente y remueve los listeners `keydown`/`keyup` de esa instancia. |
| Los listeners de teclado del motor (`ArrowLeft/Right/Up`, `Space`) podrían interferir con el foco de los botones PAUSA/FIN/SALIR (ej. Espacio activando el botón enfocado en vez de disparar). | El motor llama `preventDefault()` en las teclas que usa, y solo están activos mientras el canvas está montado y la partida no terminó.                                                                          |
| El canvas fijo en 800×600 podría verse borroso en pantallas de alta densidad (`devicePixelRatio` > 1).                                                                                         | Aceptado como riesgo conocido para este MVP — el prototipo original tampoco lo maneja; queda documentado para un spec futuro de pulido visual si se detecta como problema real.                                 |
| El registro genérico (`GAME_REGISTRY`) es nuevo; si un juego futuro no implementa correctamente `GamePlayerProps`, TypeScript debería marcar el error en tiempo de compilación.                | El tipo `GamePlayerProps` en `components/games/types.ts` es la única superficie de contrato; `npm run build` falla si un componente registrado no lo cumple.                                                    |

## Qué **no** está en este spec

- Los 8 juegos ya existentes del catálogo (incluido `rocas`), que siguen con el simulador decorativo de SPEC 01.
- Controles táctiles / móviles.
- Leaderboard real en `/juegos/[id]` o `/salon` (siguen con `seededScores`).
- Audio / efectos de sonido.
- Cambios a `lib/scores.ts`, `lib/user-context.tsx` o Supabase.

Cada uno de estos, si se implementa, va en su propio spec.
