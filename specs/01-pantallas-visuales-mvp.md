# SPEC 01 — Pantallas visuales del MVP de Arcade Vault

> **Status:** Aprobado
> **Depends on:** (ninguna)
> **Date:** 2026-09-02
> **Objective:** Portar las cinco pantallas visuales del prototipo estático en `references/templates/` (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) a rutas reales de Next.js App Router, sin implementar la lógica de ningún juego.

## Por qué existe este spec

`references/templates/` es un prototipo de React "vanilla" (sin build, cargado con Babel standalone en el navegador) que enruta todo con un único componente `App` y un hash en la URL (`app.jsx`). Este proyecto usa Next.js 16 con App Router, así que el port no es copiar los `.jsx` tal cual: hay que convertirlos en rutas de archivo reales, decidir qué pantallas son Server Component y cuáles Client Component, y reemplazar el estado global de `App` (usuario, ruta) por un mecanismo compatible con Server/Client Components y con hidratación (ver sección de Decisiones).

## Scope

**In:**

- Ruta `/` con la pantalla Biblioteca (hero, buscador, filtros por categoría, grid de tarjetas de juego con efecto _tilt_), reemplazando el placeholder actual de `app/page.tsx`.
- Ruta `/juegos/[id]` con la pantalla Detalle (portada, tags, descripción, estadísticas, leaderboard con datos con semilla, botones Jugar/Volver).
- Ruta `/juegos/[id]/jugar` con la pantalla Reproductor: HUD (jugador, puntaje, vidas, nivel), escena CRT decorativa animada, puntaje que se incrementa solo, pausa, fin de juego y modal para guardar puntaje.
- Ruta `/auth` con la pantalla de login/registro falso: tabs "Iniciar sesión" / "Crear cuenta", formulario, botón "Jugar como invitado", botones sociales decorativos (Google/GitHub, sin funcionalidad real).
- Ruta `/salon` con la pantalla Salón de la Fama: tabs por juego, podio top 3, tabla de puntajes, fila "tu mejor marca" cuando hay sesión iniciada.
- Nav superior persistente (logo, links Biblioteca/Salón, contador de créditos estático, botón de sesión, menú hamburguesa responsive) y footer, ambos vivendo en `app/layout.tsx`.
- Estado de sesión mock (login falso: cualquier usuario/contraseña entra, sin validación) persistido en `localStorage` bajo la clave `av_user`, compartido entre Nav, Auth, Reproductor y Salón vía contexto de React.
- Puntajes guardados desde la pantalla Reproductor, persistidos en `localStorage` bajo la clave `av_scores`.
- Catálogo de 8 juegos y generador de leaderboard con semilla (`seededScores`), migrados literalmente desde `references/templates/data.jsx`.

**Out of scope (for future specs):**

- Implementar la lógica real de cualquier juego (Bloque Buster, Caída, Serpentina, etc.). La pantalla Reproductor sigue siendo una simulación puramente visual.
- Autenticación real (backend, validación de contraseña, OAuth real con Google/GitHub).
- Persistencia de puntajes en un backend o base de datos.
- Crear o editar juegos desde la UI.
- Internacionalización (i18n) — la UI queda fija en español.
- Accesibilidad más allá de lo que ya trae el template (roles básicos de botón y foco de teclado en las tarjetas).

## Data model

```ts
// lib/data.ts
type Game = {
  id: string; // "bloque-buster", "caida", "serpentina", "gloton",
  // "invasores", "rocas", "ranaria", "duelo-pixel"
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS de portada, ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string; // ej. "12.4K"
};

const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

type ScoreRow = { rank: number; name: string; score: number; date: string };
```

```ts
// lib/user-context.tsx
type User = { name: string } | null;
```

**Claves de `localStorage`:**

- `av_user`: JSON de `User`, leído/escrito únicamente por `lib/user-context.tsx`.
- `av_scores`: array de `{ game: string; score: number; name: string; at: number }`, escrito por `lib/scores.ts` desde la pantalla Reproductor.

El catálogo `GAMES` (8 juegos) y la función `seededScores` se migran literalmente desde `references/templates/data.jsx`, sin cambios de contenido.

## Implementation plan

