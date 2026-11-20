import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuraGenDashboardPage from "../app/page";

const listenersMap = new Map<string, Set<(...args: unknown[]) => void>>();

vi.mock("socket.io-client", () => ({
  io: () => ({
    connected: true,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listenersMap.has(event)) {
        listenersMap.set(event, new Set());
      }
      listenersMap.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listenersMap.get(event)?.delete(cb);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

function triggerServerEvent(event: string, payload: unknown) {
  listenersMap.get(event)?.forEach((cb) => cb(payload));
}

describe("Day 6: Frontend Adaptive Friction Threshold Orchestration Dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listenersMap.clear();
  });

  it("displays live server friction:state, adaptation:eligible, and friction:recovered updates on the dashboard", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440666";
    window.localStorage.setItem("auragen_demo_session_id", sessionId);

    render(<AuraGenDashboardPage />);

    expect(screen.getByTestId("adaptive-state-badge")).toHaveTextContent(
      "MONITORING"
    );

    act(() => {
      triggerServerEvent("friction:state", {
        sessionId,
        state: "HIGH_FRICTION_CANDIDATE",
        frictionScore: 74,
        frictionLevel: "high",
        durationMs: 3000,
        requiredDurationMs: 5000,
        cooldownRemainingMs: 0,
        episodeTriggered: false,
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.getByTestId("adaptive-state-badge")).toHaveTextContent(
      "HIGH_FRICTION_CANDIDATE"
    );
    expect(screen.getByTestId("adaptive-candidate-duration")).toHaveTextContent(
      "3.0s"
    );

    act(() => {
      triggerServerEvent("friction:state", {
        sessionId,
        state: "ADAPTATION_ELIGIBLE",
        frictionScore: 79,
        frictionLevel: "high",
        durationMs: 5200,
        requiredDurationMs: 5000,
        cooldownRemainingMs: 60000,
        episodeTriggered: true,
        timestamp: new Date().toISOString(),
      });
      triggerServerEvent("adaptation:eligible", {
        sessionId,
        eligible: true,
        frictionScore: 79,
        frictionLevel: "high",
        reason: "sustained_high_interaction_friction",
        sustainedDurationMs: 5200,
        cooldownDurationMs: 60000,
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.getByTestId("adaptive-state-badge")).toHaveTextContent(
      "ADAPTATION_ELIGIBLE"
    );
    expect(screen.getByTestId("adaptive-cooldown-remaining")).toHaveTextContent(
      "60s"
    );

    act(() => {
      triggerServerEvent("friction:state", {
        sessionId,
        state: "RECOVERED",
        frictionScore: 42,
        frictionLevel: "medium",
        durationMs: 0,
        requiredDurationMs: 5000,
        cooldownRemainingMs: 0,
        episodeTriggered: false,
        resetReason: "recovered_below_threshold",
        timestamp: new Date().toISOString(),
      });
      triggerServerEvent("friction:recovered", {
        sessionId,
        recovered: true,
        frictionScore: 42,
        frictionLevel: "medium",
        recoveryThreshold: 55,
        cooldownRemainingMs: 0,
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.getByTestId("adaptive-state-badge")).toHaveTextContent(
      "RECOVERED"
    );
    expect(screen.getByTestId("adaptive-recovery-status")).toHaveTextContent(
      "Recovered (< 55)"
    );
  });

  it("runs development-only adaptive simulator scenarios through the real decision pipeline", () => {
    render(<AuraGenDashboardPage />);

    // Scenario A: Normal User
    fireEvent.click(screen.getByTestId("sim-adaptive-normal-btn"));
    expect(screen.getByTestId("adaptive-state-badge")).toHaveTextContent(
      "MONITORING"
    );
    expect(screen.getByTestId("adaptive-sim-note")).toHaveTextContent(
      "Scenario A (Normal User)"
    );
  });
});