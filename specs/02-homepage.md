# SPEC 02 — Homepage de Arcade Vault

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-09-02
> **Objective:** Portar la pantalla Home del prototipo estático en `references/templates/home-about/home.jsx` a la ruta `/`, moviendo la pantalla Biblioteca (hoy en `/`, definida en SPEC 01) a `/biblioteca`.

## Por qué existe este spec

SPEC 01 hizo que `/` fuera la pantalla Biblioteca porque el prototipo original arrancaba ahí. El template `references/templates/home-about/` trata "Inicio" (Home) y "Biblioteca" como pantallas distintas en el nav (`nav.jsx`: Inicio, Biblioteca, Salón de la Fama, Acerca de). Para portar Home fielmente hace falta liberar `/` y reubicar Biblioteca.

## Scope

**In:**

- Ruta `/` con la pantalla Home: hero con siluetas pixel flotantes decorativas, sección "¿Por qué Arcade Vault?" (grid de 4 features), preview de juegos (rail de 6 juegos tomados del catálogo real), sección de stats, sección "Actividad en Vivo" (últimas puntuaciones + top jugadores, contenido estático de ejemplo igual al template), sección de precios/FAQ, y CTA final.
- Mover la pantalla Biblioteca (buscador, chips de categoría, grid de tarjetas) de `/` a `/biblioteca`, sin cambios de comportamiento.
- Animación de scroll-reveal (`.reveal` / `.reveal.in` vía `IntersectionObserver`) en las secciones de Home, igual que en el template.
- Actualizar `components/nav.tsx`: agregar el link "Inicio" (`/`), mover el link "Biblioteca" a `/biblioteca`, y actualizar la lógica de estado activo para ambas rutas (incluyendo `/juegos/*` como parte de "Biblioteca").
- Actualizar todos los `router.push("/")` / `href="/"` existentes que hoy asumen que `/` es Biblioteca, para que apunten a `/biblioteca` (preservando la intención original de "volver al catálogo"): `app/auth/page.tsx` (login y "jugar como invitado"), `app/salon/page.tsx` ("volver a la biblioteca"), `app/juegos/[id]/page.tsx` ("volver"), `app/juegos/[id]/jugar/page.tsx` ("volver al vault").
- Migrar al `app/globals.css` el bloque de estilos "HOME PAGE" de `references/templates/home-about/styles.css` (hero, siluetas, feature grid, mini-rail, stats, actividad, precios, CTA final, `.reveal`).

**Out of scope (for future specs):**

- Pantalla "Acerca de" / contacto (`about.jsx` del mismo template), incluyendo el formulario de contacto simulado. Queda para un spec futuro.
- Link "Acerca de" en el nav (no se agrega todavía porque la pantalla no existe).
- Cualquier lógica real de envío de formularios, backend, o conexión de la sección "Actividad en Vivo" / stats a datos reales (quedan estáticos, como en el template).
- Cambios a la lógica de Biblioteca, Detalle, Reproductor, Auth o Salón más allá de actualizar sus enlaces de retorno a `/biblioteca`.

## Data model

No se introducen estructuras de datos nuevas. La sección "Juegos disponibles ahora" reutiliza `GAMES` de `lib/data.ts` (ya existente, `GAMES.slice(0, 6)`). Las secciones "Actividad en Vivo" (últimas puntuaciones, top jugadores) y las stats del hero de estadísticas se migran como arrays/textos literales dentro del componente de Home, igual que en `home.jsx`, sin persistirse ni derivarse de `localStorage`.

## Implementation plan

1. Crear `app/biblioteca/page.tsx` (Server Component) que renderiza `<LibraryScreen />`, con el mismo contenido que hoy tiene `app/page.tsx`.
2. Migrar el bloque de estilos "HOME PAGE" (silhouettes, hero, feature grid, mini-rail, stats, actividad, pricing, CTA final, `.reveal`) de `references/templates/home-about/styles.css` a `app/globals.css`, sin modificar los valores.
3. Crear `components/home-screen.tsx` (Client Component) portando `home.jsx`: `FloatingSilhouettes`, `FeatureIcon`, el rail de juegos (usando `GAMES` de `lib/data.ts` y `next/navigation` para navegar a `/juegos/[id]`), las secciones de stats/actividad/precios/FAQ con el contenido estático del template, y el hook de scroll-reveal vía `IntersectionObserver`. Los CTAs "Explorar juegos" / "Ver todos los juegos" / "Insertar moneda" navegan a `/biblioteca`; "Crear cuenta" y "Empezar gratis" navegan a `/auth`.
4. Actualizar `app/page.tsx` para renderizar `<HomeScreen />` en vez de `<LibraryScreen />`.
5. Actualizar `components/nav.tsx`: agregar el link "Inicio" apuntando a `/`, cambiar el link "Biblioteca" a `/biblioteca`, y ajustar `isActive` para que "Inicio" esté activo solo en `pathname === "/"` y "Biblioteca" esté activo en `/biblioteca` y `/juegos/*`. Replicar en el panel móvil.
6. Actualizar los `router.push("/")` / `href="/"` en `app/auth/page.tsx` (líneas de login y "jugar como invitado"), `app/salon/page.tsx`, `app/juegos/[id]/page.tsx` y `app/juegos/[id]/jugar/page.tsx` para que apunten a `/biblioteca`.
7. Correr `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/`, resolviendo cualquier error antes de dar la tarea por terminada.

