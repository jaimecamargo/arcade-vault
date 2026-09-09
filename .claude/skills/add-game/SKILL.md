---
name: add-game
description: Añade un juego nuevo al catálogo de Arcade Vault de punta a punta — escribe el spec, crea el motor y el componente canvas en components/games/<id>/, lo registra en GAME_REGISTRY, agrega su CSS de portada, e inserta y verifica su fila en la tabla `games` de Supabase. Úsalo para portar un template de references/templates/started-games/ o para crear un juego nuevo a partir de una descripción libre.
disable-model-invocation: true
argument-hint: 'ruta a references/templates/started-games/NN-nombre, o descripción libre del juego'
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(npm run build:*), Bash(npx eslint:*), mcp__supabase__execute_sql, mcp__supabase__list_tables
---

# /add-game — Añade un juego real con leaderboard al catálogo

## Contexto de sesión

Fecha de hoy (úsala para el header del spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "specs/ no existe"`

Templates disponibles:
!`ls references/templates/started-games/ 2>/dev/null || echo "no hay templates"`

Juegos ya registrados:
!`cat components/games/registry.ts 2>/dev/null || echo "no existe components/games/registry.ts"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

Árbol de trabajo / rama actual:
!`git status --short`
!`git branch --show-current`

---

## Preámbulo — léelo antes de tocar nada

Sigue las fases en orden estricto. No avances a la siguiente si la anterior no terminó
correctamente. Responde en el mismo idioma en el que el usuario escriba, **pero el archivo de
spec siempre se escribe en español**, igual que `specs/01`–`specs/06`.

**Lee estos tres archivos antes de escribir una sola línea de código de juego — son el
contrato, no una sugerencia:**

- `components/games/types.ts`
- `components/games/asteroids/engine.ts`
- `components/games/asteroids/AsteroidsCanvas.tsx`

**Archivos que NUNCA debes modificar.** Ya son genéricos; si te encuentras editando uno de
estos, tomaste un desvío equivocado:

- `components/game-player-screen.tsx` — ya resuelve `GAME_REGISTRY[game.id]`, ya maneja todo
  el estado del HUD, el overlay de pausa, el modal de fin de partida, el prefill del nombre
  desde `localStorage["av_player_name"]`, el reinicio por `key={playCount}`, y el `INSERT` en
  `scores` vía cliente browser. Agregar un juego no requiere **ningún** cambio aquí — ese es
  el punto entero del patrón de registro de SPEC 05.
- `components/games/types.ts` — el contrato `GamePlayerProps` es fijo. Si tu juego "necesita"
  un quinto callback, no lo necesita: mapéalo sobre los cuatro que existen (ver Fase 6).
- `lib/supabase/types.ts` (`GameRow`, `ScoreRow`), `lib/supabase/client.ts`,
  `lib/supabase/server.ts` — finales.
- `app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx`, `app/biblioteca/page.tsx`,
  `app/salon/page.tsx` y cualquier componente que ya consuma la tabla `games` — todos
  genéricos, impulsados enteramente por esa tabla. Una fila nueva hace que el juego aparezca
  en todas partes automáticamente.
- El esquema de la tabla `scores`, y cualquier bloque `.cover-*` ya existente en
  `app/globals.css`.
- **RLS** en Supabase: está deshabilitado en `games` y `scores` (riesgo aceptado en SPEC 06).
  No lo actives, no lo desactives más, no agregues políticas, no hagas `ALTER TABLE`.

**Archivos que SÍ vas a crear o tocar — la lista completa, nada más:**

1. `specs/NN-<slug>.md` (nuevo)
2. `components/games/<id>/engine.ts` (nuevo)
3. `components/games/<id>/<Name>Canvas.tsx` (nuevo)
4. `components/games/registry.ts` (un import + una entrada)
5. `app/globals.css` (un bloque `.cover-<id>` agregado al final de la sección de portadas)
6. `public/games/<id>/…` (solo si el template trae assets — Fase 8)
7. Un `INSERT` en `public.games`

Este proyecto pinea `next@16.3.4`. Este skill no toca rutas ni APIs de Next, así que no
necesitas leer `node_modules/next/dist/docs/` salvo que termines necesitando algo específico
de Next — en ese caso, lee la guía correspondiente antes de usarla.

---

## Fase 1 — Parsear el argumento y elegir el modo

El argumento recibido es `$ARGUMENTS`.

Clasifícalo en uno de tres casos:

- **Modo A (portar desde template).** El argumento parece una ruta o nombra una carpeta bajo
  `references/templates/started-games/` — ruta completa, nombre de carpeta (`03-tetris`), solo
  el número (`03`) o un nombre aproximado (`tetris`). Resuélvelo contra el listado de
  templates del contexto de sesión. Si resuelve a más de uno, pregunta cuál. Si no resuelve a
  ninguno pero el texto claramente parece una ruta, dilo y muestra los templates disponibles.
  No caigas al Modo B en silencio.
- **Modo B (construir desde una idea).** Prosa libre describiendo un juego sin referenciar
  ningún template (`"un juego de snake con obstáculos"`).
- **Vacío.** Presenta el listado de templates vía `AskUserQuestion` con una opción por
  template más la opción "Describir una idea nueva (sin template)". No adivines.

Anuncia el modo detectado en una línea antes de continuar
(`Modo A — portar references/templates/started-games/03-tetris`).

**Rechaza un template ya portado.** `02-asteroids` ya está en vivo como `asteroids`. Si el
template resuelto ya está representado en `GAME_REGISTRY`, detente y dilo; no crees un
duplicado.

---

## Fase 2 — Levantar el diseño del juego

### Fase 2A — Modo A: extraer del template

No asumas ningún layout fijo. `02-asteroids` es un solo `game.js` + `index.html`;
`03-tetris` separa html/css/js; `04-arkanoid` agrega `levels.js`, una carpeta `assets/` con
spritesheet y sonidos, y su propia carpeta `specs/`. En su lugar:

1. Lista la carpeta del template (`ls`, primero sin recursión, luego un nivel más).
2. Lee su **`CLAUDE.md`** — todo template tiene uno y es el archivo de mayor valor: documenta
   el modelo de estado, el mecanismo del game loop, los identificadores clave y el rol de cada
   archivo.
3. Lee su **`README.md`** — controles y scoring.
4. Lee el código real (`game.js`, más `levels.js` / `assets/spritesheet.js` donde existan). No
   lo hojees; lo estás porteando.
5. Si el template trae su propia carpeta `specs/` (`04-arkanoid` la tiene), revísala por
   decisiones que el autor original ya tomó — recordando que describen el juego standalone, no
   esta plataforma.

Luego produce una **hoja de porteo** por escrito y muéstrasela al usuario antes de escribir
nada:

- Dimensiones del canvas original y cómo se mapean al canvas lógico fijo **800×600** (ver Fase
  6).
- Controles (valores exactos de `KeyboardEvent.code`).
- Reglas de scoring → qué reporta `onScore`.
- Modelo de vidas → qué reporta `onLives` (ver la regla de mapeo en Fase 6).
- Progresión de nivel/velocidad → qué reporta `onLevel`.
- Condición de game-over → cuándo dispara `onGameOver`.
- Estado mutable a nivel de módulo en el original que debe moverse al closure de la factory.
- Assets presentes, y la propuesta para cada uno (Fase 8).
- Qué debe **eliminarse** en el porteo: su propio overlay de game-over, cualquier reinicio por
  tecla, su propia tecla de pausa, su HUD basado en DOM, su `index.html`/CSS de chrome.

### Fase 2B — Modo B: obtenerlo vía `AskUserQuestion`

Sin template, la información debe salir del usuario. Pregunta en **bloques de 3 a 5**, con
`AskUserQuestion`, 2-4 opciones concretas cada una, recomendación primero y etiquetada — misma
disciplina que exige `/spec` Fase 2. No preguntes una a la vez.

Bloque 1 — mecánica central: género/loop principal (recomienda uno basado en la idea, ofrece 3
alternativas concretas); controles (solo flechas / flechas + Espacio / WASD + Espacio / mouse);
modelo de fin de partida (vidas que decrecen, una sola vida, o infinito hasta fallar).

Bloque 2 — progresión y scoring: eventos de puntaje y valores concretos; si la dificultad
escala por niveles discretos o por una rampa continua de velocidad; cantidad de entidades y
reglas de spawn.

Bloque 3 — presentación y límites: estilo visual (vectorial como Asteroids, bloques sólidos
como Tetris, o sprites — los sprites implican assets que habría que crear, márcalo como
posible scope creep); HUD propio dibujado en canvas (sí, espejando `drawHUD` de Asteroids, o
apoyarse solo en el HUD de React); qué queda explícitamente fuera de alcance para esta primera
versión.

Deja de preguntar cuando puedas responder, sin asumir nada: qué archivos cambian, cuál es el
primer y el último paso implementable, y cómo verificar que el juego está terminado. Luego
produce la misma hoja de porteo que en 2A (sin las filas específicas de template).

---

## Fase 3 — Elegir y validar la identidad del juego

Propón los siete campos de `GameRow`, luego valida cada uno contra la realidad. Preséntalo
como tabla y confirma con `AskUserQuestion` antes de continuar.

| Campo   | Regla                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | kebab-case en minúsculas, sin acentos, estable para siempre — es la PK de Supabase, la clave de `GAME_REGISTRY`, el nombre de carpeta, el sufijo de la clase de portada, y el segmento de URL en `/juegos/<id>/jugar`. |
| `title` | Nombre a mostrar en español.                                                                                                                                                                     |
| `short` | Frase de catálogo, español, tono acorde a las filas existentes.                                                                                                                                  |
| `long`  | Párrafo de la página de detalle, español. Menciona los controles — es el único lugar donde el jugador los aprende.                                                                               |
| `cat`   | **Debe** ser `ARCADE`, `PUZZLE` o `SHOOTER`. Un CHECK constraint rechaza cualquier otro valor.                                                                                                    |
| `color` | **Debe** ser `cyan`, `magenta`, `yellow` o `green`. CHECK constraint. Mapean a `--cyan`/`--magenta`/`--yellow`/`--green` en `app/globals.css`.                                                    |
| `cover` | El **string completo** `"cover-<id>"`, no un id desnudo.                                                                                                                                          |

No fijes `created_at` — la columna usa el default `now()`.

**Tres checks de unicidad, todos obligatorios, antes de escribir nada:**

1. **Registro** — el `id` no debe ser ya una clave de `GAME_REGISTRY` (visible en el contexto
   de sesión).
2. **Supabase** — ejecuta, vía `mcp__supabase__execute_sql`:
   ```sql
   select id, title, cat, color, cover from public.games order by id;
   ```
   El `id` no debe aparecer. Esto también te muestra el catálogo vivo para que `title`/`cat`/
   `color` se sientan hermanos entre sí, no casi-duplicados. El catálogo ya tiene entradas
   solo-decorativas (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`,
   `ranaria`, `duelo-pixel`) junto al `asteroids` real. **Nunca reutilices el id de una fila
   decorativa para "actualizarla"** — SPEC 05 sentó el precedente explícito: `asteroids` se
   agregó como fila nueva y `rocas` quedó intacto.
3. **CSS** — `grep -n "cover-" app/globals.css`. `.cover-<id>` no debe existir ya. Hay más
   clases `.cover-*` que juegos registrados, así que un id plausible puede chocar.

Confirma también las restricciones vivas con `mcp__supabase__list_tables` en vez de confiar
solo en esta tabla — el esquema se aplicó vía el editor SQL y no hay migraciones `.sql` en el
repo para leer.

Si algún check falla, propón un id distinto y vuelve a validar. No avances sobre una colisión.

Define también aquí el **nombre del componente** en PascalCase (`<Name>Canvas`, ej. `tetris` →
`TetrisCanvas`), el **nombre de la factory** (`create<Name>Engine`) y el **nombre del tipo del
motor** (`<Name>Engine`).

---

## Fase 4 — Escribir el spec

No reinventes el formato del spec, la numeración ni el criterio editorial. Antes de escribir
una sola línea del archivo de spec, **lee la skill `spec` completa como referencia** — no
solo su plantilla de salida — y luego delega en su convención existente:

1. **Lee primero `~/.claude/skills/spec/SKILL.md` de punta a punta.** Es la skill que este
   mismo proyecto usa para escribir specs, y es tu referencia de proceso y de criterio, no solo
   de formato: cómo agrupa las preguntas de clarificación en bloques de 3-5 con
   `AskUserQuestion` (recomendación primero, etiquetada), cuándo escribe el spec completo de
   una sola vez vs. sección por sección esperando confirmación, su lista de "errores comunes a
   evitar" (criterios de aceptación no verificables, meter en el plan de implementación algo
   que no está en el scope, asumir nombres de archivo no confirmados, saltarse la sección de
   decisiones), y sus reglas duras (nunca escribir código en ese paso, nunca marcar el spec
   como `Aprobado` uno mismo, nunca asumir una decisión que el usuario no confirmó). La hoja de
   porteo/preguntas de la Fase 2 de este skill ya cumple el rol de la Fase 2 de `/spec`
   ("Clarificar mediante preguntas") — no repitas las mismas preguntas, pero exígete el mismo
   estándar antes de escribir: si no puedes responder sin asumir nada qué archivos cambian,
   cuál es el primer y último paso ejecutable, y cómo se verifica que el juego quedó terminado,
   vuelve a la Fase 2 de este skill en vez de rellenar el spec con suposiciones.
2. Lee `~/.claude/skills/spec/template.md` (en la misma carpeta que la skill `spec`) para la
   estructura exacta de secciones, y `specs/06-leaderboard-y-catalogo-real.md` +
   `specs/05-juego-asteroids.md` para las convenciones reales de este repo — **español**,
   header en blockquote con `**Estado:** / **Depende de:** / **Fecha:** / **Objetivo:**`,
   secciones `## Scope` con `**In:**` y `**Fuera de alcance:**`, `## Modelo de datos`,
   `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones`, `## Riesgos`.
3. Numeración, exactamente como la define `/spec` Fase 4: toma el número más alto existente en
   el listado de `specs/` del contexto de sesión, súmale uno, dos dígitos con cero a la
   izquierda. Con `01`–`06` presentes, el siguiente es `07`. El slug es kebab-case derivado del
   objetivo — sigue el estilo de nombres existente, ej. `07-juego-tetris.md`.
4. `**Fecha:**` viene del `date +%F` del contexto de sesión. **Nunca escribas una fecha que no
   hayas leído ahí.**
5. `**Depende de:**` debe listar `SPEC 05` (el contrato de registro/motor donde se conecta este
   juego) y `SPEC 06` (las tablas `games`/`scores`). Verifica que ambos archivos existan antes
   de escribir la referencia.
6. `**Estado:**` es `Borrador`. Nunca `Aprobado` — ese cambio lo hace el humano.
7. `specs/.spec-config.yml` ya existe (`AutoCreateBranch: true`). Déjalo intacto.

Contenido del spec, derivado de la hoja de porteo de la Fase 2:

- **Scope / In:** los siete archivos/artefactos exactos del preámbulo, cada uno nombrado
  concretamente.
- **Scope / Fuera de alcance:** como mínimo — sin cambios a `game-player-screen.tsx`; sin
  trabajo de RLS; sin audio (salvo que la Fase 8 haya decidido lo contrario); sin cambios a
  ningún otro juego del catálogo; sin rutas nuevas.
- **Modelo de datos:** los valores de la fila `games` tal cual, más la forma del estado interno
  del motor (los `let` dentro de la factory). Aclara explícitamente que no se introducen tablas
  ni columnas nuevas y que `ScoreRow` se reutiliza sin cambios.
- **Plan de implementación:** numerado, cada paso deja el sistema funcional, espejando las
  Fases 6–11 de este skill.
- **Criterios de aceptación:** booleanos, verificables — redactados desde el checklist de la
  Fase 13, más este criterio no negociable en este repo: *"Agregar este juego no requirió
  condicionales hardcodeadas por juego en `components/game-player-screen.tsx`, ni ningún
  cambio a ese archivo."*
- **Decisiones:** registra las elecciones de id/cat/color y por qué, el mapeo de vidas/nivel
  para juegos que carecen de esos conceptos, la decisión sobre assets, y cualquier cosa del
  template original que se descartó deliberadamente.
- **Riesgos:** como mínimo, el doble montaje de React Strict Mode en desarrollo vs. el
  `requestAnimationFrame` y los listeners de teclado (mitigación: `destroy()` en el cleanup del
  `useEffect` — el mismo riesgo que carga SPEC 05).

**Luego detente.** Muestra la ruta y pregunta:

```
Spec escrito en specs/NN-slug.md (Estado: Borrador).
Revísalo. ¿Continúo con la implementación en esta misma sesión, o prefieres
aprobarlo y ejecutar /spec-impl NN-slug por separado?
```

Espera una respuesta explícita. No inicies la Fase 5 sin ella. Si el usuario prefiere el
camino estricto, detente aquí por completo — `/spec-impl` volverá a validar el estado
`Aprobado` y tomará el control desde la Fase 5 en adelante.

---

## Fase 5 — Rama

Solo tras confirmación explícita. Espeja `/spec-impl` Fase 3 en vez de inventar un flujo de
git:

1. Si `git status --short` no está vacío, detente, muestra los cambios pendientes y pregunta si
   quiere commitear/stashear primero (recomendado) o llevarlos consigo. **Nunca hagas stash ni
   commit en nombre del usuario.**
2. Nombre de rama: `spec-NN-<slug>`, derivado del nombre del archivo de spec sin extensión.
3. Lee `AutoCreateBranch` de `specs/.spec-config.yml` (actualmente `true`). `true` →
   `git checkout -b spec-NN-slug` sin preguntar. Solo un `false` explícito dispara un prompt
   `[y/N]`. Si la rama ya existe, cámbiate a ella, lee `git log --oneline` y reporta qué pasos
   parecen ya hechos antes de continuar.
4. Confirma la rama activa antes de tocar cualquier archivo.

---

## Fase 6 — `components/games/<id>/engine.ts`

Relee `components/games/asteroids/engine.ts` inmediatamente antes de escribir. Espeja su forma
exacta.

**Estructura (no negociable):**

```ts
export type <Name>Engine = {
  start(): void;
  stop(): void;
  destroy(): void;
  onScoreChange(cb: (score: number) => void): void;
  onLivesChange(cb: (lives: number) => void): void;
  onLevelChange(cb: (level: number) => void): void;
  onGameOver(cb: () => void): void;
};

export function create<Name>Engine(canvas: HTMLCanvasElement): <Name>Engine;
```

**Reglas, cada una con su razón:**

1. **Canvas lógico fijo `const W = 800; const H = 600;`** a nivel de módulo (solo constantes).
   El elemento `<canvas>` se dimensiona `width={800} height={600}` y se estira por CSS para
   llenar `.crt-screen`. Un template con otras dimensiones (ej. un tablero de Tetris de
   300×600 más un canvas de "siguiente pieza" de 120×120) se **compone/letterboxea dentro de
   800×600** — centra la zona de juego, coloca el sidebar/preview en el espacio horizontal
   sobrante. Nunca cambies los atributos del elemento canvas; el marco CRT depende de ese
   aspect ratio.
2. **Sin estado mutable a nivel de módulo.** Cada `let` del `game.js` original se mueve dentro
   del closure de la factory. Solo constantes puras y helpers (`wrap`, `dist`, `rand`,
   `randInt`, tablas de puntaje) y clases de entidades viven a nivel de módulo. React Strict
   Mode monta los efectos dos veces en dev; el estado de módulo se filtraría entre instancias.
3. **Los cuatro callbacks se guardan como locales inicializados no-op**, igual que Asteroids:
   ```ts
   let scoreCb: (score: number) => void = () => {};
   ```
   para que el motor nunca truene si un callback no fue conectado.
4. **`start()` re-emite `score`/`lives`/`level` actuales** antes de agendar el primer frame. Es
   lo que mantiene el HUD de React sincronizado tras un resume; cópialo.
5. **`start()` es idempotente** (`if (running) return;`) y `stop()` cancela el `rafId`
   pendiente. Ambos se llaman repetidamente desde el efecto que observa `paused`.
6. **`loop(ts)` con `dt` clamped**: `const dt = Math.min((ts - lastTime) / 1000, 0.05);` y
   reset de `lastTime = null` en `start()` — si no, resumir tras una pausa larga produce un
   `dt` enorme y las entidades atraviesan paredes.
7. **Game over: para, notifica, retorna.** En el loop, cuando el estado pasa a `gameover`:
   `running = false`, llama a `gameOverCb()`, y `return` sin re-agendar. **Elimina** el overlay
   propio de game-over del original y **elimina** su reinicio por Espacio. React reinicia
   remontando con una `key` nueva. `game-player-screen.tsx` pasa `paused={paused || over}`, así
   que `stop()` también se llamará justo después del game over — debe ser seguro llamarlo
   sobre un motor ya detenido.
8. **Listeners de teclado en `window`**, agregados al final del cuerpo de la factory (después
   de `initGame()`), removidos en `destroy()`. Conserva el patrón de `preventDefault()` — sin
   eso, las flechas y Espacio scrollean la página bajo el CRT. Usa `e.code`, no `e.key`.
9. **`destroy()` llama primero a `stop()`**, luego remueve los listeners, luego libera lo de la
   Fase 8 (audio, handles de imagen).
10. **Clases de entidades con `update(dt)` / `draw(ctx)`.** Conserva las tablas de tuning del
    original (radios, velocidades, puntajes, `LINE_SCORES`, curva de `dropInterval`) como
    constantes de módulo nombradas.
11. **HUD propio en el canvas.** SPEC 05 conservó el `drawHUD` de Asteroids; conserva el
    equivalente — el CRT debe verse como un gabinete real, no un rectángulo vacío bajo el
    header de React. Duplica el HUD de React a propósito.

**Mapeo para juegos sin vidas o sin niveles** (el punto más probable de error — Tetris no tiene
ninguno de los dos en el sentido de Asteroids):

- Sin vidas → llama `onLives(1)` una vez al iniciar, y `onLives(0)` en el momento del game
  over. El HUD de React renderiza `"♥ ".repeat(lives)` con fallback a `"—"`, así que `0`
  degrada limpio.
- Sin niveles discretos → si el juego tiene alguna escalada de dificultad (ej. Tetris:
  `floor(lineas/10)+1`), repórtala vía `onLevel`. Si genuinamente no tiene ninguna, llama
  `onLevel(1)` una vez y nunca más.
- Nunca agregues un quinto callback ni toques `types.ts`. Registra el mapeo elegido en la
  sección `## Decisiones` del spec.

**Idioma:** comentario de encabezado del archivo y comentarios internos en español, igual que
`engine.ts` y `registry.ts` (`// ===== components/games/<id>/engine.ts =====` más una línea
nombrando el template de origen, como hace el encabezado de Asteroids). Strings de error en
español (`"No se pudo obtener el contexto 2D del canvas"`).

---

## Fase 7 — `components/games/<id>/<Name>Canvas.tsx`

Este archivo es casi boilerplate; copia la estructura de 52 líneas de `AsteroidsCanvas.tsx` y
cambia solo los nombres del motor.

- `"use client";` en la primera línea.
- Export por default, props desestructuradas como
  `{ paused, onScore, onLives, onLevel, onGameOver }: GamePlayerProps`.
- Dos refs: `canvasRef` (`HTMLCanvasElement`) y `engineRef` (`<Name>Engine | null`).
- **Efecto 1 — solo montaje, deps vacías.** Guarda contra `canvasRef.current`, crea el motor,
  guárdalo en `engineRef`, conecta los cuatro callbacks, llama `start()`. El cleanup llama
  `engine.destroy()` y anula el ref. Conserva el
  `// eslint-disable-next-line react-hooks/exhaustive-deps` arriba del array de deps — los
  callbacks son deliberadamente no-dependencias; re-ejecutar este efecto destruiría y
  reconstruiría el juego en cada render del padre.
- **Efecto 2 — `[paused]`.** Lee `engineRef.current`, sal si es null, luego
  `paused ? engine.stop() : engine.start()`.
- Renderiza exactamente un elemento:
  ```tsx
  <canvas ref={canvasRef} width={800} height={600}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
  ```
  Sin div wrapper, sin HUD, sin overlay — `.crt-screen` es el contexto de posicionamiento y
  `game-player-screen.tsx` ya renderiza el overlay de pausa por encima.

---

## Fase 8 — Assets (solo para templates que los traen)

**Sí, el skill maneja templates multi-archivo con assets** — `04-arkanoid` está en la carpeta y
eventualmente se porteará, así que este skill necesita una respuesta en vez de un callejón sin
salida.

**Decide por tipo de asset, preguntando con `AskUserQuestion` si el template trae alguno:**

- **Imágenes / spritesheets** (`assets/spritesheet-breakout.png`): cópialas a
  **`public/games/<id>/`**. Todo bajo `public/` se sirve desde la raíz del sitio, así que
  `public/games/arkanoid/spritesheet.png` se sirve en `/games/arkanoid/spritesheet.png`.
  Referencia esa ruta absoluta como string plano desde el motor — el dibujo en canvas usa
  `new Image()` directo; `next/image` es irrelevante aquí y no debe importarse. Cárgala dentro
  de la factory:
  ```ts
  const sprites = new Image();
  let spritesReady = false;
  sprites.onload = () => { spritesReady = true; };
  sprites.src = "/games/<id>/spritesheet.png";
  ```
  y protege cada draw en `spritesReady`, con fallback a una forma primitiva para que los
  primeros frames rendericen en vez de tronar. Portea los helpers del `assets/spritesheet.js`
  del template (`drawSprite`, `drawFrame`, tablas `SPRITES` / `EXPLOSION_FRAMES`) al archivo
  del motor o a un `sprites.ts` hermano dentro de `components/games/<id>/` — la *data* vive en
  la carpeta del componente, solo el *binario* va a `public/`.
- **Sonidos** (`assets/sounds/*.mp3`): **por defecto se descartan**, dilo en el scope del spec.
  SPEC 05 sentó ese precedente para Asteroids. Pregunta antes de decidir — si el usuario quiere
  audio, copia los archivos a `public/games/<id>/sounds/`, crea los objetos `Audio` **dentro
  de la factory** (nunca a nivel de módulo), y en `destroy()` pausa cada instancia y anula sus
  referencias, o un juego pausado/desmontado sigue sonando. Nota también que los navegadores
  bloquean el autoplay antes de un gesto del usuario, así que el primer sonido puede quedar
  silencioso hasta la primera tecla; es aceptable pero va en los riesgos del spec.
- **Datos de niveles** (`04-arkanoid/levels.js`): portea a `components/games/<id>/levels.ts`
  con un tipo exportado real, no a `public/`. Es código fuente, no un asset estático.
- **Nunca copies** el `index.html`, `style.css`, `.DS_Store`, `.claude/`, `.agents/`,
  `skills-lock.json`, ni el `specs/` propio del template. Es scaffolding de la app standalone;
  el proyecto Next ya provee todo eso.

Si se copian assets, agrega una línea `public/games/<id>/` a la lista de archivos del spec y a
los criterios de aceptación (ej. *"el spritesheet carga sin un 404 en la pestaña de red"*).

---

## Fase 9 — Registrar el juego

Un único edit a `components/games/registry.ts`: una línea de import agrupada con las
existentes, y una entrada en `GAME_REGISTRY` con la clave exacta elegida en la Fase 3. Mantén
las entradas ordenadas alfabéticamente por clave. No toques el comentario de encabezado del
archivo ni la anotación `Record<string, ComponentType<GamePlayerProps>>`.

Verifica que la clave coincida con el `id` de Supabase **carácter por carácter** — un
desajuste es silencioso: `GAME_REGISTRY[game.id]` devuelve `undefined`,
`game-player-screen.tsx` cae al stub decorativo `game-arena`, y la página se ve
superficialmente bien mientras el juego real nunca renderiza. Este es el modo de falla más
probable de todo el flujo; decláralo en los riesgos del spec.

---

## Fase 10 — CSS de portada

Agrega un bloque `.cover-<id>` al final de la sección de portadas en `app/globals.css` (los
bloques de portada corren aproximadamente entre las líneas 405–541, terminando con
`.cover-asteroids`, justo antes del comentario `/* ===== detail screen ===== */`). Insértalo
antes de ese comentario; no reordenes ni edites los bloques existentes.

Sigue el patrón establecido con precisión:

- `.cover-<id> { background: <un gradiente base radial o lineal>; }`
- `.cover-<id>::after { content: ""; position: absolute; inset: 0; background: <formas en capas con radial-gradient/linear-gradient>; }`
- Opcionalmente `.cover-<id>::before` para un glifo o forma de acento, usando una variable de
  tema para el color más un `text-shadow` a juego
  (`color: var(--cyan); text-shadow: 0 0 10px var(--cyan);`).

Usa el token de tema que corresponda al campo `color` de la fila para que la tarjeta y su
portada concuerden. El resultado debe ser visualmente distinto de cada portada existente — el
catálogo ya tiene vecinos cercanos (`cover-rocas` vs `cover-asteroids` son ambos campos de
asteroides, deliberadamente diferenciados). Por ser trabajo de diseño visual, invoca
`/frontend-design` para inventar la identidad visual — usa motivos del propio vocabulario del
juego (tetrominós, filas de ladrillos, el arco de una paleta) en vez de generar otro starfield
genérico.

Sin JS, sin imágenes, sin variables CSS nuevas. Solo gradientes en pseudo-elementos, igual que
los bloques existentes.

---

## Fase 11 — Insertar y verificar la fila en Supabase

Ejecuta, no imprimas para que el usuario lo corra a mano.

**Paso 1 — pre-vuelo** (ya hecho en la Fase 3, repítelo si se retomó una rama existente):

```sql
select id from public.games where id = '<id>';
```

Debe devolver cero filas. Si devuelve una, detente — la fila ya existe y reinsertar fallará en
la PK.

**Paso 2 — insertar** vía `mcp__supabase__execute_sql`, columnas explícitas, `created_at`
omitido para que aplique el default:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values ('<id>', '<title>', '<short>', '<long>', '<CAT>', 'cover-<id>', '<color>');
```

Escapa los apóstrofes en el copy en español duplicándolos (`'`→`''`) — `short`/`long` son
prosa y los tendrán.

**Paso 3 — verificar** con una lectura real, no confiando en el retorno del insert:

```sql
select id, title, cat, color, cover, created_at from public.games where id = '<id>';
```

Muestra la fila devuelta al usuario y revisa cada campo: `cat` es uno de los tres permitidos,
`color` uno de los cuatro, `cover` es el string completo `cover-<id>`, `created_at` está
poblado.

**Ante una falla de CHECK constraint**, el error nombra la restricción violada — corrige el
valor ofensor (casi siempre `cat` o `color`) y reintenta. No lo evadas alterando la tabla.

**Ruta de rollback:** si una fase posterior falla y el juego debe abandonarse, el undo es
`delete from public.games where id = '<id>';`. Menciónalo, pero nunca lo ejecutes sin que el
usuario lo pida.

**No toques RLS.** Ambas tablas lo tienen deshabilitado — riesgo conocido y aceptado en las
decisiones de SPEC 06. No lo actives, no agregues políticas, no lo empeores agregando una
tabla o un grant permisivo.

---

## Fase 12 — Build y lint

```bash
npx eslint .
npm run build
```

Corrige todo lo reportado hasta que ambos queden limpios. Errores esperados y su corrección
correcta:

- `react-hooks/exhaustive-deps` en el efecto de montaje → conserva el
  `// eslint-disable-next-line` existente, no agregues los callbacks al array de deps (eso
  destruiría y reconstruiría el motor en cada render del padre).
- `@typescript-eslint/no-explicit-any` → da tipos reales; el resto del código no usa `any`.
- `no-unused-vars` de un porteo parcial del original → elimina el código muerto en vez de
  deshabilitar la regla.
- Un fallo de build por `document`/`window` a nivel de módulo → todo acceso a APIs del
  navegador debe estar dentro de la factory o dentro de un `useEffect`; el componente canvas
  es `"use client"` pero igual se prerenderiza.

---

## Fase 13 — Checklist manual de extremo a extremo

No declares terminado desde un build verde. Pide al usuario correr `npm run dev` y recorrer
esta lista, presentándola como checklist para tildar. Cada ítem es booleano y mapea a un
criterio de aceptación del spec.

**Catálogo y detalle (sin cambios de código — prueban que la fila de Supabase es correcta):**

1. `/biblioteca` muestra una tarjeta para el juego nuevo con título, badge de categoría, texto
   corto, color de acento y la portada nueva correctos (no un rectángulo negro/vacío — eso
   significaría que la clase `.cover-<id>` y la columna `cover` no coinciden).
2. `/juegos/<id>` carga la página de detalle con la descripción larga y el mensaje de
   leaderboard vacío *"Sé el primero en entrar al salón de la fama"*.
3. `/salon` muestra una tab para el juego nuevo.

**Jugabilidad en `/juegos/<id>/jugar`:**

4. El juego real renderiza dentro del CRT — **no** el stub decorativo `game-arena` con los tres
   enemigos flotantes. Ver el stub significa que `GAME_REGISTRY` y `games.id` no coinciden
   (Fase 9).
5. El canvas llena la pantalla del CRT de borde a borde, sin letterboxing ni scrollbars.
6. Cada control documentado responde; flechas y Espacio no scrollean la página.
7. El HUD de React (Puntuación) se actualiza con el score del motor.
8. Vidas y Nivel se actualizan según el mapeo de la Fase 6 (o se mantienen en sus constantes
   mapeadas).
9. **PAUSA** congela la acción, mantiene el último frame visible bajo el overlay "EN PAUSA", y
   detiene los cambios de score.
10. **REANUDAR** continúa exactamente donde quedó — sin salto de `dt`, sin entidades
    teletransportadas.
11. Perder normalmente dispara el game over: el modal aparece con el score final.
12. **FIN** fuerza el modal en cualquier momento.
13. La consola queda limpia — en particular sin síntomas de doble RAF o listeners duplicados
    por el doble montaje de Strict Mode (una velocidad de juego duplicada es la señal).

**Persistencia del score:**

14. En el modal, escribe iniciales y presiona GUARDAR PUNTUACIÓN → aparece el toast
    "▸ PUNTUACIÓN GUARDADA_".
15. Recargar `/juegos/<id>` → el score está en la tabla top-10 con el nombre correcto.
16. `/salon` → el score aparece bajo la tab del juego nuevo.
17. Jugar de nuevo → el campo de nombre viene prellenado desde
    `localStorage["av_player_name"]`.
18. **JUGAR DE NUEVO** reinicia desde un estado genuinamente nuevo (score 0, vidas reiniciadas,
    nivel 1) — esto ejercita el remount por `key={playCount}`, así que un score que persiste
    aquí indica una fuga de estado de módulo fuera de la factory (Fase 6, regla 2).

**Regresión:**

19. Abre cualquier juego decorativo (ej. `/juegos/rocas/jugar`) y confirma que sigue mostrando
    la arena simulada anterior sin cambios.
20. `git status` solo muestra las rutas esperadas — sin edición accidental a
    `game-player-screen.tsx`, `types.ts`, ni `lib/supabase/*`.

---

## Fase 14 — Cierre

**Nunca commitees automáticamente** — ni por paso, ni al final. Sigue la regla de
`spec-impl` al pie de la letra.

Reporta:

```
✅ <TITLE> añadido al catálogo.

Spec:     specs/NN-slug.md
Rama:     spec-NN-slug (activa)
Archivos: components/games/<id>/engine.ts
          components/games/<id>/<Name>Canvas.tsx
          components/games/registry.ts       (+1 import, +1 entrada)
          app/globals.css                    (+ .cover-<id>)
          [public/games/<id>/…               (assets)]
Supabase: 1 fila insertada en public.games (verificada)

Siguiente paso: verifica los criterios de aceptación del spec uno a uno.
Si pasan todos, cambia el Estado del spec a "Implementado" y haz el commit
antes de mergear esta rama.
```

Luego detente. No propongas el siguiente juego, no abras un PR, no commitees.

---

## Reglas duras

- Nunca modifiques `components/game-player-screen.tsx`. Si crees que debes hacerlo, malentendiste
  el patrón de registro — relee SPEC 05.
- Nunca modifiques `components/games/types.ts`, `lib/supabase/types.ts`,
  `lib/supabase/client.ts`, ni `lib/supabase/server.ts`.
- Nunca modifiques la carpeta de otro juego, el bloque `.cover-*` de otro juego, ni la fila
  `games` de otro juego.
- Nunca agregues una ruta nueva. `/juegos/[id]/jugar` es genérica y se queda genérica.
- Nunca actives, desactives ni alteres RLS; nunca hagas `ALTER TABLE`. La única escritura a la
  base de datos que hace este skill es un `INSERT` en `games`.
- Nunca imprimas SQL para que el usuario lo corra a mano — ejecútalo y verifícalo con una
  lectura de vuelta.
- Nunca commitees ni pushees.
- Nunca marques el spec como `Aprobado` ni `Implementado` tú mismo.
- Ante una ambigüedad que el spec no resuelve: detente, dila con precisión, ofrece dos o tres
  opciones concretas, espera. No improvises.
- Si el usuario pide algo fuera del scope del spec a mitad de la implementación, recuérdale que
  está fuera de alcance y sugiere un spec de seguimiento; no lo implementes en esta rama.