1. Crear `lib/data.ts` con los tipos `Game`/`ScoreRow`, el catálogo `GAMES`, `CATS` y la función `seededScores`, migrados desde `references/templates/data.jsx`.
2. Crear `lib/user-context.tsx` con un `UserProvider` (contexto de React) que expone `user`, `login` y `signOut`, sincronizado con `localStorage` (clave `av_user`) vía `useSyncExternalStore` para evitar _mismatches_ de hidratación en Next.js.
3. Crear `lib/scores.ts` con `saveScore(entry)`, que agrega un puntaje al array en `localStorage` (clave `av_scores`).
4. Crear `components/nav.tsx` (Client Component) con el nav superior y el panel móvil, usando `usePathname` para el estado activo de los links y `useUser()` para mostrar sesión/botón de logout.
5. Actualizar `app/layout.tsx`: envolver `children` en `<UserProvider>`, renderizar `<Nav />` antes del contenido y el footer después, dentro del `div#root` existente.
6. Crear `components/game-card.tsx` (Client Component) con el efecto _tilt_ al mover el mouse y navegación a `/juegos/[id]` al hacer click.
7. Crear `components/library-screen.tsx` (Client Component) con el hero, buscador, chips de categoría y el grid de `GameCard` filtrado; actualizar `app/page.tsx` para renderizarlo.
8. Crear `app/juegos/[id]/page.tsx` (Server Component) con `generateStaticParams` sobre `GAMES`, mostrando portada, tags, descripción, estadísticas y leaderboard; `notFound()` si el `id` no existe.
9. Crear `app/juegos/[id]/jugar/page.tsx` (Client Component) con el HUD, la escena CRT animada, el ciclo de puntaje simulado, pausa/fin y el modal de guardar puntaje vía `saveScore()`.
10. Crear `app/auth/page.tsx` (Client Component) con los tabs de login/registro, el formulario, "Jugar como invitado" y los botones sociales decorativos, llamando a `login()` del contexto y redirigiendo a `/`.
11. Crear `app/salon/page.tsx` (Client Component) con los tabs por juego, el podio, la tabla de puntajes y la fila "tu mejor marca" cuando hay sesión.
12. Correr `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/`, resolviendo cualquier error antes de dar la tarea por terminada.

## Acceptance criteria

- [ ] `/` muestra la pantalla Biblioteca con hero, buscador funcional (filtra por texto) y chips de categoría funcionales.
- [ ] Al hacer click en una tarjeta de juego (o su botón JUGAR) navega a `/juegos/[id]`.
- [ ] `/juegos/[id]` muestra la información del juego y una tabla de mejores puntuaciones para los 8 juegos definidos en `GAMES`.
- [ ] El botón "JUGAR AHORA" en `/juegos/[id]` navega a `/juegos/[id]/jugar`.
- [ ] En `/juegos/[id]/jugar` el puntaje se incrementa automáticamente mientras el juego no está pausado ni terminado.
- [ ] El botón PAUSA detiene el incremento de puntaje y muestra el overlay "EN PAUSA"; REANUDAR lo retoma.
- [ ] El botón FIN abre el modal de fin de juego con el puntaje final.
- [ ] Guardar el puntaje en el modal lo persiste en `localStorage` bajo la clave `av_scores` y muestra el mensaje de confirmación.
- [ ] `/auth` permite "iniciar sesión" con cualquier usuario/contraseña, actualiza el nav con el nombre de usuario y redirige a `/`.
- [ ] "Jugar como invitado" en `/auth` cierra sesión (si había alguna) y redirige a `/`.
- [ ] Cerrar sesión desde el botón del nav borra el usuario de `localStorage` y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra podio, tabla y tabs por juego para los 8 juegos; con sesión iniciada aparece la fila "tu mejor marca".
- [ ] El menú hamburguesa funciona en viewport angosto (<840px) y sus links cierran el panel al navegar.
- [ ] `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/` terminan sin errores.

## Decisions

- **Sí:** rutas en español (`/juegos/[id]`, `/salon`, `/auth`). Coherentes con la UI en español; evita mezclar idiomas entre URLs y contenido.
- **Sí:** `/` pasa a ser la pantalla Biblioteca, reemplazando el placeholder actual. Evita una landing separada sin propósito y coincide con la ruta por defecto del prototipo original (`app.jsx` arranca en `"biblioteca"`).
- **Sí:** la pantalla Reproductor se porta tal cual como "chrome visual" (puntaje simulado, CRT animado). Es decoración CSS/estado local, no lógica de juego real, y da la sensación de MVP completo mientras se respeta "no implementar ningún juego".
- **Sí:** sesión y puntajes en `localStorage`, sin restricciones de acceso a ninguna pantalla. Igual que el prototipo original; mantiene el MVP simple sin backend ni _gating_.
- **Sí:** contexto de React (`UserProvider`) en vez del _prop drilling_ manual de `app.jsx`. Next.js App Router no tiene un componente raíz único donde levantar el estado como en la SPA original.
- **Sí:** `useSyncExternalStore` para leer `localStorage` en el contexto de usuario. Evita _mismatches_ de hidratación entre servidor y cliente que el patrón original (`useState` + `useEffect`) no maneja bien en Next.js.
- **No:** persistir la sesión en cookies o el servidor. No hay backend en este MVP; `localStorage` alcanza.
- **No:** habilitar `typedRoutes` en `next.config.ts`. No es necesario para este alcance; se usan los helpers `PageProps`/`LayoutProps` que Next.js genera automáticamente para los tipos de `params`.

## Risks

| Risk                                                                                | Mitigation                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localStorage` deshabilitado (modo privado/incógnito) o no disponible               | Los accesos en `lib/user-context.tsx` y `lib/scores.ts` van envueltos en `try/catch`; la app sigue funcionando, solo sin persistencia entre recargas. |
| El efecto _tilt_ de `GameCard` manipula el DOM directamente (`ref.style.transform`) | Queda aislado a un Client Component; no afecta el renderizado en servidor ni el resto de la pantalla.                                                 |

## Qué **no** está en este spec

- Lógica real de cualquier juego.
- Autenticación real o backend.
- Persistencia de puntajes fuera de `localStorage`.
- Internacionalización (i18n).

Cada uno de estos, si se implementa, va en su propio spec.
