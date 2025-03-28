import express from 'express';
import { Request, Response } from 'express';
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
const SERVER_VERSION = '0.1.0';

// Definição do esquema de configuração
const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  TOKEN_STORAGE_PATH: z.string().optional(),
  OAUTH_REDIRECT_PATH: z.string().default('/oauth/callback'),
  PUBLIC_URL: z.string().optional(),
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
      PUBLIC_URL: process.env.PUBLIC_URL,
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
  
  // Exibir configurações importantes para debug
  console.log(`Configuração atual:
    HOST: ${config.HOST}
    PORT: ${config.PORT}
    PUBLIC_URL: ${config.PUBLIC_URL || 'não definido'}
    OAUTH_REDIRECT_PATH: ${config.OAUTH_REDIRECT_PATH}
  `);
  
  // Cria o gerenciador de tokens
  const tokenManager = new TokenManager({
    tokenStoragePath: config.TOKEN_STORAGE_PATH || path.join(process.cwd(), 'data', 'tokens.json'),
    tokenRefreshInterval: 30 * 60 * 1000, // 30 minutos
  });
  
  // Determina a URL de redirecionamento
  let baseUrl: string;
  if (config.PUBLIC_URL) {
    // Garantir que PUBLIC_URL sempre comece com http:// ou https://
    const publicUrl = config.PUBLIC_URL.trim();
    
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      baseUrl = publicUrl;
    } else {
      // Se não tiver protocolo, adiciona https:// por padrão
      baseUrl = `https://${publicUrl}`;
      console.log(`ATENÇÃO: PUBLIC_URL não contém protocolo, usando HTTPS por padrão: ${baseUrl}`);
      console.log(`Se você está usando HTTP, defina explicitamente PUBLIC_URL=http://${publicUrl}`);
    }
  } else if (config.HOST === '0.0.0.0') {
    // Se o HOST for 0.0.0.0, usa localhost para URLs públicas
    baseUrl = `http://localhost:${config.PORT}`;
  } else {
    // Caso contrário, usa o HOST definido e adiciona protocolo se necessário
    const host = config.HOST.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      baseUrl = `${host}:${config.PORT}`;
    } else {
      baseUrl = `http://${host}:${config.PORT}`;
    }
  }
  
  // Remover barras finais para uma construção de URL consistente
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Garantir que o caminho de redirecionamento começa com /
  const redirectPath = config.OAUTH_REDIRECT_PATH.startsWith('/') 
    ? config.OAUTH_REDIRECT_PATH 
    : `/${config.OAUTH_REDIRECT_PATH}`;
  
  const redirectUri = `${baseUrl}${redirectPath}`;
  console.log(`URL de redirecionamento OAuth: ${redirectUri}`);
  
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
  app.get('/health', async (_: Request, res: Response) => {
    const isAuthenticated = await calendarService.isAuthenticated();
    
    res.status(200).json({ 
      status: 'ok', 
      server: SERVER_NAME, 
      version: SERVER_VERSION,
      authenticated: isAuthenticated 
    });
  });
  
  // Endpoint para iniciar fluxo de autorização OAuth
  app.get('/auth', (_: Request, res: Response) => {
    const authUrl = calendarService.getAuthUrl();
    res.redirect(authUrl);
  });
  
  // Endpoint de callback para receber o código de autorização OAuth
  app.get(String(config.OAUTH_REDIRECT_PATH), (req: Request, res: Response) => {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      res.status(400).send('Código de autorização ausente ou inválido');
      return;
    }
    
    (async () => {
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
    })();
  });
  
  // Endpoint para revogar o acesso
  app.post('/revoke', async (_: Request, res: Response) => {
    try {
      await calendarService.revokeAccess();
      res.status(200).json({ success: true, message: 'Acesso revogado com sucesso' });
    } catch (error) {
      console.error('Erro ao revogar acesso:', error);
      res.status(500).json({ success: false, message: `Erro ao revogar acesso: ${error}` });
    }
  });
  
  // Endpoint SSE para eventos
  app.get('/sse', function(_: Request, res: Response) {
    try {
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
      
      (async () => {
        try {
          await mcpServer.connect(transport);

          // Verifica se já está autenticado, e se estiver, registra as ferramentas
          const isAuthenticated = await calendarService.isAuthenticated();
          if (isAuthenticated) {
            registerCalendarTools(mcpServer, calendarService);
          }
        } catch (error) {
          console.error(`Erro ao conectar transporte SSE: ${error}`);
        }
      })();
    } catch (error) {
      console.error(`Erro ao inicializar conexão SSE: ${error}`);
      // Não tente enviar resposta se os cabeçalhos já foram enviados
      if (!res.headersSent) {
        res.status(500).send('Erro interno do servidor');
      }
    }
  });
  
  // Endpoint para receber mensagens dos clientes
  app.post('/messages', function(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      (async () => {
        try {
          await transport.handlePostMessage(req, res);
        } catch (error) {
          console.error(`Erro ao processar mensagem para sessão ${sessionId}:`, error);
          res.status(500).send('Erro ao processar mensagem');
        }
      })();
    } else {
      res.status(400).send('Nenhum transporte encontrado para o sessionId fornecido');
    }
  });
  
  // Inicia o servidor
  const PORT = parseInt(config.PORT, 10);
  const HOST = config.HOST;
  
  app.listen(PORT, HOST, () => {
    console.log(`Servidor em execução em ${baseUrl}`);
    console.log(`Para autorizar o aplicativo, visite ${baseUrl}/auth`);
  });
}

// Inicia o aplicativo
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
}); 