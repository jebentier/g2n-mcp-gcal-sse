import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import logger from './utils/logger.js';

// Versão e nome do servidor
const SERVER_NAME = 'g2n-mcp-gcal-sse';
const SERVER_VERSION = '1.1.0';

// Função principal
async function main() {
  try {
    // Configuração do servidor MCP
    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    // Configuração do Express
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Armazena as conexões SSE ativas
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // Rota para conexão SSE
    app.get('/sse', async (_, res) => {
      try {
        const transport = new SSEServerTransport('/messages', res);
        transports[transport.sessionId] = transport;
        logger.info(`Nova conexão SSE estabelecida: ${transport.sessionId}`);

        res.on('close', () => {
          delete transports[transport.sessionId];
          logger.info(`Conexão SSE encerrada: ${transport.sessionId}`);
        });

        await server.connect(transport);
      } catch (error) {
        logger.error('Erro ao estabelecer conexão SSE:');
        logger.error(error);
        res.status(500).end();
      }
    });

    // Rota para mensagens
    app.post('/messages', async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const transport = transports[sessionId];

        if (transport) {
          await transport.handlePostMessage(req, res);
          logger.debug(`Mensagem processada para sessão: ${sessionId}`);
        } else {
          logger.warn(`Sessão não encontrada: ${sessionId}`);
          res.status(400).send('Sessão não encontrada');
        }
      } catch (error) {
        logger.error('Erro ao processar mensagem:');
        logger.error(error);
        res.status(500).send('Erro interno do servidor');
      }
    });

    // Inicia o servidor
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`🚀 Servidor ${SERVER_NAME} v${SERVER_VERSION} rodando na porta ${port}`);
    });
  } catch (error) {
    logger.error('Erro fatal ao iniciar o servidor:');
    logger.error(error);
    process.exit(1);
  }
}

// Inicia a aplicação
main(); 