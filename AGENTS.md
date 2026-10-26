<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Convenciones de FamilyFly

## Idioma y producto

- La interfaz y los textos visibles van en español. Las cadenas viven en `src/i18n/es.ts`; no hardcodear textos en componentes.
- La estructura de i18n debe permitir añadir inglés en el futuro sin tocar los componentes.
- El producto es de uso personal: sin pagos, sin reservas y sin scraping de webs de aerolíneas.

## Arquitectura

- Next.js App Router con Server Components por defecto. Usar `"use client"` solo cuando haga falta estado, efectos o APIs del navegador.
- Las llamadas a proveedores externos se hacen en route handlers (`src/app/api/**/route.ts`) o en servidor. Las claves nunca llegan al cliente.
- La lógica de negocio va en `src/lib`, no en componentes.
- Los proveedores implementan `FlightProvider` (`src/lib/providers/types.ts`). Un archivo por proveedor; la selección se hace con `FLIGHT_PROVIDER` en `src/lib/providers/index.ts`.
- `MockProvider` es el valor por defecto y debe seguir funcionando sin red ni claves.

## Next.js 16

- Antes de tocar APIs de Next, leer la guía correspondiente en `node_modules/next/dist/docs/`.
- El proyecto usa `cacheComponents` y `partialPrefetching`. Envolver en `<Suspense>` cualquier lectura de `searchParams` o dato inestable.
- En route handlers que lean `request.url`, llamar primero a `await connection()` de `next/server`.
- No leer `new Date()` ni `Date.now()` durante el render de componentes cliente que se prerenderizan. Usar `useSyncExternalStore` con snapshot de servidor estable, un handler o un efecto.
- Los tipos de rutas (`PageProps<"/ruta">`) se generan con `next typegen`; el script `typecheck` ya lo hace antes de `tsc`.

## Fechas, precios y moneda

- Las fechas de viaje son strings ISO `YYYY-MM-DD` y se tratan en UTC.
- El precio canónico de las ofertas es USD. La conversión a EUR se hace en el cliente con el tipo de cambio de `/api/exchange-rates`.
- El tipo de cambio se cachea 12 h y tiene fallback local; una tasa obsoleta se marca como tal en la UI.
- Las búsquedas flexibles usan ±3 días y desplazan la vuelta con el mismo offset que la ida.

## Estilo de código

- TypeScript estricto. Evitar `any`; usar los tipos de `src/lib/providers/types.ts`.
- No añadir comentarios salvo que aporten contexto no evidente.
- Componentes pequeños y funciones puras en `src/lib`; nombres de archivos en kebab-case.
- Tailwind v4 con tokens definidos en `src/app/globals.css`. Usar las clases del tema (`bg-surface`, `text-muted`, etc.) en lugar de colores sueltos.

## Comandos

- `npm run dev`: desarrollo.
- `npm run lint`: ESLint.
- `npm run typecheck`: `next typegen` + `tsc --noEmit`.
- `npm run test`: Vitest en modo run.
- `npm run check`: lint + typecheck + tests.
- `npm run build`: build de producción.

Definición de terminado: `npm run check` y `npm run build` pasan sin errores.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY`, tokens de proveedores, Telegram y `CRON_SECRET` son solo de servidor. Nunca prefijarlos con `NEXT_PUBLIC_`.
- Validar y sanear toda entrada de query params con `src/lib/search-params.ts`.
- No registrar secretos ni URLs con tokens.
- Con Supabase (Fase 3), activar RLS en todas las tablas y no confiar en el cliente.

## Git y fases

- Un commit al final de cada fase, con mensaje en imperativo y alcance claro (por ejemplo, `feat: completar fase 1 de busqueda`).
- No avanzar a la siguiente fase sin revisión. Las fases están definidas en el README.
