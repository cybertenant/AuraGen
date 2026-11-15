# AuraGen — Self-Healing Generative UI via Cognitive Load

AuraGen is an adaptive fintech UI platform that detects user interaction friction in complex financial forms and uses a Gemini-powered AI agent to dynamically transform high-friction interfaces into guided, step-by-step conversational experiences.

## Architecture & Tech Stack
- **Monorepo**: `pnpm` workspaces (`apps/web`, `apps/server`, `packages/shared`)
- **Frontend (`apps/web`)**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui architecture, Lucide Icons, Socket.IO Client
- **Backend (`apps/server`)**: Node.js, Express, TypeScript, Socket.IO, Zod
- **Shared (`packages/shared`)**: End-to-end Zod schemas and TypeScript contracts
- **Testing**: Vitest & React Testing Library

## Core Guardrails
1. **No arbitrary code execution**: The LLM only generates structured JSON UI schemas validated by Zod.
2. **Approved Component Registry**: Only pre-vetted React components are rendered.
3. **Zero PII leakage**: Sensitive financial field values are never transmitted to the LLM.

## Getting Started

### 1. Prerequisites
- Node.js `>=20.0.0` (LTS)
- `pnpm` `>=9.0.0` (`npm install -g pnpm`)

### 2. Setup
```bash
# Copy environment variables
cp .env.example apps/server/.env
cp .env.example apps/web/.env.local

# Install dependencies
pnpm install