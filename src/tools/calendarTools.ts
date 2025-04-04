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
  ListCalendarsParams,
  GetCalendarParams,
  ListEventsParams,
  GetEventParams,
  CreateEventParams,
  UpdateEventParams,
  DeleteEventParams,
  ListColorsParams
} from '../types/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ILogger } from '../utils/logger.js';

export function registerCalendarTools(
  server: McpServer, 
  calendarService: GoogleCalendarService,
  logger: ILogger
): void {
  // Lista de calendários
  server.tool(
    'list-calendars',
    'Lista todos os calendários disponíveis',
    async () => {
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
        logger.error('[TOOLS] Erro ao listar calendários:', error);
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

  // Obter calendário específico
  server.tool(
    'get-calendar',
    'Obtenha detalhes de um calendário específico',
    GetCalendarSchema.shape,
    async (params: GetCalendarParams) => {
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
        logger.error(`[TOOLS] Erro ao obter calendário ${params.calendarId}:`, error);
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

  // Listar eventos
  server.tool(
    'list-events',
    'Listar eventos de um calendário com opções de filtragem',
    ListEventsSchema.shape,
    async (params: ListEventsParams) => {
      try {
        const events = await calendarService.listEvents(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(events, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error(`[TOOLS] Erro ao listar eventos do calendário ${params.calendarId}:`, error);
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

  // Obter evento específico
  server.tool(
    'get-event',
    'Obtenha informações detalhadas sobre um evento específico',
    GetEventSchema.shape,
    async (params: GetEventParams) => {
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
        logger.error(`[TOOLS] Erro ao obter evento ${params.eventId}:`, error);
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

  // Criar evento
  server.tool(
    'create-event',
    'Criar um novo evento de calendário',
    CreateEventSchema.shape,
    async (params: CreateEventParams) => {
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
        logger.error('[TOOLS] Erro ao criar evento:', error);
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

  // Atualizar evento
  server.tool(
    'update-event',
    'Atualizar um evento de calendário existente',
    UpdateEventSchema.shape,
    async (params: UpdateEventParams) => {
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
        logger.error(`[TOOLS] Erro ao atualizar evento ${params.eventId}:`, error);
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

  // Excluir evento
  server.tool(
    'delete-event',
    'Excluir um evento do calendário',
    DeleteEventSchema.shape,
    async (params: DeleteEventParams) => {
      try {
        const { calendarId, eventId, sendUpdates } = params;
        
        await calendarService.deleteEvent(calendarId, eventId, sendUpdates);
        return {
          content: [
            {
              type: 'text',
              text: `Evento ${eventId} excluído com sucesso`
            }
          ]
        };
      } catch (error) {
        logger.error(`[TOOLS] Erro ao excluir evento ${params.eventId}:`, error);
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

  // Listar cores disponíveis
  server.tool(
    'list-colors',
    'Listar cores disponíveis para eventos e calendários',
    async () => {
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
        logger.error('[TOOLS] Erro ao listar cores disponíveis:', error);
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
}