# Quote Service

Servicio NestJS responsable de la logica de negocio de cotizaciones. No expone
endpoints HTTP: consume mensajes NATS Request/Reply y persiste estado en
PostgreSQL usando TypeORM. Tambien es la fuente de verdad del catalogo de
productos que usa el agente para interpretar intenciones.

## Subjects NATS

| Subject | Payload minimo | Descripcion |
| --- | --- | --- |
| `agent.quote.create` | `{ "prompt": "quiero comprar mochilas urbanas", "requestedByUserId": "uuid", "quantity": 2 }` | Interpreta la intencion con `ai-agent` y crea una cotizacion en `PENDING_HUMAN_APPROVAL`. `quantity` es opcional y tiene prioridad sobre la cantidad interpretada. |
| `agent.quote.approve` | `{ "quoteId": "uuid", "approvedByUserId": "uuid" }` | Aprueba una cotizacion vigente. |
| `agent.quote.reject` | `{ "quoteId": "uuid", "rejectedByUserId": "uuid" }` | Rechaza una cotizacion. |
| `agent.quote.execute` | `{ "quoteId": "uuid" }` | Ejecuta una compra simulada en `payment-simulator` solo si fue aprobada. |
| `catalog.products.search` | `{ "query": "quiero tres mochilas", "limit": 5 }` | Busca productos activos del catalogo por intencion. |

## Reglas implementadas

- Toda cotizacion nueva queda en `PENDING_HUMAN_APPROVAL`.
- La creacion, aprobacion y rechazo requieren un usuario activo del dominio.
- La creacion llama por Request/Reply a `ai.intent.interpret`.
- El agente no tiene catalogo propio: llama a `catalog.products.search`.
- El catalogo se busca por `name`, `description`, `category`, `keywords` y
  `tags`, sin sensibilidad a mayusculas/minusculas.
- Si `agent.quote.create` recibe `quantity`, esa cantidad se usa para calcular
  el total. Si no la recibe, se usa la cantidad interpretada por el agente.
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

El esquema se crea desde las entidades TypeORM. El catalogo inicial y los
usuarios de dominio se siembran al iniciar el servicio.

La entidad `Product` incluye campos para busqueda por intencion:

- `category text null`
- `keywords text[] not null default '{}'`
- `tags text[] not null default '{}'`
- `metadata jsonb null`

Existe una migracion TypeORM para agregar estos campos en:

```text
src/infrastructure/typeorm/migrations/1720000000000-AddIntentSearchFieldsToProducts.ts
```

Productos iniciales:

| ID | SKU | Nombre | Categoria | Tags |
| --- | --- | --- | --- | --- |
| `mochila_urbana` | `MOCHILA-URBANA` | Mochila urbana | `backpack` | `urbano`, `estudio`, `trabajo`, `viaje corto` |
| `mochila_viaje` | `MOCHILA-VIAJE` | Mochila de viaje | `backpack` | `viaje`, `grande`, `organizador` |
| `cartera_cuero` | `CARTERA-CUERO` | Cartera de cuero | `handbag` | `moda`, `elegante`, `diario` |
| `billetera_compacta` | `BILLETERA-COMPACTA` | Billetera compacta | `wallet` | `compacto`, `tarjetas`, `accesorio` |
| `lonchera_termica` | `LONCHERA-TERMICA` | Lonchera termica | `lunchbag` | `colegio`, `oficina`, `alimentos` |
| `cartuchera_escolar` | `CARTUCHERA-ESCOLAR` | Cartuchera escolar | `pencil_case` | `colegio`, `utiles`, `organizador` |
| `morral_crossbody` | `MORRAL-CROSSBODY` | Morral crossbody | `crossbody` | `urbano`, `liviano`, `diario` |
| `maleta_cabina` | `MALETA-CABINA` | Maleta de cabina | `luggage` | `viaje`, `ruedas`, `cabina` |

Ejemplo de respuesta de `catalog.products.search`:

```json
{
  "products": [
    {
      "productId": "mochila_urbana",
      "sku": "MOCHILA-URBANA",
      "name": "Mochila urbana",
      "description": "Mochila resistente para uso diario, trabajo o universidad.",
      "category": "backpack",
      "keywords": ["mochila", "mochilas", "morral", "bolso escolar", "backpack"],
      "tags": ["urbano", "estudio", "trabajo", "viaje corto"],
      "priceCents": 28900
    }
  ]
}
```

Usuarios iniciales:

| Nombre | Email | UUID |
| --- | --- | --- |
| Juan Perez | `juan.perez@example.com` | `b6fd7d2d-5e56-4b37-a761-2d69b86a9e91` |
| Maria Lopez | `maria.lopez@example.com` | `9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2` |
| Carlos Rojas | `carlos.rojas@example.com` | `47ad93a6-44fa-494c-88cc-7a865639e2d0` |
| Ana Fernandez | `ana.fernandez@example.com` | `f2c41e10-a105-4c09-9bc8-e7980799d21e` |
| Pedro Gomez | `pedro.gomez@example.com` | `6c77170e-87ad-4f49-9848-c618b06030f7` |

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
