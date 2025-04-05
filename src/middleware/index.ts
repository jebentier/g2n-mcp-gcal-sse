import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ILogger } from '../utils/logger.js';

// Middleware to check if the MCP server is initialized
export const checkMcpServerInitialized = (getMcpServer: () => McpServer | undefined) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const mcpServer = getMcpServer();
    if (!mcpServer) {
      res.status(401).json({
        error: {
          code: -32001,
          message: "MCP server not initialized. Please authenticate at /auth first.",
          data: {
            authUrl: `${req.protocol}://${req.get('host')}/auth`
          }
        }
      });
      return;
    }
    next();
  };
};

// Middleware for CORS
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};

// Middleware to log all requests and JSON data
export const requestLoggerMiddleware = (logger: ILogger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log basic request information
    logger.debug(`[MIDDLEWARE] ${req.method} ${req.path} | IP: ${req.ip} | User-Agent: ${req.get('user-agent')}`);

    // If it's a POST, PUT, or PATCH request, log the body
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.is('application/json')) {
      try {
        const bodyStr = JSON.stringify(req.body);
        logger.debug(`[MIDDLEWARE] Data received ${req.method} ${req.path}: ${bodyStr.length > 2000 ? bodyStr.substring(0, 2000) + '... (truncated)' : bodyStr}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Data received could not be converted to string: ${err}`);
      }
    }

    // Capture and log the response (send, json, and write)
    const originalSend = res.send;
    const originalJson = res.json;
    const originalWrite = res.write;

    res.send = function(body: any): Response {
      try {
        logger.debug(`[MIDDLEWARE] Response sent ${req.method} ${req.path} | Status: ${res.statusCode} | Body: ${typeof body === 'string' ? (body.length > 1000 ? body.substring(0, 1000) + '... (truncated)' : body) : 'not a string'}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Error logging response send: ${err}`);
      }
      return originalSend.call(this, body);
    };

    res.json = function(body: any): Response {
      try {
        const responseStr = JSON.stringify(body);
        logger.debug(`[MIDDLEWARE] JSON response ${req.method} ${req.path} | Status: ${res.statusCode} | Data: ${responseStr.length > 1000 ? responseStr.substring(0, 1000) + '... (truncated)' : responseStr}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] JSON response could not be converted to string: ${err}`);
      }
      return originalJson.call(this, body);
    };

    // Capture and log data written with res.write
    res.write = function(chunk: any): boolean {
      try {
        if (chunk) {
          let content = chunk;
          if (Buffer.isBuffer(chunk)) {
            content = chunk.toString('utf8');
          }

          if (typeof content === 'string') {
            logger.debug(`[MIDDLEWARE] Data written ${req.method} ${req.path} | Status: ${res.statusCode} | Content: ${content.length > 1000 ? content.substring(0, 1000) + '... (truncated)' : content}`);
          } else if (content) {
            logger.debug(`[MIDDLEWARE] Data written ${req.method} ${req.path} | Status: ${res.statusCode} | Type: ${typeof content} | Size: ${JSON.stringify(content).length} bytes`);
          }
        }
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Error logging write data: ${err}`);
      }

      return originalWrite.apply(this, arguments as any);
    };

    // Log when the response is finished
    res.on('finish', function() {
      logger.debug(`[MIDDLEWARE] Response finished ${req.method} ${req.path} | Status: ${res.statusCode}`);
    });

    next();
  };
};
