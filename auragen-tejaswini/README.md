# AuraGen — Self-Healing Generative UI via Cognitive Load

A standalone, from-scratch implementation by **Tejaswini**, kept in its own
folder on the `tejaswini` branch so that no teammate's work is touched.

AuraGen watches how a person interacts with a dense financial form. When it
detects sustained interaction friction, it replaces the form with a guided,
one-question-at-a-time experience generated as structured JSON.

## Architecture

```
auragen-tejaswini/
├── apps/
│   ├── server/   Express + Socket.IO + TypeScript + Zod
│   └── web/      Next.js 14 (App Router) + React 18 + Tailwind
└── packages/
    └── shared/   End-to-end Zod schemas and pure scoring helpers
```

## Core guardrails

1. **No arbitrary code execution** — the model may only return JSON that
   passes the strict `GeneratedUiSchema`. Unknown keys are rejected.
2. **Approved Component Registry** — the renderer has a fixed switch over
   `text`, `number`, `select`, `checkbox`, and `textarea`. No dynamic tags, no
   `dangerouslySetInnerHTML`.
3. **Zero PII leakage** — only field IDs and friction metadata are ever sent
   to the generator. Field *values* never leave the browser.

## Getting started

```bash
cd auragen-tejaswini
cp .env.example apps/server/.env
cp .env.example apps/web/.env.local
corepack pnpm@9 install
corepack pnpm@9 test
corepack pnpm@9 dev
```

- Web: http://localhost:3000
- Server: http://localhost:4000/health

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service status |
| `POST` | `/api/sessions` | Create a session |
| `POST` | `/api/telemetry` | Record friction signals |
| `POST` | `/api/adaptations` | Generate and validate a guided UI |

Socket.IO events: `telemetry:signal` (client → server) and `ui:adapted`
(server → client).

## Testing

```bash
corepack pnpm@9 test
```

Covers the friction scorer, strict schema guardrails, PII sanitisation, the
offline generator, API routes, and the approved-component renderer.
