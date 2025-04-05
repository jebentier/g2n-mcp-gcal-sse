import { z } from 'zod';
import defaultLogger, { ILogger } from '../utils/logger.js';

// Configuration schema definition
export const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_REDIRECT_PATH: z.string().default('/oauth/callback'),
  PUBLIC_URL: z.string().optional(),
  // Log levels separated by commas (error,warn,info,http,verbose,debug,silly)
  // Use 'debug' to enable all debug logs and lower levels
  LOG_LEVEL: z.string().default('error,warn,info'),
});

export type Config = z.infer<typeof ConfigSchema>;

// Function to load environment configurations
export const loadConfig = (logger: ILogger = defaultLogger): Config => {
  try {
    const config = ConfigSchema.parse({
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_PATH: process.env.OAUTH_REDIRECT_PATH,
      PUBLIC_URL: process.env.PUBLIC_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
    });

    logger.debug(`[CONFIG] Loaded | PORT=${config.PORT}, HOST=${config.HOST}, LOG_LEVEL=${config.LOG_LEVEL}`);

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[CONFIG] Validation error:');
      error.errors.forEach(err => {
        logger.error(`[CONFIG] Field ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      logger.error('[CONFIG] Error loading:', error);
    }
    process.exit(1);
  }
};

/**
 * Builds the base URL for the server.
 * This URL is crucial for the Google OAuth flow, as it is used as part of the callback.
 *
 * The function follows this logic:
 * 1. If PUBLIC_URL is defined, use it (adding protocol if necessary)
 * 2. If running locally (HOST=0.0.0.0), use localhost
 * 3. Otherwise, use the configured HOST
 *
 * It is important that the final URL contains the correct protocol (http/https) and
 * does not point to localhost in a production environment.
 */
export const buildBaseUrl = (config: Config, logger: ILogger = defaultLogger): string => {
  let baseUrl: string;

  if (config.PUBLIC_URL) {
    const publicUrl = config.PUBLIC_URL.trim();

    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      baseUrl = publicUrl;
    } else {
      baseUrl = `https://${publicUrl}`;
      logger.warn(`[URL] Protocol not specified in PUBLIC_URL, using HTTPS: ${baseUrl}`);
      logger.warn(`[URL] To use HTTP, set PUBLIC_URL=http://${publicUrl}`);
    }
  } else if (config.HOST === '0.0.0.0') {
    baseUrl = `http://localhost:${config.PORT}`;
    logger.debug(`[URL] Local mode detected: ${baseUrl}`);
  } else {
    const host = config.HOST.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      baseUrl = `${host}:${config.PORT}`;
    } else {
      baseUrl = `http://${host}:${config.PORT}`;
    }
    logger.debug(`[URL] Using configured host: ${baseUrl}`);
  }

  // Remove trailing slash if it exists
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  logger.debug(`[URL] Final base: ${baseUrl}`);

  return baseUrl;
};
