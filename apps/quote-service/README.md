# Quote Service

Servicio NestJS responsable de la logica de negocio de cotizaciones. No expone
endpoints HTTP: consume mensajes NATS Request/Reply y persiste estado en
PostgreSQL usando TypeORM.

## Subjects NATS

| Subject | Payload minimo | Descripcion |
| --- | --- | --- |
| `agent.quote.create` | `{ "prompt": "quiero comprar dos hamburguesas", "requestedByUserId": "uuid" }` | Interpreta la intencion con `ai-agent` y crea una cotizacion en `PENDING_HUMAN_APPROVAL`. |
| `agent.quote.approve` | `{ "quoteId": "uuid", "approvedByUserId": "uuid" }` | Aprueba una cotizacion vigente. |
| `agent.quote.reject` | `{ "quoteId": "uuid", "rejectedByUserId": "uuid" }` | Rechaza una cotizacion. |
| `agent.quote.execute` | `{ "quoteId": "uuid" }` | Ejecuta una compra simulada en `payment-simulator` solo si fue aprobada. |

## Reglas implementadas

- Toda cotizacion nueva queda en `PENDING_HUMAN_APPROVAL`.
- La creacion, aprobacion y rechazo requieren un usuario activo del dominio.
- La creacion llama por Request/Reply a `ai.intent.interpret`.
- La expiracion se calcula con `QUOTE_EXPIRATION_MINUTES`, por defecto 10.
- Una cotizacion expirada no puede aprobarse ni ejecutarse.
- La ejecucion solo ocurre si la cotizacion fue aprobada por un humano.
- La ejecucion llama por Request/Reply a `payment.simulate.execute`.
- La ejecucion es idempotente en `quote-service`: llamadas repetidas devuelven
  el mismo resultado guardado sin volver a llamar al simulador.
- Cada accion registra un evento en `quote_events`.
- Los eventos guardan `userId`, `userName` y `userEmail` en `metadata` para
  auditoria.

## Estructura

```text
src/
|-- config/
|-- infrastructure/
|   |-- nats/
|   `-- typeorm/
|-- quotes/
|   |-- application/
|   |   `-- dto/
|   |-- domain/
|   |-- quotes.controller.ts
|   |-- quotes.module.ts
|   `-- quotes.service.ts
|-- app.module.ts
`-- main.ts
```

## Base de datos

Entidades TypeORM:

- `Product`
- `User`
- `Quote`
- `QuoteEvent`

El esquema se crea desde las entidades TypeORM. El catalogo simulado y los
usuarios de dominio se siembran al iniciar el servicio.

Usuarios iniciales:

| Nombre | Email | UUID |
| --- | --- | --- |
| Juan Perez | `juan.perez@example.com` | `11111111-1111-4111-8111-111111111111` |
| Maria Lopez | `maria.lopez@example.com` | `22222222-2222-4222-8222-222222222222` |
| Carlos Rojas | `carlos.rojas@example.com` | `33333333-3333-4333-8333-333333333333` |
| Ana Fernandez | `ana.fernandez@example.com` | `44444444-4444-4444-8444-444444444444` |
| Pedro Gomez | `pedro.gomez@example.com` | `55555555-5555-4555-8555-555555555555` |

## Variables de entorno

Ver `.env.example`.

| Variable | Descripcion |
| --- | --- |
| `DATABASE_URL` | Conexion PostgreSQL usada por TypeORM. |
| `NATS_SERVERS` | Lista separada por comas de servidores NATS. |
| `NATS_QUEUE` | Queue group del servicio. |
| `NATS_REQUEST_TIMEOUT_MS` | Timeout para requests NATS hacia otros servicios. |
| `QUOTE_EXPIRATION_MINUTES` | Minutos de vigencia de una cotizacion. |

## Ejecucion local

```bash
npm install
npm run start:dev
```

## Comandos

```bash
npm run build
npm run lint
npm run test
```

## Docker

```bash
docker build -t qhantuy-quote-service .
docker run --rm --env-file .env qhantuy-quote-service
```
