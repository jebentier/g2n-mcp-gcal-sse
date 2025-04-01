import fs from 'fs';
import path from 'path';
import { Credentials } from 'google-auth-library';
import { ILogger } from '../utils/logger.js';

interface TokenConfig {
  tokenStoragePath: string;
  tokenRefreshInterval: number; // em milissegundos
}

export class TokenManager {
  private config: TokenConfig;
  private tokens: Credentials | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshListener: ((tokens: Credentials) => Promise<void>) | null = null;
  private logger: ILogger;

  constructor(config: TokenConfig, logger: ILogger) {
    this.config = {
      tokenStoragePath: config.tokenStoragePath || path.join(process.cwd(), 'tokens.json'),
      tokenRefreshInterval: config.tokenRefreshInterval || 30 * 60 * 1000, // 30 minutos por padrão
    };
    this.logger = logger;

    // Certifica-se de que o diretório de armazenamento existe
    const tokenDir = path.dirname(this.config.tokenStoragePath);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
  }

  /**
   * Salva os tokens no armazenamento
   */
  public async saveTokens(tokens: Credentials): Promise<void> {
    this.tokens = tokens;
    try {
      await fs.promises.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(tokens, null, 2)
      );
      
      this.logger.info('Tokens salvos com sucesso');
      
      // Configura o temporizador para atualização automática do token
      this.setupTokenRefresh();
    } catch (error) {
      this.logger.error('Erro ao salvar tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém os tokens do armazenamento
   */
  public async getTokens(): Promise<Credentials | null> {
    if (this.tokens) {
      return this.tokens;
    }

    try {
      if (!fs.existsSync(this.config.tokenStoragePath)) {
        return null;
      }
      
      const tokensData = await fs.promises.readFile(this.config.tokenStoragePath, 'utf-8');
      this.tokens = JSON.parse(tokensData) as Credentials;
      return this.tokens;
    } catch (error) {
      this.logger.error('Erro ao obter tokens:');
      this.logger.error(error);
      return null;
    }
  }

  /**
   * Limpa os tokens armazenados
   */
  public async clearTokens(): Promise<void> {
    this.tokens = null;
    
    // Limpa o temporizador de atualização
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    try {
      if (fs.existsSync(this.config.tokenStoragePath)) {
        await fs.promises.unlink(this.config.tokenStoragePath);
      }
      
      this.logger.info('Tokens removidos com sucesso');
    } catch (error) {
      this.logger.error('Erro ao limpar tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Verifica se existem tokens válidos armazenados
   */
  public async hasValidTokens(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      
      if (!tokens) {
        return false;
      }
      
      // Verifica se há um token de acesso
      if (!tokens.access_token) {
        return false;
      }
      
      // Se houver uma data de expiração, verifica se o token expirou
      if (tokens.expiry_date) {
        const now = Date.now();
        // Se o token expira em menos de 5 minutos, considera inválido
        if (tokens.expiry_date <= now + 5 * 60 * 1000) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao verificar validade dos tokens:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Configura o temporizador para atualização automática do token
   */
  private setupTokenRefresh(): void {
    // Limpa o temporizador anterior, se existir
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Se não temos tokens, não configuramos atualização
    if (!this.tokens) return;
    
    let refreshTime = this.config.tokenRefreshInterval;
    
    // Se o token tem expiração, usar um tempo um pouco menor
    // para garantir que o token seja renovado antes de expirar
    if (this.tokens.expiry_date) {
      const expiresIn = this.tokens.expiry_date - Date.now();
      
      // Se o token já expirou ou vai expirar em menos de 5 minutos, 
      // atualiza em 1 minuto
      if (expiresIn < 5 * 60 * 1000) {
        refreshTime = 60 * 1000; // 1 minuto
      } else {
        // Atualiza 5 minutos antes de expirar
        refreshTime = expiresIn - (5 * 60 * 1000);
      }
    }
    
    this.logger.info(`Configurando atualização automática de token em ${refreshTime / 1000 / 60} minutos`);
    
    // Configura o temporizador
    this.refreshTimer = setTimeout(async () => {
      try {
        this.logger.info('Iniciando atualização automática de token...');
        
        // Chama o listener para atualizar o token
        if (this.tokenRefreshListener && this.tokens) {
          await this.tokenRefreshListener(this.tokens);
          
          // Configura a próxima atualização
          this.setupTokenRefresh();
        }
      } catch (error) {
        // Em caso de erro, tenta novamente em 1 minuto
        this.refreshTimer = setTimeout(() => this.setupTokenRefresh(), 60 * 1000);
      }
    }, refreshTime);
  }

  /**
   * Registra um ouvinte para eventos de atualização de token
   */
  public setTokenRefreshListener(listener: (tokens: Credentials) => Promise<void>): void {
    this.tokenRefreshListener = listener;
  }
} 