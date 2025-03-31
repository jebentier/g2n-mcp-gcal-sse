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

export class Server {
  private app: express.Application;
  private mcpServer: McpServer | undefined;
  private calendarService: GoogleCalendarService;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private readonly serverName: string;
  private readonly serverVersion: string;

  constructor(config: Config, serverName: string, serverVersion: string) {
    this.serverName = serverName;
    this.serverVersion = serverVersion;
    this.app = express();

    // Configurar o gerenciador de tokens
    const tokenManager = new TokenManager({
      tokenStoragePath: path.join(process.cwd(), 'data', 'tokens.json'),
      tokenRefreshInterval: 30 * 60 * 1000, // 30 minutos
    });

    // Configurar o manipulador OAuth
    const baseUrl = buildBaseUrl(config);
    const redirectPath = config.OAUTH_REDIRECT_PATH.startsWith('/') 
      ? config.OAUTH_REDIRECT_PATH 
      : `/${config.OAUTH_REDIRECT_PATH}`;
    
    const redirectUri = `${baseUrl}${redirectPath}`;

    const oauthHandler = new OAuthHandler({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
    }, tokenManager);

    // Inicializar o serviço do Google Calendar
    this.calendarService = new GoogleCalendarService(oauthHandler, tokenManager);

    // Configurar middlewares
    this.app.use(corsMiddleware);

    // Configurar rotas
    this.app.use('/', createRouter(
      this,
      this.calendarService,
      this.transports,
      this.serverName,
      this.serverVersion
    ));
  }

  public async start(port: string, host: string): Promise<void> {
    // Tentar inicializar o servidor MCP se já estiver autenticado
    try {
      const isInitialized = await this.calendarService.initialize();
      if (isInitialized) {
        console.log('Serviço do Google Calendar inicializado com sucesso');
        await this.initializeMcpServer();
        console.log('Servidor MCP inicializado automaticamente');
      } else {
        console.log('Serviço do Google Calendar requer autenticação');
      }
    } catch (error) {
      console.error('Erro ao tentar inicializar servidor MCP:', error);
    }

    return new Promise((resolve) => {
      this.app.listen(parseInt(port), host, () => {
        console.log(`Servidor ${this.serverName} v${this.serverVersion} iniciado em ${host}:${port}`);
        resolve();
      });
    });
  }

  public async initializeMcpServer(): Promise<void> {
    this.mcpServer = new McpServer({
      name: this.serverName,
      version: this.serverVersion,
    });

    registerCalendarTools(this.mcpServer, this.calendarService);
  }

  public getMcpServer(): McpServer | undefined {
    return this.mcpServer;
  }
} 