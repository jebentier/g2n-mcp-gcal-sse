import { z } from 'zod';

// Esquemas de validação para ferramentas do Google Calendar

export const ListCalendarsSchema = z.object({});

export const GetCalendarSchema = z.object({
  calendarId: z.string().describe('ID do calendário para obter detalhes')
});

export const ListEventsSchema = z.object({
  calendarId: z.string().describe('ID do calendário para listar eventos'),
  timeMin: z.string().optional().describe('Tempo mínimo (formato ISO)'),
  timeMax: z.string().optional().describe('Tempo máximo (formato ISO)'),
  maxResults: z.number().min(1).max(2500).optional().describe('Número máximo de resultados'),
  q: z.string().optional().describe('Termo de pesquisa de texto completo'),
  singleEvents: z.boolean().optional().describe('Expandir eventos recorrentes'),
  orderBy: z.enum(['startTime', 'updated']).optional().describe('Ordem de eventos')
});

export const GetEventSchema = z.object({
  calendarId: z.string().describe('ID do calendário'),
  eventId: z.string().describe('ID do evento para obter detalhes')
});

export const CreateEventSchema = z.object({
  calendarId: z.string().describe('ID do calendário para criar o evento'),
  summary: z.string().describe('Título do evento'),
  location: z.string().optional().describe('Local do evento'),
  description: z.string().optional().describe('Descrição do evento'),
  start: z.object({
    dateTime: z.string().optional().describe('Data e hora de início (formato ISO)'),
    date: z.string().optional().describe('Data de início para eventos de dia inteiro (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Fuso horário')
  }),
  end: z.object({
    dateTime: z.string().optional().describe('Data e hora de término (formato ISO)'),
    date: z.string().optional().describe('Data de término para eventos de dia inteiro (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Fuso horário')
  }),
  colorId: z.string().optional().describe('ID da cor do evento'),
  attendees: z.array(z.object({
    email: z.string().email().describe('Email do participante'),
    displayName: z.string().optional().describe('Nome de exibição'),
    optional: z.boolean().optional().describe('Presença opcional')
  })).optional().describe('Lista de participantes'),
  reminders: z.object({
    useDefault: z.boolean().optional().describe('Usar lembretes padrão'),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']).describe('Método do lembrete'),
      minutes: z.number().min(0).describe('Minutos antes do evento')
    })).optional().describe('Substituições para lembretes específicos')
  }).optional().describe('Configurações de lembretes')
});

export const UpdateEventSchema = z.object({
  calendarId: z.string().describe('ID do calendário'),
  eventId: z.string().describe('ID do evento a ser atualizado'),
  summary: z.string().optional().describe('Título do evento'),
  location: z.string().optional().describe('Local do evento'),
  description: z.string().optional().describe('Descrição do evento'),
  start: z.object({
    dateTime: z.string().optional().describe('Data e hora de início (formato ISO)'),
    date: z.string().optional().describe('Data de início para eventos de dia inteiro (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Fuso horário')
  }).optional(),
  end: z.object({
    dateTime: z.string().optional().describe('Data e hora de término (formato ISO)'),
    date: z.string().optional().describe('Data de término para eventos de dia inteiro (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Fuso horário')
  }).optional(),
  colorId: z.string().optional().describe('ID da cor do evento'),
  attendees: z.array(z.object({
    email: z.string().email().describe('Email do participante'),
    displayName: z.string().optional().describe('Nome de exibição'),
    optional: z.boolean().optional().describe('Presença opcional')
  })).optional().describe('Lista de participantes'),
  reminders: z.object({
    useDefault: z.boolean().optional().describe('Usar lembretes padrão'),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']).describe('Método do lembrete'),
      minutes: z.number().min(0).describe('Minutos antes do evento')
    })).optional().describe('Substituições para lembretes específicos')
  }).optional().describe('Configurações de lembretes')
});

export const DeleteEventSchema = z.object({
  calendarId: z.string().describe('ID do calendário'),
  eventId: z.string().describe('ID do evento a ser excluído'),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional()
    .describe('Qual notificação de cancelamento enviar')
});

export const ListColorsSchema = z.object({});

// Tipos inferidos dos esquemas
export type ListCalendarsParams = z.infer<typeof ListCalendarsSchema>;
export type GetCalendarParams = z.infer<typeof GetCalendarSchema>;
export type ListEventsParams = z.infer<typeof ListEventsSchema>;
export type GetEventParams = z.infer<typeof GetEventSchema>;
export type CreateEventParams = z.infer<typeof CreateEventSchema>;
export type UpdateEventParams = z.infer<typeof UpdateEventSchema>;
export type DeleteEventParams = z.infer<typeof DeleteEventSchema>;
export type ListColorsParams = z.infer<typeof ListColorsSchema>; 