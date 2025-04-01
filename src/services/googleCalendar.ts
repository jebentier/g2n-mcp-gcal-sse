import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { OAuthHandler } from '../auth/oauthHandler.js';
import { TokenManager } from '../auth/tokenManager.js';
import { ILogger } from '../utils/logger.js';
import { 
  ListEventsParams, 
  GetCalendarParams,
  GetEventParams,
  CreateEventParams,
  UpdateEventParams,
  DeleteEventParams,
  ListColorsParams
} from '../types/index.js';

/**
 * Serviço para interagir com a API do Google Calendar
 */
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private oauthHandler: OAuthHandler;
  private tokenManager: TokenManager;
  private logger: ILogger;

  constructor(oauthHandler: OAuthHandler, tokenManager: TokenManager, logger: ILogger) {
    this.oauthHandler = oauthHandler;
    this.tokenManager = tokenManager;
    this.logger = logger;
    this.logger.debug('[GCAL] Serviço instanciado');
  }

  /**
   * Inicializa o cliente da API do Google Calendar
   */
  public async initialize(): Promise<boolean> {
    this.logger.debug('[GCAL] Inicializando cliente');
    
    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`[GCAL] Tokens disponíveis: ${hasTokens ? 'sim' : 'não'}`);
      
      if (!hasTokens) {
        this.logger.debug('[GCAL] Sem tokens válidos, inicialização cancelada');
        return false;
      }
      
      await this.setupClientWithTokens();
      
      // Configura o listener para refresh de token
      this.logger.debug('[GCAL] Configurando refresh automático de token');
      this.tokenManager.setupTokenRefresh(async (tokens) => {
        this.logger.debug('[GCAL] Executando refresh de token');
        await this.refreshAccessToken(tokens);
      });
      
      this.logger.debug('[GCAL] Cliente inicializado com sucesso');
      return true;
    } catch (error) {
      this.logger.error('[GCAL] Erro na inicialização:', error);
      return false;
    }
  }

  /**
   * Verifica se o serviço está autenticado
   */
  public async isAuthenticated(): Promise<boolean> {
    this.logger.debug('[GCAL] Verificando autenticação');
    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`[GCAL] Status: ${hasTokens ? 'autenticado' : 'não autenticado'}`);
      return hasTokens;
    } catch (error) {
      this.logger.error('[GCAL] Erro ao verificar autenticação:', error);
      return false;
    }
  }

  /**
   * Atualiza o token de acesso usando o refresh token
   */
  public async refreshAccessToken(tokens: any): Promise<void> {
    this.logger.debug('[GCAL] Iniciando refresh de token');
    
    try {
      if (!tokens.refresh_token) {
        this.logger.error('[GCAL] Refresh token não disponível');
        throw new Error('Refresh token não disponível');
      }
      
      this.logger.debug('[GCAL] Obtendo novo access token');
      const client = this.oauthHandler.getClient();
      client.setCredentials(tokens);
      const newTokens = await client.refreshAccessToken();
      
      // Preserva o refresh_token que pode não ser retornado em cada refresh
      if (!newTokens.credentials.refresh_token && tokens.refresh_token) {
        this.logger.debug('[GCAL] Preservando refresh token original');
        newTokens.credentials.refresh_token = tokens.refresh_token;
      }
      
      this.logger.debug('[GCAL] Salvando tokens atualizados');
      await this.tokenManager.saveTokens(newTokens.credentials);
      
      this.logger.debug('[GCAL] Configurando cliente com novos tokens');
      await this.setupClientWithTokens();
      
      this.logger.debug('[GCAL] Token atualizado com sucesso');
    } catch (error) {
      this.logger.error('[GCAL] Erro ao atualizar token:', error);
      throw error;
    }
  }

  /**
   * Configura o cliente da API com os tokens existentes
   */
  private async setupClientWithTokens(): Promise<void> {
    this.logger.debug('[GCAL] Configurando cliente com tokens');
    
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (!tokens) {
        this.logger.error('[GCAL] Tokens não encontrados');
        throw new Error('Tokens não encontrados');
      }
      
      this.logger.debug('[GCAL] Criando cliente da API');
      const auth = this.oauthHandler.getClient();
      auth.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.debug('[GCAL] Cliente configurado com sucesso');
    } catch (error) {
      this.logger.error('[GCAL] Erro ao configurar cliente:', error);
      throw error;
    }
  }

  /**
   * Processa o código de autorização recebido do callback OAuth
   */
  public async handleAuthCode(code: string): Promise<void> {
    this.logger.debug('[GCAL] Processando código de autorização');
    
    try {
      this.logger.debug('[GCAL] Trocando código por tokens');
      const tokens = await this.oauthHandler.exchangeCode(code);
      
      this.logger.debug('[GCAL] Código trocado com sucesso');
      await this.tokenManager.saveTokens(tokens);
      
      this.logger.debug('[GCAL] Configurando cliente');
      await this.setupClientWithTokens();
      
      this.logger.debug('[GCAL] Autorização processada com sucesso');
    } catch (error) {
      this.logger.error('[GCAL] Erro ao processar código:', error);
      throw error;
    }
  }

  /**
   * Obtém a URL para autenticação OAuth
   */
  public getAuthUrl(): string {
    this.logger.debug('[GCAL] Gerando URL de autenticação');
    const authUrl = this.oauthHandler.generateAuthUrl();
    this.logger.debug(`[GCAL] URL gerada: ${authUrl}`);
    return authUrl;
  }

  /**
   * Revoga o acesso atual
   */
  public async revokeAccess(): Promise<void> {
    this.logger.debug('[GCAL] Iniciando revogação de acesso');
    
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (tokens && tokens.access_token) {
        this.logger.debug('[GCAL] Revogando tokens');
        await this.oauthHandler.revokeTokens();
      }
      
      this.logger.debug('[GCAL] Limpando tokens locais');
      await this.tokenManager.clearTokens();
      
      this.calendar = null;
      this.logger.info('[GCAL] Acesso revogado com sucesso');
    } catch (error) {
      this.logger.error('[GCAL] Erro ao revogar acesso:', error);
      throw error;
    }
  }

  /**
   * Lista todos os calendários disponíveis
   */
  public async listCalendars(): Promise<calendar_v3.Schema$CalendarList> {
    this.logger.debug('[GCAL] Listando calendários');
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição calendarList.list');
      const response = await this.calendar.calendarList.list();
      this.logger.debug(`[GCAL] Encontrados ${response.data.items?.length || 0} calendários`);
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Erro ao listar calendários:', error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um calendário específico
   */
  public async getCalendar(calendarId: string): Promise<calendar_v3.Schema$Calendar> {
    this.logger.debug(`[GCAL] Obtendo calendário: ${calendarId}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição calendars.get');
      const response = await this.calendar.calendars.get({ calendarId });
      this.logger.debug(`[GCAL] Obtido: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Erro ao obter calendário ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Lista os eventos de um calendário
   */
  public async listEvents(params: {
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    singleEvents?: boolean,
    orderBy?: string
  }): Promise<calendar_v3.Schema$Events> {
    this.logger.debug(`[GCAL] Listando eventos | Calendário: ${params.calendarId} | Filtros: ${JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: params.maxResults,
      q: params.q,
      singleEvents: params.singleEvents,
      orderBy: params.orderBy
    })}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição events.list');
      const response = await this.calendar.events.list(params);
      this.logger.debug(`[GCAL] Encontrados ${response.data.items?.length || 0} eventos`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Erro ao listar eventos do calendário ${params.calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um evento específico
   */
  public async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Obtendo evento | ID: ${eventId} | Calendário: ${calendarId}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição events.get');
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      
      this.logger.debug(`[GCAL] Evento obtido: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Erro ao obter evento ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Cria um novo evento no calendário
   */
  public async createEvent(calendarId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Criando evento | Calendário: ${calendarId} | Resumo: ${eventData.summary || 'N/A'}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição events.insert');
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData
      });
      
      this.logger.debug(`[GCAL] Evento criado | ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Erro ao criar evento:', error);
      throw error;
    }
  }

  /**
   * Atualiza um evento existente
   */
  public async updateEvent(calendarId: string, eventId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`[GCAL] Atualizando evento | ID: ${eventId} | Calendário: ${calendarId}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição events.update');
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData
      });
      
      this.logger.debug(`[GCAL] Evento atualizado | ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Erro ao atualizar evento ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Exclui um evento do calendário
   */
  public async deleteEvent(calendarId: string, eventId: string, sendUpdates?: string): Promise<any> {
    this.logger.debug(`[GCAL] Excluindo evento | ID: ${eventId} | Calendário: ${calendarId} | Notificações: ${sendUpdates || 'padrão'}`);
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição events.delete');
      const response = await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates
      });
      
      this.logger.debug('[GCAL] Evento excluído com sucesso');
      return response.data;
    } catch (error) {
      this.logger.error(`[GCAL] Erro ao excluir evento ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Lista as cores disponíveis para eventos e calendários
   */
  public async listColors(): Promise<calendar_v3.Schema$Colors> {
    this.logger.debug('[GCAL] Listando cores disponíveis');
    
    try {
      if (!this.calendar) {
        this.logger.error('[GCAL] Cliente não inicializado');
        throw new Error('Cliente do Calendar não inicializado');
      }
      
      this.logger.debug('[GCAL] Requisição colors.get');
      const response = await this.calendar.colors.get({});
      this.logger.debug('[GCAL] Cores obtidas com sucesso');
      return response.data;
    } catch (error) {
      this.logger.error('[GCAL] Erro ao listar cores:', error);
      throw error;
    }
  }
}