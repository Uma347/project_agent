# AI Agent

Servicio Python 3.12 que interpreta una intencion de compra, calcula una
cantidad cuando no viene explicita y selecciona un producto validandolo contra
el catalogo real del `quote-service`. No escribe en base de datos, no aprueba
cotizaciones y no ejecuta compras.

## Subject NATS

Consume:

```text
ai.intent.interpret
```

Entrada:

```json
{
  "prompt": "quiero comprar dos hamburguesas"
}
```

Salida exitosa:

```json
{
  "productId": "burger_classic",
  "quantity": 2,
  "reason": "Producto identificado desde la intencion del usuario y validado contra el catalogo real."
}
```

Salida con error:

```json
{
  "error": {
    "code": "PRODUCT_NOT_IDENTIFIED",
    "message": "No se pudo identificar un producto disponible en el catalogo."
  }
}
```

## Consulta de catalogo

El agente no mantiene productos en memoria. Para identificar el producto,
publica un Request/Reply NATS hacia:

```text
catalog.products.search
```

Payload enviado:

```json
{
  "query": "quiero comprar dos hamburguesas",
  "limit": 5
}
```

Si el catalogo no responde o hay timeout, el agente devuelve:

```json
{
  "error": {
    "code": "CATALOG_SERVICE_UNAVAILABLE",
    "message": "No fue posible consultar el catalogo de productos."
  }
}
```

El subject `catalog.products.search` es atendido por `quote-service`, que es la
fuente de verdad del catalogo.

## Variables de entorno

Ver `.env.example`.

| Variable | Descripcion | Default |
| --- | --- | --- |
| `NATS_SERVERS` | Lista separada por comas de servidores NATS. | `nats://localhost:4222` |
| `NATS_QUEUE` | Queue group del agente. | `ai-agent` |
| `CATALOG_REQUEST_TIMEOUT_SECONDS` | Timeout para consultar el catalogo real. | `3` |

## Ejecucion local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Docker

```bash
docker build -t qhantuy-ai-agent .
docker run --rm --env-file .env qhantuy-ai-agent
```
