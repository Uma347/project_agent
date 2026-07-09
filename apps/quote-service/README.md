# Quote Service

Servicio NestJS responsable de la logica de negocio de cotizaciones. No expone
endpoints HTTP: consume mensajes NATS Request/Reply y persiste estado en
PostgreSQL usando TypeORM.

## Subjects NATS

| Subject | Payload minimo | Descripcion |
| --- | --- | --- |
| `agent.quote.create` | `{ "prompt": "quiero comprar dos hamburguesas" }` | Interpreta la intencion con `ai-agent` y crea una cotizacion en `PENDING_HUMAN_APPROVAL`. |
| `agent.quote.approve` | `{ "quoteId": "uuid", "approvedBy": "human-id" }` | Aprueba una cotizacion vigente. |
| `agent.quote.reject` | `{ "quoteId": "uuid", "rejectedBy": "human-id" }` | Rechaza una cotizacion. |
| `agent.quote.execute` | `{ "quoteId": "uuid" }` | Ejecuta una compra simulada en `payment-simulator` solo si fue aprobada. |

## Reglas implementadas

- Toda cotizacion nueva queda en `PENDING_HUMAN_APPROVAL`.
- La creacion llama por Request/Reply a `ai.intent.interpret`.
- La expiracion se calcula con `QUOTE_EXPIRATION_MINUTES`, por defecto 10.
- Una cotizacion expirada no puede aprobarse ni ejecutarse.
- La ejecucion solo ocurre si la cotizacion fue aprobada por un humano.
- La ejecucion llama por Request/Reply a `payment.simulate.execute`.
- La ejecucion es idempotente en `quote-service`: llamadas repetidas devuelven
  el mismo resultado guardado sin volver a llamar al simulador.
- Cada accion registra un evento en `quote_events`.

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
- `Quote`
- `QuoteEvent`

El esquema se crea desde las entidades TypeORM y el catalogo simulado se
siembra al iniciar el servicio.

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
