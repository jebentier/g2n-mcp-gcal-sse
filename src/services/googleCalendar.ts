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

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private oauthHandler: OAuthHandler;
  private tokenManager: TokenManager;
  private logger: ILogger;

  constructor(oauthHandler: OAuthHandler, tokenManager: TokenManager, logger: ILogger) {
    this.oauthHandler = oauthHandler;
    this.tokenManager = tokenManager;
    this.logger = logger;
    
    // Inicialmente, cria o cliente do Calendar com o cliente OAuth
    this.calendar = google.calendar({
      version: 'v3',
      auth: this.oauthHandler.getClient()
    });
    
    // Configura o ouvinte de atualização de token
    this.tokenManager.setTokenRefreshListener(async (tokens) => {
      await this.refreshAccessToken();
    });
  }

  /**
   * Inicializa o serviço do Calendar com tokens existentes
   */
  public async initialize(): Promise<boolean> {
    try {
      // Verifica se já temos tokens válidos
      const hasValidTokens = await this.tokenManager.hasValidTokens();
      
      if (hasValidTokens) {
        // Configura o cliente com tokens existentes
        await this.oauthHandler.setupClientWithTokens();
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Erro ao inicializar serviço do Calendar:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Verifica se o serviço está autenticado com tokens válidos
   */
  public async isAuthenticated(): Promise<boolean> {
    try {
      // Verifica se temos tokens válidos
      const hasValidTokens = await this.tokenManager.hasValidTokens();
      
      if (hasValidTokens) {
        // Tenta a inicialização se temos tokens
        await this.oauthHandler.setupClientWithTokens();
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Erro ao verificar autenticação:');
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Método para gerenciar tokens de acesso
   */
  public async refreshAccessToken(): Promise<void> {
    try {
      const auth = await this.oauthHandler.setupClientWithTokens();
      
      // Atualiza o cliente do Calendar com o cliente OAuth atualizado
      this.calendar = google.calendar({
        version: 'v3',
        auth
      });
      
    } catch (error) {
      this.logger.error('Erro ao atualizar token de acesso:');
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Obtém a URL de autorização OAuth
   */
  public getAuthUrl(): string {
    return this.oauthHandler.generateAuthUrl();
  }

  /**
   * Processa o código de autorização retornado pelo Google
   */
  public async handleAuthCode(code: string): Promise<void> {
    await this.oauthHandler.exchangeCode(code);
    await this.refreshAccessToken();
  }

  /**
   * Revoga o acesso atual
   */
  public async revokeAccess(): Promise<void> {
    await this.oauthHandler.revokeTokens();
  }

  // Métodos de Calendário
  public async listCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao listar calendários:');
      this.logger.error(error);
      throw new Error(`Erro ao listar calendários: ${error}`);
    }
  }

  public async getCalendar(calendarId: GetCalendarParams['calendarId']) {
    try {
      const response = await this.calendar.calendarList.get({
        calendarId
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter calendário ${calendarId}:`);
      this.logger.error(error);
      throw new Error(`Erro ao obter calendário ${calendarId}: ${error}`);
    }
  }

  // Métodos de Eventos
  public async listEvents(params: Omit<ListEventsParams, 'orderBy'> & { orderBy?: 'startTime' | 'updated' | string }) {
    try {
      const response = await this.calendar.events.list({
        calendarId: params.calendarId,
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        maxResults: params.maxResults,
        q: params.q,
        singleEvents: params.singleEvents,
        orderBy: params.orderBy as 'startTime' | 'updated' | undefined,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao listar eventos do calendário ${params.calendarId}:`);
      this.logger.error(error);
      throw new Error(`Erro ao listar eventos do calendário ${params.calendarId}: ${error}`);
    }
  }

  public async getEvent(
    calendarId: GetEventParams['calendarId'], 
    eventId: GetEventParams['eventId']
  ) {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter evento ${eventId}:`);
      this.logger.error(error);
      throw new Error(`Erro ao obter evento ${eventId}: ${error}`);
    }
  }

  public async createEvent(
    calendarId: CreateEventParams['calendarId'], 
    eventData: Omit<CreateEventParams, 'calendarId'>
  ) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData as calendar_v3.Schema$Event,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao criar evento:');
      this.logger.error(error);
      throw new Error(`Erro ao criar evento: ${error}`);
    }
  }

  public async updateEvent(
    calendarId: UpdateEventParams['calendarId'], 
    eventId: UpdateEventParams['eventId'], 
    eventData: Omit<UpdateEventParams, 'calendarId' | 'eventId'>
  ) {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData as calendar_v3.Schema$Event,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao atualizar evento ${eventId}:`);
      this.logger.error(error);
      throw new Error(`Erro ao atualizar evento ${eventId}: ${error}`);
    }
  }

  public async deleteEvent(
    calendarId: DeleteEventParams['calendarId'], 
    eventId: DeleteEventParams['eventId'], 
    sendUpdates?: DeleteEventParams['sendUpdates']
  ) {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates
      });
      return { success: true, message: `Evento ${eventId} excluído com sucesso` };
    } catch (error) {
      this.logger.error(`Erro ao excluir evento ${eventId}:`);
      this.logger.error(error);
      throw new Error(`Erro ao excluir evento ${eventId}: ${error}`);
    }
  }

  // Cores disponíveis
  public async listColors() {
    try {
      const response = await this.calendar.colors.get();
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao listar cores disponíveis:');
      this.logger.error(error);
      throw new Error(`Erro ao listar cores disponíveis: ${error}`);
    }
  }
} 