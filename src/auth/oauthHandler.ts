import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { TokenManager } from './tokenManager.js';
import { ILogger } from '../utils/logger.js';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export class OAuthHandler {
  private client: OAuth2Client;
  private config: OAuthConfig;
  private tokenManager: TokenManager;
  private logger: ILogger;

  constructor(config: OAuthConfig, tokenManager: TokenManager, logger: ILogger) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.logger = logger;

    this.logger.debug(`[OAUTH] Initializing | Callback URI: ${config.redirectUri} | Scopes: ${config.scopes.join(', ')}`);

    this.client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    this.logger.debug('[OAUTH] Client successfully created');
  }

  /**
   * Generates the authorization URL to start the OAuth flow
   */
  public generateAuthUrl(): string {
    this.logger.debug('[OAUTH] Generating authorization URL');

    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'  // Forces the consent prompt to always obtain a refresh token
    });

    this.logger.debug(`[OAUTH] URL generated: ${authUrl}`);
    return authUrl;
  }

  /**
   * Exchanges the authorization code for access and refresh tokens
   */
  public async exchangeCode(code: string): Promise<any> {
    this.logger.debug(`[OAUTH] Exchanging code (partial: ${code.substring(0, 10)}...) for tokens`);

    try {
      const { tokens } = await this.client.getToken(code);

      this.logger.debug(`[OAUTH] Tokens received | Access: ${tokens.access_token?.substring(0, 10)}... | Refresh: ${tokens.refresh_token ? 'present' : 'absent'} | Expiration: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'}`);

      if (!tokens.refresh_token) {
        this.logger.error('[OAUTH] No refresh token returned');
        throw new Error('No refresh token returned. Ensure the request includes prompt=consent');
      }

      // Stores the tokens in the token manager
      this.logger.debug('[OAUTH] Saving tokens');
      await this.tokenManager.saveTokens(tokens);

      this.logger.debug('[OAUTH] Setting up client');
      this.client.setCredentials(tokens);

      this.logger.debug('[OAUTH] Exchange successfully completed');
      return tokens;
    } catch (error) {
      this.logger.error('[OAUTH] Error exchanging code for tokens:', error);
      throw error;
    }
  }

  /**
   * Sets up the OAuth client with existing tokens
   */
  public async setupClientWithTokens(): Promise<OAuth2Client> {
    this.logger.debug('[OAUTH] Setting up client with existing tokens');

    try {
      // Attempts to retrieve saved tokens
      const tokens = await this.tokenManager.getTokens();

      if (!tokens) {
        this.logger.error('[OAUTH] Tokens not found');
        throw new Error('No saved tokens. The user needs to authorize first.');
      }

      let timeToExpiry = 0;
      if (tokens.expiry_date) {
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        timeToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60);
      }

      this.logger.debug(`[OAUTH] Tokens loaded | Access: ${tokens.access_token?.substring(0, 10)}... | Refresh: ${tokens.refresh_token ? 'present' : 'absent'} | Expiration: ${timeToExpiry}min`);

      this.client.setCredentials(tokens);
      this.logger.debug('[OAUTH] Client successfully set up');
      return this.client;
    } catch (error) {
      this.logger.error('[OAUTH] Error setting up client:', error);
      throw error;
    }
  }

  /**
   * Revokes the current tokens
   */
  public async revokeTokens(): Promise<void> {
    this.logger.debug('[OAUTH] Starting token revocation');

    try {
      const tokens = await this.tokenManager.getTokens();

      if (tokens && tokens.access_token) {
        this.logger.debug(`[OAUTH] Revoking access token: ${tokens.access_token.substring(0, 10)}...`);
        await this.client.revokeToken(tokens.access_token);
        this.logger.debug('[OAUTH] Access token revoked');
      } else {
        this.logger.debug('[OAUTH] No access token to revoke');
      }

      this.logger.debug('[OAUTH] Clearing tokens in TokenManager');
      await this.tokenManager.clearTokens();

      this.logger.debug('[OAUTH] Revocation completed');
    } catch (error) {
      this.logger.error('[OAUTH] Error revoking tokens:', error);
      throw error;
    }
  }

  /**
   * Gets the configured OAuth client
   */
  public getClient(): OAuth2Client {
    return this.client;
  }
}
