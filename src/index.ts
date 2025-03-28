import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GoogleCalendarService } from './services/googleCalendar.js';
import { createCalendarTools } from './tools/calendarTools.js';
import { z } from 'zod';

// Definição do esquema de configuração
const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REFRESH_TOKEN: z.string(),
  SERVER_NAME: z.string().default('g2n-mcp-gcal-sse'),
  SERVER_VERSION: z.string().default('1.0.0'),
});

// Função para carregar configurações do ambiente
const loadConfig = () => {
  try {
    return ConfigSchema.parse({
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
      SERVER_NAME: process.env.SERVER_NAME,
      SERVER_VERSION: process.env.SERVER_VERSION,
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

  console.log(`Iniciando ${config.SERVER_NAME} v${config.SERVER_VERSION}`);
  
  // Inicializa o serviço do Google Calendar
  const calendarService = new GoogleCalendarService({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    refreshToken: config.GOOGLE_REFRESH_TOKEN,
  });
  
  // Inicializa o servidor MCP
  const server = new McpServer({
    name: config.SERVER_NAME,
    version: config.SERVER_VERSION,
  });
  
  // Registra as ferramentas do Google Calendar
  const calendarTools = createCalendarTools(calendarService);
  calendarTools.forEach(tool => server.registerTool(tool));
  
  // Configura o servidor Express para SSE
  const app = express();
  
  // Adiciona middleware para parsear JSON
  app.use(express.json());
  
  // Para suportar múltiplas conexões simultâneas, mantemos um objeto de pesquisa
  // que mapeia sessionId para o transporte correspondente
  const transports: {[sessionId: string]: SSEServerTransport} = {};
  
  // Endpoint de saúde
  app.get('/health', (_, res) => {
    res.status(200).json({ status: 'ok', server: config.SERVER_NAME, version: config.SERVER_VERSION });
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
    
    await server.connect(transport);
  });
  
  // Endpoint para receber mensagens dos clientes
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('Nenhum transporte encontrado para o sessionId fornecido');
    }
  });
  
  // Inicia o servidor
  app.listen(parseInt(config.PORT), config.HOST, () => {
    console.log(`Servidor MCP Google Calendar iniciado em ${config.HOST}:${config.PORT}`);
    console.log('Endpoints disponíveis:');
    console.log(`- Saúde: http://${config.HOST}:${config.PORT}/health`);
    console.log(`- SSE: http://${config.HOST}:${config.PORT}/sse`);
    console.log(`- Mensagens: http://${config.HOST}:${config.PORT}/messages?sessionId=<session-id>`);
  });
}

// Inicia a aplicação
main().catch(error => {
  console.error('Erro fatal ao iniciar o servidor:', error);
  process.exit(1);
}); 