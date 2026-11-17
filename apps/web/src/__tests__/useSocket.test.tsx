import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuraGenDashboardPage from "../app/page";

const listenersMap = new Map<string, Set<(...args: unknown[]) => void>>();
const emittedEvents: Array<{ event: string; payload: unknown }> = [];
let mockConnectedState = true;

vi.mock("socket.io-client", () => ({
  io: () => ({
    get connected() {
      return mockConnectedState;
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listenersMap.has(event)) {
        listenersMap.set(event, new Set());
      }
      listenersMap.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listenersMap.get(event)?.delete(cb);
    }),
    emit: vi.fn((event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    }),
    disconnect: vi.fn(),
    io: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

function triggerServerEvent(event: string, payload: unknown) {
  const handlers = listenersMap.get(event);
  if (handlers) {
    handlers.forEach((cb) => cb(payload));
  }
}

describe("Day 5: Frontend useSocket() & Dashboard Real-Time Integration (Scenarios 8, 13, 14, 15)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listenersMap.clear();
    emittedEvents.length = 0;
    mockConnectedState = true;
  });

  it("Scenario 8 & 13: receives authoritative friction:update on dashboard and cleans up listeners on unmount without duplicates", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440088";
    window.localStorage.setItem("auragen_demo_session_id", sessionId);

    const { unmount } = render(<AuraGenDashboardPage />);

    // Verify no duplicate friction:update listeners registered
    expect(listenersMap.get("friction:update")?.size).toBe(1);

    // Simulate session:ready followed by authoritative friction:update from backend
    act(() => {
      triggerServerEvent("session:ready", {
        sessionId,
        room: `session:${sessionId}`,
        serverTimestamp: new Date().toISOString(),
        message: "Connected",
      });

      triggerServerEvent("friction:update", {
        sessionId,
        rawScore: 76.5,
        smoothedScore: 72.0,
        level: "high",
        signals: {
          hesitation: 0.67,
          validationErrors: 1,
          repeatedClicks: 0.5,
          backtracking: 0.33,
          cursorAnomaly: 0.4,
        },
        contributions: {
          hesitation: 16.75,
          validationErrors: 30,
          repeatedClicks: 10,
          backtracking: 5,
          cursorAnomaly: 4,
        },
        thresholdStatus: {
          state: "candidate",
          isAboveHighThreshold: true,
          isEligibleForAdaptation: false,
          shouldTriggerAdaptationEvent: false,
          sustainedDurationMs: 2000,
          remainingSustainedMs: 3000,
          cooldownRemainingMs: 0,
        },
        persistedToDatabase: true,
        databaseAvailable: true,
        processingTimeMs: 1.4,
        timestamp: new Date().toISOString(),
      });
    });

    // Dashboard reflects authoritative server smoothed score (72) and HIGH FRICTION
    expect(screen.getByTestId("engine-smoothed-score")).toHaveTextContent("72");
    expect(
      screen.getByTestId("engine-friction-level-badge")
    ).toHaveTextContent("HIGH FRICTION");

    unmount();
    expect(listenersMap.get("friction:update")?.size ?? 0).toBe(0);
  });

  it("Scenarios 14 & 15: keeps financial loan form functional when socket is disconnected and never sends financial values in telemetry", () => {
    mockConnectedState = false;
    render(<AuraGenDashboardPage />);

    const fullNameInput = screen.getByLabelText(
      /Full Legal Name/i
    ) as HTMLInputElement;
    fireEvent.focusIn(fullNameInput);
    fireEvent.change(fullNameInput, {
      target: { value: "CONFIDENTIAL_INCOME_9999999" },
    });
    fireEvent.focusOut(fullNameInput);

    // Form value updates cleanly while disconnected
    expect(fullNameInput.value).toBe("CONFIDENTIAL_INCOME_9999999");

    // Ensure no emitted socket event ever contains the typed string
    const serializedEmits = JSON.stringify(emittedEvents);
    expect(serializedEmits).not.toContain("CONFIDENTIAL_INCOME_9999999");
  });
});