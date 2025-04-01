import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { TokenManager } from './tokenManager.js';
import { ILogger } from '../utils/logger.js';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export class OAuthHandler {
  private client: OAuth2Client;
  private config: OAuthConfig;
  private tokenManager: TokenManager;
  private logger: ILogger;

  constructor(config: OAuthConfig, tokenManager: TokenManager, logger: ILogger) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.logger = logger;

    this.client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
  }

  /**
   * Gera a URL de autorização para iniciar o fluxo OAuth
   */
  public generateAuthUrl(): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'  // Força o prompt de consentimento para obter sempre um refresh token
    });
  }

  /**
   * Troca o código de autorização por tokens de acesso e atualização
   */
  public async exchangeCode(code: string): Promise<void> {
    try {
      const { tokens } = await this.client.getToken(code);
      
      if (!tokens.refresh_token) {
        throw new Error('Nenhum token de atualização retornado. Verifique se a solicitação inclui prompt=consent');
      }
      
      // Armazena os tokens no gerenciador de tokens
      await this.tokenManager.saveTokens(tokens);
      
      this.client.setCredentials(tokens);
      
      return;
    } catch (error) {
      this.logger.error('Erro ao trocar código por tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Configura o cliente OAuth com tokens existentes
   */
  public async setupClientWithTokens(): Promise<OAuth2Client> {
    try {
      // Tenta obter tokens salvos
      const tokens = await this.tokenManager.getTokens();
      
      if (!tokens) {
        throw new Error('Não há tokens salvos. O usuário precisa autorizar primeiro.');
      }
      
      this.client.setCredentials(tokens);
      return this.client;
    } catch (error) {
      this.logger.error('Erro ao configurar cliente com tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Revoga os tokens atuais
   */
  public async revokeTokens(): Promise<void> {
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (tokens && tokens.access_token) {
        await this.client.revokeToken(tokens.access_token);
      }
      
      await this.tokenManager.clearTokens();
    } catch (error) {
      this.logger.error('Erro ao revogar tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém o cliente OAuth configurado
   */
  public getClient(): OAuth2Client {
    return this.client;
  }
} 