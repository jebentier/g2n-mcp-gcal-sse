import express from 'express';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { TokenManager } from '../auth/tokenManager.js';
import { OAuthHandler } from '../auth/oauthHandler.js';
import { GoogleCalendarService } from '../services/googleCalendar.js';
import { registerCalendarTools } from '../tools/calendarTools.js';
import { corsMiddleware } from '../middleware/index.js';
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

    this.logger.debug(`Iniciando construção do servidor ${serverName} v${serverVersion}`);
    this.logger.debug(`Configurações: PORT=${config.PORT}, HOST=${config.HOST}, URL=${config.PUBLIC_URL || 'não definida'}`);

    // Configurar o gerenciador de tokens
    this.logger.debug('Configurando TokenManager');
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
    
    this.logger.debug(`Configurando OAuthHandler com redirectUri: ${redirectUri}`);
    this.logger.debug(`Escopos OAuth: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"]`);

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
    this.logger.debug('Inicializando GoogleCalendarService');
    this.calendarService = new GoogleCalendarService(oauthHandler, tokenManager, this.logger);

    // Configurar middlewares
    this.logger.debug('Configurando middlewares Express');
    this.app.use(corsMiddleware);

    // Configurar rotas
    this.logger.debug('Configurando rotas Express');
    this.app.use('/', createRouter(
      this,
      this.calendarService,
      this.transports,
      this.serverName,
      this.serverVersion,
      this.logger
    ));
    
    this.logger.debug('Construção do servidor concluída');
  }

  public async start(port: string, host: string): Promise<void> {
    this.logger.debug(`Iniciando servidor na porta ${port} e host ${host}`);
    
    // Tentar inicializar o servidor MCP se já estiver autenticado
    try {
      this.logger.debug('Tentando inicializar GoogleCalendarService');
      const isInitialized = await this.calendarService.initialize();
      if (isInitialized) {
        this.logger.info('Serviço do Google Calendar inicializado com sucesso');
        this.logger.debug('Inicializando servidor MCP automaticamente');
        await this.initializeMcpServer();
        this.logger.info('Servidor MCP inicializado automaticamente');
      } else {
        const authUrl = this.calendarService.getAuthUrl();
        this.logger.info('Serviço do Google Calendar requer autenticação');
        this.logger.info(`URL de autenticação: ${authUrl}`);
        this.logger.debug('Redirecionando para autorização OAuth: ' + authUrl);
      }
    } catch (error) {
      this.logger.error('Erro ao tentar inicializar servidor MCP:');
      this.logger.error(error);
      this.logger.debug('Falha na inicialização automática, servidor será iniciado sem MCP');
    }

    return new Promise((resolve) => {
      this.logger.debug(`Configurando listener do Express na porta ${port}`);
      this.app.listen(parseInt(port), host, () => {
        this.logger.info(`Servidor ${this.serverName} v${this.serverVersion} iniciado em ${host}:${port}`);
        this.logger.debug('Servidor Express está em execução');
        resolve();
      });
    });
  }

  public async initializeMcpServer(): Promise<void> {
    this.logger.debug('Criando instância do McpServer');
    this.mcpServer = new McpServer({
      name: this.serverName,
      version: this.serverVersion,
    });

    this.logger.debug('Registrando ferramentas de calendário no servidor MCP');
    registerCalendarTools(this.mcpServer, this.calendarService, this.logger);
    this.logger.debug('Ferramentas de calendário registradas com sucesso');
  }

  public getMcpServer(): McpServer | undefined {
    this.logger.debug(`Obtendo instância do McpServer (${this.mcpServer ? 'inicializado' : 'não inicializado'})`);
    return this.mcpServer;
  }
} 