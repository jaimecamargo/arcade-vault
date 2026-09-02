# SPEC 03 — Acerca de + Contacto por correo

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-09-02
> **Objective:** Portar la pantalla "Acerca de" del prototipo estático en `references/templates/home-about/about.jsx` a la ruta `/acerca-de`, con un formulario de contacto que envía correos reales usando Resend.

## Por qué existe este spec

SPEC 02 dejó explícitamente fuera de alcance la pantalla "Acerca de" y su formulario de contacto, porque en el template original (`about.jsx`) el envío solo simula un resultado exitoso en memoria (`setSent`), sin backend real. Este spec cierra ese pendiente: porta la pantalla fielmente y conecta el formulario a un envío de correo real con Resend.

## Scope

**In:**

- Ruta `/acerca-de` con la pantalla `AboutScreen`: hero de misión ("ACERCA DE ARCADE VAULT"), fila de 3 destacados (hecho con ❤️, juegos en HTML, proyecto en crecimiento), divisor animado, y sección de contacto con formulario (nombre, correo, mensaje).
- Server Action `sendContactMessage` que usa Resend para enviar el mensaje del formulario a `jaime.camargo@gmail.com`, usando el correo del formulario como `replyTo`.
- Validación antes de enviar: los 3 campos no vacíos (dispara el shake ya existente en el template) y formato de email válido (nueva validación, no está en el template original).
- Estados del formulario: vacío/inválido (shake existente), enviando (botón deshabilitado con indicador de carga), éxito (bloque terminal ya existente en el template, con el nombre del usuario), y error de envío (nuevo bloque terminal de error, conservando lo que el usuario escribió).
- Dependencia `resend` agregada a `package.json`.
- Variable de entorno `RESEND_API_KEY` en `.env.local` (no versionada; ya cubierta por `.env*` en `.gitignore`).
- Migrar el bloque de estilos "ABOUT PAGE" de `references/templates/home-about/styles.css` a `app/globals.css`, más los estilos nuevos para el estado de error del formulario (variante del `.terminal-success` ya existente).
- Actualizar `components/nav.tsx`: agregar el link "Acerca de" → `/acerca-de` en el nav desktop y en el panel móvil, y actualizar `isActive` para reconocerlo.

**Out of scope (for future specs):**

- Protección anti-spam del formulario (captcha, honeypot, rate limiting).
- Persistir los mensajes de contacto en alguna base de datos o `localStorage`. Solo se envían por correo.
- Dominio propio verificado en Resend o dirección `from` personalizada (se usa el dominio de pruebas `onboarding@resend.dev`).
- Plantilla de correo HTML con branding; el cuerpo del correo es texto simple.

## Data model

No se introducen estructuras de datos persistentes. El único "modelo" es el payload que viaja del formulario a la Server Action: `{ name: string, email: string, message: string }`, usado únicamente para construir la llamada a `resend.emails.send(...)` y no se guarda en ningún storage.

## Implementation plan

1. Ejecutar `npm install resend` y crear `.env.local` con `RESEND_API_KEY=<key del usuario>` (el usuario provee la key manualmente; el archivo no se versiona).
2. Crear `lib/resend.ts` exportando un cliente `Resend` inicializado con `process.env.RESEND_API_KEY`.
3. Crear `app/acerca-de/actions.ts` con la Server Action `sendContactMessage(data: { name: string; email: string; message: string })`: revalida en servidor que los 3 campos no estén vacíos y que el email tenga formato válido, llama a `resend.emails.send({ from: "Arcade Vault <onboarding@resend.dev>", to: "jaime.camargo@gmail.com", replyTo: data.email, subject: \`Nuevo mensaje de contacto de ${data.name}\`, text: ... })`, y devuelve `{ ok: true }`o`{ ok: false, error: string }` sin lanzar excepciones al cliente.
4. Migrar el bloque de estilos "ABOUT PAGE" de `references/templates/home-about/styles.css` a `app/globals.css`, y agregar una variante de error para `.terminal-success` (por ejemplo `.terminal-error`) reusando la misma estructura visual tipo terminal.
5. Crear `components/about-screen.tsx` (Client Component) portando `about.jsx`: hero, `HighlightIcon`, divisor con scroll-reveal (`IntersectionObserver`, igual patrón que `home-screen.tsx`), y el formulario de contacto manejando los estados `idle | sending | sent | error` (validación de vacíos + formato de email antes de invocar la Server Action; al recibir `{ ok: false }` se muestra el bloque de error sin limpiar el formulario).
6. Crear `app/acerca-de/page.tsx` (Server Component) que renderiza `<AboutScreen />`.
7. Actualizar `components/nav.tsx`: agregar el link "Acerca de" apuntando a `/acerca-de` en el nav desktop y en el panel móvil, y extender `isActive` para que quede activo en `pathname === "/acerca-de"`.
8. Correr `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/`, resolviendo cualquier error antes de dar la tarea por terminada.

