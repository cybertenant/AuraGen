export type Answer = string | boolean;

export interface SessionRecord {
  id: string;
  createdAt: number;
  answers: Record<string, Answer>;
}

const sessions = new Map<string, SessionRecord>();

export function createSession(id: string): SessionRecord {
  const session: SessionRecord = { id, createdAt: Date.now(), answers: {} };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionRecord | undefined {
  return sessions.get(id);
}

export function recordAnswer(
  sessionId: string,
  fieldId: string,
  value: Answer
): SessionRecord | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  session.answers[fieldId] = value;
  return session;
}

export function clearSessions(): void {
  sessions.clear();
}
