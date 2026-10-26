# FamilyFly

Web personal para buscar y comparar vuelos desde Perú y Madrid, con precios en USD o EUR, y base preparada para alertas de precio bajo por Telegram en fases posteriores.

> **Estado actual: Fase 1.** La app funciona sin claves ni red externa usando `MockProvider`. Las ofertas son simuladas y no representan disponibilidad real. No hay pagos, reservas ni scraping.

## Estado por fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| 1 | Búsqueda, resultados, moneda, tema e i18n con datos mock | Completada |
| 2 | Proveedores reales (`Travelpayouts`, `Ignav`), caché y comparación | Pendiente |
| 3 | Supabase, historial de precios y watchlist | Pendiente |
| 4 | Alertas Telegram, GitHub Actions y despliegue en Vercel | Pendiente |

## Funcionalidad de la Fase 1

- Búsqueda de ida y vuelta o solo ida con origen y destino por código IATA.
- Selector de aeropuertos con búsqueda por ciudad, país, nombre o código (97 aeropuertos).
- Búsqueda de "cualquier destino" desde Madrid.
- Pasajeros de 1 a 9 y filtro de escalas (todas, directo o máximo 1).
- Fechas flexibles de ±3 días, desplazando la vuelta con el mismo offset que la ida.
- Resultados con mejor opción, precio y duración; filtros por aerolínea y escalas.
- Precios canónicos en USD y conversión a EUR con tipo de cambio real cacheado 12 h.
- Tema claro/oscuro y aviso de antigüedad de los datos.
- Interfaz en español con textos centralizados para añadir inglés después.

## Stack

- Next.js 16.4.3 (App Router, Server Components, `cacheComponents`)
- React 19.3
- TypeScript estricto
- Tailwind CSS v4
- Vitest

## Requisitos

- Node.js 22 o superior
- npm 10 o superior

## Puesta en marcha

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

Sin `.env.local`, la app arranca igualmente con `FLIGHT_PROVIDER=mock`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera tipos de rutas y ejecuta `tsc --noEmit` |
| `npm run test` | Vitest en modo run |
| `npm run test:watch` | Vitest en modo watch |
| `npm run check` | lint + typecheck + tests |

La definición de terminado de una fase es que pasen `npm run check` y `npm run build`.

## Variables de entorno

Copia `.env.example` a `.env.local`. Las variables `NEXT_PUBLIC_*` son públicas; el resto son solo de servidor.

| Variable | Fase | Uso | Dónde obtenerla |
| --- | --- | --- | --- |
| `FLIGHT_PROVIDER` | 1 | `mock`, `travelpayouts` o `ignav` | Se define a mano |
| `FLIGHT_CACHE_TTL_HOURS` | 2 | Horas de caché de proveedores reales | Se define a mano |
| `TRAVELPAYOUTS_TOKEN` | 2 | Token de la API de vuelos | Panel de Travelpayouts |
| `IGNAV_API_KEY` | 2 | Clave de la API de Ignav | Panel de Ignav |
| `NEXT_PUBLIC_SUPABASE_URL` | 3 | URL del proyecto Supabase | Supabase, ajustes del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3 | Clave anónima sujeta a RLS | Supabase, API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | 3 | Escrituras del job; solo servidor | Supabase, API keys |
| `TELEGRAM_BOT_TOKEN` | 4 | Envío de alertas | `@BotFather` en Telegram |
| `TELEGRAM_CHAT_ID` | 4 | Chat que recibe las alertas | API de Telegram `getUpdates` |
| `TELEGRAM_WEBHOOK_SECRET` | 4 | Validación del webhook | Se genera a mano |
| `CRON_SECRET` | 4 | Autoriza el job de alertas | Se genera a mano |
| `RESEND_API_KEY` | 4 | Email opcional de alertas | Panel de Resend |
| `APP_URL` | 4 | URL pública para enlaces | Vercel o local |

El tipo de cambio usa la API pública de Frankfurter y no necesita clave. Si falla, se usa un fallback local de `0.92` y la UI lo marca como obsoleto.

### Cómo obtener cada clave

