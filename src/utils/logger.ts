import winston from 'winston';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import { Config } from '../config/config.js';
const { format, transports, createLogger } = winston;
const { combine, timestamp, printf, colorize, errors, splat } = format;

// Default npm log levels (RFC5424)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

// Adds colors to winston
winston.addColors(colors);

// Converts the configuration into an array of active levels
const parseLogLevels = (logLevelStr: string): string[] => {
  return logLevelStr
    .split(',')
    .map(l => l.trim().toLowerCase())
    .filter(l => l in levels);
};

// Gets the base log level from the configuration
const getBaseLevel = (logLevelStr: string): string => {
  const configLevels = parseLogLevels(logLevelStr);

  // If DEBUG is in the list, include all levels below it
  if (configLevels.includes('debug')) {
    return 'debug';
  }

  // If VERBOSE is in the list, include all levels below it
  if (configLevels.includes('verbose')) {
    return 'verbose';
  }

  // If HTTP is in the list, include all levels below it
  if (configLevels.includes('http')) {
    return 'http';
  }

  // Uses 'info' as the default base
  return 'info';
};

// Function to create a logger with specific configuration
export function createLoggerWithConfig(config: Config) {
  // Checks if a specific level is active
  const isLevelEnabled = (level: string): boolean => {
    const configLevels = parseLogLevels(config.LOG_LEVEL || '');

    if (!configLevels?.length) {
      // If no levels are defined, use the default levels
      return ['error', 'warn', 'info'].includes(level);
    }

    // If DEBUG is enabled, also enable debug, verbose, http, info, warn, and error
    if (configLevels.includes('debug')) {
      return ['error', 'warn', 'info', 'http', 'verbose', 'debug'].includes(level);
    }

    // If VERBOSE is enabled, also enable verbose, http, info, warn, and error
    if (configLevels.includes('verbose')) {
      return ['error', 'warn', 'info', 'http', 'verbose'].includes(level);
    }

    return configLevels.includes(level);
  };

  // Custom format for logs
  const customFormat = printf(info => {
    // Extracts basic information
    const { level, message, timestamp, stack, ...rest } = info;

    // Builds the base message
    let output = `${timestamp} ${level}: ${message}`;

    // Adds the stack trace if it exists
    if (stack) {
      output += `\n${stack}`;
    }

    // Adds extra metadata (if any)
    const metaKeys = Object.keys(rest).filter(key =>
      ![LEVEL, MESSAGE, SPLAT].includes(key as any)
    );

    if (metaKeys.length > 0) {
      const meta = metaKeys.reduce((obj, key) => {
        obj[key] = rest[key];
        return obj;
      }, {} as Record<string, any>);

      output += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return output;
  });

  // Creates the logger
  const logger = createLogger({
    level: getBaseLevel(config.LOG_LEVEL || ''), // Determines the base level
    levels,
    format: combine(
      errors({ stack: true }), // Captures stack traces
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      splat(), // Enables string interpolation with %s, %d, etc.
      colorize({ all: true }),
      customFormat
    ),
    transports: [
      new transports.Console({
        handleExceptions: true,
        handleRejections: true
      })
    ],
    exitOnError: false // Does not terminate the process in case of error
  });

  // Helper function to format non-string objects into strings
  const formatIfNeeded = (message: any): string => {
    if (message === null || message === undefined) {
      return String(message);
    }

    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message; // The stack trace will be added by the errors() format
    }

    if (typeof message === 'object') {
      return JSON.stringify(message);
    }

    return String(message);
  };

  // Logger interface
  interface ILogger {
    error(message: string, ...meta: any[]): void;
    error(message: any): void;
    warn(message: string, ...meta: any[]): void;
    warn(message: any): void;
    info(message: string, ...meta: any[]): void;
    info(message: any): void;
    http(message: string, ...meta: any[]): void;
    http(message: any): void;
    verbose(message: string, ...meta: any[]): void;
    verbose(message: any): void;
    debug(message: string, ...meta: any[]): void;
    debug(message: any): void;
    silly(message: string, ...meta: any[]): void;
    silly(message: any): void;
    profile(id: string, meta?: Record<string, any>): void;
    startTimer(): winston.Profiler;
    isLevelEnabled(level: string): boolean;
  }

  // Logger wrapper with argument handling
  const winstonLogger: ILogger = {
    error: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('error')) return;
      if (typeof message === 'string') {
        logger.error(message, ...meta);
      } else {
        logger.error(formatIfNeeded(message));
      }
    },
    warn: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('warn')) return;
      if (typeof message === 'string') {
        logger.warn(message, ...meta);
      } else {
        logger.warn(formatIfNeeded(message));
      }
    },
    info: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('info')) return;
      if (typeof message === 'string') {
        logger.info(message, ...meta);
      } else {
        logger.info(formatIfNeeded(message));
      }
    },
    http: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('http')) return;
      if (typeof message === 'string') {
        logger.http(message, ...meta);
      } else {
        logger.http(formatIfNeeded(message));
      }
    },
    verbose: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('verbose')) return;
      if (typeof message === 'string') {
        logger.verbose(message, ...meta);
      } else {
        logger.verbose(formatIfNeeded(message));
      }
    },
    debug: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('debug')) return;
      if (typeof message === 'string') {
        logger.debug(message, ...meta);
      } else {
        logger.debug(formatIfNeeded(message));
      }
    },
    silly: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('silly')) return;
      if (typeof message === 'string') {
        logger.silly(message, ...meta);
      } else {
        logger.silly(formatIfNeeded(message));
      }
    },
    profile: (id: string, meta?: Record<string, any>): void => {
      logger.profile(id, meta);
    },
    startTimer: (): winston.Profiler => {
      return logger.startTimer();
    },
    isLevelEnabled
  };

  return winstonLogger;
}

// Re-exports the ILogger interface
export interface ILogger {
  error(message: string, ...meta: any[]): void;
  error(message: any): void;
  warn(message: string, ...meta: any[]): void;
  warn(message: any): void;
  info(message: string, ...meta: any[]): void;
  info(message: any): void;
  http(message: string, ...meta: any[]): void;
  http(message: any): void;
  verbose(message: string, ...meta: any[]): void;
  verbose(message: any): void;
  debug(message: string, ...meta: any[]): void;
  debug(message: any): void;
  silly(message: string, ...meta: any[]): void;
  silly(message: any): void;
  profile(id: string, meta?: Record<string, any>): void;
  startTimer(): winston.Profiler;
  isLevelEnabled(level: string): boolean;
}

// Creates a basic logger for scenarios where config is unavailable
const defaultLogger = createLoggerWithConfig({
  PORT: '3001',
  HOST: '0.0.0.0',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  OAUTH_REDIRECT_PATH: '/oauth/callback',
  LOG_LEVEL: 'error,warn,info,debug'
});

export default defaultLogger;
