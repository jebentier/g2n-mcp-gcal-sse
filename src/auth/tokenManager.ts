import fs from 'fs';
import path from 'path';
import { Credentials } from 'google-auth-library';
import { ILogger } from '../utils/logger.js';

interface TokenManagerConfig {
  tokenStoragePath: string;
  tokenRefreshInterval: number; // in milliseconds
}

/**
 * Manages OAuth2 access and refresh tokens
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private tokens: Credentials | null = null;
  private tokenRefreshListener: ((credentials: Credentials) => Promise<void>) | null = null;
  private refreshTimerId: NodeJS.Timeout | null = null;
  private logger: ILogger;

  constructor(config: TokenManagerConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.logger.debug(`[TOKEN] Initialized | Storage: ${config.tokenStoragePath} | Interval: ${config.tokenRefreshInterval / 60000} min`);

    // Ensure the token directory exists
    const dir = path.dirname(this.config.tokenStoragePath);
    if (!fs.existsSync(dir)) {
      this.logger.debug(`[TOKEN] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Saves tokens to the file system
   */
  public async saveTokens(credentials: Credentials): Promise<void> {
    this.logger.debug(`[TOKEN] Saving | Expiration: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A'} | Refresh: ${credentials.refresh_token ? 'present' : 'absent'}`);

    try {
      this.tokens = credentials;
      const dir = path.dirname(this.config.tokenStoragePath);

      if (!fs.existsSync(dir)) {
        this.logger.debug(`[TOKEN] Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(credentials, null, 2)
      );

      this.logger.info(`[TOKEN] Successfully saved to ${this.config.tokenStoragePath}`);
    } catch (error) {
      this.logger.error('[TOKEN] Error saving:', error);
      throw error;
    }
  }

  /**
   * Loads tokens from the file system
   */
  public async getTokens(): Promise<Credentials | null> {
    try {
      if (this.tokens) {
        this.logger.debug('[TOKEN] Using in-memory tokens');
        return this.tokens;
      }

      this.logger.debug(`[TOKEN] Loading from ${this.config.tokenStoragePath}`);

      if (fs.existsSync(this.config.tokenStoragePath)) {
        const tokensData = await fs.promises.readFile(
          this.config.tokenStoragePath,
          'utf8'
        );

        this.tokens = JSON.parse(tokensData);

        if (this.tokens && this.tokens.expiry_date) {
          const expiryDate = new Date(this.tokens.expiry_date);
          this.logger.debug(`[TOKEN] Loaded | Expires at: ${expiryDate.toISOString()}`);
        }

        return this.tokens;
      }

      this.logger.debug('[TOKEN] File not found');
      return null;
    } catch (error) {
      this.logger.error('[TOKEN] Error loading:', error);
      this.tokens = null;
      return null;
    }
  }

  /**
   * Clears stored tokens
   */
  public async clearTokens(): Promise<void> {
    this.logger.debug('[TOKEN] Clearing tokens');

    try {
      this.tokens = null;

      if (fs.existsSync(this.config.tokenStoragePath)) {
        this.logger.debug(`[TOKEN] Removing file: ${this.config.tokenStoragePath}`);
        await fs.promises.unlink(this.config.tokenStoragePath);
      }

      this.logger.info('[TOKEN] Successfully removed');

      // Clears any active refresh timer
      if (this.refreshTimerId) {
        this.logger.debug('[TOKEN] Canceling refresh timer');
        clearTimeout(this.refreshTimerId);
        this.refreshTimerId = null;
      }
    } catch (error) {
      this.logger.error('[TOKEN] Error clearing:', error);
      throw error;
    }
  }

  /**
   * Checks if valid tokens are available
   */
  public async hasValidTokens(): Promise<boolean> {
    this.logger.debug('[TOKEN] Checking validity');

    try {
      const tokens = await this.getTokens();

      if (!tokens) {
        this.logger.debug('[TOKEN] No tokens found');
        return false;
      }

      const hasRefreshToken = !!tokens.refresh_token;

      // Checks if the access token is valid
      if (tokens.expiry_date) {
        const now = Date.now();
        const isValid = tokens.expiry_date > now;
        const timeRemaining = (tokens.expiry_date - now) / 1000 / 60; // in minutes

        this.logger.debug(`[TOKEN] Status: ${isValid ? 'valid' : 'expired'} | Refresh: ${hasRefreshToken ? 'yes' : 'no'} | Time remaining: ${timeRemaining.toFixed(2)}min`);

        // Consider valid if it has a refresh_token, even if the access_token is expired
        return hasRefreshToken;
      }

      this.logger.debug('[TOKEN] No expiration date, considering invalid');
      return false;
    } catch (error) {
      this.logger.error('[TOKEN] Error checking validity:', error);
      return false;
    }
  }

  /**
   * Sets up automatic token refresh
   */
  public setupTokenRefresh(listener: (credentials: Credentials) => Promise<void>): void {
    this.logger.debug('[TOKEN] Setting up automatic refresh');
    this.tokenRefreshListener = listener;

    // Cancels any existing timer
    if (this.refreshTimerId) {
      this.logger.debug('[TOKEN] Canceling previous timer');
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }

    const checkAndRefreshToken = async () => {
      try {
        const tokens = await this.getTokens();

        if (tokens && tokens.expiry_date && tokens.refresh_token) {
          const now = Date.now();
          const timeToExpiry = tokens.expiry_date - now;
          const timeToExpiryMinutes = timeToExpiry / 1000 / 60;
          const shouldRefresh = timeToExpiry < 15 * 60 * 1000; // Refresh if less than 15 minutes left

          this.logger.debug(`[TOKEN] Checking | Expires in: ${timeToExpiryMinutes.toFixed(2)}min | Refresh needed: ${shouldRefresh ? 'yes' : 'no'}`);

          if (shouldRefresh && this.tokenRefreshListener) {
            this.logger.debug('[TOKEN] Starting refresh');
            await this.tokenRefreshListener(tokens);
            this.logger.info('[TOKEN] Successfully updated');
          }
        } else if (!tokens) {
          this.logger.debug('[TOKEN] Not available for refresh');
        } else if (!tokens.refresh_token) {
          this.logger.debug('[TOKEN] Refresh token absent');
        } else if (!tokens.expiry_date) {
          this.logger.debug('[TOKEN] No expiration date');
        }
      } catch (error) {
        this.logger.error('[TOKEN] Error during refresh:', error);
      }

      // Schedules the next check
      const nextCheckMinutes = this.config.tokenRefreshInterval / 60000;
      this.logger.debug(`[TOKEN] Next check in ${nextCheckMinutes}min`);
      this.refreshTimerId = setTimeout(checkAndRefreshToken, this.config.tokenRefreshInterval);
    };

    // Starts the refresh cycle and immediately performs the first check
    this.logger.debug('[TOKEN] Starting refresh cycle');
    checkAndRefreshToken();
  }
}
