import fs from 'fs';
import path from 'path';
import { Credentials } from 'google-auth-library';

interface TokenConfig {
  tokenStoragePath: string;
  tokenRefreshInterval: number; // em milissegundos
}

export class TokenManager {
  private config: TokenConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private onTokenRefresh: ((tokens: Credentials) => void) | null = null;

  constructor(config: TokenConfig) {
    this.config = {
      tokenStoragePath: config.tokenStoragePath || path.join(process.cwd(), 'tokens.json'),
      tokenRefreshInterval: config.tokenRefreshInterval || 30 * 60 * 1000, // 30 minutos por padrão
    };

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
    try {
      await fs.promises.writeFile(
        this.config.tokenStoragePath,
        JSON.stringify(tokens, null, 2)
      );
      
      console.log('Tokens salvos com sucesso');
      
      // Configura o temporizador para atualização automática do token
      this.setupTokenRefreshTimer(tokens);
      
      // Notifica os ouvintes sobre a atualização do token
      if (this.onTokenRefresh) {
        this.onTokenRefresh(tokens);
      }
    } catch (error) {
      console.error('Erro ao salvar tokens:', error);
      throw error;
    }
  }

  /**
   * Obtém os tokens do armazenamento
   */
  public async getTokens(): Promise<Credentials | null> {
    try {
      if (!fs.existsSync(this.config.tokenStoragePath)) {
        return null;
      }
      
      const tokensData = await fs.promises.readFile(this.config.tokenStoragePath, 'utf-8');
      return JSON.parse(tokensData) as Credentials;
    } catch (error) {
      console.error('Erro ao obter tokens:', error);
      return null;
    }
  }

  /**
   * Limpa os tokens armazenados
   */
  public async clearTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.config.tokenStoragePath)) {
        await fs.promises.unlink(this.config.tokenStoragePath);
      }
      
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      console.log('Tokens removidos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar tokens:', error);
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
      console.error('Erro ao verificar validade dos tokens:', error);
      return false;
    }
  }

  /**
   * Configura o temporizador para atualização automática do token
   */
  private setupTokenRefreshTimer(tokens: Credentials): void {
    // Limpa o temporizador anterior, se existir
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Se não houver data de expiração, usa o intervalo padrão
    let refreshTime = this.config.tokenRefreshInterval;
    
    // Se houver uma data de expiração, calcula o tempo até precisar renovar
    if (tokens.expiry_date) {
      const expiryTime = tokens.expiry_date;
      const now = Date.now();
      // Atualiza 5 minutos antes da expiração
      refreshTime = Math.max(expiryTime - now - 5 * 60 * 1000, 0); 
    }
    
    console.log(`Configurando atualização automática de token em ${refreshTime / 1000 / 60} minutos`);
    
    // Configura o temporizador
    this.refreshTimer = setTimeout(() => {
      this.triggerTokenRefresh();
    }, refreshTime);
  }

  /**
   * Dispara a lógica de atualização de token quando necessário
   */
  private triggerTokenRefresh(): void {
    console.log('Iniciando atualização automática de token...');
    // A lógica real de atualização deve ser manipulada pelo cliente OAuth
    // Este método apenas notifica o ouvinte registrado
    this.getTokens().then((tokens) => {
      if (tokens && this.onTokenRefresh) {
        this.onTokenRefresh(tokens);
      }
    });
  }

  /**
   * Registra um ouvinte para eventos de atualização de token
   */
  public setTokenRefreshListener(listener: (tokens: Credentials) => void): void {
    this.onTokenRefresh = listener;
  }
} 