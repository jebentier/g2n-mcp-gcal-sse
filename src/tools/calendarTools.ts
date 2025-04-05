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
  // List calendars
  // server.tool(
  //   'listCalendars',
  //   'List all available calendars',
  //   ListCalendarsSchema.shape,
  //   async (params: ListCalendarsParams) => {
  //     try {
  //       const calendars = await calendarService.listCalendars();
  //       return {
  //         content: [
  //           {
  //             type: 'text',
  //             text: JSON.stringify(calendars, null, 2)
  //           }
  //         ]
  //       };
  //     } catch (error) {
  //       logger.error('[TOOLS] Error listing calendars:', error);
  //       return {
  //         content: [
  //           {
  //             type: 'text',
  //             text: `Error listing calendars: ${error}`
  //           }
  //         ],
  //         isError: true
  //       };
  //     }
  //   }
  // );

  // Get specific calendar
  server.tool(
    'getCalendar',
    'Get details of a specific calendar',
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
        logger.error(`[TOOLS] Error getting calendar ${params.calendarId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error getting calendar ${params.calendarId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List events
  server.tool(
    'listEvents',
    'List events of a calendar with filtering options',
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
        logger.error(`[TOOLS] Error listing events of calendar ${params.calendarId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error listing events of calendar ${params.calendarId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get specific event
  server.tool(
    'getEvent',
    'Get detailed information about a specific event',
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
        logger.error(`[TOOLS] Error getting event ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error getting event ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create event
  server.tool(
    'createEvent',
    'Create a new calendar event',
    CreateEventSchema.shape,
    async (params: CreateEventParams) => {
      try {
        // Extract relevant event data from the parameter
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
        logger.error('[TOOLS] Error creating event:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error creating event: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update event
  server.tool(
    'updateEvent',
    'Update an existing calendar event',
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
        logger.error(`[TOOLS] Error updating event ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error updating event ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete event
  server.tool(
    'deleteEvent',
    'Delete a calendar event',
    DeleteEventSchema.shape,
    async (params: DeleteEventParams) => {
      try {
        const { calendarId, eventId, sendUpdates } = params;

        await calendarService.deleteEvent(calendarId, eventId, sendUpdates);
        return {
          content: [
            {
              type: 'text',
              text: `Event ${eventId} successfully deleted`
            }
          ]
        };
      } catch (error) {
        logger.error(`[TOOLS] Error deleting event ${params.eventId}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting event ${params.eventId}: ${error}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List available colors
  // server.tool(
  //   'listColors',
  //   'List available colors for events and calendars',
  //   ListColorsSchema.shape,
  //   async (params: ListColorsParams) => {
  //     try {
  //       const colors = await calendarService.listColors();
  //       return {
  //         content: [
  //           {
  //             type: 'text',
  //             text: JSON.stringify(colors, null, 2)
  //           }
  //         ]
  //       };
  //     } catch (error) {
  //       logger.error('[TOOLS] Error listing available colors:', error);
  //       return {
  //         content: [
  //           {
  //             type: 'text',
  //             text: `Error listing available colors: ${error}`
  //           }
  //         ],
  //         isError: true
  //       };
  //     }
  //   }
  // );
}
