# Guided Session Experience — Tejaswini's Contribution

This document describes the work added on the `tejaswini` branch. All of it is
**new files only**; no files owned by other team members were modified or
deleted.

## What was added

| File | Purpose |
| --- | --- |
| `apps/web/src/components/guided/guided-session.contract.ts` | Zod contracts for a guided session, its approved components, and a strictly value-free AI context. |
| `apps/web/src/components/guided/GuidedSessionPanel.tsx` | Renderer that validates a session schema before displaying anything and only renders approved controls. |
| `apps/web/src/hooks/useGuidedSession.ts` | Client-local state machine for step navigation and answers. |
| `apps/web/src/app/guided/page.tsx` | New `/guided` route with a static demo session. |
| `apps/web/src/__tests__/guidedSession.test.tsx` | Contract guardrail tests and React Testing Library coverage. |

## How the guardrails are respected

1. **No arbitrary code execution** — a session is parsed with
   `GuidedSessionSchema` (`.strict()`) before render. Unknown keys and unknown
   component types are rejected and the panel fails closed.
2. **Approved Component Registry** — `ApprovedField` supports only `text`,
   `number`, `select`, `checkbox`, and `confirm`. There is no dynamic tag
   creation and no `dangerouslySetInnerHTML`.
3. **Zero PII leakage** — answers live in React state in the browser. The only
   object prepared for an AI request is `SanitizedGuidedContext`, which is
   strict and contains just the session id, friction metadata, field IDs, and
   the visible step index — never a field value.

## Running it

```bash
pnpm install
pnpm --filter @auragen/web test -- guidedSession
pnpm dev:web
# open http://localhost:3000/guided
```

## Notes

- The new route is automatically discovered by the Next.js App Router; no
  existing navigation or route file needed to be edited.
- The demo session at `/guided` is static. In production the same payload would
  come from the Gemini agent and be validated by `GuidedSessionSchema` before
  reaching `GuidedSessionPanel`.
