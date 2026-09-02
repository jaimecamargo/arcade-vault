# SPEC 04 — Integración de Supabase (plumbing)

> **Status:** Implementado
> **Depends on:** (ninguna)
> **Date:** 2026-09-02
> **Objective:** Conectar el SDK de Supabase al proyecto Next.js (clientes de browser y servidor, refresco de sesión vía `proxy.ts`, variables de entorno), sin migrar todavía ninguna funcionalidad existente a Supabase.

## Por qué existe este spec

El proyecto ya tiene un proyecto Supabase remoto provisto (`tdlvsdvlanjsxobjnnnm`, referenciado en `.mcp.json` y `.env.template`), pero sin tablas, migraciones ni SDK instalado. Antes de migrar el login mock (`av_user` en `localStorage`) o los puntajes (`av_scores`), hace falta dejar la infraestructura de conexión lista y probada. Ese es el único objetivo de este spec — specs futuros construirán autenticación real y persistencia de puntajes sobre esta base.

## Scope

**In:**

- Instalar `@supabase/ssr` y `@supabase/supabase-js`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.template` (documentando de dónde se obtienen) y en `.env.local` con los valores reales del proyecto `tdlvsdvlanjsxobjnnnm`.
- `lib/supabase/client.ts`: cliente de Supabase para Client Components (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente de Supabase para Server Components/Server Actions/Route Handlers (`createServerClient`, cookies vía `next/headers`).
- `lib/supabase/proxy.ts`: función `updateSession(request)` que refresca el token de sesión de Supabase y propaga las cookies actualizadas.
- `proxy.ts` en la raíz del proyecto (convención de Next.js 16, reemplaza a `middleware.ts`) que invoca `updateSession`, con un `matcher` que excluye assets estáticos.

**Out of scope (for future specs):**

- Migrar el login/registro mock (`av_user` en `localStorage`, `lib/user-context.tsx`, `app/auth/page.tsx`) a Supabase Auth real.
- Migrar los puntajes (`av_scores`, `lib/scores.ts`) o el leaderboard (`seededScores`, `/salon`) a tablas de Supabase.
- Cualquier tabla de Postgres (ej. `profiles`, `scores`), migración SQL, o política de Row Level Security.
- Cualquier ruta o componente de diagnóstico visible en la UI.
- Mover el catálogo de juegos (`GAMES` en `lib/data.ts`) a una tabla de Supabase.

## Data model

No se introduce ningún modelo de datos ni tabla en este spec. No hay todavía ninguna funcionalidad que lea o escriba en la base de datos de Supabase; solo se deja el SDK conectado.

## Implementation plan

1. Ejecutar `npm install @supabase/ssr @supabase/supabase-js`.
2. Agregar a `.env.template` las claves `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (con comentario apuntando al dashboard del proyecto `tdlvsdvlanjsxobjnnnm`), y escribir sus valores reales en `.env.local` (obtenidos vía las herramientas MCP `get_project_url` y `get_publishable_keys`, usando la publishable key moderna `sb_publishable_...`, no la `anon` legacy).
3. Crear `lib/supabase/client.ts` exportando `createClient()`, que envuelve `createBrowserClient` de `@supabase/ssr` con las variables `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Crear `lib/supabase/server.ts` exportando un `createClient()` async, que envuelve `createServerClient` de `@supabase/ssr` leyendo/escribiendo cookies vía `cookies()` de `next/headers`.
5. Crear `lib/supabase/proxy.ts` con `updateSession(request: NextRequest)`: crea un `createServerClient` sobre las cookies de la request/response, llama a `supabase.auth.getClaims()` para refrescar el token, y devuelve el `NextResponse` con las cookies actualizadas.
6. Crear `proxy.ts` en la raíz del proyecto que importa `updateSession` desde `lib/supabase/proxy.ts` y lo expone como `export async function proxy(request)`, con `export const config = { matcher: [...] }` excluyendo `_next/static`, `_next/image`, `favicon.ico` y extensiones de imagen comunes.
7. Correr `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/`, resolviendo cualquier error antes de dar la tarea por terminada.

## Acceptance criteria

- [ ] `@supabase/ssr` y `@supabase/supabase-js` aparecen como dependencias en `package.json`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` existen en `.env.template` (documentando su origen) y en `.env.local` con los valores reales del proyecto `tdlvsdvlanjsxobjnnnm`.
- [ ] `lib/supabase/client.ts` exporta un cliente de Supabase utilizable desde un Client Component.
- [ ] `lib/supabase/server.ts` exporta un cliente de Supabase async utilizable desde un Server Component, Server Action o Route Handler, usando cookies de `next/headers`.
- [ ] `proxy.ts` en la raíz del proyecto refresca la sesión de Supabase en cada request (excepto assets estáticos) delegando en `lib/supabase/proxy.ts`.
- [ ] Ninguna pantalla existente (`/`, `/biblioteca`, `/auth`, `/salon`, `/acerca-de`, `/juegos/[id]`, `/juegos/[id]/jugar`) cambia de comportamiento visible; el login/logout sigue siendo el mock de `av_user` en `localStorage`.
- [ ] `.env.local` sigue sin versionarse (cubierto por `.env*` en `.gitignore`).
- [ ] `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/` terminan sin errores.

