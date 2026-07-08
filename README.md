# Qhantuy Agent Quotes

## Descripción

Este proyecto implementa el núcleo de un flujo de compra asistido por
IA. Un agente interpreta la intención de compra del usuario, genera una
cotización y **requiere aprobación humana obligatoria** antes de
ejecutar una compra simulada.

## Arquitectura

``` text
Frontend / Postman
        │
        ▼
API Gateway (NestJS)
        │
   HTTP → NATS
        │
        ▼
+-------------------------+
|         NATS            |
+-------------------------+
     │              │
     ▼              ▼
Quote Service    AI Agent
(NestJS)         (Python)
     │
     ▼
 PostgreSQL
```

## Estructura del monorepo

``` text
qhantuy-agent/
├── apps/
│   ├── api-gateway/
│   ├── quote-service/
│   └── ai-agent/
├── packages/
│   └── shared/
├── infra/
│   └── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Tecnologías

-   Node.js + TypeScript
-   NestJS
-   Python
-   PostgreSQL
-   Prisma ORM
-   NATS + JetStream
-   Docker Compose

## Ejecución

### Levantar infraestructura

``` bash
docker compose -f infra/docker-compose.yml up -d
```

### Gateway

``` bash
cd apps/api-gateway
npm install
npm run start:dev
```

### Quote Service

``` bash
cd apps/quote-service
npm install
npm run start:dev
```

### AI Agent

``` bash
cd apps/ai-agent
python -m venv .venv
# Activar el entorno según el sistema operativo
pip install -r requirements.txt
python main.py
```

## Objetivo

Demostrar una arquitectura preparada para sistemas de IA donde el agente
puede recomendar y preparar una compra, pero la decisión final y la
autorización para ejecutar una operación económica permanecen bajo
control humano.
