import { GoogleCalendarService } from '../services/googleCalendar.js';
import { 
  ListCalendarsSchema,
  GetCalendarSchema,
  ListEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  ListColorsSchema,
  ListEventsParams,
  GetCalendarParams,
  GetEventParams,
  CreateEventParams,
  UpdateEventParams,
  DeleteEventParams
} from '../types/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const registerCalendarTools = (server: McpServer, calendarService: GoogleCalendarService): void => {
  // List Calendars
  server.tool(
    'list-calendars',
    'Listar todos os calendários disponíveis',
    async (extra) => {
      try {
        const calendars = await calendarService.listCalendars();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(calendars, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error('Erro ao listar calendários:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao listar calendários: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get Calendar
  server.tool(
    'get-calendar',
    'Obtenha detalhes de um calendário específico',
    GetCalendarSchema.shape,
    async (params: GetCalendarParams, extra) => {
      try {
        const calendar = await calendarService.getCalendar(params.calendarId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(calendar, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Erro ao obter calendário ${params.calendarId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao obter calendário ${params.calendarId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List Events
  server.tool(
    'list-events',
    'Listar eventos de um calendário com opções de filtragem',
    ListEventsSchema.shape,
    async (params: ListEventsParams, extra) => {
      try {
        const events = await calendarService.listEvents({
          calendarId: params.calendarId,
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          maxResults: params.maxResults,
          q: params.q,
          singleEvents: params.singleEvents,
          orderBy: params.orderBy
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(events, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Erro ao listar eventos do calendário ${params.calendarId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao listar eventos do calendário ${params.calendarId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get Event
  server.tool(
    'get-event',
    'Obtenha informações detalhadas sobre um evento específico',
    GetEventSchema.shape,
    async (params: GetEventParams, extra) => {
      try {
        const event = await calendarService.getEvent(params.calendarId, params.eventId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(event, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Erro ao obter evento ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao obter evento ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create Event
  server.tool(
    'create-event',
    'Criar um novo evento de calendário',
    CreateEventSchema.shape,
    async (params: CreateEventParams, extra) => {
      try {
        // Extrai os dados relevantes do evento do parâmetro
        const { calendarId, ...eventData } = params;
        
        const createdEvent = await calendarService.createEvent(calendarId, eventData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(createdEvent, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error('Erro ao criar evento:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao criar evento: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update Event
  server.tool(
    'update-event',
    'Atualizar um evento de calendário existente',
    UpdateEventSchema.shape,
    async (params: UpdateEventParams, extra) => {
      try {
        const { calendarId, eventId, ...eventData } = params;
        
        const updatedEvent = await calendarService.updateEvent(calendarId, eventId, eventData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedEvent, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Erro ao atualizar evento ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao atualizar evento ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete Event
  server.tool(
    'delete-event',
    'Excluir um evento do calendário',
    DeleteEventSchema.shape,
    async (params: DeleteEventParams, extra) => {
      try {
        const result = await calendarService.deleteEvent(
          params.calendarId, 
          params.eventId, 
          params.sendUpdates
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Erro ao excluir evento ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao excluir evento ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List Colors
  server.tool(
    'list-colors',
    'Listar cores disponíveis para eventos e calendários',
    async (extra) => {
      try {
        const colors = await calendarService.listColors();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(colors, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error('Erro ao listar cores disponíveis:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro ao listar cores disponíveis: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );
}; 