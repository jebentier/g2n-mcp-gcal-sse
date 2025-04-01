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
  private readonly serverName: string;
  private readonly serverVersion: string;
  private logger: ILogger;

  constructor(config: Config, serverName: string, serverVersion: string, logger: ILogger) {
    this.serverName = serverName;
    this.serverVersion = serverVersion;
    this.logger = logger;
    this.app = express();

    this.logger.debug(`[INIT] Servidor ${serverName} v${serverVersion} | Configurações: PORT=${config.PORT}, HOST=${config.HOST}, URL=${config.PUBLIC_URL || 'não definida'}`);

    // Configurar o gerenciador de tokens
    const tokenManager = new TokenManager({
      tokenStoragePath: path.join(process.cwd(), 'data', 'tokens.json'),
      tokenRefreshInterval: 30 * 60 * 1000, // 30 minutos
    }, this.logger);

    // Configurar o manipulador OAuth
    const baseUrl = buildBaseUrl(config);
    const redirectPath = config.OAUTH_REDIRECT_PATH.startsWith('/') 
      ? config.OAUTH_REDIRECT_PATH 
      : `/${config.OAUTH_REDIRECT_PATH}`;
    
    const redirectUri = `${baseUrl}${redirectPath}`;
    
    this.logger.debug(`[OAUTH] Configurando handler com URI=${redirectUri} e escopos=["calendar", "calendar.events"]`);

    const oauthHandler = new OAuthHandler({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
    }, tokenManager, this.logger);

    // Inicializar o serviço do Google Calendar
    this.calendarService = new GoogleCalendarService(oauthHandler, tokenManager, this.logger);

    // Configurar middlewares e rotas
    this.app.use(express.json());
    this.app.use(corsMiddleware);
    this.app.use(requestLoggerMiddleware(this.logger));
    this.app.use('/', createRouter(
      this,
      this.calendarService,
      this.transports,
      this.serverName,
      this.serverVersion,
      this.logger
    ));
    
    this.logger.debug('[INIT] Servidor configurado com sucesso');
  }

  public async start(port: string, host: string): Promise<void> {
    this.logger.info(`[SERVER] Iniciando em ${host}:${port}`);
    
    // Tentar inicializar o servidor MCP se já estiver autenticado
    try {
      const isInitialized = await this.calendarService.initialize();
      if (isInitialized) {
        this.logger.info('[GCAL] Serviço inicializado com sucesso');
        await this.initializeMcpServer();
        this.logger.info('[MCP] Servidor inicializado automaticamente');
      } else {
        const authUrl = this.calendarService.getAuthUrl();
        this.logger.info('[GCAL] Autenticação necessária');
        this.logger.info(`[AUTH] URL: ${authUrl}`);
      }
    } catch (error) {
      this.logger.error('[MCP] Falha na inicialização:', error);
      this.logger.info('[SERVER] Iniciando sem integração MCP');
    }

    return new Promise((resolve) => {
      this.app.listen(parseInt(port), host, () => {
        this.logger.info(`[SERVER] ${this.serverName} v${this.serverVersion} em execução: http://${host}:${port}`);
        resolve();
      });
    });
  }

  public async initializeMcpServer(): Promise<void> {
    this.mcpServer = new McpServer({
      name: this.serverName,
      version: this.serverVersion,
    });

    this.logger.debug('[MCP] Registrando ferramentas de calendário');
    registerCalendarTools(this.mcpServer, this.calendarService, this.logger);
  }

  public getMcpServer(): McpServer | undefined {
    return this.mcpServer;
  }
} 