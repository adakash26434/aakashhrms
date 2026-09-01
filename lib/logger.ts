/**
 * Structured logging utility.
 *
 * Designed for cPanel/Passenger shared hosting — outputs to stdout/stderr
 * (captured by Passenger logs). No external dependencies.
 *
 * In development: pretty-prints with color hints.
 * In production: outputs JSON lines for log aggregation.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Payroll generated', { runId, employeeCount });
 *   logger.error('DB connection failed', { error: err.message });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const appId = 'aakash-hrms';

  if (process.env.NODE_ENV === 'production') {
    // JSON lines for log aggregation (Loki, Datadog, etc.)
    return JSON.stringify({
      timestamp,
      level,
      app: appId,
      message,
      ...context,
    });
  }

  // Dev: human-readable
  const ctxStr = context && Object.keys(context).length > 0
    ? ' ' + JSON.stringify(context)
    : '';
  const levelTag = level.toUpperCase().padEnd(5);
  return `[${timestamp}] ${levelTag} ${message}${ctxStr}`;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) return;

  const formatted = formatLog(level, message, context);

  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
};

/**
 * Wraps an async function with error logging.
 * Returns the result on success, logs and re-throws on error.
 */
export async function withLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext,
): Promise<T> {
  logger.info(`${operation} started`, context);
  try {
    const result = await fn();
    logger.info(`${operation} completed`, context);
    return result;
  } catch (error) {
    logger.error(`${operation} failed`, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
