"use client";

import { createContext, useContext } from "react";
import { useApplication } from "@/context/ApplicationContext";
import useFrictionEngine from "@/hooks/useFrictionEngine";

// Runs the Friction Engine for the whole app and shares its state with the monitor.
// Only components that call useFriction() re-render when scores change.

const FrictionContext = createContext(null);

export function FrictionProvider({ children }) {
  const { currentSection } = useApplication();

  const friction = useFrictionEngine({
    currentSection,
    // Phase 3 will call the AI code-gen agent here. For now the dashboard shows a notification.
    onHighFriction: (payload) => {
      if (process.env.NODE_ENV !== "production") console.info("[friction]", payload);
    },
  });

  return <FrictionContext.Provider value={friction}>{children}</FrictionContext.Provider>;
}

export function useFriction() {
  const context = useContext(FrictionContext);
  if (!context) throw new Error("useFriction must be used inside FrictionProvider");
  return context;
}
