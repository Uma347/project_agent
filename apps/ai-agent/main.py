import asyncio
import json
import os
import re
import signal
import uuid
from typing import Any

import nats
from dotenv import load_dotenv

SUBJECT = "ai.intent.interpret"
CATALOG_SEARCH_SUBJECT = "catalog.products.search"

SPANISH_NUMBERS = {
    "un": 1,
    "una": 1,
    "uno": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
}


def success_response(product: dict[str, Any], quantity: int) -> dict[str, Any]:
    return {
        "productId": product["productId"],
        "quantity": quantity,
        "reason": (
            "Producto identificado desde la intencion del usuario y validado "
            "contra el catalogo real."
        ),
    }


def error_response(code: str, message: str) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
        },
    }


def parse_quantity(prompt: str) -> int:
    numeric_match = re.search(r"\b(\d+)\b", prompt)
    if numeric_match:
        quantity = int(numeric_match.group(1))
        if quantity > 0:
            return quantity

    words = re.findall(r"\b[a-zA-ZáéíóúñÁÉÍÓÚÑ]+\b", prompt.lower())
    for word in words:
        if word in SPANISH_NUMBERS:
            return SPANISH_NUMBERS[word]

    return 1


async def search_catalog(
    nc: Any, prompt: str, timeout_seconds: float
) -> list[dict[str, Any]] | None:
    request_id = uuid.uuid4().hex
    request = {
        "pattern": CATALOG_SEARCH_SUBJECT,
        "data": {
            "query": prompt,
            "limit": 5,
        },
        "id": request_id,
    }
    response = await nc.request(
        CATALOG_SEARCH_SUBJECT,
        json.dumps(request).encode("utf-8"),
        timeout=timeout_seconds,
    )
    print(f"AI AGENT CATALOG RAW DATA: {response.data.decode('utf-8')}")
    payload = decode_payload(response.data)
    if payload is None:
        return None

    products = payload.get("products")
    if not isinstance(products, list):
        print(f"AI AGENT CATALOG INVALID PAYLOAD: {payload}")
        return None

    return [product for product in products if isinstance(product, dict)]


async def interpret_intent(
    nc: Any, payload: dict[str, Any], catalog_timeout_seconds: float
) -> dict[str, Any]:
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return error_response(
            "INVALID_PROMPT",
            "El campo 'prompt' es requerido y debe ser un texto no vacio.",
        )

    quantity = parse_quantity(prompt)

    try:
        products = await search_catalog(nc, prompt, catalog_timeout_seconds)
    except (TimeoutError, nats.errors.TimeoutError, OSError) as error:
        print(f"AI AGENT CATALOG REQUEST FAILED: {error}")
        return error_response(
            "CATALOG_SERVICE_UNAVAILABLE",
            "No fue posible consultar el catalogo de productos.",
        )

    if products is None:
        return error_response(
            "CATALOG_SERVICE_UNAVAILABLE",
            "No fue posible consultar el catalogo de productos.",
        )

    if not products:
        return error_response(
            "PRODUCT_NOT_IDENTIFIED",
            "No se pudo identificar un producto disponible en el catalogo.",
        )

    return success_response(products[0], quantity)


def decode_payload(data: bytes) -> dict[str, Any] | None:
    try:
        message = json.loads(data.decode("utf-8"))
    except json.JSONDecodeError:
        return None

    if not isinstance(message, dict):
        return None

    if isinstance(message.get("response"), dict):
        return message["response"]

    if isinstance(message.get("data"), dict):
        return message["data"]

    return message


async def main() -> None:
    load_dotenv("../../.env")
    load_dotenv(".env", override=True)

    nats_servers = [
        server.strip()
        for server in os.getenv("NATS_SERVERS", "nats://localhost:4222").split(",")
        if server.strip()
    ]
    queue = os.getenv("NATS_QUEUE", "ai-agent")
    catalog_timeout_seconds = float(os.getenv("CATALOG_REQUEST_TIMEOUT_SECONDS", "3"))

    nc = await nats.connect(servers=nats_servers)
    stop_event = asyncio.Event()

    async def handle_message(message: Any) -> None:
        payload = decode_payload(message.data)
        print(f"AI AGENT RAW DATA: {message.data.decode('utf-8')}")
        print(f"AI AGENT PAYLOAD: {payload}")
        if payload is None:
            response = error_response(
                "INVALID_JSON",
                "El mensaje debe ser un objeto JSON valido.",
            )
        else:
            response = await interpret_intent(nc, payload, catalog_timeout_seconds)

        await message.respond(json.dumps(response).encode("utf-8"))

    await nc.subscribe(SUBJECT, queue=queue, cb=handle_message)
    print(f"AI Agent listening on subject '{SUBJECT}'")

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    await stop_event.wait()
    await nc.drain()


if __name__ == "__main__":
    asyncio.run(main())