## Acceptance criteria

- [ ] `/acerca-de` muestra el hero de misión, los 3 destacados, el divisor animado y la sección de contacto con formulario (nombre, correo, mensaje).
- [ ] Enviar el formulario con algún campo vacío dispara el shake existente y no llama a la Server Action.
- [ ] Enviar el formulario con un correo de formato inválido muestra un error de validación y no llama a la Server Action.
- [ ] Enviar el formulario válido invoca `sendContactMessage`, que envía un correo real vía Resend a `jaime.camargo@gmail.com` con `replyTo` igual al correo ingresado en el formulario.
- [ ] Mientras el envío está en curso, el botón de enviar muestra un estado de carga y queda deshabilitado.
- [ ] Si el envío es exitoso, se muestra el bloque de éxito estilo terminal (igual al template) con el nombre del usuario.
- [ ] Si Resend devuelve un error (ej. `RESEND_API_KEY` inválida), se muestra un bloque de error estilo terminal, sin borrar los valores que el usuario había escrito.
- [ ] El nav (desktop y móvil) muestra el link "Acerca de" apuntando a `/acerca-de`, con el estado activo correcto en esa ruta.
- [ ] `RESEND_API_KEY` se lee desde variable de entorno; no aparece hardcodeada en ningún archivo versionado.
- [ ] `npm run build` y `npx eslint .` sobre `app/`, `components/` y `lib/` terminan sin errores.

## Decisions

- **Sí:** el envío se implementa con una Server Action (`app/acerca-de/actions.ts`), no con un Route Handler. Confirmado por el usuario — es el patrón nativo de Next 16 App Router para este caso y evita exponer un endpoint HTTP adicional.
- **Sí:** se usa el dominio de pruebas `onboarding@resend.dev` como remitente. Confirmado por el usuario para el MVP, sin verificación DNS de un dominio propio.
- **Sí:** el destinatario es fijo, `jaime.camargo@gmail.com`, hardcodeado en la Server Action (no configurable por variable de entorno aparte de la API key). Confirmado por el usuario.
- **Sí:** la ruta es `/acerca-de` (español), consistente con `/biblioteca` y `/salon`. Confirmado por el usuario en vez de `/about`.
- **Sí:** se agrega validación de formato de email (regex simple) además de la validación de campos no vacíos que ya traía el template. Confirmado por el usuario.
- **Sí:** se agrega un estado visual de error de envío en el propio formulario (bloque estilo terminal, análogo al de éxito), en vez de solo reusar el shake. Confirmado por el usuario.
- **Sí:** se agrega el link "Acerca de" al nav en este spec, ahora que la pantalla existe. Revierte la decisión de SPEC 02 de dejarlo fuera porque la ruta no existía todavía.
- **No:** no se implementa protección anti-spam (captcha, honeypot, rate limiting) en este spec. Queda para un spec futuro si se detecta abuso real.
- **No:** no se persisten los mensajes de contacto en ninguna base de datos ni `localStorage`; solo se envían por correo.

## Risks

| Risk                                                                                                                                                                                                                                               | Mitigation                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La cuenta gratuita de Resend con el dominio de pruebas (`onboarding@resend.dev`) solo permite enviar correos a la dirección con la que el usuario se registró en Resend. Si `jaime.camargo@gmail.com` no es esa cuenta, todos los envíos fallarán. | Se documenta explícitamente en este spec; cualquier falla de este tipo queda cubierta por el estado de error del formulario (paso 3 y 5 del plan), visible para quien prueba la feature. |
| `RESEND_API_KEY` ausente o inválida en el entorno rompe el envío.                                                                                                                                                                                  | La Server Action valida la respuesta de Resend y devuelve `{ ok: false, error }` en vez de lanzar una excepción no controlada; la UI lo traduce al bloque de error.                      |
| Sin protección anti-spam, el formulario puede recibir envíos automatizados una vez publicado.                                                                                                                                                      | Aceptado como riesgo conocido para el MVP; explícitamente fuera de scope (ver "Qué no está en este spec").                                                                               |

## Qué **no** está en este spec

- Protección anti-spam del formulario (captcha, honeypot, rate limiting).
- Persistencia de mensajes de contacto en base de datos o `localStorage`.
- Dominio propio verificado en Resend / dirección `from` personalizada.
- Plantilla de correo HTML con branding más allá de texto simple.

Cada uno de estos, si se implementa, va en su propio spec.
