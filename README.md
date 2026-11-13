# AuraGen - Phases 1 and 2

A Next.js (App Router) financial application portal. This is the static,
original interface that later phases of AuraGen will adapt into a conversational wizard.

## Requirements

- Node.js 18.17 or newer
- npm

## Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Production build:

```bash
npm run build
npm start
```

## Stack

Next.js 14 (App Router), React 18, JavaScript, Tailwind CSS 3, React hooks, Lucide React.
Phase 1/2 keep all data in React state. Phase 3A.1 adds the PostgreSQL + Prisma foundation in `apps/api` (no endpoints yet).

## Folder structure

```
app/
  layout.js, page.js, globals.css
components/
  AppShell.jsx              Sidebar + main area layout
  Sidebar.jsx               Branding, navigation, application status
  Dashboard.jsx             Welcome, progress, completion summary
  DynamicRenderer.jsx       Picks which form UI to render (NormalForm for now)
  NormalForm.jsx            Step header, section body, Previous/Next, success screen
  PersonalInformation.jsx
  EmploymentInformation.jsx
  FinancialInformation.jsx
  DocumentUpload.jsx
  ApplicationReview.jsx
  ProgressIndicator.jsx     Completion bar and step indicator
  ui/FormControls.jsx       TextField, SelectField, TextAreaField
context/
  ApplicationContext.jsx    Centralized form state and actions
lib/
  fields.js                 Sections, field definitions, initial data
  validation.js             Validation rules and progress calculation
```

## How state works

`ApplicationContext` holds one `formData` object (`personal`, `employment`,
`financial`, `documents`), plus `errors`, `currentSection` and `submission`.
Every section component is controlled: it receives `data`, `errors`,
`onChange` and `onBlur` as props. A future `WizardForm` can read and write the
same context, so entered data carries over when the UI switches.

## Preparing for later phases

- `DynamicRenderer` renders `NormalForm` today. Add a `WizardForm` case there later.
- Every input has `data-section` and `data-field` attributes, so a Friction Engine
  can attach listeners per field without changing the form components.
- Field definitions and validation are separate from the UI (`lib/`), so a
  wizard can reuse them.

## Notes

- Currency symbol is set by `CURRENCY_SYMBOL` in `lib/fields.js`.
- Uploaded files stay in the browser. Allowed types: PDF, JPG, PNG, up to 5 MB.
- Fonts load through `next/font/google`, so the first `npm run dev` needs internet access.


---

# Phase 2: Friction Engine

The portal now measures interaction friction per form section and exposes a
Cognitive Friction Score (0 to 100). No AI model is connected yet.

Open **Friction Monitor** in the sidebar to see it live.

## What is tracked (metadata only)

| Signal | How it is detected |
| --- | --- |
| Repeated clicks | 3 or more clicks on the same field within 2 s. One or two clicks are ignored. |
| Hesitation | A field stays focused for 8 s or more before typing or leaving. |
| Validation errors | Invalid Next/Submit attempts (counted per section and per field), plus smaller inline errors. |
| Backtracking | Moving back to an earlier section that was already visited. |
| Help interactions | Opening "Need help with this step?" (shown in the monitor, not part of the formula). |

Only section IDs, field IDs, counts and timings are stored. Field values, passwords and
documents are never read. Mouse movement is not tracked.

## Score

```
Friction = 0.30 x Repeated Click + 0.30 x Hesitation + 0.25 x Validation + 0.15 x Backtracking
```

Each metric is normalized to 0-100 (see `saturation` values in `friction/frictionConfig.js`).
Levels: 0-30 low, 31-60 moderate, 61-100 high.

- Scores are calculated per section and recalculated on every event and once per second.
- Rolling window: 60 s. Events keep full weight for 30 s, then fade to zero.
- Smoothing: the score rises quickly and falls slowly to avoid flicker.
- The overall score is the highest section score.
- A high score means a section may be hard to use. It is not proof of how a person feels.

## High-friction event

When a section reaches the high threshold, the engine emits:

```json
{
  "event": "friction:detected",
  "sectionId": "employment",
  "frictionScore": 82,
  "frictionLevel": "high",
  "metrics": { "repeatedClicks": 5, "hesitationEvents": 3, "validationErrors": 3, "backtracks": 0 }
}
```

A section triggers again only after its score drops below the high threshold and the
30 s cooldown has passed. Listen to it in either of two ways:

