"use client";

import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@auragen/shared";

export type AuraGenClientSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let sharedSocket: AuraGenClientSocket | null = null;

export function getOrCreateSocketClient(): AuraGenClientSocket {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });
  }
  return sharedSocket;
}

export function resetSocketClientForTesting(): void {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}