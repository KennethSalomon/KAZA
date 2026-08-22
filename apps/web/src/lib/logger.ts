import { type SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  request_id?: string;
  timestamp: string;
  level: LogLevel;
  action: string;
  user_id?: string;
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeLog(level: LogLevel, action: string, options: {
  requestId?: string;
  userId?: string;
  message?: string;
  error?: Error | string;
  metadata?: Record<string, unknown>;
} = {}) {
  const entry: LogEntry = {
    request_id: options.requestId,
    timestamp: new Date().toISOString(),
    level,
    action,
    user_id: options.userId,
    message: options.message,
    error: options.error instanceof Error ? options.error.message : options.error,
    metadata: options.metadata,
  };

  const output = formatEntry(entry);

  if (isProduction) {
    // Send to Sentry for errors and warnings
    if (level === 'error' || level === 'warn') {
      Sentry.addBreadcrumb({
        category: 'log',
        message: action,
        level: level === 'error' ? 'error' : 'warning',
        data: {
          ...entry,
          metadata: undefined, // Don't duplicate in breadcrumb
        },
      });
      Sentry.captureMessage(action, {
        level: level === 'error' ? 'error' : 'warning',
        extra: entry.metadata,
      });
    }

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  } else {
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[36m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`${color}[${level.toUpperCase()}]${reset} ${action}`, options.message ? `- ${options.message}` : '', output);
  }
}

export const logger = {
  debug: (action: string, options?: { requestId?: string; userId?: string; message?: string; metadata?: Record<string, unknown> }) =>
    writeLog('debug', action, options),

  info: (action: string, options?: { requestId?: string; userId?: string; message?: string; metadata?: Record<string, unknown> }) =>
    writeLog('info', action, options),

  warn: (action: string, options?: { requestId?: string; userId?: string; message?: string; metadata?: Record<string, unknown> }) =>
    writeLog('warn', action, options),

  error: (action: string, options?: { requestId?: string; userId?: string; message?: string; error?: Error | string; metadata?: Record<string, unknown> }) =>
    writeLog('error', action, { ...options, error: options?.error }),
};

/** Helper to time an async operation and log its duration */
export async function timed<T>(
  action: string,
  fn: () => Promise<T>,
  options: { requestId?: string; userId?: string; metadata?: Record<string, unknown> } = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logger.info(action, { ...options, metadata: { ...options.metadata, duration_ms: Date.now() - start }, message: 'completed' });
    return result;
  } catch (err) {
    logger.error(action, { ...options, metadata: { ...options.metadata, duration_ms: Date.now() - start }, error: err as Error, message: 'failed' });
    throw err;
  }
}

/** Extract request ID from headers (middleware sets x-request-id) */
export function getRequestId(headers: Headers): string | undefined {
  return headers.get('x-request-id') ?? undefined;
}

/** Get user ID from Supabase auth context (if available) */
export async function getCurrentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}