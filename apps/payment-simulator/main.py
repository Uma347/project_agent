import asyncio
import json
import os
import signal
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import nats
from dotenv import load_dotenv

SUBJECT = "payment.simulate.execute"
PROVIDER = "qhantuy-payment-simulator"


def success_response(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "purchaseId": f"pur_{uuid4()}",
        "status": "SIMULATED_SUCCESS",
        "provider": PROVIDER,
        "quoteId": payload["quoteId"],
        "amountCents": payload["amountCents"],
        "currency": payload["currency"],
        "executedAt": datetime.now(timezone.utc).isoformat(),
        "message": "Compra simulada ejecutada correctamente. No se movió dinero real.",
    }


def error_response(message: str) -> dict[str, Any]:
    return {
        "error": {
            "code": "INVALID_PAYMENT_REQUEST",
            "message": message,
        },
    }


def decode_payload(data: bytes) -> dict[str, Any] | None:
    try:
        payload = json.loads(data.decode("utf-8"))
    except json.JSONDecodeError:
        return None

    return payload if isinstance(payload, dict) else None


def unwrap_nest_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if payload.get("pattern") == SUBJECT and isinstance(data, dict):
        return data

    return payload


def validate_payload(payload: dict[str, Any]) -> str | None:
    quote_id = payload.get("quoteId")
    amount_cents = payload.get("amountCents")
    currency = payload.get("currency")
    idempotency_key = payload.get("idempotencyKey")

    if not isinstance(quote_id, str) or not quote_id.strip():
        return "quoteId es requerido."

    if type(amount_cents) is not int or amount_cents <= 0:
        return "amountCents debe ser un entero mayor a 0."

    if not isinstance(currency, str) or not currency.strip():
        return "currency es requerido."

    if not isinstance(idempotency_key, str) or not idempotency_key.strip():
        return "idempotencyKey es requerido."

    return None


def handle_payment(payload: dict[str, Any] | None) -> dict[str, Any]:
    if payload is None:
        return error_response("El mensaje debe ser un objeto JSON valido.")

    payment_payload = unwrap_nest_payload(payload)
    validation_error = validate_payload(payment_payload)
    if validation_error:
        return error_response(validation_error)

    return success_response(payment_payload)


async def main() -> None:
    load_dotenv("../../.env")
    load_dotenv(".env", override=True)

    nats_servers = [
        server.strip()
        for server in os.getenv("NATS_SERVERS", "nats://localhost:4222").split(",")
        if server.strip()
    ]
    queue = os.getenv("NATS_QUEUE", "payment-simulator")

    nc = await nats.connect(servers=nats_servers)
    stop_event = asyncio.Event()

    async def handle_message(message: Any) -> None:
        response = handle_payment(decode_payload(message.data))
        await message.respond(json.dumps(response).encode("utf-8"))

    await nc.subscribe(SUBJECT, queue=queue, cb=handle_message)
    print(f"Payment Simulator listening on subject '{SUBJECT}'")

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    await stop_event.wait()
    await nc.drain()


if __name__ == "__main__":
    asyncio.run(main())
