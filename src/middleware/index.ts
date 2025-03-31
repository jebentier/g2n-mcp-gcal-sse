import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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