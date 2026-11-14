export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : "");
  },
};