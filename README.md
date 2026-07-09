# Qhantuy Agent Quotes

Flujo de compra asistido por IA con aprobacion humana obligatoria. El usuario
envia una intencion de compra por HTTP, el gateway la publica por NATS,
`quote-service` consulta al `ai-agent`, crea una cotizacion y solo permite
ejecutarla si fue aprobada por una persona. Al ejecutar, `quote-service`
solicita una compra simulada al `payment-simulator`; no se mueve dinero real.

## Arquitectura

```text
Postman / Frontend
        |
        v
API Gateway (NestJS)
        |
        | HTTP -> NATS Request/Reply
        v
NATS
  |--------------------------|-------------------------------|
  v                          v                               v
Quote Service (NestJS)    AI Agent (Python)    Payment Simulator (Python)
  |
  v
PostgreSQL
```

## Servicios

- `apps/api-gateway`: API REST para Postman. No contiene logica de negocio.
- `apps/quote-service`: reglas de negocio de cotizaciones y persistencia.
- `apps/ai-agent`: interpreta intenciones de compra con catalogo simulado.
- `apps/payment-simulator`: simula la ejecucion de compra/pago por NATS,
  sin base de datos y sin mover dinero real.
- `infra/docker-compose.yml`: levanta todo el stack.

## Requisitos

- Docker y Docker Compose.
- Opcional para desarrollo local: Node.js 22+, Python 3.12+, npm.

## Levantar todo con Docker

Desde la raiz del repositorio:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Servicios expuestos:

- API Gateway: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- NATS monitor: `http://localhost:8222`
- PostgreSQL: `localhost:5433`

El contenedor `quote-service` usa TypeORM para crear el esquema y sembrar el
catalogo simulado al iniciar.

Usuarios de dominio sembrados:

| Nombre | Email | UUID |
| --- | --- | --- |
| Juan Perez | `juan.perez@example.com` | `11111111-1111-4111-8111-111111111111` |
| Maria Lopez | `maria.lopez@example.com` | `22222222-2222-4222-8222-222222222222` |
| Carlos Rojas | `carlos.rojas@example.com` | `33333333-3333-4333-8333-333333333333` |
| Ana Fernandez | `ana.fernandez@example.com` | `44444444-4444-4444-8444-444444444444` |
| Pedro Gomez | `pedro.gomez@example.com` | `55555555-5555-4555-8555-555555555555` |

No hay autenticacion ni login; estos usuarios solo extienden el modelo de
dominio.

Para apagar:

```bash
docker compose -f infra/docker-compose.yml down
```

Para borrar tambien los datos de PostgreSQL:

```bash
docker compose -f infra/docker-compose.yml down -v
```

## Flujo desde Postman

Crear cotizacion:

```http
POST http://localhost:3000/api/agent/quote
Content-Type: application/json

{
  "prompt": "quiero comprar dos hamburguesas",
  "requestedByUserId": "11111111-1111-4111-8111-111111111111"
}
```

Aprobar cotizacion:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/approve
Content-Type: application/json

{
  "approvedByUserId": "22222222-2222-4222-8222-222222222222"
}
```

Ejecutar compra simulada:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/execute
Content-Type: application/json

{
  "executedBy": "human-operator-1"
}
```

Durante la ejecucion, `quote-service` publica un Request/Reply NATS a:

```text
payment.simulate.execute
```

con:

```json
{
  "quoteId": "uuid",
  "amountCents": 5000,
  "currency": "BOB",
  "idempotencyKey": "uuid"
}
```

`payment-simulator` responde una compra simulada con estado
`SIMULATED_SUCCESS`. La idempotencia principal queda en `quote-service`: si una
cotizacion ya esta `EXECUTED`, devuelve el mismo resultado guardado sin volver
a llamar al simulador.

Rechazar cotizacion:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/reject
Content-Type: application/json

{
  "rejectedByUserId": "33333333-3333-4333-8333-333333333333",
  "reason": "Cliente no confirmo la compra"
}
```

## Variables de entorno

La raiz incluye `.env.example` para desarrollo local. El compose ya configura
las variables internas necesarias entre contenedores.

Variables principales:

- `DATABASE_URL`
- `NATS_SERVERS`
- `NATS_REQUEST_TIMEOUT_MS`
- `PORT`
- `API_GLOBAL_PREFIX`
- `QUOTE_EXPIRATION_MINUTES`

## Desarrollo local sin Docker para apps

Levanta infraestructura:

```bash
docker compose -f infra/docker-compose.yml up -d postgres nats
```

API Gateway:

```bash
cd apps/api-gateway
npm install
npm run start:dev
```

Quote Service:

```bash
cd apps/quote-service
npm install
npm run start:dev
```

AI Agent:

```bash
cd apps/ai-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Payment Simulator:

```bash
cd apps/payment-simulator
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Pruebas

```bash
cd apps/api-gateway
npm run lint
npm run build
npm run test
npm run test:e2e
```

```bash
cd apps/quote-service
npm run lint
npm run build
npm run test
npm run test:e2e
```
