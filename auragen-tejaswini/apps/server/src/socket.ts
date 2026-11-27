import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import {
  FrictionSignalsSchema,
  computeFrictionScore,
  frictionLevel,
  sanitizeForAi,
} from "@tejaswini/shared";
import { generateUi, type UiGenerator } from "./ai/generator.js";
import { config } from "./config.js";

interface JoinPayload {
  sessionId?: unknown;
  fieldIds?: unknown;
}

/** Real-time friction telemetry and adaptation events. */
export function attachSockets(server: HttpServer, generator: UiGenerator) {
  const io = new SocketServer(server, {
    cors: { origin: config.corsOrigin },
  });

  io.on("connection", (socket: Socket) => {
    let sessionId = socket.id;
    let fieldIds: string[] = [];

    socket.on("session:join", (payload: JoinPayload) => {
      if (typeof payload?.sessionId === "string") sessionId = payload.sessionId;
      if (Array.isArray(payload?.fieldIds)) {
        fieldIds = payload.fieldIds
          .filter((value): value is string => typeof value === "string")
          .slice(0, 20);
      }
    });

    socket.on("telemetry:signal", async (payload: unknown) => {
      const parsed = FrictionSignalsSchema.safeParse(payload);
      if (!parsed.success) return;

      const score = computeFrictionScore(parsed.data);
      socket.emit("friction:score", { score, level: frictionLevel(score) });

      if (score >= 65 && fieldIds.length > 0) {
        try {
          // Only IDs and metadata cross this boundary - never field values.
          const context = sanitizeForAi(sessionId, score, fieldIds);
          const ui = await generateUi(context, generator);
          socket.emit("ui:adapted", ui);
        } catch {
          socket.emit("ui:adaptation-failed", { message: "Schema rejected" });
        }
      }
    });
  });

  return io;
}
