import { Router, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GoogleCalendarService } from '../services/googleCalendar.js';
import { checkMcpServerInitialized } from '../middleware/index.js';
import { successTemplate, errorTemplate } from '../views/templates.js';
import { Server } from '../server/server.js';
import { ILogger } from '../utils/logger.js';

export const createRouter = (
  server: Server,
  calendarService: GoogleCalendarService,
  transports: { [sessionId: string]: SSEServerTransport },
  serverName: string,
  serverVersion: string,
  logger: ILogger
) => {
  const router = Router();

  // Endpoint de saúde
  router.get('/health', async (_: Request, res: Response) => {
    const isAuthenticated = await calendarService.isAuthenticated();
    
    res.status(200).json({ 
      status: 'ok', 
      server: serverName, 
      version: serverVersion,
      authenticated: isAuthenticated 
    });
  });

  // Endpoint para iniciar fluxo de autorização OAuth
  router.get('/auth', (_: Request, res: Response) => {
    const authUrl = calendarService.getAuthUrl();
    res.redirect(authUrl);
  });

  // Endpoint de callback para receber o código de autorização OAuth
  router.get('/oauth/callback', async (req: Request, res: Response) => {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      res.status(400).send(errorTemplate('Código de autorização ausente ou inválido'));
      return;
    }

    try {
      // Processa o código de autorização
      await calendarService.handleAuthCode(code);
      
      // Inicializa o serviço do Calendar
      const isInitialized = await calendarService.initialize();
      if (isInitialized) {
        logger.info('Serviço do Google Calendar inicializado com sucesso');
        
        // Inicializa o servidor MCP
        await server.initializeMcpServer();
        logger.info('Servidor MCP inicializado com sucesso');
        
        res.send(successTemplate);
      } else {
        res.status(500).send(errorTemplate('Falha ao inicializar o serviço do Google Calendar'));
      }
    } catch (error) {
      logger.error('Erro durante autorização OAuth:');
      logger.error(error);
      res.status(500).send(errorTemplate(`Erro durante autorização: ${error}`));
    }
  });

  // Endpoint para revogar o acesso
  router.post('/revoke', async (_: Request, res: Response) => {
    try {
      await calendarService.revokeAccess();
      res.status(200).json({ success: true, message: 'Acesso revogado com sucesso' });
    } catch (error) {
      logger.error('Erro ao revogar acesso:');
      logger.error(error);
      res.status(500).json({ success: false, message: `Erro ao revogar acesso: ${error}` });
    }
  });

  // Endpoint SSE para eventos
  router.get('/sse', checkMcpServerInitialized(() => server.getMcpServer()), async (_: Request, res: Response) => {
    try {      
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      
      res.on('close', () => {
        delete transports[transport.sessionId];
      });
      
      const mcpServer = server.getMcpServer();
      if (mcpServer) {
        await mcpServer.connect(transport);
      }
    } catch (error) {
      logger.error('Erro ao estabelecer conexão SSE:');
      logger.error(error);
      res.status(500).end();
    }
  });

  // Endpoint para mensagens
  router.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('Nenhum transporte encontrado para o sessionId');
    }
  });

  return router;
}; 