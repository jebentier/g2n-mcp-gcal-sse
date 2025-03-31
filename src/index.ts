import { loadConfig } from './config/config.js';
import { Server } from './server/server.js';

// Versão e nome do servidor
const SERVER_NAME = 'g2n-mcp-gcal-sse';
const SERVER_VERSION = '0.1.0';

// Função principal
async function main() {
  const config = loadConfig();

  console.log(`Iniciando ${SERVER_NAME} v${SERVER_VERSION}`);
  
  // Exibir configurações importantes para debug
  console.log(`Configuração atual:
    PORT: ${config.PORT}
    PUBLIC_URL: ${config.PUBLIC_URL || 'não definido'}
    OAUTH_REDIRECT_PATH: ${config.OAUTH_REDIRECT_PATH}
  `);

  // Criar e iniciar o servidor
  const server = new Server(config, SERVER_NAME, SERVER_VERSION);
  await server.start(config.PORT, config.HOST);
}

// Iniciar o servidor
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
}); 