## Decisions

- **Sí:** alcance limitado a la integración/plumbing de Supabase (clientes + refresco de sesión + variables de entorno), sin migrar el login mock ni los puntajes. Confirmado por el usuario — auth real y persistencia de puntajes quedan para specs futuros que construyan sobre esta base.
- **Sí:** se crea `proxy.ts` en vez de `middleware.ts`. Next.js 16 (versión pineada en este repo) deprecó el archivo `middleware.js` y lo renombró a `proxy.js`; la funcionalidad es idéntica, solo cambia el nombre del archivo y de la función exportada (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
- **Sí:** se usa la publishable key moderna (`sb_publishable_...`) en vez de la `anon` key legacy (JWT), siguiendo la recomendación actual de Supabase para proyectos nuevos.
- **Sí:** sin ruta ni componente de diagnóstico visible en la UI. Confirmado por el usuario — la verificación de este spec es `npm run build`/`npx eslint` más revisión de código; el uso real de estos clientes se probará en el spec que implemente autenticación real.
- **Sí:** las variables de entorno se configuran automáticamente vía MCP (`get_project_url`, `get_publishable_keys`) en vez de que el usuario las pegue a mano. Confirmado por el usuario — a diferencia de `RESEND_API_KEY`, no son secretas.
- **No:** no se crea ninguna tabla en Postgres (ej. `profiles`) ni ningún modelo de datos nuevo en este spec — no hay todavía ninguna funcionalidad que persista datos en Supabase.
- **No:** no se modifican el login mock (`av_user`), `lib/user-context.tsx`, `lib/scores.ts`, ni las pantallas `/auth` o `/salon`.

## Risks

| Risk                                                                                                                                                                                                             | Mitigation                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El proyecto Supabase remoto está vacío hoy (sin tablas ni migraciones); si sus credenciales cambiaran o el proyecto se pausara, `proxy.ts` llamaría a `getClaims()` contra un proyecto inválido en cada request. | Como ninguna pantalla depende todavía de una sesión real, el único efecto sería un error de refresco de sesión sin impacto visible; queda documentado como riesgo conocido a revisar en el spec de auth real. |
| `proxy.ts` corre en (casi) cada request; un `matcher` mal configurado podría bloquear la carga de assets estáticos.                                                                                              | Se replica el `matcher` recomendado por la guía oficial de Supabase para Next.js, excluyendo `_next/static`, `_next/image`, `favicon.ico` y extensiones de imagen comunes.                                    |

## Qué **no** está en este spec

- Autenticación real con Supabase (login/registro/logout reemplazando el mock de `av_user`).
- Persistencia de puntajes o leaderboard real en Supabase.
- Tablas de Postgres, migraciones SQL o políticas de Row Level Security.
- Cualquier ruta o componente de diagnóstico visible en la UI.
- Mover el catálogo de juegos (`GAMES`) a una tabla de Supabase.

Cada uno de estos, si se implementa, va en su propio spec.
