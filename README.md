# Qhantuy Agent Quotes

Flujo de compra asistido por IA con aprobacion humana obligatoria. El usuario
envia una intencion de compra por HTTP, el gateway la publica por NATS,
`quote-service` consulta al `ai-agent`, crea una cotizacion y solo permite
ejecutarla si fue aprobada por una persona.

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
  |--------------------------|
  v                          v
Quote Service (NestJS)    AI Agent (Python)
  |
  v
PostgreSQL
```

## Servicios

- `apps/api-gateway`: API REST para Postman. No contiene logica de negocio.
- `apps/quote-service`: reglas de negocio de cotizaciones y persistencia.
- `apps/ai-agent`: interpreta intenciones de compra con catalogo simulado.
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
- PostgreSQL: `localhost:5432`

El contenedor `quote-service` ejecuta automaticamente:

```bash
npx prisma migrate deploy
npm run prisma:seed
node dist/main.js
```

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
  "prompt": "quiero comprar dos hamburguesas"
}
```

Aprobar cotizacion:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/approve
Content-Type: application/json

{
  "approvedBy": "human-operator-1"
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

Rechazar cotizacion:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/reject
Content-Type: application/json

{
  "rejectedBy": "human-operator-1",
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
npx prisma migrate dev
npm run prisma:seed
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
