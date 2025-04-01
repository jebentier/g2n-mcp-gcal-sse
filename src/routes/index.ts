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
  logger: ILogger,
  heartbeatIntervals: { [sessionId: string]: NodeJS.Timeout }
) => {
  const router = Router();

  // Endpoint de saúde
  router.get('/health', async (req: Request, res: Response) => {
    const isAuthenticated = await calendarService.isAuthenticated();
    const responseData = { 
      status: 'ok', 
      server: serverName, 
      version: serverVersion,
      authenticated: isAuthenticated 
    };
    
    res.status(200).json(responseData);
  });

  // Endpoint para iniciar fluxo de autorização OAuth
  router.get('/auth', (req: Request, res: Response) => {
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
        logger.info('[ROUTES] Google Calendar inicializado com sucesso');
        
        // Inicializa o servidor MCP
        await server.initializeMcpServer();
        logger.info('[ROUTES] Servidor MCP inicializado com sucesso');
        
        res.send(successTemplate);
      } else {
        res.status(500).send(errorTemplate('Falha ao inicializar o serviço do Google Calendar'));
      }
    } catch (error) {
      logger.error('[ROUTES] Erro durante autorização OAuth:', error);
      res.status(500).send(errorTemplate(`Erro durante autorização: ${error}`));
    }
  });

  // Endpoint para revogar o acesso
  router.post('/revoke', async (req: Request, res: Response) => {
    try {
      await calendarService.revokeAccess();
      res.status(200).json({ success: true, message: 'Acesso revogado com sucesso' });
    } catch (error) {
      logger.error('[ROUTES] Erro ao revogar acesso:', error);
      res.status(500).json({ success: false, message: `Erro ao revogar acesso: ${error}` });
    }
  });

  // Endpoint SSE para eventos
  router.get('/sse', checkMcpServerInitialized(() => server.getMcpServer()), async (req: Request, res: Response) => {
    try {      
      const transport = new SSEServerTransport('/messages', res);
      const transportId = transport.sessionId;
      transports[transportId] = transport;
      
      logger.debug(`[ROUTES] SSE conexão estabelecida | SessionID: ${transportId}`);
      
      res.on('close', () => {
        logger.debug(`[ROUTES] SSE conexão fechada | SessionID: ${transportId}`);

        // Limpar o heartbeat
        if (heartbeatIntervals[transportId]) {
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
          logger.debug(`[ROUTES] SSE heartbeat interrompido | SessionID: ${transportId}`);
        }

        delete transports[transportId];
      });

      res.on('error', (err) => {
        logger.error(`[ROUTES] SSE erro na conexão | SessionID: ${transportId}:`, err);
        if (heartbeatIntervals[transportId]) {
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
        }
        delete transports[transportId];
      });
      
      const mcpServer: McpServer | undefined = server.getMcpServer();
      if (mcpServer) {
        await mcpServer.connect(transport);
        logger.debug(`[ROUTES] MCP conectado ao transporte | SessionID: ${transportId}`);
      }

      // Configurar heartbeat a cada 10 segundos para manter a conexão viva
      heartbeatIntervals[transportId] = setInterval(() => {
        try {
          if (res.writable) {
            res.write(`: heartbeat ${Date.now()}\n\n`);
            logger.debug(`[ROUTES] SSE heartbeat enviado | SessionID: ${transportId}`);
          } else {
            clearInterval(heartbeatIntervals[transportId]);
            delete heartbeatIntervals[transportId];
            logger.debug(`[ROUTES] SSE conexão não está mais gravável, heartbeat interrompido | SessionID: ${transportId}`);
          }
        } catch (err) {
          logger.error(`[ROUTES] Erro ao enviar SSE heartbeat | SessionID: ${transportId}:`, err);
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
        }
      }, 10000); // 10 segundos
    } catch (error) {
      logger.error('[ROUTES] Erro na conexão SSE:', error);
      res.status(500).end();
    }
  });

  // Endpoint para mensagens
  router.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      try {
        await transport.handlePostMessage(req, res, req.body);
        logger.debug(`[ROUTES] Mensagem processada | SessionID: ${sessionId}`);
      } catch (error) {
        logger.error(`[ROUTES] Erro ao processar mensagem | SessionID: ${sessionId}:`, error);
      }
    } else {
      logger.debug(`[ROUTES] Erro: SessionID inválido: ${sessionId}`);
      res.status(400).send('Nenhum transporte encontrado para o sessionId');
    }
  });

  return router;
}; 