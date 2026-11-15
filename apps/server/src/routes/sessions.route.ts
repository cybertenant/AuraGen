import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  UpsertFormDraftInputSchema,
  CreateFrictionEventInputSchema,
} from "@auragen/shared";
import {
  PersistenceRepository,
  DrizzlePersistenceRepository,
} from "../repositories/persistence.repository.js";
import { logger } from "../utils/logger.js";

const SessionIdParamSchema = z.object({
  sessionId: z.string().uuid({ message: "Invalid session UUID format" }),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function createSessionsRouter(
  repository: PersistenceRepository = new DrizzlePersistenceRepository()
): Router {
  const router: Router = Router();

  /**
   * A. POST /api/sessions
   * Generates a backend UUID session in Neon PostgreSQL.
   */
  router.post(
    "/",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await repository.createSession();
        logger.info("Created new AuraGen session", { sessionId: session.id });
        res.status(201).json({
          status: "ok",
          session,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * F. GET /api/sessions/:sessionId
   * Retrieves session metadata.
   */
  router.get(
    "/:sessionId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paramResult = SessionIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid session ID parameter",
            errors: paramResult.error.flatten().fieldErrors,
          });
          return;
        }

        const session = await repository.getSessionById(
          paramResult.data.sessionId
        );
        if (!session) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "Session not found",
          });
          return;
        }

        res.status(200).json({
          status: "ok",
          session,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * B. PUT /api/sessions/:sessionId/draft
   * Upserts the synthetic financial form draft (max 1 active draft per session)
   * and updates session.last_seen_at. Never logs form field values.
   */
  router.put(
    "/:sessionId/draft",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paramResult = SessionIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid session ID parameter",
            errors: paramResult.error.flatten().fieldErrors,
          });
          return;
        }

        const bodyResult = UpsertFormDraftInputSchema.safeParse(req.body);
        if (!bodyResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid form draft payload",
            errors: bodyResult.error.flatten(),
          });
          return;
        }

        const draft = await repository.upsertFormDraft(
          paramResult.data.sessionId,
          bodyResult.data
        );

        if (!draft) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "Session not found; cannot save draft",
          });
          return;
        }

        logger.info("Upserted form draft metadata", {
          sessionId: draft.sessionId,
          draftId: draft.id,
          schemaVersion: draft.schemaVersion,
          fieldCount: Object.keys(draft.formData).length,
        });

        res.status(200).json({
          status: "ok",
          draft,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * C. GET /api/sessions/:sessionId/draft
   * Retrieves the saved form draft for a session.
   */
  router.get(
    "/:sessionId/draft",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paramResult = SessionIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid session ID parameter",
            errors: paramResult.error.flatten().fieldErrors,
          });
          return;
        }

        const session = await repository.getSessionById(
          paramResult.data.sessionId
        );
        if (!session) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "Session not found",
          });
          return;
        }

        const draft = await repository.getFormDraft(paramResult.data.sessionId);
        if (!draft) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "No form draft found for this session",
          });
          return;
        }

        res.status(200).json({
          status: "ok",
          draft,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * D. POST /api/sessions/:sessionId/friction-events
   * Validates and stores aggregated interaction friction events.
   */
  router.post(
    "/:sessionId/friction-events",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paramResult = SessionIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid session ID parameter",
            errors: paramResult.error.flatten().fieldErrors,
          });
          return;
        }

        const bodyResult = CreateFrictionEventInputSchema.safeParse(req.body);
        if (!bodyResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid friction event payload",
            errors: bodyResult.error.flatten(),
          });
          return;
        }

        const event = await repository.createFrictionEvent(
          paramResult.data.sessionId,
          bodyResult.data
        );

        if (!event) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "Session not found; cannot record friction event",
          });
          return;
        }

        logger.info("Stored aggregated cognitive friction event", {
          sessionId: event.sessionId,
          eventId: event.id,
          frictionScore: event.frictionScore,
          frictionLevel: event.frictionLevel,
        });

        res.status(201).json({
          status: "ok",
          eventId: event.id,
          event,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * E. GET /api/sessions/:sessionId/friction-events
   * Retrieves bounded friction history sorted newest-first.
   */
  router.get(
    "/:sessionId/friction-events",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paramResult = SessionIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid session ID parameter",
            errors: paramResult.error.flatten().fieldErrors,
          });
          return;
        }

        const queryResult = HistoryQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Invalid query parameters",
            errors: queryResult.error.flatten().fieldErrors,
          });
          return;
        }

        const events = await repository.getFrictionEvents(
          paramResult.data.sessionId,
          queryResult.data.limit
        );

        if (events === null) {
          res.status(404).json({
            status: "error",
            statusCode: 404,
            message: "Session not found",
          });
          return;
        }

        res.status(200).json({
          status: "ok",
          count: events.length,
          events,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}