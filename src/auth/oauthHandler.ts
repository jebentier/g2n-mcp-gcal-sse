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

    this.logger.debug('Inicializando OAuthHandler');
    this.logger.debug(`URL de redirecionamento configurada: ${config.redirectUri}`);
    this.logger.debug(`Escopos configurados: ${config.scopes.join(', ')}`);

    this.client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    
    this.logger.debug('Cliente OAuth2 criado com sucesso');
  }

  /**
   * Gera a URL de autorização para iniciar o fluxo OAuth
   */
  public generateAuthUrl(): string {
    this.logger.debug('Gerando URL de autorização OAuth');
    
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'  // Força o prompt de consentimento para obter sempre um refresh token
    });
    
    this.logger.debug(`URL de autorização OAuth gerada: ${authUrl}`);
    return authUrl;
  }

  /**
   * Troca o código de autorização por tokens de acesso e atualização
   */
  public async exchangeCode(code: string): Promise<any> {
    this.logger.debug('Trocando código de autorização por tokens');
    this.logger.debug(`Código recebido (parcial): ${code.substring(0, 10)}...`);
    
    try {
      this.logger.debug('Chamando OAuth2Client.getToken');
      const { tokens } = await this.client.getToken(code);
      
      this.logger.debug('Tokens recebidos do servidor OAuth');
      this.logger.debug(`Access token (parcial): ${tokens.access_token?.substring(0, 10)}...`);
      this.logger.debug(`Refresh token presente: ${tokens.refresh_token ? 'Sim' : 'Não'}`);
      this.logger.debug(`Token expira em: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'}`);
      
      if (!tokens.refresh_token) {
        this.logger.error('Nenhum refresh token retornado pelo servidor OAuth');
        throw new Error('Nenhum token de atualização retornado. Verifique se a solicitação inclui prompt=consent');
      }
      
      // Armazena os tokens no gerenciador de tokens
      this.logger.debug('Salvando tokens no TokenManager');
      await this.tokenManager.saveTokens(tokens);
      
      this.logger.debug('Configurando tokens no cliente OAuth2');
      this.client.setCredentials(tokens);
      
      this.logger.debug('Troca de código por tokens concluída com sucesso');
      return tokens;
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
    this.logger.debug('Configurando cliente OAuth2 com tokens existentes');
    
    try {
      // Tenta obter tokens salvos
      this.logger.debug('Obtendo tokens do TokenManager');
      const tokens = await this.tokenManager.getTokens();
      
      if (!tokens) {
        this.logger.error('Não há tokens salvos no TokenManager');
        throw new Error('Não há tokens salvos. O usuário precisa autorizar primeiro.');
      }
      
      this.logger.debug(`Access token (parcial): ${tokens.access_token?.substring(0, 10)}...`);
      this.logger.debug(`Refresh token presente: ${tokens.refresh_token ? 'Sim' : 'Não'}`);
      
      if (tokens.expiry_date) {
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        const timeToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60);
        
        this.logger.debug(`Token expira em: ${expiryDate.toISOString()}`);
        this.logger.debug(`Tempo para expiração: aproximadamente ${timeToExpiry} minutos`);
      }
      
      this.logger.debug('Configurando tokens no cliente OAuth2');
      this.client.setCredentials(tokens);
      
      this.logger.debug('Cliente OAuth2 configurado com sucesso');
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
    this.logger.debug('Iniciando revogação de tokens');
    
    try {
      this.logger.debug('Obtendo tokens do TokenManager');
      const tokens = await this.tokenManager.getTokens();
      
      if (tokens && tokens.access_token) {
        this.logger.debug(`Revogando access token (parcial): ${tokens.access_token.substring(0, 10)}...`);
        await this.client.revokeToken(tokens.access_token);
        this.logger.debug('Access token revogado com sucesso');
      } else {
        this.logger.debug('Nenhum access token encontrado para revogar');
      }
      
      this.logger.debug('Limpando tokens no TokenManager');
      await this.tokenManager.clearTokens();
      
      this.logger.debug('Revogação de tokens concluída com sucesso');
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
    this.logger.debug('Obtendo cliente OAuth2');
    return this.client;
  }
} 