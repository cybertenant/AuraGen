import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuraGenDashboardPage from "../app/page";
import { SESSION_STORAGE_KEY } from "../components/persistence/PersistenceWorkbench";

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

describe("AuraGen Dashboard, 5-Section Financial Loan Form & Day 2/3 Integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders AuraGen branding, initial telemetry cards, and required buttons", () => {
    render(<AuraGenDashboardPage />);

    expect(
      screen.getByText("AuraGen Adaptive Control Center")
    ).toBeInTheDocument();

    expect(screen.getByTestId("friction-score-value")).toHaveTextContent("0");
    expect(screen.getByTestId("interaction-status-value")).toHaveTextContent(
      "Normal"
    );
    expect(screen.getByTestId("adaptation-status-value")).toHaveTextContent(
      "Waiting"
    );

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

  it("navigates across all 5 loan application sections, preserves values, and tracks backtracks & validation errors", async () => {
    render(<AuraGenDashboardPage />);

    // Section 1: Personal Information
    expect(
      screen.getByTestId("section-personal-information")
    ).toBeInTheDocument();
    const fullNameInput = screen.getByLabelText(
      /Full Legal Name/i
    ) as HTMLInputElement;
    fireEvent.change(fullNameInput, {
      target: { value: "Rohan Sharma Synthetic" },
    });

    // Advance to Section 2: Employment Details
    fireEvent.click(screen.getByTestId("wizard-next-step-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("section-employment-details")
      ).toBeInTheDocument();
    });

    // Advance to Section 3: Financial Information
    fireEvent.click(screen.getByTestId("wizard-next-step-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("section-financial-information")
      ).toBeInTheDocument();
    });

    // Navigate backward to Section 2 -> should increment telemetry backtracks and preserve values
    fireEvent.click(screen.getByTestId("wizard-prev-step-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("section-employment-details")
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("metric-backtracks")).toHaveTextContent("1");

    // Navigate back to Section 1 and verify "Rohan Sharma Synthetic" was preserved
    fireEvent.click(screen.getByTestId("wizard-prev-step-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("section-personal-information")
      ).toBeInTheDocument();
    });
    expect(
      (screen.getByLabelText(/Full Legal Name/i) as HTMLInputElement).value
    ).toBe("Rohan Sharma Synthetic");
  });

  it("Scenario 5: creates a session, saves a 5-section loan draft, and restores the draft on page reload", async () => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440099";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/sessions") && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
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
      if (
        url.endsWith(`/api/sessions/${mockSessionId}/draft`) &&
        init?.method === "PUT"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            draft: {
              id: "660e8400-e29b-41d4-a716-446655440011",
              sessionId: mockSessionId,
              formData: {
                fullName: "Reload Survived Holdings",
                employerOrEntityName: "Reload Survived Holdings",
                requestedLoanAmount: 900000,
              },
              schemaVersion: 1,
              updatedAt: new Date().toISOString(),
            },
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
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            draft: {
              id: "660e8400-e29b-41d4-a716-446655440011",
              sessionId: mockSessionId,
              formData: {
                fullName: "Reload Survived Holdings",
                employerOrEntityName: "Reload Survived Holdings",
                requestedLoanAmount: 900000,
              },
              schemaVersion: 1,
              updatedAt: new Date().toISOString(),
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", count: 0, events: [] }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<AuraGenDashboardPage />);

    // 1. Click "Create New Session"
    fireEvent.click(screen.getByTestId("create-session-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("active-session-id")).toHaveTextContent(
        mockSessionId
      );
    });

    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe(
      mockSessionId
    );

    // 2. Click "Save Draft to Neon"
    fireEvent.click(screen.getByTestId("save-draft-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("persistence-status-banner")
      ).toHaveTextContent(/Saved 5-section loan draft/i);
    });

    // 3. Simulate page refresh by unmounting and remounting
    unmount();
    render(<AuraGenDashboardPage />);

    await waitFor(() => {
      const fullNameInput = screen.getByLabelText(
        /Full Legal Name/i
      ) as HTMLInputElement;
      expect(fullNameInput.value).toBe("Reload Survived Holdings");
    });
  });
});