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
    this.logger.debug('GoogleCalendarService instanciado');
  }

  /**
   * Inicializa o cliente da API do Google Calendar
   */
  public async initialize(): Promise<boolean> {
    this.logger.debug('Tentando inicializar cliente do Google Calendar');
    
    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`Tokens válidos disponíveis: ${hasTokens}`);
      
      if (!hasTokens) {
        this.logger.debug('Não há tokens válidos, inicialização cancelada');
        return false;
      }
      
      await this.setupClientWithTokens();
      
      // Configura o listener para refresh de token
      this.logger.debug('Configurando listener de refresh de token');
      this.tokenManager.setupTokenRefresh(async (tokens) => {
        this.logger.debug('Executando refresh de token solicitado pelo TokenManager');
        await this.refreshAccessToken(tokens);
      });
      
      this.logger.debug('Cliente do Google Calendar inicializado com sucesso');
      return true;
    } catch (error) {
      this.logger.error('Erro ao inicializar cliente do Google Calendar:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Verifica se o serviço está autenticado
   */
  public async isAuthenticated(): Promise<boolean> {
    this.logger.debug('Verificando autenticação do serviço');
    try {
      const hasTokens = await this.tokenManager.hasValidTokens();
      this.logger.debug(`Status de autenticação: ${hasTokens ? 'autenticado' : 'não autenticado'}`);
      return hasTokens;
    } catch (error) {
      this.logger.error('Erro ao verificar autenticação:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Atualiza o token de acesso usando o refresh token
   */
  public async refreshAccessToken(tokens: any): Promise<void> {
    this.logger.debug('Iniciando refresh de access token');
    
    try {
      if (!tokens.refresh_token) {
        this.logger.error('Refresh token não disponível');
        throw new Error('Refresh token não disponível');
      }
      
      this.logger.debug('Obtendo novo access token');
      const client = this.oauthHandler.getClient();
      client.setCredentials(tokens);
      const newTokens = await client.refreshAccessToken();
      
      // Preserva o refresh_token que pode não ser retornado em cada refresh
      if (!newTokens.credentials.refresh_token && tokens.refresh_token) {
        this.logger.debug('Preservando refresh token original pois não foi retornado um novo');
        newTokens.credentials.refresh_token = tokens.refresh_token;
      }
      
      this.logger.debug('Salvando tokens atualizados');
      await this.tokenManager.saveTokens(newTokens.credentials);
      
      this.logger.debug('Configurando cliente com novos tokens');
      await this.setupClientWithTokens();
      
      this.logger.debug('Token atualizado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao atualizar access token:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Configura o cliente da API com os tokens existentes
   */
  private async setupClientWithTokens(): Promise<void> {
    this.logger.debug('Configurando cliente da API com tokens');
    
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (!tokens) {
        this.logger.error('Tokens não encontrados para configurar cliente');
        throw new Error('Tokens não encontrados');
      }
      
      this.logger.debug('Criando cliente OAuth2 e API do Calendar');
      const auth = this.oauthHandler.getClient();
      auth.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.debug('Cliente da API configurado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao configurar cliente com tokens:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Processa o código de autorização recebido do callback OAuth
   */
  public async handleAuthCode(code: string): Promise<void> {
    this.logger.debug('Processando código de autorização recebido');
    
    try {
      this.logger.debug('Trocando código por tokens');
      const tokens = await this.oauthHandler.exchangeCode(code);
      
      this.logger.debug('Código trocado com sucesso, salvando tokens');
      await this.tokenManager.saveTokens(tokens);
      
      this.logger.debug('Configurando cliente com tokens obtidos');
      await this.setupClientWithTokens();
      
      this.logger.debug('Autorização processada com sucesso');
    } catch (error) {
      this.logger.error('Erro ao processar código de autorização:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém a URL para autenticação OAuth
   */
  public getAuthUrl(): string {
    this.logger.debug('Gerando URL de autenticação OAuth');
    const authUrl = this.oauthHandler.generateAuthUrl();
    this.logger.debug(`URL de autenticação gerada: ${authUrl}`);
    return authUrl;
  }

  /**
   * Revoga o acesso atual
   */
  public async revokeAccess(): Promise<void> {
    this.logger.debug('Iniciando revogação de acesso');
    
    try {
      const tokens = await this.tokenManager.getTokens();
      
      if (tokens && tokens.access_token) {
        this.logger.debug('Revogando tokens no servidor OAuth');
        await this.oauthHandler.revokeTokens();
      }
      
      this.logger.debug('Limpando tokens locais');
      await this.tokenManager.clearTokens();
      
      this.calendar = null;
      this.logger.info('Acesso revogado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao revogar acesso:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Lista todos os calendários disponíveis
   */
  public async listCalendars(): Promise<calendar_v3.Schema$CalendarList> {
    this.logger.debug('Listando calendários disponíveis');
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API calendarList.list');
      const response = await this.calendar.calendarList.list();
      this.logger.debug(`Encontrados ${response.data.items?.length || 0} calendários`);
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao listar calendários:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém informações sobre um calendário específico
   */
  public async getCalendar(calendarId: string): Promise<calendar_v3.Schema$Calendar> {
    this.logger.debug(`Obtendo detalhes do calendário: ${calendarId}`);
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API calendars.get');
      const response = await this.calendar.calendars.get({ calendarId });
      this.logger.debug(`Dados do calendário obtidos com sucesso: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter calendário ${calendarId}:`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Lista eventos de um calendário
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
    this.logger.debug(`Listando eventos do calendário: ${params.calendarId}`);
    this.logger.debug(`Parâmetros: ${JSON.stringify({
      timeMin: params.timeMin || 'não definido',
      timeMax: params.timeMax || 'não definido',
      maxResults: params.maxResults || 'não definido',
      q: params.q || 'não definido',
      singleEvents: params.singleEvents || 'não definido',
      orderBy: params.orderBy || 'não definido'
    })}`);
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API events.list');
      const response = await this.calendar.events.list(params);
      this.logger.debug(`Encontrados ${response.data.items?.length || 0} eventos`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao listar eventos do calendário ${params.calendarId}:`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém informações sobre um evento específico
   */
  public async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`Obtendo detalhes do evento: ${eventId} do calendário: ${calendarId}`);
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API events.get');
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      this.logger.debug(`Dados do evento obtidos com sucesso: ${response.data.summary}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter evento ${eventId}:`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Cria um novo evento no calendário
   */
  public async createEvent(calendarId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`Criando evento no calendário: ${calendarId}`);
    this.logger.debug(`Dados do evento: ${JSON.stringify({
      summary: eventData.summary || 'não definido',
      start: eventData.start ? 'definido' : 'não definido',
      end: eventData.end ? 'definido' : 'não definido'
    })}`);
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API events.insert');
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData
      });
      this.logger.debug(`Evento criado com sucesso: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao criar evento:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Atualiza um evento existente
   */
  public async updateEvent(calendarId: string, eventId: string, eventData: any): Promise<calendar_v3.Schema$Event> {
    this.logger.debug(`Atualizando evento: ${eventId} no calendário: ${calendarId}`);
    this.logger.debug(`Dados para atualização: ${JSON.stringify({
      summary: eventData.summary || 'não modificado',
      start: eventData.start ? 'modificado' : 'não modificado',
      end: eventData.end ? 'modificado' : 'não modificado'
    })}`);
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API events.update');
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData
      });
      this.logger.debug(`Evento atualizado com sucesso: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao atualizar evento ${eventId}:`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Exclui um evento do calendário
   */
  public async deleteEvent(calendarId: string, eventId: string, sendUpdates?: string): Promise<any> {
    this.logger.debug(`Excluindo evento: ${eventId} do calendário: ${calendarId}`);
    if (sendUpdates) {
      this.logger.debug(`Modo de notificação: ${sendUpdates}`);
    }
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API events.delete');
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates
      });
      this.logger.debug('Evento excluído com sucesso');
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao excluir evento ${eventId}:`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Lista as cores disponíveis para eventos e calendários
   */
  public async listColors(): Promise<calendar_v3.Schema$Colors> {
    this.logger.debug('Listando cores disponíveis para eventos e calendários');
    
    if (!this.calendar) {
      this.logger.error('Cliente do Calendar não inicializado');
      throw new Error('Cliente do Calendar não inicializado');
    }
    
    try {
      this.logger.debug('Fazendo requisição à API colors.get');
      const response = await this.calendar.colors.get();
      this.logger.debug('Cores obtidas com sucesso');
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao listar cores disponíveis:');
      this.logger.error(error);
      throw error;
    }
  }
}