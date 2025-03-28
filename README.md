# G2N MCP Google Calendar SSE Server

🌎 This README is available in multiple languages:
- 🇺🇸 [English](README.md)
- 🇧🇷 [Português](README.pt-br.md)

## Overview

G2N MCP Google Calendar SSE Server is a Model Context Protocol (MCP) server implementation that provides Google Calendar integration through Server-Sent Events (SSE). This server exposes Google Calendar functionality as tools that can be used by AI models and tools like n8n to interact with Google Calendar.

## Features

The server provides the following MCP tools for Google Calendar management:

- `list-calendars`: List all available calendars
- `get-calendar`: Get details of a specific calendar
- `list-events`: List events from a calendar with filtering options
- `get-event`: Get detailed information about a specific event
- `create-event`: Create a new calendar event
- `update-event`: Update an existing calendar event
- `delete-event`: Delete a calendar event
- `list-colors`: List available colors for events and calendars

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Google Cloud Project with Calendar API enabled
- OAuth 2.0 Client ID and Client Secret

### Quick Start with Docker

1. Clone the repository:
   ```bash
   git clone https://github.com/gabriel-g2n/g2n-mcp-gcal-sse.git
   cd g2n-mcp-gcal-sse
   ```

2. Create an `.env` file based on the `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file and fill in your Google API credentials:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

4. Run the Docker container:
   ```bash
   docker-compose up -d
   ```

5. Navigate to the authentication URL to authorize the application:
   ```
   http://localhost:3001/auth
   ```
   
6. Follow the OAuth flow in your browser to grant access to your Google Calendar.

7. Once authorization is complete, the server will be available at http://localhost:3001

### Docker Swarm Deployment

For production deployment with Docker Swarm:

```bash
# Create Docker secrets for sensitive information
echo "your-client-id" | docker secret create google_client_id -
echo "your-client-secret" | docker secret create google_client_secret -

# Deploy the stack
docker stack deploy -c docker-compose.yml g2n-mcp-gcal
```

After deployment, navigate to `http://your-server:3001/auth` to complete the OAuth authorization flow.

## Authentication Flow

1. Start the server using Docker or directly
2. Navigate to `/auth` endpoint in your browser
3. Grant permissions to the application using your Google account
4. After authorization, the server will store refresh tokens for continued access
5. The server will automatically refresh tokens when needed

To revoke access, use the `/revoke` endpoint:
```bash
curl -X POST http://localhost:3001/revoke
```

## Usage with n8n

1. In n8n, add a new MCP node
2. Configure the MCP node with the SSE endpoint URL: `http://your-server:3001/sse`
3. Use the exposed calendar tools in your workflows

## Development

To set up a development environment:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Navigate to the authorization URL:
   ```
   http://localhost:3001/auth
   ```

4. Build the project:
   ```bash
   npm run build
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## About G2NTech

This project is developed and maintained by [Gabriel Augusto](https://github.com/oaugustosgabriel) at G2NTech.

## Support the Project 💜

If you find this project useful, consider supporting it via PIX:
- **PIX Key:** `gabriel@g2ngroup.com` 