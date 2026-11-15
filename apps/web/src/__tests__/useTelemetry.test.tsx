import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTelemetry, UseTelemetryOptions } from "../hooks/useTelemetry";

function TelemetryHarness(props: UseTelemetryOptions) {
  const {
    containerRef,
    metrics,
    recordValidationError,
    recordBacktrack,
    resetTelemetry,
    getTelemetrySnapshot,
  } = useTelemetry(props);

  const [secretInput, setSecretInput] = useState("");
  const [snapshotJson, setSnapshotJson] = useState("");

  return (
    <div ref={containerRef} data-testid="telemetry-container">
      <div data-auragen-section="step1" data-auragen-section-index="1">
        <input
          id="fullName"
          data-auragen-field="fullName"
          data-testid="input-fullName"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
        />
        <input
          id="annualIncome"
          data-auragen-field="annualIncome"
          data-testid="input-annualIncome"
        />
      </div>

      <div data-auragen-section="step2" data-auragen-section-index="2">
        <input
          id="taxId"
          data-auragen-field="taxId"
          data-testid="input-taxId"
        />
      </div>

      <button
        type="button"
        data-auragen-action="submit"
        data-testid="btn-submit"
      >
        Submit
      </button>

      <button
        type="button"
        data-auragen-action="secondary"
        data-testid="btn-secondary"
      >
        Secondary
      </button>

      <button
        type="button"
        data-testid="btn-record-error"
        onClick={() => recordValidationError("annualIncome", "range")}
      >
        Trigger Validation Error
      </button>

      <button
        type="button"
        data-testid="btn-record-backtrack"
        onClick={() => recordBacktrack("step_2_to_1")}
      >
        Trigger Backtrack
      </button>

      <button
        type="button"
        data-testid="btn-reset"
        onClick={() => resetTelemetry()}
      >
        Reset
      </button>

      <button
        type="button"
        data-testid="btn-snapshot"
        onClick={() => setSnapshotJson(JSON.stringify(getTelemetrySnapshot()))}
      >
        Capture Snapshot
      </button>

      <output data-testid="focus-count">{metrics.fieldFocusCount}</output>
      <output data-testid="hesitation-count">{metrics.hesitationCount}</output>
      <output data-testid="repeated-clicks">{metrics.repeatedClicks}</output>
      <output data-testid="validation-errors">{metrics.validationErrors}</output>
      <output data-testid="backtracks">{metrics.backtracks}</output>
      <output data-testid="cursor-anomaly">{metrics.cursorAnomalyScore}</output>
      <output data-testid="snapshot-json">{snapshotJson}</output>
    </div>
  );
}

