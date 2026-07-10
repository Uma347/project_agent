# API Gateway

Servicio NestJS que expone una API HTTP REST y delega la ejecucion de casos
de uso a microservicios mediante NATS Request/Reply. Este gateway no contiene
logica de negocio, persistencia ni autenticacion.

## Responsabilidades

- Exponer endpoints HTTP REST.
- Validar requests de entrada con pipes globales.
- Traducir requests HTTP a mensajes NATS Request/Reply.
- Centralizar configuracion, logging, errores y documentacion Swagger.
- Exponer un endpoint de salud.

## Estructura

```text
src/
|-- common/
|   `-- filters/
|       `-- all-exceptions.filter.ts
|-- config/
|   |-- configuration.ts
|   `-- env.validation.ts
|-- health/
|   |-- health.module.ts
|   `-- presentation/
|       `-- http/
|           `-- health.controller.ts
|-- infrastructure/
|   `-- nats/
|       |-- nats.constants.ts
|       |-- nats.module.ts
|       `-- nats-request.client.ts
|-- app.module.ts
`-- main.ts
```

## Variables de entorno

Ver `.env.example`.

| Variable | Descripcion | Default |
| --- | --- | --- |
| `NODE_ENV` | Ambiente de ejecucion: `development`, `test`, `production`. | `development` |
| `PORT` | Puerto HTTP del gateway. | `3000` |
| `API_GLOBAL_PREFIX` | Prefijo global de la API. | `api` |
| `SWAGGER_TITLE` | Titulo de Swagger. | `Qhantuy API Gateway` |
| `SWAGGER_DESCRIPTION` | Descripcion de Swagger. | `HTTP REST API Gateway for Qhantuy microservices.` |
| `SWAGGER_VERSION` | Version documentada de la API. | `1.0.0` |
| `SWAGGER_PATH` | Ruta de Swagger. | `docs` |
| `NATS_SERVERS` | Lista separada por comas de servidores NATS. | `nats://localhost:4222` |
| `NATS_REQUEST_TIMEOUT_MS` | Timeout de requests NATS en milisegundos. | `5000` |

## Ejecucion local

```bash
npm install
npm run start:dev
```

Health:

```bash
curl http://localhost:3000/api/health
```

## Endpoints REST

Crear cotizacion desde una intencion:

```bash
curl -X POST http://localhost:3000/api/agent/quote \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"quiero comprar mochilas urbanas\",\"requestedByUserId\":\"b6fd7d2d-5e56-4b37-a761-2d69b86a9e91\",\"quantity\":3}"
```

Body:

```json
{
  "prompt": "quiero comprar mochilas urbanas",
  "requestedByUserId": "b6fd7d2d-5e56-4b37-a761-2d69b86a9e91",
  "quantity": 3
}
```

`quantity` es opcional. Si se envia, el Quote Service calcula el total con esa
cantidad. Si no se envia, el agente intenta interpretarla desde el `prompt`.

Aprobar cotizacion:

```bash
curl -X POST http://localhost:3000/api/agent/quote/{quote_id}/approve \
  -H "Content-Type: application/json" \
  -d "{\"approvedByUserId\":\"9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2\"}"
```

Rechazar cotizacion:

```bash
curl -X POST http://localhost:3000/api/agent/quote/{quote_id}/reject \
  -H "Content-Type: application/json" \
  -d "{\"rejectedByUserId\":\"47ad93a6-44fa-494c-88cc-7a865639e2d0\",\"reason\":\"Cliente no confirmo\"}"
```

Ejecutar compra simulada:

```bash
curl -X POST http://localhost:3000/api/agent/quote/{quote_id}/execute \
  -H "Content-Type: application/json" \
  -d "{\"executedBy\":\"human-operator-1\"}"
```

Swagger:

```text
http://localhost:3000/docs
```

## Cliente NATS

El cliente reutilizable vive en `src/infrastructure/nats/nats-request.client.ts`.
Los modulos HTTP futuros deben inyectar `NatsRequestClient` y llamar:

```ts
await natsRequestClient.request<ResponseDto, RequestDto>('subject.name', payload);
```

## Docker

```bash
docker build -t qhantuy-api-gateway .
docker run --rm -p 3000:3000 --env-file .env qhantuy-api-gateway
```

## Comandos

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Pendiente

- Autenticacion.
