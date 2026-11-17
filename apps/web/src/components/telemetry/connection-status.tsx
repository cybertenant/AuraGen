"use client";

import React from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type {
  SocketConnectionStatus,
  SocketActivityLogEntry,
} from "@/hooks/useSocket";
import type { TelemetryAckPayload, ServerErrorPayload } from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ConnectionStatusPanelProps {
  connectionStatus: SocketConnectionStatus;
  sessionId: string | null;
  lastTelemetryAck: TelemetryAckPayload | null;
  socketError: ServerErrorPayload | null;
  activityLog: SocketActivityLogEntry[];
}

export function ConnectionStatusPanel({
  connectionStatus,
  sessionId,
  lastTelemetryAck,
  socketError,
  activityLog,
}: ConnectionStatusPanelProps) {
  const badgeVariant =
    connectionStatus === "Connected"
      ? "default"
      : connectionStatus === "Connecting" || connectionStatus === "Reconnecting"
      ? "warning"
      : "danger";

  const abbreviatedSession = sessionId
    ? `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`
    : "No Active Session";

  return (
    <Card
      className="border-slate-800/90 bg-slate-900/75"
      data-testid="socket-connection-status-panel"
    >
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          {connectionStatus === "Connected" ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : connectionStatus === "Reconnecting" ||
            connectionStatus === "Connecting" ? (
            <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4 text-rose-400" />
          )}
          <div>
            <CardTitle className="text-slate-100 text-sm font-semibold">
              Day 5: Real-Time Socket.IO Pipeline &amp; Activity Stream
            </CardTitle>
            <p className="text-[11px] text-slate-400">
              Session Room:{" "}
              <code
                data-testid="socket-abbreviated-session"
                className="text-emerald-400 font-mono"
              >
                {abbreviatedSession}
              </code>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={badgeVariant}
            data-testid="socket-connection-status-badge"
          >
            {connectionStatus}
          </Badge>

          <Badge
            variant={
              lastTelemetryAck
                ? lastTelemetryAck.databaseAvailable
                  ? "default"
                  : "danger"
                : "neutral"
            }
            data-testid="socket-db-persistence-badge"
          >
            <Database className="mr-1 h-3 w-3" />
            {lastTelemetryAck
              ? lastTelemetryAck.databaseAvailable
                ? lastTelemetryAck.persistedToDatabase
                  ? "Neon Saved"
                  : "Neon Standby (Throttled)"
                : "Database unavailable"
              : "DB Ready"}
          </Badge>

          {lastTelemetryAck && (
            <Badge variant="neutral">
              <Clock className="mr-1 h-3 w-3" />
              {lastTelemetryAck.processingTimeMs.toFixed(1)}ms server calc
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {socketError && (
          <div
            role="alert"
            data-testid="socket-server-error-banner"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{socketError.code}:</strong> {socketError.message}
            </span>
          </div>
        )}

        <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800/80">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              Live Telemetry &amp; Friction Activity Log
            </span>
            <span>
              Last Ack:{" "}
              {lastTelemetryAck
                ? new Date(lastTelemetryAck.serverTimestamp)
                    .toTimeString()
                    .slice(0, 8)
                : "Waiting for interaction"}
            </span>
          </div>

          <div
            data-testid="socket-activity-log"
            className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px]"
          >
            {activityLog.length === 0 ? (
              <div className="text-slate-500 py-1">
                No real-time events logged yet. Create or join a session and
                interact with the form.
              </div>
            ) : (
              activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-slate-300"
                >
                  <span className="text-slate-500 shrink-0">{entry.time}</span>
                  <span>—</span>
                  <span
                    className={
                      entry.type === "error"
                        ? "text-rose-400"
                        : entry.type === "warning"
                        ? "text-amber-300"
                        : entry.type === "success"
                        ? "text-emerald-400"
                        : "text-slate-300"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}