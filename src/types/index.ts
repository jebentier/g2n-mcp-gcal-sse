import { z } from 'zod';

// Validation schemas for Google Calendar tools

export const ListCalendarsSchema = z.object({});

export const GetCalendarSchema = z.object({
  calendarId: z.string().describe('Calendar ID to get details')
});

export const ListEventsSchema = z.object({
  calendarId: z.string().describe('Calendar ID to list events'),
  timeMin: z.string().optional().describe('Minimum time (ISO format)'),
  timeMax: z.string().optional().describe('Maximum time (ISO format)'),
  maxResults: z.number().min(1).max(2500).optional().describe('Maximum number of results'),
  q: z.string().optional().describe('Full-text search term'),
  singleEvents: z.boolean().optional().describe('Expand recurring events'),
  orderBy: z.enum(['startTime', 'updated']).optional().describe('Order of events')
});

export const GetEventSchema = z.object({
  calendarId: z.string().describe('Calendar ID'),
  eventId: z.string().describe('Event ID to get details')
});

export const CreateEventSchema = z.object({
  calendarId: z.string().describe('Calendar ID to create the event'),
  summary: z.string().describe('Event title'),
  location: z.string().optional().describe('Event location'),
  description: z.string().optional().describe('Event description'),
  start: z.object({
    dateTime: z.string().optional().describe('Start date and time (ISO format)'),
    date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Time zone')
  }),
  end: z.object({
    dateTime: z.string().optional().describe('End date and time (ISO format)'),
    date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Time zone')
  }),
  colorId: z.string().optional().describe('Event color ID'),
  attendees: z.array(z.object({
    email: z.string().email().describe('Participant email'),
    displayName: z.string().optional().describe('Display name'),
    optional: z.boolean().optional().describe('Optional attendance')
  })).optional().describe('List of participants'),
  reminders: z.object({
    useDefault: z.boolean().optional().describe('Use default reminders'),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']).describe('Reminder method'),
      minutes: z.number().min(0).describe('Minutes before the event')
    })).optional().describe('Overrides for specific reminders')
  }).optional().describe('Reminder settings')
});

export const UpdateEventSchema = z.object({
  calendarId: z.string().describe('Calendar ID'),
  eventId: z.string().describe('Event ID to be updated'),
  summary: z.string().optional().describe('Event title'),
  location: z.string().optional().describe('Event location'),
  description: z.string().optional().describe('Event description'),
  start: z.object({
    dateTime: z.string().optional().describe('Start date and time (ISO format)'),
    date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Time zone')
  }).optional(),
  end: z.object({
    dateTime: z.string().optional().describe('End date and time (ISO format)'),
    date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
    timeZone: z.string().optional().describe('Time zone')
  }).optional(),
  colorId: z.string().optional().describe('Event color ID'),
  attendees: z.array(z.object({
    email: z.string().email().describe('Participant email'),
    displayName: z.string().optional().describe('Display name'),
    optional: z.boolean().optional().describe('Optional attendance')
  })).optional().describe('List of participants'),
  reminders: z.object({
    useDefault: z.boolean().optional().describe('Use default reminders'),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']).describe('Reminder method'),
      minutes: z.number().min(0).describe('Minutes before the event')
    })).optional().describe('Overrides for specific reminders')
  }).optional().describe('Reminder settings')
});

export const DeleteEventSchema = z.object({
  calendarId: z.string().describe('Calendar ID'),
  eventId: z.string().describe('Event ID to be deleted'),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional()
    .describe('Which cancellation notification to send')
});

export const ListColorsSchema = z.object({});

// Types inferred from schemas
export type ListCalendarsParams = z.infer<typeof ListCalendarsSchema>;
export type GetCalendarParams = z.infer<typeof GetCalendarSchema>;
export type ListEventsParams = z.infer<typeof ListEventsSchema>;
export type GetEventParams = z.infer<typeof GetEventSchema>;
export type CreateEventParams = z.infer<typeof CreateEventSchema>;
export type UpdateEventParams = z.infer<typeof UpdateEventSchema>;
export type DeleteEventParams = z.infer<typeof DeleteEventSchema>;
export type ListColorsParams = z.infer<typeof ListColorsSchema>;
