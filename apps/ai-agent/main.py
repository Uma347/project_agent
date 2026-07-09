import asyncio
import json
import os
import re
import signal
from dataclasses import dataclass
from typing import Any

import nats
from dotenv import load_dotenv

SUBJECT = "ai.intent.interpret"


@dataclass(frozen=True)
class Product:
    product_id: str
    name: str
    keywords: tuple[str, ...]


CATALOG: tuple[Product, ...] = (
    Product(
        product_id="burger_classic",
        name="Hamburguesa clasica",
        keywords=("hamburguesa", "hamburguesas", "burger", "burgers"),
    ),
    Product(
        product_id="fries_regular",
        name="Papas fritas",
        keywords=("papas", "papas fritas", "fritas", "fries"),
    ),
    Product(
        product_id="soda_regular",
        name="Gaseosa regular",
        keywords=("gaseosa", "refresco", "soda", "bebida"),
    ),
)

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


def success_response(product: Product, quantity: int) -> dict[str, Any]:
    return {
        "productId": product.product_id,
        "quantity": quantity,
        "reason": "Producto identificado desde la intencion del usuario",
    }


def error_response(code: str, message: str) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
        },
    }


def normalize_text(value: str) -> str:
    return value.strip().lower()


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


def find_product(prompt: str) -> Product | None:
    normalized_prompt = normalize_text(prompt)
    for product in CATALOG:
        if any(keyword in normalized_prompt for keyword in product.keywords):
            return product

    return None


def interpret_intent(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt")
    print(f"-----------------------------------------: {prompt}")
    if not isinstance(prompt, str) or not prompt.strip():
        return error_response(
            "INVALID_PROMPT",
            "El campo 'prompt' es requerido y debe ser un texto no vacio.",
        )

    product = find_product(prompt)
    if product is None:
        return error_response(
            "PRODUCT_NOT_IDENTIFIED",
            "No se pudo identificar un producto del catalogo simulado.",
        )

    return success_response(product, parse_quantity(prompt))


def decode_payload(data: bytes) -> dict[str, Any] | None:
    try:
        message = json.loads(data.decode("utf-8"))
    except json.JSONDecodeError:
        return None

    if not isinstance(message, dict):
        return None

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
            response = interpret_intent(payload)

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
