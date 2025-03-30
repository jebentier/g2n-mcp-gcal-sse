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
  const activeConnections: {[sessionId: string]: Response} = {}; // Para armazenar as conexões ativas
  
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
  app.get('/sse', function(req: Request, res: Response) {
    // Gerar um ID de sessão único
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Configuração de cabeçalhos SSE manualmente
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desativa o buffering para proxies Nginx
      'Access-Control-Allow-Origin': '*'
    });

    // Armazenar a conexão
    activeConnections[sessionId] = res;
    
    console.log(`Nova conexão SSE estabelecida: ${sessionId}`);
    
    // Enviar evento inicial com o sessionId
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
    
    // Função para manter a conexão viva
    const keepAlive = setInterval(() => {
      if (activeConnections[sessionId]) {
        try {
          res.write(': keepalive\n\n');
        } catch (error) {
          // Se houver erro ao escrever, a conexão provavelmente já foi fechada
          clearInterval(keepAlive);
          delete activeConnections[sessionId];
          delete transports[sessionId];
        }
      } else {
        clearInterval(keepAlive);
      }
    }, 30000); // a cada 30 segundos
    
    // Limpar recursos quando a conexão for fechada
    res.on('close', () => {
      clearInterval(keepAlive);
      delete activeConnections[sessionId];
      delete transports[sessionId];
      console.log(`Conexão SSE fechada: ${sessionId}`);
    });
    
    // Criar o transporte MCP para este sessionId, mas não envie cabeçalhos pelo transporte
    // Criar o transporte apenas para o /messages endpoint, não para o SSE diretamente
    const dummyRes = {
      write: () => {}, // Função vazia para não interferir na resposta SSE
      end: () => {},
      on: () => {}
    } as unknown as Response;
    
    // Este transporte será usado apenas para receber mensagens via /messages
    const transport = new SSEServerTransport('/messages', dummyRes);
    transports[sessionId] = transport;
    
    // Sobrescrever o método send para redirecionar para nossa conexão SSE
    transport.send = async (message) => {
      if (activeConnections[sessionId]) {
        try {
          const data = JSON.stringify(message);
          activeConnections[sessionId].write(`data: ${data}\n\n`);
        } catch (error) {
          console.error(`Erro ao enviar mensagem SSE: ${error}`);
        }
      }
    };
    
    // Conectar ao servidor MCP
    (async () => {
      try {
        // Verificar autenticação antes de tentar conectar
        const isAuthenticated = await calendarService.isAuthenticated();
        
        // Conectar o transporte ao servidor MCP
        await mcpServer.connect(transport);
        
        if (isAuthenticated) {
          registerCalendarTools(mcpServer, calendarService);
          // Informar ao cliente que estamos autenticados
          if (activeConnections[sessionId]) {
            activeConnections[sessionId].write(`data: ${JSON.stringify({ type: 'authenticated' })}\n\n`);
          }
        } else {
          // Informar ao cliente que precisamos de autenticação
          if (activeConnections[sessionId]) {
            activeConnections[sessionId].write(`data: ${JSON.stringify({ type: 'auth_required', authUrl: `${baseUrl}/auth` })}\n\n`);
          }
        }
      } catch (error) {
        console.error(`Erro ao configurar conexão SSE: ${error}`);
      }
    })();
  });
  
  // Endpoint para receber mensagens dos clientes
  app.post('/messages', function(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).json({ 
        error: 'missing_session_id',
        message: 'É necessário fornecer um sessionId como parâmetro de consulta' 
      });
      return;
    }
    
    const transport = transports[sessionId];
    
    if (!transport) {
      res.status(404).json({ 
        error: 'session_not_found',
        message: 'Nenhum transporte encontrado para o sessionId fornecido. A sessão pode ter expirado.' 
      });
      return;
    }
    
    // Verificar se a conexão SSE ainda está ativa
    if (!activeConnections[sessionId]) {
      res.status(410).json({
        error: 'connection_closed',
        message: 'A conexão SSE para esta sessão foi fechada. Reconecte via SSE.'
      });
      return;
    }
    
    // Processar a mensagem no transporte
    (async () => {
      try {
        // Extrair a mensagem JSON da solicitação
        const message = req.body;
        
        // Simular o processo handlePostMessage diretamente
        if (transport.onmessage) {
          await transport.onmessage(message);
        }
        
        // Responder com sucesso
        res.status(200).json({ success: true });
      } catch (error) {
        console.error(`Erro ao processar mensagem para sessão ${sessionId}:`, error);
        
        // Só envie resposta se ainda não tivermos respondido
        if (!res.headersSent) {
          res.status(500).json({
            error: 'internal_error',
            message: 'Erro ao processar mensagem'
          });
        }
      }
    })();
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