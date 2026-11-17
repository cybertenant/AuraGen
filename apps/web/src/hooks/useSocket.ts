"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  FrictionUpdatePayload,
  TelemetryAckPayload,
  TelemetryBatchPayload,
  ServerErrorPayload,
  SessionReadyPayload,
} from "@auragen/shared";
import {
  getOrCreateSocketClient,
  AuraGenClientSocket,
} from "@/lib/socket-client";

export type SocketConnectionStatus =
  | "Connected"
  | "Connecting"
  | "Reconnecting"
  | "Disconnected"
  | "Database unavailable";

export interface SocketActivityLogEntry {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

function formatLogTime(isoOrDate?: string): string {
  const date = isoOrDate ? new Date(isoOrDate) : new Date();
  return date.toTimeString().slice(0, 8);
}

export function useSocket(activeSessionId?: string | null) {
  const socketRef = useRef<AuraGenClientSocket | null>(null);
  const joinedSessionRef = useRef<string | null>(null);

  const [connected, setConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<SocketConnectionStatus>("Connecting");
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(null);
  const [latestFriction, setLatestFriction] =
    useState<FrictionUpdatePayload | null>(null);
  const [lastTelemetryAck, setLastTelemetryAck] =
    useState<TelemetryAckPayload | null>(null);
  const [socketError, setSocketError] = useState<ServerErrorPayload | null>(
    null
  );
  const [activityLog, setActivityLog] = useState<SocketActivityLogEntry[]>([]);

  const appendActivityLog = useCallback(
    (
      message: string,
      type: SocketActivityLogEntry["type"] = "info",
      timestampIso?: string
    ) => {
      setActivityLog((prev) => {
        const entry: SocketActivityLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: formatLogTime(timestampIso),
          message,
          type,
        };
        return [entry, ...prev].slice(0, 12);
      });
    },
    []
  );

  const joinSession = useCallback(
    (sessionId: string) => {
      const socket = socketRef.current;
      if (!socket || !sessionId) return;

      socket.emit?.("session:join", { sessionId });
    },
    []
  );

  const sendTelemetry = useCallback((batch: TelemetryBatchPayload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || !joinedSessionRef.current) {
      return false;
    }

    socket.emit?.("telemetry:batch", {
      observationWindowSeconds: batch.observationWindowSeconds,
      fieldFocusCount: batch.fieldFocusCount,
      hesitationCount: batch.hesitationCount,
      totalFieldFocusDurationMs: batch.totalFieldFocusDurationMs ?? 0,
      validationErrors: batch.validationErrors,
      repeatedClicks: batch.repeatedClicks,
      backtracks: batch.backtracks,
      cursorAnomalyScore: batch.cursorAnomalyScore,
    });
    return true;
  }, []);

  useEffect(() => {
    const socket = getOrCreateSocketClient();
    socketRef.current = socket;

    if (socket.connected) {
      setConnected(true);
      setConnectionStatus("Connected");
    }

    const handleConnect = () => {
      setConnected(true);
      setConnectionStatus("Connected");
      setSocketError(null);
      appendActivityLog("Socket.IO transport connected.", "info");

      if (activeSessionId) {
        socket.emit?.("session:join", { sessionId: activeSessionId });
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      setConnectionStatus("Disconnected");
      joinedSessionRef.current = null;
      setJoinedSessionId(null);
      appendActivityLog("Socket disconnected. Local telemetry active.", "warning");
    };

    const handleReconnectAttempt = () => {
      setConnectionStatus("Reconnecting");
      appendActivityLog("Attempting WebSocket reconnection...", "warning");
    };

    const handleSessionReady = (payload: SessionReadyPayload) => {
      joinedSessionRef.current = payload.sessionId;
      setJoinedSessionId(payload.sessionId);
      setSocketError(null);
      appendActivityLog(
        `Session ${payload.sessionId.slice(0, 8)}... connected.`,
        "success",
        payload.serverTimestamp
      );
    };

    const handleTelemetryAck = (payload: TelemetryAckPayload) => {
      setLastTelemetryAck(payload);
      if (!payload.databaseAvailable) {
        setConnectionStatus("Database unavailable");
      } else if (socket.connected) {
        setConnectionStatus("Connected");
      }

      if (payload.status === "processed") {
        appendActivityLog(
          `Telemetry batch received (${payload.processingTimeMs.toFixed(1)}ms).`,
          "info",
          payload.serverTimestamp
        );
        if (payload.persistedToDatabase) {
          appendActivityLog(
            "Friction snapshot saved to Neon.",
            "success",
            payload.serverTimestamp
          );
        }
      }
    };

    const handleFrictionUpdate = (payload: FrictionUpdatePayload) => {
      setLatestFriction(payload);
      if (!payload.databaseAvailable) {
        setConnectionStatus("Database unavailable");
      }
      appendActivityLog(
        `Friction score updated → ${Math.round(payload.smoothedScore)} (${payload.level.toUpperCase()}).`,
        payload.level === "high"
          ? "warning"
          : payload.level === "medium"
          ? "info"
          : "success",
        payload.timestamp
      );
    };

    const handleServerError = (payload: ServerErrorPayload) => {
      setSocketError(payload);
      if (payload.code === "DATABASE_UNAVAILABLE") {
        setConnectionStatus("Database unavailable");
      }
      appendActivityLog(
        `Server warning [${payload.code}]: ${payload.message}`,
        "error",
        payload.timestamp
      );
    };

    socket.on?.("connect", handleConnect);
    socket.on?.("disconnect", handleDisconnect);
    socket.io?.on?.("reconnect_attempt", handleReconnectAttempt);
    socket.on?.("session:ready", handleSessionReady);
    socket.on?.("telemetry:ack", handleTelemetryAck);
    socket.on?.("friction:update", handleFrictionUpdate);
    socket.on?.("server:error", handleServerError);

    return () => {
      socket.off?.("connect", handleConnect);
      socket.off?.("disconnect", handleDisconnect);
      socket.io?.off?.("reconnect_attempt", handleReconnectAttempt);
      socket.off?.("session:ready", handleSessionReady);
      socket.off?.("telemetry:ack", handleTelemetryAck);
      socket.off?.("friction:update", handleFrictionUpdate);
      socket.off?.("server:error", handleServerError);
    };
  }, [activeSessionId, appendActivityLog]);

  // Automatically join session when activeSessionId becomes available on an open socket
  useEffect(() => {
    const socket = socketRef.current;
    if (
      activeSessionId &&
      socket?.connected &&
      joinedSessionRef.current !== activeSessionId
    ) {
      socket.emit?.("session:join", { sessionId: activeSessionId });
    }
  }, [activeSessionId, connected]);

  return {
    connected,
    connectionStatus,
    joinedSessionId,
    joinSession,
    sendTelemetry,
    latestFriction,
    lastTelemetryAck,
    socketError,
    activityLog,
  };
}