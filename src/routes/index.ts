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

  // Health endpoint
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

  // Endpoint to start OAuth authorization flow
  router.get('/auth', (req: Request, res: Response) => {
    const authUrl = calendarService.getAuthUrl();
    res.redirect(authUrl);
  });

  // Callback endpoint to receive the OAuth authorization code
  router.get('/oauth/callback', async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).send(errorTemplate('Missing or invalid authorization code'));
      return;
    }

    try {
      // Process the authorization code
      await calendarService.handleAuthCode(code);

      // Initialize the Calendar service
      const isInitialized = await calendarService.initialize();
      if (isInitialized) {
        logger.info('[ROUTES] Google Calendar successfully initialized');

        // Initialize the MCP server
        await server.initializeMcpServer();
        logger.info('[ROUTES] MCP server successfully initialized');

        res.send(successTemplate);
      } else {
        res.status(500).send(errorTemplate('Failed to initialize Google Calendar service'));
      }
    } catch (error) {
      logger.error('[ROUTES] Error during OAuth authorization:', error);
      res.status(500).send(errorTemplate(`Error during authorization: ${error}`));
    }
  });

  // Endpoint to revoke access
  router.post('/revoke', async (req: Request, res: Response) => {
    try {
      await calendarService.revokeAccess();
      res.status(200).json({ success: true, message: 'Access successfully revoked' });
    } catch (error) {
      logger.error('[ROUTES] Error revoking access:', error);
      res.status(500).json({ success: false, message: `Error revoking access: ${error}` });
    }
  });

  // SSE endpoint for events
  router.get('/sse', checkMcpServerInitialized(() => server.getMcpServer()), async (req: Request, res: Response) => {
    try {
      const transport = new SSEServerTransport('/messages', res);
      const transportId = transport.sessionId;
      transports[transportId] = transport;

      logger.debug(`[ROUTES] SSE connection established | SessionID: ${transportId}`);

      res.on('close', () => {
        logger.debug(`[ROUTES] SSE connection closed | SessionID: ${transportId}`);

        // Clear the heartbeat
        if (heartbeatIntervals[transportId]) {
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
          logger.debug(`[ROUTES] SSE heartbeat stopped | SessionID: ${transportId}`);
        }

        delete transports[transportId];
      });

      res.on('error', (err) => {
        logger.error(`[ROUTES] SSE connection error | SessionID: ${transportId}:`, err);
        if (heartbeatIntervals[transportId]) {
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
        }
        delete transports[transportId];
      });

      const mcpServer: McpServer | undefined = server.getMcpServer();
      if (mcpServer) {
        await mcpServer.connect(transport);
        logger.debug(`[ROUTES] MCP connected to transport | SessionID: ${transportId}`);
      }

      // Set up a heartbeat every 10 seconds to keep the connection alive
      heartbeatIntervals[transportId] = setInterval(() => {
        try {
          if (res.writable) {
            res.write(`: heartbeat ${Date.now()}\n\n`);
            logger.debug(`[ROUTES] SSE heartbeat sent | SessionID: ${transportId}`);
          } else {
            clearInterval(heartbeatIntervals[transportId]);
            delete heartbeatIntervals[transportId];
            logger.debug(`[ROUTES] SSE connection is no longer writable, heartbeat stopped | SessionID: ${transportId}`);
          }
        } catch (err) {
          logger.error(`[ROUTES] Error sending SSE heartbeat | SessionID: ${transportId}:`, err);
          clearInterval(heartbeatIntervals[transportId]);
          delete heartbeatIntervals[transportId];
        }
      }, 10000); // 10 seconds
    } catch (error) {
      logger.error('[ROUTES] Error in SSE connection:', error);
      res.status(500).end();
    }
  });

  // Endpoint for messages
  router.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];

    if (transport) {
      try {
        await transport.handlePostMessage(req, res, req.body);
        logger.debug(`[ROUTES] Message processed | SessionID: ${sessionId}`);
      } catch (error) {
        logger.error(`[ROUTES] Error processing message | SessionID: ${sessionId}:`, error);
      }
    } else {
      logger.debug(`[ROUTES] Error: Invalid SessionID: ${sessionId}`);
      res.status(400).send('No transport found for the sessionId');
    }
  });

  return router;
};
