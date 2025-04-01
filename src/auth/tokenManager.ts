import fs from 'fs';
import path from 'path';
import { Credentials } from 'google-auth-library';
import { ILogger } from '../utils/logger.js';

interface TokenManagerConfig {
  tokenStoragePath: string;
  tokenRefreshInterval: number; // em milissegundos
}

/**
 * Gerencia os tokens de acesso e refresh do OAuth2
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private tokens: Credentials | null = null;
  private tokenRefreshListener: ((credentials: Credentials) => Promise<void>) | null = null;
  private refreshTimerId: NodeJS.Timeout | null = null;
  private logger: ILogger;

  constructor(config: TokenManagerConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.logger.debug(`TokenManager inicializado com armazenamento em: ${config.tokenStoragePath}`);
    this.logger.debug(`Intervalo de refresh configurado para: ${config.tokenRefreshInterval / 60000} minutos`);
    
    // Garantir que o diretório de tokens exista
    const dir = path.dirname(this.config.tokenStoragePath);
    if (!fs.existsSync(dir)) {
      this.logger.debug(`Criando diretório para armazenamento de tokens: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Salva os tokens no sistema de arquivos
   */
  public async saveTokens(credentials: Credentials): Promise<void> {
    this.logger.debug('Salvando tokens de acesso');
    this.logger.debug(`Access token expira em: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A'}`);
    this.logger.debug(`Refresh token ${credentials.refresh_token ? 'presente' : 'ausente'}`);
    
    try {
      this.tokens = credentials;
      const dir = path.dirname(this.config.tokenStoragePath);
      
      if (!fs.existsSync(dir)) {
        this.logger.debug(`Criando diretório de tokens: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
      
      await fs.promises.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(credentials, null, 2)
      );
      
      this.logger.info('Tokens salvos com sucesso');
      this.logger.debug(`Tokens salvos em: ${this.config.tokenStoragePath}`);
    } catch (error) {
      this.logger.error('Erro ao salvar tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Carrega os tokens do sistema de arquivos
   */
  public async getTokens(): Promise<Credentials | null> {
    this.logger.debug('Tentando carregar tokens do armazenamento');
    this.logger.debug(`Caminho do arquivo: ${this.config.tokenStoragePath}`);
    
    try {
      if (this.tokens) {
        this.logger.debug('Retornando tokens já carregados em memória');
        return this.tokens;
      }
      
      if (fs.existsSync(this.config.tokenStoragePath)) {
        const tokensData = await fs.promises.readFile(
          this.config.tokenStoragePath, 
          'utf8'
        );
        
        this.tokens = JSON.parse(tokensData);
        this.logger.debug('Tokens carregados com sucesso do arquivo');
        
        if (this.tokens && this.tokens.expiry_date) {
          const expiryDate = new Date(this.tokens.expiry_date);
          this.logger.debug(`Access token expira em: ${expiryDate.toISOString()}`);
        }
        
        return this.tokens;
      }
      
      this.logger.debug('Arquivo de tokens não encontrado');
      return null;
    } catch (error) {
      this.logger.error('Erro ao carregar tokens:');
      this.logger.error(error);
      this.logger.debug('Resetando tokens devido a erro de carregamento');
      this.tokens = null;
      return null;
    }
  }

  /**
   * Limpa os tokens armazenados
   */
  public async clearTokens(): Promise<void> {
    this.logger.debug('Limpando tokens armazenados');
    
    try {
      this.tokens = null;
      
      if (fs.existsSync(this.config.tokenStoragePath)) {
        this.logger.debug(`Removendo arquivo de tokens: ${this.config.tokenStoragePath}`);
        await fs.promises.unlink(this.config.tokenStoragePath);
      }
      
      this.logger.info('Tokens removidos com sucesso');
      
      // Limpa qualquer timer de refresh ativo
      if (this.refreshTimerId) {
        this.logger.debug('Cancelando timer de refresh automático');
        clearTimeout(this.refreshTimerId);
        this.refreshTimerId = null;
      }
    } catch (error) {
      this.logger.error('Erro ao limpar tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Verifica se há tokens válidos disponíveis
   */
  public async hasValidTokens(): Promise<boolean> {
    this.logger.debug('Verificando existência de tokens válidos');
    
    try {
      const tokens = await this.getTokens();
      
      if (!tokens) {
        this.logger.debug('Nenhum token encontrado');
        return false;
      }
      
      const hasRefreshToken = !!tokens.refresh_token;
      this.logger.debug(`Refresh token ${hasRefreshToken ? 'presente' : 'ausente'}`);
      
      // Verifica se o access token está válido
      if (tokens.expiry_date) {
        const now = Date.now();
        const isValid = tokens.expiry_date > now;
        const timeRemaining = (tokens.expiry_date - now) / 1000 / 60; // em minutos
        
        this.logger.debug(`Access token ${isValid ? 'válido' : 'expirado'}`);
        if (isValid) {
          this.logger.debug(`Tempo restante para expiração: ${timeRemaining.toFixed(2)} minutos`);
        }
        
        // Considera válido se tem refresh_token, mesmo que o access_token esteja expirado
        return hasRefreshToken;
      }
      
      this.logger.debug('Tokens sem data de expiração, considerando inválido');
      return false;
    } catch (error) {
      this.logger.error('Erro ao verificar validade dos tokens:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Configura a atualização automática de tokens
   */
  public setupTokenRefresh(listener: (credentials: Credentials) => Promise<void>): void {
    this.logger.debug('Configurando refresh automático de tokens');
    this.tokenRefreshListener = listener;
    
    // Cancela qualquer timer existente
    if (this.refreshTimerId) {
      this.logger.debug('Cancelando timer de refresh anterior');
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    
    const checkAndRefreshToken = async () => {
      this.logger.debug('Verificando necessidade de refresh de token');
      try {
        const tokens = await this.getTokens();
        
        if (tokens && tokens.expiry_date && tokens.refresh_token) {
          const now = Date.now();
          const timeToExpiry = tokens.expiry_date - now;
          const timeToExpiryMinutes = timeToExpiry / 1000 / 60;
          const shouldRefresh = timeToExpiry < 15 * 60 * 1000; // Refresh if less than 15 minutes left
          
          this.logger.debug(`Token expira em ${timeToExpiryMinutes.toFixed(2)} minutos`);
          this.logger.debug(`Data atual: ${new Date(now).toISOString()}`);
          this.logger.debug(`Data de expiração do token: ${new Date(tokens.expiry_date).toISOString()}`);
          this.logger.debug(`Necessário refresh? ${shouldRefresh ? 'Sim' : 'Não'}`);
          
          if (shouldRefresh && this.tokenRefreshListener) {
            this.logger.debug('Iniciando refresh de token');
            await this.tokenRefreshListener(tokens);
            this.logger.info('Token atualizado com sucesso');
          } else if (!shouldRefresh) {
            this.logger.debug(`Refresh não necessário ainda. Próximo refresh em aproximadamente ${(timeToExpiryMinutes - 15).toFixed(2)} minutos`);
          }
        } else if (!tokens) {
          this.logger.debug('Nenhum token disponível, pulando refresh');
        } else if (!tokens.refresh_token) {
          this.logger.debug('Nenhum refresh token disponível, pulando refresh');
        } else if (!tokens.expiry_date) {
          this.logger.debug('Token sem data de expiração, pulando refresh');
        }
      } catch (error) {
        this.logger.error('Erro durante refresh automático de token:');
        this.logger.error(error);
      }
      
      // Agenda o próximo check
      const nextCheckMinutes = this.config.tokenRefreshInterval / 60000;
      this.logger.debug(`Agendando próxima verificação em ${nextCheckMinutes} minutos (${nextCheckMinutes * 60} segundos)`);
      this.refreshTimerId = setTimeout(checkAndRefreshToken, this.config.tokenRefreshInterval);
    };
    
    // Inicia o ciclo de refresh
    this.logger.debug('Iniciando ciclo de refresh automático');
    // Executa imediatamente a primeira verificação
    this.logger.debug('Executando verificação inicial de token');
    checkAndRefreshToken();
  }
} 