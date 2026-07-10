# Qhantuy Agent Quotes

Flujo de compra asistido por IA con aprobacion humana obligatoria. El usuario
envia una intencion de compra por HTTP, el gateway la publica por NATS,
`quote-service` consulta al `ai-agent`, el agente valida el producto contra el
catalogo real del `quote-service`, se crea una cotizacion y solo se permite
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
Quote Service (NestJS) <-> AI Agent (Python)    Payment Simulator (Python)
  |
  v
PostgreSQL
```

## Servicios

- `apps/api-gateway`: API REST para Postman. No contiene logica de negocio.
- `apps/quote-service`: reglas de negocio de cotizaciones, persistencia y
  fuente de verdad del catalogo de productos.
- `apps/ai-agent`: interpreta intenciones de compra, calcula cantidad desde el
  prompt cuando hace falta y consulta el catalogo real por NATS.
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
catalogo inicial al iniciar. Los productos incluyen `category`, `keywords`,
`tags` y `metadata` para busqueda por intencion.

Productos iniciales:

| ID | SKU | Nombre | Categoria | Keywords |
| --- | --- | --- | --- | --- |
| `mochila_urbana` | `MOCHILA-URBANA` | Mochila urbana | `backpack` | `mochila`, `mochilas`, `morral`, `bolso escolar`, `backpack` |
| `mochila_viaje` | `MOCHILA-VIAJE` | Mochila de viaje | `backpack` | `mochila de viaje`, `mochila viajera`, `viaje`, `equipaje` |
| `cartera_cuero` | `CARTERA-CUERO` | Cartera de cuero | `handbag` | `cartera`, `carteras`, `bolso`, `bolsa`, `handbag` |
| `billetera_compacta` | `BILLETERA-COMPACTA` | Billetera compacta | `wallet` | `billetera`, `billeteras`, `monedero`, `wallet` |
| `lonchera_termica` | `LONCHERA-TERMICA` | Lonchera termica | `lunchbag` | `lonchera`, `loncheras`, `termica`, `lunch bag` |
| `cartuchera_escolar` | `CARTUCHERA-ESCOLAR` | Cartuchera escolar | `pencil_case` | `cartuchera`, `cartucheras`, `estuche`, `lapicera` |
| `morral_crossbody` | `MORRAL-CROSSBODY` | Morral crossbody | `crossbody` | `morral`, `bolso cruzado`, `crossbody`, `canguro` |
| `maleta_cabina` | `MALETA-CABINA` | Maleta de cabina | `luggage` | `maleta`, `maletas`, `equipaje`, `carry on`, `cabina` |

Usuarios de dominio sembrados:

| Nombre | Email | UUID |
| --- | --- | --- |
| Juan Perez | `juan.perez@example.com` | `b6fd7d2d-5e56-4b37-a761-2d69b86a9e91` |
| Maria Lopez | `maria.lopez@example.com` | `9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2` |
| Carlos Rojas | `carlos.rojas@example.com` | `47ad93a6-44fa-494c-88cc-7a865639e2d0` |
| Ana Fernandez | `ana.fernandez@example.com` | `f2c41e10-a105-4c09-9bc8-e7980799d21e` |
| Pedro Gomez | `pedro.gomez@example.com` | `6c77170e-87ad-4f49-9848-c618b06030f7` |

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
  "prompt": "quiero comprar dos mochilas urbanas",
  "requestedByUserId": "b6fd7d2d-5e56-4b37-a761-2d69b86a9e91",
  "quantity": 2
}
```

`quantity` es opcional. Si se envia, tiene prioridad sobre la cantidad que el
agente pueda interpretar desde el `prompt`; si no se envia, el agente intenta
extraerla desde texto como `dos`, `tres` o `5`.

Durante la creacion de cotizacion:

1. `quote-service` valida el usuario activo.
2. `quote-service` llama a `ai.intent.interpret`.
3. `ai-agent` consulta `catalog.products.search` en `quote-service`.
4. `quote-service` busca productos activos por `name`, `description`,
   `category`, `keywords` y `tags`.
5. `quote-service` calcula `totalCents = unitPriceCents * quantity`.

Aprobar cotizacion:

```http
POST http://localhost:3000/api/agent/quote/{quote_id}/approve
Content-Type: application/json

{
  "approvedByUserId": "9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2"
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
  "rejectedByUserId": "47ad93a6-44fa-494c-88cc-7a865639e2d0",
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
- `CATALOG_REQUEST_TIMEOUT_SECONDS`
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
