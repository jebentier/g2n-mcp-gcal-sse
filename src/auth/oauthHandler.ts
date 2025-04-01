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

    this.logger.debug(`[OAUTH] Inicializando | Callback URI: ${config.redirectUri} | Escopos: ${config.scopes.join(', ')}`);

    this.client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    
    this.logger.debug('[OAUTH] Cliente criado com sucesso');
  }

  /**
   * Gera a URL de autorização para iniciar o fluxo OAuth
   */
  public generateAuthUrl(): string {
    this.logger.debug('[OAUTH] Gerando URL de autorização');
    
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'  // Força o prompt de consentimento para obter sempre um refresh token
    });
    
    this.logger.debug(`[OAUTH] URL gerada: ${authUrl}`);
    return authUrl;
  }

  /**
   * Troca o código de autorização por tokens de acesso e atualização
   */
  public async exchangeCode(code: string): Promise<any> {
    this.logger.debug(`[OAUTH] Trocando código (parcial: ${code.substring(0, 10)}...) por tokens`);
    
    try {
      const { tokens } = await this.client.getToken(code);
      
      this.logger.debug(`[OAUTH] Tokens recebidos | Access: ${tokens.access_token?.substring(0, 10)}... | Refresh: ${tokens.refresh_token ? 'presente' : 'ausente'} | Expiração: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'}`);
      
      if (!tokens.refresh_token) {
        this.logger.error('[OAUTH] Nenhum refresh token retornado');
        throw new Error('Nenhum token de atualização retornado. Verifique se a solicitação inclui prompt=consent');
      }
      
      // Armazena os tokens no gerenciador de tokens
      this.logger.debug('[OAUTH] Salvando tokens');
      await this.tokenManager.saveTokens(tokens);
      
      this.logger.debug('[OAUTH] Configurando cliente');
      this.client.setCredentials(tokens);
      
      this.logger.debug('[OAUTH] Troca concluída com sucesso');
      return tokens;
    } catch (error) {
      this.logger.error('[OAUTH] Erro ao trocar código por tokens:', error);
      throw error;
    }
  }

  /**
   * Configura o cliente OAuth com tokens existentes
   */
  public async setupClientWithTokens(): Promise<OAuth2Client> {
    this.logger.debug('[OAUTH] Configurando cliente com tokens existentes');
    
    try {
      // Tenta obter tokens salvos
      const tokens = await this.tokenManager.getTokens();
      
      if (!tokens) {
        this.logger.error('[OAUTH] Tokens não encontrados');
        throw new Error('Não há tokens salvos. O usuário precisa autorizar primeiro.');
      }
      
      let timeToExpiry = 0;
      if (tokens.expiry_date) {
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        timeToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60);
      }
      
      this.logger.debug(`[OAUTH] Tokens carregados | Access: ${tokens.access_token?.substring(0, 10)}... | Refresh: ${tokens.refresh_token ? 'presente' : 'ausente'} | Expiração: ${timeToExpiry}min`);
      
      this.client.setCredentials(tokens);
      this.logger.debug('[OAUTH] Cliente configurado com sucesso');
      return this.client;
    } catch (error) {
      this.logger.error('[OAUTH] Erro ao configurar cliente:', error);
      throw error;
    }
  }

  /**
   * Revoga os tokens atuais
   */
  public async revokeTokens(): Promise<void> {
    this.logger.debug('[OAUTH] Iniciando revogação de tokens');
    
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (tokens && tokens.access_token) {
        this.logger.debug(`[OAUTH] Revogando access token: ${tokens.access_token.substring(0, 10)}...`);
        await this.client.revokeToken(tokens.access_token);
        this.logger.debug('[OAUTH] Access token revogado');
      } else {
        this.logger.debug('[OAUTH] Nenhum access token para revogar');
      }
      
      this.logger.debug('[OAUTH] Limpando tokens no TokenManager');
      await this.tokenManager.clearTokens();
      
      this.logger.debug('[OAUTH] Revogação concluída');
    } catch (error) {
      this.logger.error('[OAUTH] Erro ao revogar tokens:', error);
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