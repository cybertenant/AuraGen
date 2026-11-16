import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AuraGenDashboardPage from "../app/page";

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

describe("Day 4: Cognitive Friction Engine Frontend & Neon Integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates Cognitive Friction Engine raw score, smoothed score, and signal contributions from live Day 3 telemetry", () => {
    render(<AuraGenDashboardPage />);

    expect(screen.getByTestId("engine-smoothed-score")).toHaveTextContent("0");
    expect(screen.getByTestId("engine-raw-score")).toHaveTextContent("0.0");
    expect(
      screen.getByTestId("engine-friction-level-badge")
    ).toHaveTextContent("LOW FRICTION");

    // Trigger 2 validation errors (20 pts) + 1 backtrack (5 pts) = 25.0 raw pts
    fireEvent.click(screen.getByTestId("sim-validation-error-btn"));
    fireEvent.click(screen.getByTestId("sim-validation-error-btn"));
    fireEvent.click(screen.getByTestId("sim-backtrack-btn"));

    expect(screen.getByTestId("engine-raw-score")).toHaveTextContent("25.0");
    expect(
      screen.getByTestId("contribution-validationErrors")
    ).toHaveTextContent("20.0 pts");
    expect(screen.getByTestId("contribution-backtracking")).toHaveTextContent(
      "5.0 pts"
    );
  });

  it("runs deterministic Simulate High Friction through the real scoring pipeline and triggers eligibility after 5s sustained high load", () => {
    vi.useFakeTimers();
    render(<AuraGenDashboardPage />);

    fireEvent.click(screen.getByTestId("sim-scenario-high-btn"));

    expect(screen.getByTestId("engine-raw-score")).toHaveTextContent("87.2");

    // Advance 3s so exponential smoothing climbs from 30.5 -> 50.4 -> 63.3 -> 71.6 (>= 65 HIGH FRICTION)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      screen.getByTestId("engine-friction-level-badge")
    ).toHaveTextContent("HIGH FRICTION");

    // Advance 6s more so score >= 65 is sustained for >= 5 continuous seconds -> ELIGIBLE
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(
      screen.getByTestId("adaptation-eligibility-badge")
    ).toHaveTextContent("ELIGIBLE");
    vi.useRealTimers();
  });

  it("saves friction snapshots to Neon and continues operating gracefully if Neon returns 503", async () => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440077";
    window.localStorage.setItem("auragen_demo_session_id", mockSessionId);

    const postedPayloads: unknown[] = [];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (
        url.endsWith(`/api/sessions/${mockSessionId}/friction-events`) &&
        init?.method === "POST"
      ) {
        postedPayloads.push(JSON.parse(String(init.body)));
        return {
          ok: false,
          status: 503,
          json: async () => ({
            status: "error",
            message: "Simulated Neon PostgreSQL outage",
          }),
        };
      }
      if (url.endsWith(`/api/sessions/${mockSessionId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            session: {
              id: mockSessionId,
              startedAt: new Date().toISOString(),
              lastSeenAt: new Date().toISOString(),
              endedAt: null,
            },
          }),
        };
      }
      if (url.endsWith(`/api/sessions/${mockSessionId}/draft`)) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", count: 0, events: [] }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AuraGenDashboardPage />);

    // Flush initial mount fetch microtasks
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Trigger high friction simulation -> automatically sends snapshot to Neon
    fireEvent.click(screen.getByTestId("sim-scenario-high-btn"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(postedPayloads.length).toBeGreaterThanOrEqual(1);
    const firstPayload = postedPayloads[0] as {
      frictionScore: number;
      frictionLevel: string;
      signals: Record<string, unknown>;
    };
    expect(firstPayload.frictionScore).toBeGreaterThan(0);
    expect(firstPayload.frictionScore).toBeLessThanOrEqual(100);
    expect(firstPayload.signals).toHaveProperty("hesitation_count");

    // Dashboard must remain completely functional despite 503 database response
    expect(screen.getByTestId("engine-raw-score")).toHaveTextContent("87.2");
  });
});