import express, { Request, Response } from 'express';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GoogleCalendarService } from './services/googleCalendar.js';
import { registerCalendarTools } from './tools/calendarTools.js';
import { TokenManager } from './auth/tokenManager.js';
import { OAuthHandler } from './auth/oauthHandler.js';
import { z } from 'zod';

// Versão e nome do servidor
const SERVER_NAME = 'g2n-mcp-gcal-sse';
const SERVER_VERSION = '1.0.0';

// Definição do esquema de configuração
const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  TOKEN_STORAGE_PATH: z.string().optional(),
  OAUTH_REDIRECT_PATH: z.string().default('/oauth/callback'),
});

// Função para carregar configurações do ambiente
const loadConfig = () => {
  try {
    return ConfigSchema.parse({
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      TOKEN_STORAGE_PATH: process.env.TOKEN_STORAGE_PATH,
      OAUTH_REDIRECT_PATH: process.env.OAUTH_REDIRECT_PATH,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Erro de configuração:');
      error.errors.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('Erro desconhecido ao carregar configuração:', error);
    }
    process.exit(1);
  }
};

// Inicializa o servidor
async function main() {
  const config = loadConfig();

  console.log(`Iniciando ${SERVER_NAME} v${SERVER_VERSION}`);
  
  // Cria o gerenciador de tokens
  const tokenManager = new TokenManager({
    tokenStoragePath: config.TOKEN_STORAGE_PATH || path.join(process.cwd(), 'data', 'tokens.json'),
    tokenRefreshInterval: 30 * 60 * 1000, // 30 minutos
  });
  
  // Determina a URL de redirecionamento
  const redirectUri = `http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}${config.OAUTH_REDIRECT_PATH}`;
  
  // Cria o manipulador OAuth
  const oauthHandler = new OAuthHandler({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  }, tokenManager);
  
  // Inicializa o serviço do Google Calendar
  const calendarService = new GoogleCalendarService(oauthHandler, tokenManager);
  
  // Inicializa o servidor MCP
  const mcpServer = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  
  // Configura o servidor Express para SSE e OAuth
  const app = express();
  
  // Adiciona middleware para parsear JSON
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Para suportar múltiplas conexões simultâneas, mantemos um objeto de pesquisa
  // que mapeia sessionId para o transporte correspondente
  const transports: {[sessionId: string]: SSEServerTransport} = {};
  
  // Endpoint de saúde
  app.get('/health', async (_, res) => {
    const isAuthenticated = await calendarService.isAuthenticated();
    
    res.status(200).json({ 
      status: 'ok', 
      server: SERVER_NAME, 
      version: SERVER_VERSION,
      authenticated: isAuthenticated 
    });
  });
  
  // Endpoint para iniciar fluxo de autorização OAuth
  app.get('/auth', (_, res) => {
    const authUrl = calendarService.getAuthUrl();
    res.redirect(authUrl);
  });
  
  // Endpoint de callback para receber o código de autorização OAuth
  app.get(config.OAUTH_REDIRECT_PATH, async (req: Request, res: Response) => {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Código de autorização ausente ou inválido');
    }
    
    try {
      // Processa o código de autorização
      await calendarService.handleAuthCode(code);
      
      res.send(`
        <html>
          <head>
            <title>Autorização concluída</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
              .success { color: green; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">Autorização concluída com sucesso!</h1>
              <p>O servidor MCP do Google Calendar foi autorizado com sucesso.</p>
              <p>Você pode fechar esta janela agora e voltar para a aplicação.</p>
            </div>
          </body>
        </html>
      `);
      
      // Registra as ferramentas do Google Calendar após autenticação bem-sucedida
      registerCalendarTools(mcpServer, calendarService);
      
    } catch (error) {
      console.error('Erro durante autorização OAuth:', error);
      res.status(500).send(`Erro durante autorização: ${error}`);
    }
  });
  
  // Endpoint para revogar o acesso
  app.post('/revoke', async (_, res) => {
    try {
      await calendarService.revokeAccess();
      res.status(200).json({ success: true, message: 'Acesso revogado com sucesso' });
    } catch (error) {
      console.error('Erro ao revogar acesso:', error);
      res.status(500).json({ success: false, message: `Erro ao revogar acesso: ${error}` });
    }
  });
  
  // Endpoint SSE para eventos
  app.get('/sse', async (_: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    console.log(`Nova conexão SSE estabelecida: ${transport.sessionId}`);
    
    res.on('close', () => {
      delete transports[transport.sessionId];
      console.log(`Conexão SSE fechada: ${transport.sessionId}`);
    });
    
    await mcpServer.connect(transport);

    // Verifica se já está autenticado, e se estiver, registra as ferramentas
    const isAuthenticated = await calendarService.isAuthenticated();
    if (isAuthenticated) {
      registerCalendarTools(mcpServer, calendarService);
    }
  });
  
  // Endpoint para receber mensagens dos clientes
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      try {
        await transport.handlePostMessage(req, res);
      } catch (error) {
        console.error(`Erro ao processar mensagem para sessão ${sessionId}:`, error);
        res.status(500).send('Erro ao processar mensagem');
      }
    } else {
      res.status(400).send('Nenhum transporte encontrado para o sessionId fornecido');
    }
  });
  
  // Inicia o servidor
  const PORT = parseInt(config.PORT, 10);
  const HOST = config.HOST;
  
  app.listen(PORT, HOST, () => {
    console.log(`Servidor em execução em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`Para autorizar o aplicativo, visite http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/auth`);
  });
}

// Inicia o aplicativo
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
}); 