## Acceptance criteria

- [ ] `/` muestra la pantalla Home: hero con siluetas flotantes, sección "¿Por qué Arcade Vault?", rail "Juegos disponibles ahora" con 6 juegos del catálogo real, sección de stats, sección "Actividad en Vivo", sección de precios/FAQ y CTA final.
- [ ] `/biblioteca` muestra la pantalla Biblioteca (hero, buscador, chips, grid) con el mismo comportamiento que tenía antes en `/`.
- [ ] Los botones "Explorar juegos", "Ver todos los juegos →" e "Insertar moneda →" en Home navegan a `/biblioteca`.
- [ ] Los botones "Crear cuenta" y "Empezar gratis →" en Home navegan a `/auth`.
- [ ] Hacer click en una tarjeta del rail de juegos de Home navega a `/juegos/[id]` del juego correspondiente.
- [ ] Las secciones de Home marcadas `reveal` aparecen con la animación de fade/slide al hacer scroll hasta ellas.
- [ ] El nav muestra los links "Inicio" y "Biblioteca" apuntando a `/` y `/biblioteca` respectivamente, con el estado activo correcto en cada ruta (incluyendo `/juegos/*` para "Biblioteca").
- [ ] Iniciar sesión y "jugar como invitado" en `/auth` redirigen a `/biblioteca`.
- [ ] "Volver a la biblioteca" en `/salon`, "volver" en `/juegos/[id]` y "volver al vault" en `/juegos/[id]/jugar` navegan a `/biblioteca`.
- [ ] `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/` terminan sin errores.

## Decisions

- **Sí:** Home reemplaza a Biblioteca en `/`; Biblioteca se muda a `/biblioteca`. Decisión confirmada por el usuario — coincide con el nav de 4 links del template (Inicio, Biblioteca, Salón, Acerca de) y con `/` como landing del sitio.
- **Sí:** la sección "Actividad en Vivo" y las stats del hero quedan estáticas/decorativas, migradas literalmente del template. Confirmado por el usuario — es contenido de marketing, no funcionalidad real, coherente con el resto del MVP visual (SPEC 01).
- **Sí:** todos los redirects/links que hoy apuntan a `/` (login, "jugar como invitado", "volver", "volver al vault", "volver a la biblioteca") pasan a apuntar a `/biblioteca`, preservando su intención funcional original de volver al catálogo de juegos. Solo el logo del nav y el nuevo link "Inicio" apuntan a `/`.
- **No:** no se implementa la pantalla "Acerca de" ni su formulario de contacto en este spec. El folder de referencia trae ambas pantallas juntas, pero el usuario confirmó que solo Home entra acá; "Acerca de" queda para un spec futuro.
- **No:** no se agrega el link "Acerca de" al nav todavía, para no enlazar a una ruta inexistente.
- **No:** no se conecta la sección "Actividad en Vivo" a `av_scores`/`seededScores` reales. Se migra tal cual el contenido de ejemplo del template.

## Risks

| Risk                                                                                                                 | Mitigation                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambiar `/` de Biblioteca a Home rompe enlaces internos que asumían `/` como catálogo (login, salón, detalle, jugar) | Se actualizan explícitamente todos los `router.push("/")`/`href="/"` existentes en el paso 6 del plan de implementación; el criterio de aceptación correspondiente verifica cada uno. |
| El hook de scroll-reveal usa `IntersectionObserver`, que no existe en el servidor                                    | `HomeScreen` es Client Component (`"use client"`), igual que `LibraryScreen`; el `useEffect` que registra el observer solo corre en el navegador.                                     |

## Qué **no** está en este spec

- Pantalla "Acerca de" y su formulario de contacto.
- Link "Acerca de" en el nav.
- Conexión de "Actividad en Vivo" o stats a datos reales.
- Cambios de lógica en Biblioteca, Detalle, Reproductor, Auth o Salón (solo se actualizan sus enlaces de retorno).

Cada uno de estos, si se implementa, va en su propio spec.
