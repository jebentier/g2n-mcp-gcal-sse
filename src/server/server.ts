import express from 'express';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { TokenManager } from '../auth/tokenManager.js';
import { OAuthHandler } from '../auth/oauthHandler.js';
import { GoogleCalendarService } from '../services/googleCalendar.js';
import { registerCalendarTools } from '../tools/calendarTools.js';
import { corsMiddleware, requestLoggerMiddleware } from '../middleware/index.js';
import { createRouter } from '../routes/index.js';
import { Config, buildBaseUrl } from '../config/config.js';
import { ILogger } from '../utils/logger.js';

export class Server {
  private app: express.Application;
  private mcpServer: McpServer | undefined;
  private calendarService: GoogleCalendarService;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private heartbeatIntervals: { [sessionId: string]: NodeJS.Timeout } = {};
  private readonly serverName: string;
  private readonly serverVersion: string;
  private logger: ILogger;

  constructor(config: Config, serverName: string, serverVersion: string, logger: ILogger) {
    this.serverName = serverName;
    this.serverVersion = serverVersion;
    this.logger = logger;
    this.app = express();

    this.logger.debug(`[INIT] Server ${serverName} v${serverVersion} | Configurations: PORT=${config.PORT}, HOST=${config.HOST}, URL=${config.PUBLIC_URL || 'not defined'}`);

    // Configure the token manager
    const tokenManager = new TokenManager({
      tokenStoragePath: path.join(process.cwd(), 'data', 'tokens.json'),
      tokenRefreshInterval: 30 * 60 * 1000, // 30 minutes
    }, this.logger);

    // Configure the OAuth handler
    const baseUrl = buildBaseUrl(config);
    const redirectPath = config.OAUTH_REDIRECT_PATH.startsWith('/')
      ? config.OAUTH_REDIRECT_PATH
      : `/${config.OAUTH_REDIRECT_PATH}`;

    const redirectUri = `${baseUrl}${redirectPath}`;

    this.logger.debug(`[OAUTH] Configuring handler with URI=${redirectUri} and scopes=["calendar", "calendar.events"]`);

    const oauthHandler = new OAuthHandler({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
    }, tokenManager, this.logger);

    // Initialize the Google Calendar service
    this.calendarService = new GoogleCalendarService(oauthHandler, tokenManager, this.logger);

    // Configure middlewares and routes
    this.app.use(express.json());
    this.app.use(corsMiddleware);
    this.app.use(requestLoggerMiddleware(this.logger));
    this.app.use('/', createRouter(
      this,
      this.calendarService,
      this.transports,
      this.serverName,
      this.serverVersion,
      this.logger,
      this.heartbeatIntervals
    ));

    this.logger.debug('[INIT] Server successfully configured');
  }

  public async start(port: string, host: string): Promise<void> {
    this.logger.info(`[SERVER] Starting at ${host}:${port}`);

    // Attempt to initialize the MCP server if already authenticated
    try {
      const isInitialized = await this.calendarService.initialize();
      if (isInitialized) {
        this.logger.info('[GCAL] Service successfully initialized');
        await this.initializeMcpServer();
        this.logger.info('[MCP] Server automatically initialized');
      } else {
        const authUrl = this.calendarService.getAuthUrl();
        this.logger.info('[GCAL] Authentication required');
        this.logger.info(`[AUTH] URL: ${authUrl}`);
      }
    } catch (error) {
      this.logger.error('[MCP] Initialization failed:', error);
      this.logger.info('[SERVER] Starting without MCP integration');
    }

    return new Promise((resolve) => {
      this.app.listen(parseInt(port), host, () => {
        this.logger.info(`[SERVER] ${this.serverName} v${this.serverVersion} running at: http://${host}:${port}`);
        resolve();
      });
    });
  }

  public async initializeMcpServer(): Promise<void> {
    this.mcpServer = new McpServer({
      name: this.serverName,
      version: this.serverVersion,
    });

    this.logger.debug('[MCP] Registering calendar tools');
    registerCalendarTools(this.mcpServer, this.calendarService, this.logger);
  }

  public getMcpServer(): McpServer | undefined {
    return this.mcpServer;
  }
}
