# AuraGen - Phase 1: Financial Application Portal

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
No backend, no database. All data lives in React state.

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
