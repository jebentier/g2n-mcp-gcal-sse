import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { OAuthHandler } from '../auth/oauthHandler.js';
import { TokenManager } from '../auth/tokenManager.js';
import { ILogger } from '../utils/logger.js';
import {
  ListEventsParams,
  GetCalendarParams,
  GetEventParams,
  CreateEventParams,
  UpdateEventParams,
  DeleteEventParams,
  ListColorsParams
} from '../types/index.js';

/**
 * Service to interact with the Google Calendar API
 */
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private oauthHandler: OAuthHandler;
  private tokenManager: TokenManager;
  private logger: ILogger;

  constructor(oauthHandler: OAuthHandler, tokenManager: TokenManager, logger: ILogger) {
    this.oauthHandler = oauthHandler;
    this.tokenManager = tokenManager;
    this.logger = logger;
    this.logger.debug('[GCAL] Service instantiated');
  }

  /**
   * Initializes the Google Calendar API client
   */
  public async initialize(): Promise<boolean> {
    this.logger.debug('[GCAL] Initializing client');

    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`[GCAL] Tokens available: ${hasTokens ? 'yes' : 'no'}`);

      if (!hasTokens) {
        this.logger.debug('[GCAL] No valid tokens, initialization canceled');
        return false;
      }

      await this.setupClientWithTokens();

      // Sets up the listener for token refresh
      this.logger.debug('[GCAL] Setting up automatic token refresh');
      this.tokenManager.setupTokenRefresh(async (tokens) => {
        this.logger.debug('[GCAL] Executing token refresh');
        await this.refreshAccessToken(tokens);
      });

      this.logger.debug('[GCAL] Client successfully initialized');
      return true;
    } catch (error) {
      this.logger.error('[GCAL] Initialization error:', error);
      return false;
    }
  }

  /**
   * Checks if the service is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    this.logger.debug('[GCAL] Checking authentication');
    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`[GCAL] Status: ${hasTokens ? 'authenticated' : 'not authenticated'}`);
      return hasTokens;
    } catch (error) {
      this.logger.error('[GCAL] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Refreshes the access token using the refresh token
   */
  public async refreshAccessToken(tokens: any): Promise<void> {
    this.logger.debug('[GCAL] Starting token refresh');

    try {
      if (!tokens.refresh_token) {
        this.logger.error('[GCAL] Refresh token not available');
        throw new Error('Refresh token not available');
      }

      this.logger.debug('[GCAL] Obtaining new access token');
      const client = this.oauthHandler.getClient();
      client.setCredentials(tokens);
      const newTokens = await client.refreshAccessToken();

      // Preserve the refresh_token which may not be returned in every refresh
      if (!newTokens.credentials.refresh_token && tokens.refresh_token) {
        this.logger.debug('[GCAL] Preserving original refresh token');
        newTokens.credentials.refresh_token = tokens.refresh_token;
      }

      this.logger.debug('[GCAL] Saving updated tokens');
      await this.tokenManager.saveTokens(newTokens.credentials);

      this.logger.debug('[GCAL] Setting up client with new tokens');
      await this.setupClientWithTokens();

      this.logger.debug('[GCAL] Token successfully updated');
    } catch (error) {
      this.logger.error('[GCAL] Error updating token:', error);
      throw error;
    }
  }

  /**
   * Sets up the API client with existing tokens
   */
  private async setupClientWithTokens(): Promise<void> {
    this.logger.debug('[GCAL] Setting up client with tokens');

    try {
      const tokens = await this.tokenManager.getTokens();

      if (!tokens) {
        this.logger.error('[GCAL] Tokens not found');
        throw new Error('Tokens not found');
      }

      this.logger.debug('[GCAL] Creating API client');
      const auth = this.oauthHandler.getClient();
      auth.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.debug('[GCAL] Client successfully configured');
    } catch (error) {
      this.logger.error('[GCAL] Error setting up client:', error);
      throw error;
    }
  }

  /**
   * Processes the authorization code received from the OAuth callback
   */
  public async handleAuthCode(code: string): Promise<void> {
    this.logger.debug('[GCAL] Processing authorization code');

    try {
      this.logger.debug('[GCAL] Exchanging code for tokens');
      const tokens = await this.oauthHandler.exchangeCode(code);

      this.logger.debug('[GCAL] Code successfully exchanged');
      await this.tokenManager.saveTokens(tokens);

      this.logger.debug('[GCAL] Setting up client');
      await this.setupClientWithTokens();

      this.logger.debug('[GCAL] Authorization successfully processed');
    } catch (error) {
      this.logger.error('[GCAL] Error processing code:', error);
      throw error;
    }
  }

  /**
   * Gets the URL for OAuth authentication
   */
  public getAuthUrl(): string {
    this.logger.debug('[GCAL] Generating authentication URL');
    const authUrl = this.oauthHandler.generateAuthUrl();
    this.logger.debug(`[GCAL] URL generated: ${authUrl}`);
    return authUrl;
  }

  /**
   * Revokes the current access
   */
  public async revokeAccess(): Promise<void> {
    this.logger.debug('[GCAL] Starting access revocation');

    try {
      const tokens = await this.tokenManager.getTokens();

      if (tokens && tokens.access_token) {
        this.logger.debug('[GCAL] Revoking tokens');
        await this.oauthHandler.revokeTokens();
      }

      this.logger.debug('[GCAL] Clearing local tokens');
      await this.tokenManager.clearTokens();

      this.calendar = null;
      this.logger.info('[GCAL] Access successfully revoked');
    } catch (error) {
      this.logger.error('[GCAL] Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Lists all available calendars
   */
  public async listCalendars(): Promise<calendar_v3.Schema$CalendarList> {
    this.logger.debug('[GCAL] Listing calendars');

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting calendarList.list');
      const response = await this.calendar.calendarList.list();
      this.logger.debug(`[GCAL] Found ${response.data.items?.length || 0} calendars`);
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Error listing calendars:', error);
      throw error;
    }
  }

  /**
   * Gets details of a specific calendar
   */
  public async getCalendar(calendarId: string): Promise<calendar_v3.Schema$Calendar> {
    this.logger.debug(`[GCAL] Getting calendar: ${calendarId}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting calendars.get');
      const response = await this.calendar.calendars.get({ calendarId });
      this.logger.debug(`[GCAL] Retrieved: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Error getting calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Lists events from a calendar
   */
  public async listEvents(params: {
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    singleEvents?: boolean,
    orderBy?: string
  }): Promise<calendar_v3.Schema$Events> {
    this.logger.debug(`[GCAL] Listing events | Calendar: ${params.calendarId} | Filters: ${JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: params.maxResults,
      q: params.q,
      singleEvents: params.singleEvents,
      orderBy: params.orderBy
    })}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting events.list');
      const response = await this.calendar.events.list(params);
      this.logger.debug(`[GCAL] Found ${response.data.items?.length || 0} events`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Error listing events from calendar ${params.calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Gets details of a specific event
   */
  public async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Getting event | ID: ${eventId} | Calendar: ${calendarId}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting events.get');
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });

      this.logger.debug(`[GCAL] Event retrieved: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Error getting event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new event in the calendar
   */
  public async createEvent(calendarId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Creating event | Calendar: ${calendarId} | Summary: ${eventData.summary || 'N/A'}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting events.insert');
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData
      });

      this.logger.debug(`[GCAL] Event created | ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Error creating event:', error);
      throw error;
    }
  }

  /**
   * Updates an existing event
   */
  public async updateEvent(calendarId: string, eventId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Updating event | ID: ${eventId} | Calendar: ${calendarId}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting events.update');
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData
      });

      this.logger.debug(`[GCAL] Event updated | ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Error updating event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes an event from the calendar
   */
  public async deleteEvent(calendarId: string, eventId: string, sendUpdates?: string): Promise<any> {
    this.logger.debug(`[GCAL] Deleting event | ID: ${eventId} | Calendar: ${calendarId} | Notifications: ${sendUpdates || 'default'}`);

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting events.delete');
      const response = await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates
      });

      this.logger.debug('[GCAL] Event successfully deleted');
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Error deleting event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Lists available colors for events and calendars
   */
  public async listColors(): Promise<calendar_v3.Schema$Colors> {
    this.logger.debug('[GCAL] Listing available colors');

    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Client not initialized');
        throw new Error('Calendar client not initialized');
      }

      this.logger.debug('[GCAL] Requesting colors.get');
      const response = await this.calendar.colors.get({});
      this.logger.debug('[GCAL] Colors successfully retrieved');
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Error listing colors:', error);
      throw error;
    }
  }
}
