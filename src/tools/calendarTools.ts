import { McpTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GoogleCalendarService } from '../services/googleCalendar.js';
import * as Types from '../types/index.js';

export const createCalendarTools = (calendarService: GoogleCalendarService): McpTool[] => {
  return [
    {
      name: 'list-calendars',
      description: 'Listar todos os calendários disponíveis',
      parameters: Types.ListCalendarsSchema,
      execute: async () => {
        try {
          const calendars = await calendarService.listCalendars();
          return calendars;
        } catch (error) {
          console.error('Erro ao listar calendários:', error);
          throw error;
        }
      }
    },
    
    {
      name: 'get-calendar',
      description: 'Obtenha detalhes de um calendário específico',
      parameters: Types.GetCalendarSchema,
      execute: async (params: Types.GetCalendarParams) => {
        try {
          const calendar = await calendarService.getCalendar(params.calendarId);
          return calendar;
        } catch (error) {
          console.error(`Erro ao obter calendário ${params.calendarId}:`, error);
          throw error;
        }
      }
    },
    
    {
      name: 'list-events',
      description: 'Listar eventos de um calendário com opções de filtragem',
      parameters: Types.ListEventsSchema,
      execute: async (params: Types.ListEventsParams) => {
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
          return events;
        } catch (error) {
          console.error(`Erro ao listar eventos do calendário ${params.calendarId}:`, error);
          throw error;
        }
      }
    },
    
    {
      name: 'get-event',
      description: 'Obtenha informações detalhadas sobre um evento específico',
      parameters: Types.GetEventSchema,
      execute: async (params: Types.GetEventParams) => {
        try {
          const event = await calendarService.getEvent(params.calendarId, params.eventId);
          return event;
        } catch (error) {
          console.error(`Erro ao obter evento ${params.eventId}:`, error);
          throw error;
        }
      }
    },
    
    {
      name: 'create-event',
      description: 'Criar um novo evento de calendário',
      parameters: Types.CreateEventSchema,
      execute: async (params: Types.CreateEventParams) => {
        try {
          // Extrai os dados relevantes do evento do parâmetro
          const { calendarId, ...eventData } = params;
          
          const createdEvent = await calendarService.createEvent(calendarId, eventData);
          return createdEvent;
        } catch (error) {
          console.error('Erro ao criar evento:', error);
          throw error;
        }
      }
    },
    
    {
      name: 'update-event',
      description: 'Atualizar um evento de calendário existente',
      parameters: Types.UpdateEventSchema,
      execute: async (params: Types.UpdateEventParams) => {
        try {
          const { calendarId, eventId, ...eventData } = params;
          
          const updatedEvent = await calendarService.updateEvent(calendarId, eventId, eventData);
          return updatedEvent;
        } catch (error) {
          console.error(`Erro ao atualizar evento ${params.eventId}:`, error);
          throw error;
        }
      }
    },
    
    {
      name: 'delete-event',
      description: 'Excluir um evento do calendário',
      parameters: Types.DeleteEventSchema,
      execute: async (params: Types.DeleteEventParams) => {
        try {
          const result = await calendarService.deleteEvent(
            params.calendarId, 
            params.eventId, 
            params.sendUpdates
          );
          return result;
        } catch (error) {
          console.error(`Erro ao excluir evento ${params.eventId}:`, error);
          throw error;
        }
      }
    },
    
    {
      name: 'list-colors',
      description: 'Listar cores disponíveis para eventos e calendários',
      parameters: Types.ListColorsSchema,
      execute: async () => {
        try {
          const colors = await calendarService.listColors();
          return colors;
        } catch (error) {
          console.error('Erro ao listar cores disponíveis:', error);
          throw error;
        }
      }
    }
  ];
}; 