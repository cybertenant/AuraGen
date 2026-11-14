import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuraGenDashboardPage from "../app/page";

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

describe("AuraGen Dashboard Day 1 Requirements", () => {
  it("renders AuraGen branding, initial telemetry cards, and required buttons", () => {
    render(<AuraGenDashboardPage />);

    expect(
      screen.getByText("AuraGen Adaptive Control Center")
    ).toBeInTheDocument();

    // Initial Card Values
    expect(screen.getByTestId("friction-score-value")).toHaveTextContent("0");
    expect(screen.getByTestId("interaction-status-value")).toHaveTextContent(
      "Normal"
    );
    expect(screen.getByTestId("adaptation-status-value")).toHaveTextContent(
      "Waiting"
    );

    // Required Buttons
    expect(
      screen.getByRole("button", { name: /Open Financial Application/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Simulate High Friction/i })
    ).toBeInTheDocument();
  });

  it("updates telemetry cards when Simulate High Friction is clicked", () => {
    render(<AuraGenDashboardPage />);

    const simulateBtn = screen.getByRole("button", {
      name: /Simulate High Friction/i,
    });
    fireEvent.click(simulateBtn);

    expect(screen.getByTestId("friction-score-value")).toHaveTextContent("88");
    expect(screen.getByTestId("interaction-status-value")).toHaveTextContent(
      "High Cognitive Load"
    );
    expect(screen.getByTestId("adaptation-status-value")).toHaveTextContent(
      "Adapting"
    );
  });
});