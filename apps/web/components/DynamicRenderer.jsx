"use client";

import NormalForm from "@/components/NormalForm";

// Phase 1: always renders the NormalForm.
// Later phases will pick between NormalForm and WizardForm here,
// both reading the same state from ApplicationContext.
export default function DynamicRenderer() {
  const mode = "normal";

  switch (mode) {
    case "normal":
    default:
      return <NormalForm />;
  }
}
