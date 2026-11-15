"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  FrictionLevel,
  InteractionStatus,
  UIAdaptationStatus,
} from "@auragen/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";
const DEMO_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

export function useTelemetrySocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [frictionScore, setFrictionScore] = useState<number>(0);
  const [frictionLevel, setFrictionLevel] = useState<FrictionLevel>("low");
  const [interactionStatus, setInteractionStatus] = useState<InteractionStatus>("Normal");
  const [adaptationStatus, setAdaptationStatus] = useState<UIAdaptationStatus>("Waiting");

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(WS_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("telemetry:acknowledged", (payload) => {
      setFrictionScore(payload.score);
      setFrictionLevel(payload.level);
      setInteractionStatus(payload.interactionStatus);
      setAdaptationStatus(payload.adaptationStatus);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const simulateHighFriction = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("telemetry:simulate_high_friction", {
        sessionId: DEMO_SESSION_ID,
      });
    } else {
      // Fallback local state update when running frontend standalone or during tests
      setFrictionScore(88);
      setFrictionLevel("high");
      setInteractionStatus("High Cognitive Load");
      setAdaptationStatus("Adapting");
    }
  }, []);

  const resetFriction = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("telemetry:reset_friction", {
        sessionId: DEMO_SESSION_ID,
      });
    } else {
      setFrictionScore(0);
      setFrictionLevel("low");
      setInteractionStatus("Normal");
      setAdaptationStatus("Waiting");
    }
  }, []);

  return {
    connected,
    frictionScore,
    frictionLevel,
    interactionStatus,
    adaptationStatus,
    simulateHighFriction,
    resetFriction,
  };
}