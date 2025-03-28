import { calendar_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { OAuthHandler } from '../auth/oauthHandler.js';
import { TokenManager } from '../auth/tokenManager.js';

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private oauthHandler: OAuthHandler;
  private tokenManager: TokenManager;

  constructor(oauthHandler: OAuthHandler, tokenManager: TokenManager) {
    this.oauthHandler = oauthHandler;
    this.tokenManager = tokenManager;
    
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
      console.error('Erro ao inicializar serviço do Calendar:', error);
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
      console.error('Erro ao atualizar token de acesso:', error);
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
      throw new Error(`Erro ao listar calendários: ${error}`);
    }
  }

  public async getCalendar(calendarId: string) {
    try {
      const response = await this.calendar.calendarList.get({
        calendarId
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter calendário ${calendarId}: ${error}`);
    }
  }

  // Métodos de Eventos
  public async listEvents(params: {
    calendarId: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    q?: string;
    singleEvents?: boolean;
    orderBy?: string;
  }) {
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
      throw new Error(`Erro ao listar eventos do calendário ${params.calendarId}: ${error}`);
    }
  }

  public async getEvent(calendarId: string, eventId: string) {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter evento ${eventId}: ${error}`);
    }
  }

  public async createEvent(calendarId: string, eventData: calendar_v3.Schema$Event) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao criar evento: ${error}`);
    }
  }

  public async updateEvent(
    calendarId: string, 
    eventId: string, 
    eventData: calendar_v3.Schema$Event
  ) {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao atualizar evento ${eventId}: ${error}`);
    }
  }

  public async deleteEvent(
    calendarId: string, 
    eventId: string, 
    sendUpdates?: 'all' | 'externalOnly' | 'none'
  ) {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates
      });
      return { success: true, message: `Evento ${eventId} excluído com sucesso` };
    } catch (error) {
      throw new Error(`Erro ao excluir evento ${eventId}: ${error}`);
    }
  }

  // Cores disponíveis
  public async listColors() {
    try {
      const response = await this.calendar.colors.get();
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao listar cores disponíveis: ${error}`);
    }
  }
} 