# Servidor G2N MCP SSE para Google Calendar

🌎 Este README está disponível em múltiplos idiomas:
- 🇺🇸 [English](README.md)
- 🇧🇷 [Português](README.pt-br.md)

## Visão Geral

O Servidor G2N MCP Google Calendar SSE é uma implementação de servidor Model Context Protocol (MCP) que fornece integração com o Google Calendar através de Server-Sent Events (SSE). Este servidor expõe funcionalidades do Google Calendar como ferramentas que podem ser utilizadas por modelos de IA e ferramentas como o n8n para interagir com o Google Calendar.

## Funcionalidades

O servidor fornece as seguintes ferramentas MCP para gerenciamento do Google Calendar:

- `list-calendars`: Listar todos os calendários disponíveis
- `get-calendar`: Obter detalhes de um calendário específico
- `list-events`: Listar eventos de um calendário com opções de filtragem
- `get-event`: Obter informações detalhadas sobre um evento específico
- `create-event`: Criar um novo evento no calendário
- `update-event`: Atualizar um evento existente no calendário
- `delete-event`: Excluir um evento do calendário
- `list-colors`: Listar cores disponíveis para eventos e calendários

## Começando

### Pré-requisitos

- Docker e Docker Compose instalados
- Credenciais da API do Google Calendar (Client ID, Client Secret e Refresh Token)

### Início Rápido com Docker

1. Clone o repositório:
   ```bash
   git clone https://github.com/gabriel-g2n/g2n-mcp-gcal-sse.git
   cd g2n-mcp-gcal-sse
   ```

2. Crie um arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edite o arquivo `.env` e preencha com suas credenciais do Google Calendar:
   ```
   GOOGLE_CLIENT_ID=seu-client-id
   GOOGLE_CLIENT_SECRET=seu-client-secret
   GOOGLE_REFRESH_TOKEN=seu-refresh-token
   ```

4. Execute o contêiner Docker:
   ```bash
   docker-compose up -d
   ```

5. O servidor estará disponível em http://localhost:3001

### Implantação no Docker Swarm

Para implantação em produção com Docker Swarm:

```bash
# Crie segredos Docker para informações sensíveis
echo "seu-client-id" | docker secret create google_client_id -
echo "seu-client-secret" | docker secret create google_client_secret -
echo "seu-refresh-token" | docker secret create google_refresh_token -

# Implante a stack
docker stack deploy -c docker-compose.yml g2n-mcp-gcal
```

## Uso com n8n

1. No n8n, adicione um novo nó MCP
2. Configure o nó MCP com a URL do endpoint SSE: `http://seu-servidor:3001/sse`
3. Utilize as ferramentas de calendário expostas em seus fluxos de trabalho

## Desenvolvimento

Para configurar um ambiente de desenvolvimento:

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Construa o projeto:
   ```bash
   npm run build
   ```

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## Sobre a G2NTech

Este projeto é desenvolvido e mantido por [Gabriel Augusto](https://github.com/oaugustosgabriel) na G2NTech.

## Apoie o Projeto 💜

Se este projeto for útil para você, considere apoiá-lo via PIX:
- **Chave PIX:** `gabriel@g2ngroup.com`