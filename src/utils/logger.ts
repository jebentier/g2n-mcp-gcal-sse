import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Níveis de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Cores para cada nível de log
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Adiciona as cores ao winston
winston.addColors(colors);

// Função para validar os níveis de log
const validateLogLevels = (logLevels: string[]): string[] => {
  const validLevels = Object.keys(levels);
  return logLevels.filter(level => validLevels.includes(level));
};

// Função para determinar os níveis de log baseado na variável de ambiente
const getLogLevels = (): string[] => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';

  if (isDevelopment) {
    return Object.keys(levels);
  }

  const envLevels = (process.env.LOG_LEVEL || '').split(',').map(level => level.trim().toLowerCase());
  if (!envLevels || envLevels.length === 0) {
    return ['error', 'warn', 'info']; // níveis padrão em produção
  }

  const validLevels = validateLogLevels(envLevels);
  return validLevels.length > 0 ? validLevels : ['error', 'warn', 'info'];
};

// Classe personalizada de transporte para filtrar níveis
class FilteredConsoleTransport extends winston.transports.Console {
  constructor(options: winston.transports.ConsoleTransportOptions & { enabledLevels: string[] }) {
    super(options);
    const { enabledLevels, ...rest } = options;
    this.enabledLevels = new Set(enabledLevels);
  }

  private enabledLevels: Set<string>;

  log(info: any, callback: () => void) {
    if (this.enabledLevels.has(info.level)) {
      if (typeof super.log === 'function') {
        super.log(info, callback);
      } else {
        callback();
      }
    } else {
      callback();
    }
  }
}

// Formato personalizado para os logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Formato para arquivos (sem cores)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Diretório de logs
const logDir = 'logs';

// Obtém os níveis de log habilitados
const enabledLevels = getLogLevels();

// Transportes
const transports = [
  // Console com níveis filtrados
  new FilteredConsoleTransport({
    format,
    enabledLevels,
  }),
  // Arquivo de erros
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: fileFormat,
  }),
  // Arquivo com todos os logs habilitados
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
  }),
];

// Cria o logger
const Logger = winston.createLogger({
  levels,
  transports,
  level: 'debug', // permite todos os níveis, filtragem feita no transporte
});

// Função para formatar objetos/erros antes de logar
const formatMessage = (message: unknown): string => {
  if (message instanceof Error) {
    return `${message.message}\n${message.stack}`;
  }
  if (typeof message === 'object') {
    return JSON.stringify(message, null, 2);
  }
  return String(message);
};

// Interface para tipagem
export interface ILogger {
  error(message: unknown): void;
  warn(message: unknown): void;
  info(message: unknown): void;
  http(message: unknown): void;
  debug(message: unknown): void;
}

// Wrapper do logger com formatação de mensagens
const logger: ILogger = {
  error: (message: unknown) => Logger.error(formatMessage(message)),
  warn: (message: unknown) => Logger.warn(formatMessage(message)),
  info: (message: unknown) => Logger.info(formatMessage(message)),
  http: (message: unknown) => Logger.http(formatMessage(message)),
  debug: (message: unknown) => Logger.debug(formatMessage(message)),
};

// Log inicial com níveis habilitados
Logger.info(`Logger iniciado com os seguintes níveis: ${enabledLevels.join(', ')}`);

export default logger; 