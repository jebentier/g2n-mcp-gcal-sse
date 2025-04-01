import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ILogger } from '../utils/logger.js';

// Middleware para verificar se o servidor MCP está inicializado
export const checkMcpServerInitialized = (getMcpServer: () => McpServer | undefined) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const mcpServer = getMcpServer();
    if (!mcpServer) {
      res.status(401).json({
        error: {
          code: -32001,
          message: "Servidor MCP não inicializado. Por favor, autentique-se em /auth primeiro.",
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

// Middleware para CORS
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

// Middleware para registrar todas as requisições e dados JSON
export const requestLoggerMiddleware = (logger: ILogger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Registra informações básicas da requisição
    logger.debug(`[MIDDLEWARE] ${req.method} ${req.path} | IP: ${req.ip} | User-Agent: ${req.get('user-agent')}`);
    
    // Se for uma requisição POST ou PUT, registra o corpo
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.is('application/json')) {
      try {
        const bodyStr = JSON.stringify(req.body);
        logger.debug(`[MIDDLEWARE] Dados recebidos ${req.method} ${req.path}: ${bodyStr.length > 2000 ? bodyStr.substring(0, 2000) + '... (truncado)' : bodyStr}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Dados recebidos não puderam ser convertidos para string: ${err}`);
      }
    }
    
    // Captura e registra a resposta (send, json e write)
    const originalSend = res.send;
    const originalJson = res.json;
    const originalWrite = res.write;
    
    res.send = function(body: any): Response {
      try {
        logger.debug(`[MIDDLEWARE] Resposta enviada ${req.method} ${req.path} | Status: ${res.statusCode} | Corpo: ${typeof body === 'string' ? (body.length > 1000 ? body.substring(0, 1000) + '... (truncado)' : body) : 'não é string'}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Erro ao logar resposta send: ${err}`);
      }
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any): Response {
      try {
        const responseStr = JSON.stringify(body);
        logger.debug(`[MIDDLEWARE] Resposta JSON ${req.method} ${req.path} | Status: ${res.statusCode} | Dados: ${responseStr.length > 1000 ? responseStr.substring(0, 1000) + '... (truncado)' : responseStr}`);
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Resposta JSON não pôde ser convertida para string: ${err}`);
      }
      return originalJson.call(this, body);
    };
    
    // Capturar e registrar dados escritos com res.write
    res.write = function(chunk: any): boolean {
      try {
        if (chunk) {
          let content = chunk;
          if (Buffer.isBuffer(chunk)) {
            content = chunk.toString('utf8');
          }
          
          if (typeof content === 'string') {
            logger.debug(`[MIDDLEWARE] Dados escritos ${req.method} ${req.path} | Status: ${res.statusCode} | Conteúdo: ${content.length > 1000 ? content.substring(0, 1000) + '... (truncado)' : content}`);
          } else if (content) {
            logger.debug(`[MIDDLEWARE] Dados escritos ${req.method} ${req.path} | Status: ${res.statusCode} | Tipo: ${typeof content} | Tamanho: ${JSON.stringify(content).length} bytes`);
          }
        }
      } catch (err) {
        logger.debug(`[MIDDLEWARE] Erro ao logar dados do write: ${err}`);
      }
      
      return originalWrite.apply(this, arguments as any);
    };
    
    // Registra quando a resposta for concluída
    res.on('finish', function() {
      logger.debug(`[MIDDLEWARE] Resposta finalizada ${req.method} ${req.path} | Status: ${res.statusCode}`);
    });
    
    next();
  };
}; 