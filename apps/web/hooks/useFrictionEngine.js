"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FrictionEngine } from "@/friction/frictionEngine.js";
import { frictionBus } from "@/friction/frictionBus.js";

// Creates one FrictionEngine, binds DOM listeners, and exposes its live state.
//
//   currentSection  the active page id from ApplicationContext (used for backtracking)
//   onHighFriction  optional callback for every "friction:detected" event
//                   (this is where the Phase 3 AI trigger will plug in)
//   config          optional override of FRICTION_CONFIG
export default function useFrictionEngine({ currentSection, onHighFriction, config } = {}) {
  const engineRef = useRef(null);
  if (engineRef.current === null) {
    engineRef.current = new FrictionEngine(config ? { config } : {});
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  const callbackRef = useRef(onHighFriction);
  callbackRef.current = onHighFriction;

  // Subscribe, attach DOM listeners, start the recalculation timer. All of it is undone on unmount.
  useEffect(() => {
    const unsubscribe = engine.subscribe(setSnapshot);
    const offDetected = engine.on("friction:detected", (payload) => {
      if (callbackRef.current) callbackRef.current(payload);
    });
    const offValidation = frictionBus.on("validation", (payload) => engine.recordValidation(payload));
    const offHelp = frictionBus.on("help", ({ sectionId }) => engine.recordHelp(sectionId));
    const detachDom = engine.attach(document);
    engine.start();
    setSnapshot(engine.getSnapshot());

    return () => {
      engine.stop();
      detachDom();
      offHelp();
      offValidation();
      offDetected();
      unsubscribe();
    };
  }, [engine]);

  // Section changes feed the navigation (backtracking) tracker.
  useEffect(() => {
    if (currentSection) engine.navigate(currentSection);
  }, [currentSection, engine]);

  const dismissNotification = useCallback((id) => engine.dismissNotification(id), [engine]);
  const reset = useCallback(() => engine.reset(), [engine]);

  return {
    engine,
    score: snapshot.overall.score, // 0-100
    status: snapshot.overall.level, // "low" | "moderate" | "high"
    sections: snapshot.sections,
    stats: snapshot.stats,
    log: snapshot.log,
    notifications: snapshot.notifications,
    thresholds: snapshot.thresholds,
    windowMs: snapshot.windowMs,
    dismissNotification,
    reset,
  };
}