**Travelpayouts (Fase 2).** Crea una cuenta en [travelpayouts.com](https://www.travelpayouts.com/), únete al programa de Aviasales y abre la sección de herramientas o API para copiar el token. La aprobación del programa puede tardar. Guarda el token como `TRAVELPAYOUTS_TOKEN`; solo se usa en el servidor.

**Ignav (Fase 2, opcional).** Crea una cuenta en [ignav.com](https://ignav.com/) y copia la clave de API del panel. Solo se activa con `FLIGHT_PROVIDER=ignav`; si no tienes clave, deja el mock.

**Supabase (Fase 3).** Crea un proyecto en [supabase.com](https://supabase.com/), entra en *Project Settings > API* y copia:
- `Project URL` a `NEXT_PUBLIC_SUPABASE_URL`.
- `anon public` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `service_role` a `SUPABASE_SERVICE_ROLE_KEY`. Esta clave salta RLS: nunca la pongas en el cliente ni en una variable `NEXT_PUBLIC_`.

**Telegram (Fase 4).**
1. Abre Telegram y habla con [@BotFather](https://t.me/BotFather).
2. Envía `/newbot`, elige un nombre visible y un usuario que termine en `bot`.
3. Copia el token que devuelve a `TELEGRAM_BOT_TOKEN`.
4. Envía un mensaje a tu bot y consulta `https://api.telegram.org/bot<TOKEN>/getUpdates` para obtener el `chat.id`; guárdalo en `TELEGRAM_CHAT_ID`.
5. En la Fase 4, el comando `/start` vinculará el chat con la cuenta.

**CRON_SECRET (Fase 4).** Genera una cadena aleatoria larga con un gestor de contraseñas o:

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

Guárdala igual en Vercel y en GitHub Actions. El endpoint de alertas debe rechazar peticiones sin el header correcto.

**Resend (Fase 4, opcional).** Crea una API key en [resend.com](https://resend.com/) y guárdala en `RESEND_API_KEY`. El email no se implementa en la Fase 1.

**Frankfurter.** No requiere clave ni registro.

### Secretos en GitHub Actions

En el repositorio: *Settings > Secrets and variables > Actions > New repository secret*. Añade los mismos nombres que en `.env.example` que necesite el job de la Fase 4 (`CRON_SECRET`, `APP_URL` y, si aplica, claves de proveedores y Supabase). Con GitHub CLI también puedes usar `gh secret set CRON_SECRET`.

### Variables en Vercel

En el proyecto de Vercel: *Settings > Environment Variables*. Define cada variable para Production y Preview según la fase. No marques como pública ninguna clave de servidor. `NEXT_PUBLIC_*` sí se expone al navegador por diseño.

## Arquitectura

```text
src/
  app/
    api/exchange-rates/route.ts    Tipo de cambio USD/EUR con caché
    api/flights/search/route.ts    Búsqueda de vuelos
    results/                       Página de resultados con Suspense
    globals.css                    Tokens de Tailwind y tema
    layout.tsx, page.tsx
  components/
    layout/                        Cabecera y pie
    providers/                     Contexto de moneda
    results/                       Tarjetas, filtros y estados de carga
    search/                        Formulario y combobox de aeropuertos
    ui/                            Iconos y selectores
  data/
    airports.ts                    97 aeropuertos con coordenadas
    airlines.ts                    34 aerolíneas
  i18n/                            Diccionario español y helper de traducción
  lib/
    providers/                     Interfaz, mock y selección de proveedor
    services/flights.ts            Orquestación, flexibilidad y antigüedad
    dates.ts, currency.ts, airports.ts, search-params.ts
```

### Flujo de una búsqueda

1. El formulario valida y navega a `/results` con query params ISO.
2. `src/lib/search-params.ts` valida y normaliza la entrada en el servidor.
3. `/api/flights/search` consulta el proveedor configurado y devuelve ofertas en USD.
4. El cliente ordena, filtra y convierte a EUR con el tipo de cambio cacheado.
5. Los enlaces de reserva son enlaces de búsqueda a Google Flights; no hay compra integrada.

### Proveedores

Todos implementan `FlightProvider` en `src/lib/providers/types.ts`:

```ts
interface FlightProvider {
  readonly id: FlightProviderId;
  searchFlights(request: FlightSearchRequest): Promise<FlightOffer[]>;
  getPriceCalendar(request: PriceCalendarRequest): Promise<PriceCalendarEntry[]>;
  getCheapestDestinations(
    request: CheapestDestinationsRequest,
  ): Promise<CheapestDestination[]>;
}
```

- `MockProvider` es el valor por defecto y genera datos deterministas sin red.
- En la Fase 2 se añadirán `TravelpayoutsProvider` e `IgnavProvider` en archivos separados.
- La selección se hace en `src/lib/providers/index.ts` con `FLIGHT_PROVIDER`.
- Un proveedor nuevo no debe cambiar componentes ni claves públicas.

## Datos, fechas y moneda

- Las fechas son `YYYY-MM-DD` y se interpretan en UTC.
- El precio canónico es USD; EUR se calcula en el cliente.
- Las búsquedas flexibles usan ±3 días y mantienen la misma duración de estancia.
- El mock usa un PRNG con semilla por ruta y fecha: la misma búsqueda devuelve los mismos precios.
- La antigüedad de los datos se calcula en el servidor (`dataAgeHours`).

## Tests

```powershell
npm run test
```

Cubren:

- Fechas, ventanas flexibles y formatos en español.
- Validación y serialización de query params.
- `MockProvider`: ida y vuelta, escalas, cualquier destino, calendario y determinismo.
- Servicio de búsqueda: ventana flexible, offset de vuelta y orden por precio.

Los tests no necesitan red ni claves.

## Despliegue

### Vercel

1. Importa el repositorio en Vercel.
2. Añade las variables de entorno de la fase correspondiente.
3. Despliega. La Fase 1 no necesita ninguna clave.

### GitHub Actions

En la Fase 4, el job de alertas usará secretos del repositorio equivalentes a las variables de servidor. El job se disparará con `schedule` y llamará a un endpoint protegido con `CRON_SECRET`. No se usan Vercel Cron ni funciones programadas.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY`, tokens de proveedores, Telegram y `CRON_SECRET` nunca llevan prefijo `NEXT_PUBLIC_`.
- Las llamadas a proveedores salen del servidor; el navegador solo habla con las rutas de la app.
- Toda entrada de query params pasa por `src/lib/search-params.ts`.
- No se registran secretos ni URLs con tokens.
- En la Fase 3 se activará RLS en todas las tablas de Supabase.

## Roadmap

- [x] Fase 1: estructura, mock, búsqueda, resultados, moneda, tema e i18n.
- [ ] Fase 2: proveedores reales, caché, comparación y enlaces afiliados.
- [ ] Fase 3: Supabase, historial de precios y watchlist.
- [ ] Fase 4: alertas Telegram, GitHub Actions y despliegue.

## Aviso

FamilyFly es un proyecto personal. En la Fase 1 todos los vuelos, precios y aerolíneas son simulados. No uses estos datos para tomar decisiones de compra.
