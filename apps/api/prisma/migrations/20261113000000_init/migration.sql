-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FrictionLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "InteractionEventType" AS ENUM ('REPEATED_CLICK', 'FIELD_FOCUS', 'FIELD_BLUR', 'HESITATION', 'VALIDATION_ERROR', 'NAVIGATION_BACKTRACK', 'HELP_REQUESTED', 'SECTION_COMPLETED', 'APPLICATION_COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "externalUserId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "currentSection" TEXT,
    "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallFrictionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frictionLevel" "FrictionLevel" NOT NULL DEFAULT 'LOW',
    "totalInteractionEvents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sectionId" TEXT NOT NULL,
    "fieldId" TEXT,
    "eventType" "InteractionEventType" NOT NULL,
    "eventMetadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friction_history" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sectionId" TEXT NOT NULL,
    "frictionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frictionLevel" "FrictionLevel" NOT NULL DEFAULT 'LOW',
    "repeatedClickScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hesitationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validationErrorScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "navigationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friction_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_externalUserId_key" ON "users"("externalUserId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_startedAt_idx" ON "sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "sessions_applicationStatus_idx" ON "sessions"("applicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_events_eventId_key" ON "interaction_events"("eventId");

-- CreateIndex
CREATE INDEX "interaction_events_sessionId_idx" ON "interaction_events"("sessionId");

-- CreateIndex
CREATE INDEX "interaction_events_userId_idx" ON "interaction_events"("userId");

-- CreateIndex
CREATE INDEX "interaction_events_timestamp_idx" ON "interaction_events"("timestamp");

-- CreateIndex
CREATE INDEX "interaction_events_eventType_idx" ON "interaction_events"("eventType");

-- CreateIndex
CREATE INDEX "interaction_events_sectionId_idx" ON "interaction_events"("sectionId");

-- CreateIndex
CREATE INDEX "interaction_events_sessionId_timestamp_idx" ON "interaction_events"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "friction_history_sessionId_idx" ON "friction_history"("sessionId");

-- CreateIndex
CREATE INDEX "friction_history_userId_idx" ON "friction_history"("userId");

-- CreateIndex
CREATE INDEX "friction_history_sectionId_idx" ON "friction_history"("sectionId");

-- CreateIndex
CREATE INDEX "friction_history_calculatedAt_idx" ON "friction_history"("calculatedAt");

-- CreateIndex
CREATE INDEX "friction_history_sessionId_calculatedAt_idx" ON "friction_history"("sessionId", "calculatedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friction_history" ADD CONSTRAINT "friction_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friction_history" ADD CONSTRAINT "friction_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