```js
// 1. Hook option (see context/FrictionContext.jsx)
useFrictionEngine({ currentSection, onHighFriction: (payload) => { /* Phase 3 */ } });

// 2. Emitter
engine.on("friction:detected", (payload) => { /* Phase 3 */ });
```

For now the Friction Monitor shows a notification instead.

## Files added in Phase 2

```
friction/
  frictionConfig.js       thresholds, weights, window, cooldown (edit values here)
  frictionCalculator.js   pure scoring functions
  frictionEngine.js       event store, scoring loop, trigger, snapshot
  clickTracker.js         repeated-click bursts
  mouseTracker.js         delegated click listener (no mousemove)
  hesitationTracker.js    focus time before input
  validationTracker.js    errors per section and field
  navigationTracker.js    backtracking
  frictionBus.js          lets Phase 1 code report validation/help metadata
  eventEmitter.js
  friction.test.js        scenario tests
hooks/useFrictionEngine.js
context/FrictionContext.jsx
components/
  FrictionDashboard.jsx, FrictionScoreCard.jsx, SectionFrictionList.jsx,
  InteractionLog.jsx, HelpPanel.jsx, frictionStyles.js
```

Small edits to Phase 1 files: `app/page.js`, `components/AppShell.jsx`, `components/Sidebar.jsx`,
`components/NormalForm.jsx`, `components/ApplicationReview.jsx`, `context/ApplicationContext.jsx`, `package.json`.

## Testing

Automated (no browser needed, uses a fake clock; Node 20.19+ or 22.7+):

```bash
npm run test:friction
```

It covers the seven scenarios: normal filling, repeated clicks, long hesitation, repeated
invalid submissions, frequent navigation, combined signals reaching high friction, and
gradual decay as events leave the window.

Manual (run `npm run dev`, then watch **Friction Monitor** in the sidebar; use the sidebar
to switch between the form and the monitor):

1. **Normal use.** Fill Personal Information at a normal pace. Scores stay Low.
2. **Repeated clicks.** Click the Employment type field 4 times quickly. Repeated clicks rise, and the log shows the field name.
3. **Hesitation.** Click into Monthly income and wait 8 s without typing. A hesitation event appears. To test faster, set `hesitation.thresholdMs` to `3000` in `friction/frictionConfig.js`.
4. **Validation.** Press Next on an empty section 3 times. Validation errors and the top error field update.
5. **Backtracking.** Go Personal, Employment, Personal, Employment, Personal using the sidebar. Backtracks rise.
6. **High friction.** Combine steps 2 to 4 on one section within a minute. The score reaches 61 or more and a red notification appears once.
7. **Recovery.** Keep using the form normally. The score falls gradually and reaches 0 after about 60 s.

---

## Phase 3A.1 – PostgreSQL + Prisma foundation

Monorepo layout (Turborepo, npm workspaces):

```
apps/web   Next.js app (Phase 1 + 2)
apps/api   NestJS + Prisma 7 (Phase 3A.1: database only, no REST endpoints)
```

### Run it

```bash
npm install
cp .env.example .env                    # set POSTGRES_PASSWORD (docker-compose)
cp apps/api/.env.example apps/api/.env  # set DATABASE_URL with the same password
npm run db:up                           # start PostgreSQL (auragen_db)
npm run db:generate                     # prisma generate
npm run db:migrate                      # prisma migrate dev (applies the init migration)
npm run db:validate                     # prisma validate
npm run db:verify                       # connects and counts rows in all 4 tables
npm run dev                             # web on :3000, api on :4000
```

Without Docker, create the database yourself: `createdb auragen_db`.

### Models

- **User** – an applicant or admin. `externalUserId` (unique, optional) links to an auth provider; `role` USER/ADMIN; `accountStatus` ACTIVE/DISABLED.
- **Session** – one pass through the application form. Tracks status, current section, completion %, overall friction score/level and a running event count.
- **InteractionEvent** – one raw behavioural signal (click, hesitation, validation error...). `eventId` is client-generated and unique, so retried uploads are idempotent. `eventMetadata` is JSONB.
- **FrictionHistory** – a point-in-time friction score per section with its four component scores. Written by the calculation phase, not yet.

Deleting a User cascades to their sessions, events and history; deleting a Session cascades to its events and history.
