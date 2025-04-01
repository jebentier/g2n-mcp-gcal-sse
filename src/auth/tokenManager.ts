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
    this.logger.debug(`[TOKEN] Inicializado | Armazenamento: ${config.tokenStoragePath} | Intervalo: ${config.tokenRefreshInterval / 60000} min`);
    
    // Garantir que o diretório de tokens exista
    const dir = path.dirname(this.config.tokenStoragePath);
    if (!fs.existsSync(dir)) {
      this.logger.debug(`[TOKEN] Criando diretório: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Salva os tokens no sistema de arquivos
   */
  public async saveTokens(credentials: Credentials): Promise<void> {
    this.logger.debug(`[TOKEN] Salvando | Expiração: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A'} | Refresh: ${credentials.refresh_token ? 'presente' : 'ausente'}`);
    
    try {
      this.tokens = credentials;
      const dir = path.dirname(this.config.tokenStoragePath);
      
      if (!fs.existsSync(dir)) {
        this.logger.debug(`[TOKEN] Criando diretório: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
      
      await fs.promises.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(credentials, null, 2)
      );
      
      this.logger.info(`[TOKEN] Salvo com sucesso em ${this.config.tokenStoragePath}`);
    } catch (error) {
      this.logger.error('[TOKEN] Erro ao salvar:', error);
      throw error;
    }
  }

  /**
   * Carrega os tokens do sistema de arquivos
   */
  public async getTokens(): Promise<Credentials | null> {
  
    try {
      if (this.tokens) {
        this.logger.debug('[TOKEN] Usando tokens em memória');
        return this.tokens;
      }
      
      this.logger.debug(`[TOKEN] Carregando de ${this.config.tokenStoragePath}`);

      if (fs.existsSync(this.config.tokenStoragePath)) {
        const tokensData = await fs.promises.readFile(
          this.config.tokenStoragePath, 
          'utf8'
        );
        
        this.tokens = JSON.parse(tokensData);
        
        if (this.tokens && this.tokens.expiry_date) {
          const expiryDate = new Date(this.tokens.expiry_date);
          this.logger.debug(`[TOKEN] Carregado | Expira em: ${expiryDate.toISOString()}`);
        }
        
        return this.tokens;
      }
      
      this.logger.debug('[TOKEN] Arquivo não encontrado');
      return null;
    } catch (error) {
      this.logger.error('[TOKEN] Erro ao carregar:', error);
      this.tokens = null;
      return null;
    }
  }

  /**
   * Limpa os tokens armazenados
   */
  public async clearTokens(): Promise<void> {
    this.logger.debug('[TOKEN] Limpando tokens');
    
    try {
      this.tokens = null;
      
      if (fs.existsSync(this.config.tokenStoragePath)) {
        this.logger.debug(`[TOKEN] Removendo arquivo: ${this.config.tokenStoragePath}`);
        await fs.promises.unlink(this.config.tokenStoragePath);
      }
      
      this.logger.info('[TOKEN] Removido com sucesso');
      
      // Limpa qualquer timer de refresh ativo
      if (this.refreshTimerId) {
        this.logger.debug('[TOKEN] Cancelando timer de refresh');
        clearTimeout(this.refreshTimerId);
        this.refreshTimerId = null;
      }
    } catch (error) {
      this.logger.error('[TOKEN] Erro ao limpar:', error);
      throw error;
    }
  }

  /**
   * Verifica se há tokens válidos disponíveis
   */
  public async hasValidTokens(): Promise<boolean> {
    this.logger.debug('[TOKEN] Verificando validade');
    
    try {
      const tokens = await this.getTokens();
      
      if (!tokens) {
        this.logger.debug('[TOKEN] Nenhum token encontrado');
        return false;
      }
      
      const hasRefreshToken = !!tokens.refresh_token;
      
      // Verifica se o access token está válido
      if (tokens.expiry_date) {
        const now = Date.now();
        const isValid = tokens.expiry_date > now;
        const timeRemaining = (tokens.expiry_date - now) / 1000 / 60; // em minutos
        
        this.logger.debug(`[TOKEN] Status: ${isValid ? 'válido' : 'expirado'} | Refresh: ${hasRefreshToken ? 'sim' : 'não'} | Tempo restante: ${timeRemaining.toFixed(2)}min`);
        
        // Considera válido se tem refresh_token, mesmo que o access_token esteja expirado
        return hasRefreshToken;
      }
      
      this.logger.debug('[TOKEN] Sem data de expiração, considerando inválido');
      return false;
    } catch (error) {
      this.logger.error('[TOKEN] Erro ao verificar validade:', error);
      return false;
    }
  }

  /**
   * Configura a atualização automática de tokens
   */
  public setupTokenRefresh(listener: (credentials: Credentials) => Promise<void>): void {
    this.logger.debug('[TOKEN] Configurando refresh automático');
    this.tokenRefreshListener = listener;
    
    // Cancela qualquer timer existente
    if (this.refreshTimerId) {
      this.logger.debug('[TOKEN] Cancelando timer anterior');
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    
    const checkAndRefreshToken = async () => {
      try {
        const tokens = await this.getTokens();
        
        if (tokens && tokens.expiry_date && tokens.refresh_token) {
          const now = Date.now();
          const timeToExpiry = tokens.expiry_date - now;
          const timeToExpiryMinutes = timeToExpiry / 1000 / 60;
          const shouldRefresh = timeToExpiry < 15 * 60 * 1000; // Refresh if less than 15 minutes left
          
          this.logger.debug(`[TOKEN] Verificando | Expira em: ${timeToExpiryMinutes.toFixed(2)}min | Refresh necessário: ${shouldRefresh ? 'sim' : 'não'}`);
          
          if (shouldRefresh && this.tokenRefreshListener) {
            this.logger.debug('[TOKEN] Iniciando refresh');
            await this.tokenRefreshListener(tokens);
            this.logger.info('[TOKEN] Atualizado com sucesso');
          }
        } else if (!tokens) {
          this.logger.debug('[TOKEN] Não disponível para refresh');
        } else if (!tokens.refresh_token) {
          this.logger.debug('[TOKEN] Refresh token ausente');
        } else if (!tokens.expiry_date) {
          this.logger.debug('[TOKEN] Sem data de expiração');
        }
      } catch (error) {
        this.logger.error('[TOKEN] Erro durante refresh:', error);
      }
      
      // Agenda o próximo check
      const nextCheckMinutes = this.config.tokenRefreshInterval / 60000;
      this.logger.debug(`[TOKEN] Próxima verificação em ${nextCheckMinutes}min`);
      this.refreshTimerId = setTimeout(checkAndRefreshToken, this.config.tokenRefreshInterval);
    };
    
    // Inicia o ciclo de refresh e executa imediatamente a primeira verificação
    this.logger.debug('[TOKEN] Iniciando ciclo de refresh');
    checkAndRefreshToken();
  }
} 