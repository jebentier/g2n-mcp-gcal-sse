import { z } from 'zod';
import defaultLogger, { ILogger } from '../utils/logger.js';

// Definição do esquema de configuração
export const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_REDIRECT_PATH: z.string().default('/oauth/callback'),
  PUBLIC_URL: z.string().optional(),
  // Níveis de log separados por vírgula (error,warn,info,http,verbose,debug,silly)
  // Use 'debug' para ativar todos os logs de debug e níveis inferiores
  LOG_LEVEL: z.string().default('error,warn,info'),
});

export type Config = z.infer<typeof ConfigSchema>;

// Função para carregar configurações do ambiente
export const loadConfig = (logger: ILogger = defaultLogger): Config => {
  try {
    const config = ConfigSchema.parse({
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_PATH: process.env.OAUTH_REDIRECT_PATH,
      PUBLIC_URL: process.env.PUBLIC_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
    });
    
    logger.debug(`[CONFIG] Carregada | PORT=${config.PORT}, HOST=${config.HOST}, LOG_LEVEL=${config.LOG_LEVEL}`);
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[CONFIG] Erro de validação:');
      error.errors.forEach(err => {
        logger.error(`[CONFIG] Campo ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      logger.error('[CONFIG] Erro ao carregar:', error);
    }
    process.exit(1);
  }
};

/**
 * Constrói a URL base para o servidor.
 * Esta URL é crucial para o fluxo OAuth do Google, pois é usada como parte do callback.
 * 
 * A função segue a seguinte lógica:
 * 1. Se PUBLIC_URL está definida, usa essa (adicionando protocolo se necessário)
 * 2. Se está em ambiente local (HOST=0.0.0.0), usa localhost
 * 3. Caso contrário, usa o HOST configurado
 * 
 * É importante que a URL final contenha o protocolo correto (http/https) e
 * não aponte para localhost em ambiente de produção.
 */
export const buildBaseUrl = (config: Config, logger: ILogger = defaultLogger): string => {
  let baseUrl: string;
  
  if (config.PUBLIC_URL) {
    const publicUrl = config.PUBLIC_URL.trim();
    
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      baseUrl = publicUrl;
    } else {
      baseUrl = `https://${publicUrl}`;
      logger.warn(`[URL] Protocolo não especificado em PUBLIC_URL, usando HTTPS: ${baseUrl}`);
      logger.warn(`[URL] Para usar HTTP, defina PUBLIC_URL=http://${publicUrl}`);
    }
  } else if (config.HOST === '0.0.0.0') {
    baseUrl = `http://localhost:${config.PORT}`;
    logger.debug(`[URL] Modo local detectado: ${baseUrl}`);
  } else {
    const host = config.HOST.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      baseUrl = `${host}:${config.PORT}`;
    } else {
      baseUrl = `http://${host}:${config.PORT}`;
    }
    logger.debug(`[URL] Usando host configurado: ${baseUrl}`);
  }
  
  // Remove a barra no final, se existir
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  logger.debug(`[URL] Base final: ${baseUrl}`);
  
  return baseUrl;
}; 