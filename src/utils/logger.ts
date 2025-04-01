import winston from 'winston';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import { Config } from '../config/config.js';
const { format, transports, createLogger } = winston;
const { combine, timestamp, printf, colorize, errors, splat } = format;

// Níveis de log padrão do npm (RFC5424)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Cores para cada nível
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

// Adiciona as cores ao winston
winston.addColors(colors);

// Converte a configuração para um array de níveis ativos
const parseLogLevels = (logLevelStr: string): string[] => {
  return logLevelStr
    .split(',')
    .map(l => l.trim().toLowerCase())
    .filter(l => l in levels);
};

// Obtém o nível de log base da configuração
const getBaseLevel = (): string => {
  // Usa 'silly' como base para permitir todos os níveis possíveis
  // O controle real será feito pela função isLevelEnabled
  return 'silly';
};

// Função para criar um logger com configuração específica
export function createLoggerWithConfig(config: Config) {
  // Verifica se um nível específico está ativo
  const isLevelEnabled = (level: string): boolean => {
    const configLevels = parseLogLevels(config.LOG_LEVEL || '');

    if (!configLevels?.length) {
      // Se não há níveis definidos, usa os níveis padrão
      return ['error', 'warn', 'info'].includes(level);
    }

    return configLevels.includes(level);
  };

  // Formato personalizado para os logs
  const customFormat = printf(info => {
    // Extrai as informações básicas
    const { level, message, timestamp, stack, ...rest } = info;
    
    // Constrói a mensagem base
    let output = `${timestamp} ${level}: ${message}`;
    
    // Adiciona o stack trace se existir
    if (stack) {
      output += `\n${stack}`;
    }
    
    // Adiciona metadados extras (se houver)
    const metaKeys = Object.keys(rest).filter(key => 
      ![LEVEL, MESSAGE, SPLAT].includes(key as any)
    );
    
    if (metaKeys.length > 0) {
      const meta = metaKeys.reduce((obj, key) => {
        obj[key] = rest[key];
        return obj;
      }, {} as Record<string, any>);
      
      output += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return output;
  });

  // Cria o logger
  const logger = createLogger({
    level: getBaseLevel(), // Usa o primeiro nível como nível base
    levels,
    format: combine(
      errors({ stack: true }), // Captura stack traces
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      splat(), // Habilita interpolação de strings com %s, %d, etc
      colorize({ all: true }),
      customFormat
    ),
    transports: [
      new transports.Console({
        handleExceptions: true,
        handleRejections: true
      })
    ],
    exitOnError: false // Não finaliza o processo em caso de erro
  });

  // Função auxiliar para formatar objetos não-string em string
  const formatIfNeeded = (message: any): string => {
    if (message === null || message === undefined) {
      return String(message);
    }
    
    if (typeof message === 'string') {
      return message;
    }
    
    if (message instanceof Error) {
      return message.message; // O stack trace será adicionado pelo formato errors()
    }
    
    if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    
    return String(message);
  };

  // Interface do logger
  interface ILogger {
    error(message: string, ...meta: any[]): void;
    error(message: any): void;
    warn(message: string, ...meta: any[]): void;
    warn(message: any): void;
    info(message: string, ...meta: any[]): void;
    info(message: any): void;
    http(message: string, ...meta: any[]): void;
    http(message: any): void;
    verbose(message: string, ...meta: any[]): void;
    verbose(message: any): void;
    debug(message: string, ...meta: any[]): void;
    debug(message: any): void;
    silly(message: string, ...meta: any[]): void;
    silly(message: any): void;
    profile(id: string, meta?: Record<string, any>): void;
    startTimer(): winston.Profiler;
    isLevelEnabled(level: string): boolean;
  }

  // Wrapper do logger com tratamento de argumentos
  const winstonLogger: ILogger = {
    error: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('error')) return;
      if (typeof message === 'string') {
        logger.error(message, ...meta);
      } else {
        logger.error(formatIfNeeded(message));
      }
    },
    warn: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('warn')) return;
      if (typeof message === 'string') {
        logger.warn(message, ...meta);
      } else {
        logger.warn(formatIfNeeded(message));
      }
    },
    info: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('info')) return;
      if (typeof message === 'string') {
        logger.info(message, ...meta);
      } else {
        logger.info(formatIfNeeded(message));
      }
    },
    http: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('http')) return;
      if (typeof message === 'string') {
        logger.http(message, ...meta);
      } else {
        logger.http(formatIfNeeded(message));
      }
    },
    verbose: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('verbose')) return;
      if (typeof message === 'string') {
        logger.verbose(message, ...meta);
      } else {
        logger.verbose(formatIfNeeded(message));
      }
    },
    debug: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('debug')) return;
      if (typeof message === 'string') {
        logger.debug(message, ...meta);
      } else {
        logger.debug(formatIfNeeded(message));
      }
    },
    silly: (message: any, ...meta: any[]): void => {
      if (!isLevelEnabled('silly')) return;
      if (typeof message === 'string') {
        logger.silly(message, ...meta);
      } else {
        logger.silly(formatIfNeeded(message));
      }
    },
    profile: (id: string, meta?: Record<string, any>): void => {
      logger.profile(id, meta);
    },
    startTimer: (): winston.Profiler => {
      return logger.startTimer();
    },
    isLevelEnabled
  };

  // Níveis efetivamente ativos
  const activeLogLevels = parseLogLevels(config.LOG_LEVEL || '');
  const effectiveLevels = activeLogLevels.length > 0 
    ? activeLogLevels.join(', ') 
    : 'error, warn, info (padrão)';

  // Log inicial com informações do logger
  logger.info(`Logger iniciado (níveis ativos: ${effectiveLevels})`);

  return winstonLogger;
}

// Re-exporta a interface ILogger
export interface ILogger {
  error(message: string, ...meta: any[]): void;
  error(message: any): void;
  warn(message: string, ...meta: any[]): void;
  warn(message: any): void;
  info(message: string, ...meta: any[]): void;
  info(message: any): void;
  http(message: string, ...meta: any[]): void;
  http(message: any): void;
  verbose(message: string, ...meta: any[]): void;
  verbose(message: any): void;
  debug(message: string, ...meta: any[]): void;
  debug(message: any): void;
  silly(message: string, ...meta: any[]): void;
  silly(message: any): void;
  profile(id: string, meta?: Record<string, any>): void;
  startTimer(): winston.Profiler;
  isLevelEnabled(level: string): boolean;
}

// Cria uma versão básica do logger para cenários em que a config não está disponível
const defaultLogger = createLoggerWithConfig({
  PORT: '3001',
  HOST: '0.0.0.0',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  OAUTH_REDIRECT_PATH: '/oauth/callback',
  LOG_LEVEL: 'error,warn,info'
});

export default defaultLogger; 