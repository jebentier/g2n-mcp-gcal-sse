import { calendar_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private auth: OAuth2Client;

  constructor(credentials: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) {
    this.auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    );
    
    this.auth.setCredentials({
      refresh_token: credentials.refreshToken
    });

    this.calendar = google.calendar({
      version: 'v3',
      auth: this.auth
    });
  }

  // Método para gerenciar tokens de acesso
  public async refreshAccessToken(): Promise<string> {
    const { credentials } = await this.auth.refreshAccessToken();
    this.auth.setCredentials(credentials);
    return credentials.access_token || '';
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