import { isProduction } from "@/config/env";

/**
 * Structured client logging. Deliberately thin — its value is that every log
 * carries the same shape, so swapping the sink for a real service later is
 * one file rather than a search for stray `console.log` calls.
 */

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

export interface LogContext {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  // Debug noise is useful while building and pure cost in production.
  if (isProduction && level === LogLevel.Debug) return;

  const payload = { level, message, ...context, at: new Date().toISOString() };
  if (level === LogLevel.Error) console.error(payload);
  else if (level === LogLevel.Warn) console.warn(payload);
  else console.info(payload);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit(LogLevel.Debug, message, context),
  info: (message: string, context?: LogContext) => emit(LogLevel.Info, message, context),
  warn: (message: string, context?: LogContext) => emit(LogLevel.Warn, message, context),
  error: (message: string, context?: LogContext) => emit(LogLevel.Error, message, context),
};
