# AI Agent

Servicio Python 3.12 que interpreta una intencion de compra y responde que
producto del catalogo simulado debe cotizarse. No escribe en base de datos, no
aprueba cotizaciones y no ejecuta compras.

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
  "reason": "Producto identificado desde la intencion del usuario"
}
```

Salida con error:

```json
{
  "error": {
    "code": "PRODUCT_NOT_IDENTIFIED",
    "message": "No se pudo identificar un producto del catalogo simulado."
  }
}
```

## Catalogo simulado

- `burger_classic`
- `fries_regular`
- `soda_regular`

## Variables de entorno

Ver `.env.example`.

| Variable | Descripcion | Default |
| --- | --- | --- |
| `NATS_SERVERS` | Lista separada por comas de servidores NATS. | `nats://localhost:4222` |
| `NATS_QUEUE` | Queue group del agente. | `ai-agent` |

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
