/**
 * Shared logger types and constants for preload and main process
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogMessage {
  level: LogLevel;
  message: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  source: string;
}

export const ALLOWED_LEVELS = Object.values(LogLevel);

export const MAX_MESSAGE_LENGTH = 10000; // 10KB max message length

export interface LogResult {
  success: boolean;
  error?: string;
}

/**
 * Validates if a log level is allowed
 */
export function isValidLogLevel(level: string): level is LogLevel {
  return ALLOWED_LEVELS.includes(level as LogLevel);
}

/**
 * Validates if an object is JSON serializable
 */
export function isJSONSerializable(obj: unknown): boolean {
  try {
    JSON.stringify(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes and validates log data before sending
 */
export function validateLogData(logData: Partial<LogMessage>): {
  isValid: boolean;
  error?: string;
  sanitizedData?: LogMessage;
} {
  // Check required fields
  if (!logData.level) {
    return { isValid: false, error: 'Log level is required' };
  }

  if (!logData.message) {
    return { isValid: false, error: 'Log message is required' };
  }

  if (!logData.source) {
    return { isValid: false, error: 'Log source is required' };
  }

  // Validate log level
  if (!isValidLogLevel(logData.level)) {
    return {
      isValid: false,
      error: `Invalid log level: ${logData.level}. Allowed levels: ${ALLOWED_LEVELS.join(', ')}`,
    };
  }

  // Validate message length
  if (typeof logData.message !== 'string') {
    return { isValid: false, error: 'Log message must be a string' };
  }

  if (logData.message.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Log message too long. Maximum length: ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  // Validate payload is JSON serializable
  if (logData.payload !== undefined && !isJSONSerializable(logData.payload)) {
    return { isValid: false, error: 'Log payload must be JSON serializable' };
  }

  // Create sanitized data
  const sanitizedData: LogMessage = {
    level: logData.level,
    message: logData.message.substring(0, MAX_MESSAGE_LENGTH), // Cap message length
    source: logData.source,
    timestamp: logData.timestamp || new Date().toISOString(),
    ...(logData.payload && { payload: logData.payload }),
  };

  return { isValid: true, sanitizedData };
}