describe("Day 3: useTelemetry() Hook — 12 Mandatory Scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. detects field focus interactions on data-auragen-field elements", () => {
    render(<TelemetryHarness />);
    const fullName = screen.getByTestId("input-fullName");
    const annualIncome = screen.getByTestId("input-annualIncome");

    fireEvent.focusIn(fullName);
    fireEvent.focusOut(fullName);
    fireEvent.focusIn(annualIncome);

    expect(screen.getByTestId("focus-count")).toHaveTextContent("2");
    expect(screen.getByTestId("hesitation-count")).toHaveTextContent("0");
  });

  it("2. detects field hesitation after exceeding configured duration (>8 seconds)", () => {
    render(<TelemetryHarness hesitationThresholdMs={8000} />);
    const fullName = screen.getByTestId("input-fullName");

    fireEvent.focusIn(fullName);

    act(() => {
      vi.advanceTimersByTime(7900);
    });
    expect(screen.getByTestId("hesitation-count")).toHaveTextContent("0");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("hesitation-count")).toHaveTextContent("1");
  });

  it("3. detects repeated clicks (>=3 clicks within 2 seconds) on the same target", () => {
    render(<TelemetryHarness />);
    const submitBtn = screen.getByTestId("btn-submit");

    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(screen.getByTestId("repeated-clicks")).toHaveTextContent("0");

    fireEvent.click(submitBtn);
    expect(screen.getByTestId("repeated-clicks")).toHaveTextContent("1");
  });

  it("4. does NOT classify independent clicks on different targets as repeated clicks", () => {
    render(<TelemetryHarness />);
    const submitBtn = screen.getByTestId("btn-submit");
    const secondaryBtn = screen.getByTestId("btn-secondary");

    fireEvent.click(submitBtn);
    fireEvent.click(secondaryBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(secondaryBtn);

    expect(screen.getByTestId("repeated-clicks")).toHaveTextContent("0");
  });

  it("5. records validation errors via explicit callback without inspecting form values", () => {
    render(<TelemetryHarness />);
    const errBtn = screen.getByTestId("btn-record-error");

    fireEvent.click(errBtn);
    fireEvent.click(errBtn);

    expect(screen.getByTestId("validation-errors")).toHaveTextContent("2");
  });

  it("6. detects backtracking via recordBacktrack() and cross-section backward navigation, ignoring ordinary field focus shifts", () => {
    render(<TelemetryHarness />);
    const fullNameStep1 = screen.getByTestId("input-fullName");
    const incomeStep1 = screen.getByTestId("input-annualIncome");
    const taxIdStep2 = screen.getByTestId("input-taxId");

    // Ordinary focus shift within Section 1 -> NOT a backtrack
    fireEvent.focusIn(fullNameStep1);
    fireEvent.focusOut(fullNameStep1);
    fireEvent.focusIn(incomeStep1);
    fireEvent.focusOut(incomeStep1);
    expect(screen.getByTestId("backtracks")).toHaveTextContent("0");

    // Move forward to Section 2 -> NOT a backtrack
    fireEvent.focusIn(taxIdStep2);
    fireEvent.focusOut(taxIdStep2);
    expect(screen.getByTestId("backtracks")).toHaveTextContent("0");

    // Move backward from Section 2 to Section 1 -> counts as 1 backtrack
    fireEvent.focusIn(fullNameStep1);
    expect(screen.getByTestId("backtracks")).toHaveTextContent("1");

    // Explicit wizard backtrack call -> counts as 2nd backtrack
    fireEvent.click(screen.getByTestId("btn-record-backtrack"));
    expect(screen.getByTestId("backtracks")).toHaveTextContent("2");
  });

  it("7. normalizes erratic cursor movement into a score bounded between 0 and 1", () => {
    render(<TelemetryHarness pointerSampleIntervalMs={10} />);
    const container = screen.getByTestId("telemetry-container");

    // Simulate rapid back-and-forth pointer reversals
    const coords = [0, 300, 10, 350, 5, 400, 0, 420, 10, 450];
    coords.forEach((x) => {
      act(() => {
        vi.advanceTimersByTime(25);
      });
      const moveEvent = new MouseEvent("pointermove", {
        bubbles: true,
        clientX: x,
        clientY: 100,
      });
      Object.defineProperty(moveEvent, "pointerType", { value: "mouse" });
      fireEvent(container, moveEvent);
    });

    const score = Number(screen.getByTestId("cursor-anomaly").textContent);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("8. expires old signals outside the rolling observation window and supports manual reset", () => {
    render(<TelemetryHarness observationWindowSeconds={10} />);
    const fullName = screen.getByTestId("input-fullName");

    fireEvent.focusIn(fullName);
    fireEvent.focusOut(fullName);
    expect(screen.getByTestId("focus-count")).toHaveTextContent("1");

    // Advance past the 10-second rolling window
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    expect(screen.getByTestId("focus-count")).toHaveTextContent("0");

    // Test manual resetTelemetry()
    fireEvent.click(screen.getByTestId("btn-record-error"));
    expect(screen.getByTestId("validation-errors")).toHaveTextContent("1");
    fireEvent.click(screen.getByTestId("btn-reset"));
    expect(screen.getByTestId("validation-errors")).toHaveTextContent("0");
  });

  it("9. cleans up active timers and listeners on component unmount without memory leaks", () => {
    const { unmount } = render(<TelemetryHarness hesitationThresholdMs={5000} />);
    const fullName = screen.getByTestId("input-fullName");

    fireEvent.focusIn(fullName);
    unmount();

    // Advancing timers after unmount must not throw or trigger state updates
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });

  it("10. respects disabled telemetry and revoked consent flags", () => {
    render(<TelemetryHarness enabled={false} consentGranted={false} />);
    const fullName = screen.getByTestId("input-fullName");
    const submitBtn = screen.getByTestId("btn-submit");

    fireEvent.focusIn(fullName);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(screen.getByTestId("btn-record-error"));

    expect(screen.getByTestId("focus-count")).toHaveTextContent("0");
    expect(screen.getByTestId("repeated-clicks")).toHaveTextContent("0");
    expect(screen.getByTestId("validation-errors")).toHaveTextContent("0");
  });

  it("11. gracefully handles touch pointer events and keyboard-only interactions", () => {
    render(<TelemetryHarness pointerSampleIntervalMs={10} />);
    const container = screen.getByTestId("telemetry-container");
    const fullName = screen.getByTestId("input-fullName");

    // Touch scrolling should never generate cursor anomaly scores
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      const touchMoveEvent = new MouseEvent("pointermove", {
        bubbles: true,
        clientX: i % 2 === 0 ? 0 : 400,
        clientY: 100,
      });
      Object.defineProperty(touchMoveEvent, "pointerType", { value: "touch" });
      fireEvent(container, touchMoveEvent);
    }
    expect(Number(screen.getByTestId("cursor-anomaly").textContent)).toBe(0);

    // Keyboard tab focus still tracks field focus accurately
    fireEvent.focusIn(fullName);
    expect(screen.getByTestId("focus-count")).toHaveTextContent("1");
  });

  it("12. never collects or exposes entered form values or sensitive strings in telemetry snapshots", () => {
    render(<TelemetryHarness />);
    const fullName = screen.getByTestId("input-fullName");

    fireEvent.focusIn(fullName);
    fireEvent.change(fullName, {
      target: { value: "SUPER_SECRET_BANK_ACCOUNT_987654321" },
    });
    fireEvent.focusOut(fullName);
    fireEvent.click(screen.getByTestId("btn-snapshot"));

    const serialized = screen.getByTestId("snapshot-json").textContent || "";
    expect(serialized).not.toContain("SUPER_SECRET_BANK_ACCOUNT_987654321");
    expect(serialized).toContain('"fieldFocusCount":1');
  });
});