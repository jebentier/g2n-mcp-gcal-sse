# Servidor G2N MCP SSE para Google Calendar

🌎 Este README está disponível em múltiplos idiomas:
- 🇺🇸 [English](README.md)
- 🇧🇷 [Português](README.pt-br.md)

## Visão Geral

O Servidor G2N MCP Google Calendar SSE é uma implementação de servidor Model Context Protocol (MCP) que fornece integração com o Google Calendar através de Server-Sent Events (SSE). Este servidor expõe funcionalidades do Google Calendar como ferramentas que podem ser utilizadas por modelos de IA e aplicações como Cursor, Claude e n8n para interagir com o Google Calendar.

Construído com a versão mais recente do SDK MCP, este servidor oferece uma integração robusta entre modelos de IA compatíveis com MCP e serviços do Google Calendar.

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

## Arquitetura

O projeto segue uma abordagem de arquitetura limpa com:

- **Tipagem forte**: Definições de tipo consistentes usando esquemas Zod e TypeScript
- **Design modular**: Separação de responsabilidades entre autenticação, serviços e ferramentas
- **Suporte a Docker**: Implantação de contêiner multiplataforma para facilidade de uso

## Começando

### Pré-requisitos

- Docker e Docker Compose instalados
- Projeto no Google Cloud com API Calendar habilitada
- ID do Cliente OAuth 2.0 e Chave Secreta

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

3. Edite o arquivo `.env` e preencha com suas credenciais da API Google:
   ```
   GOOGLE_CLIENT_ID=seu-client-id
   GOOGLE_CLIENT_SECRET=seu-client-secret
   ```

4. Execute o contêiner Docker:
   ```bash
   docker-compose up -d
   ```

5. Navegue até a URL de autenticação para autorizar a aplicação:
   ```
   http://localhost:3001/auth
   ```

6. Siga o fluxo OAuth em seu navegador para conceder acesso ao seu Google Calendar.

7. Após a autorização ser concluída, o servidor estará disponível em http://localhost:3001

### Implantação no Docker Swarm

Para implantação em produção com Docker Swarm:

```bash
# Construa e envie a imagem para o Docker Hub
docker build -t g2ntech/g2n-mcp-gcal-sse:latest .
docker push g2ntech/g2n-mcp-gcal-sse:latest

# Crie segredos Docker para informações sensíveis (recomendado)
echo "seu-client-id" | docker secret create google_client_id -
echo "seu-client-secret" | docker secret create google_client_secret -

# Implante a stack
docker stack deploy -c docker-compose.yml g2n-mcp-gcal
```

Para uma configuração mais segura com Docker Swarm, modifique o `docker-compose.yml` para usar segredos em vez de variáveis de ambiente:

```yaml
services:
  mcp-gcal-sse:
    # ... outras configurações
    secrets:
      - google_client_id
      - google_client_secret
    environment:
      - PORT=3001
      - HOST=0.0.0.0
      - GOOGLE_CLIENT_ID_FILE=/run/secrets/google_client_id
      - GOOGLE_CLIENT_SECRET_FILE=/run/secrets/google_client_secret
      - TOKEN_STORAGE_PATH=/app/data/tokens.json

secrets:
  google_client_id:
    external: true
  google_client_secret:
    external: true
```

Após a implantação, navegue até `http://seu-servidor:3001/auth` para completar o fluxo de autorização OAuth.

## Suporte a Múltiplas Plataformas

A imagem Docker é construída para várias plataformas, incluindo:
- linux/amd64
- linux/arm64
- linux/arm/v7

Para construir uma imagem multi-arquitetura:

```bash
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t g2ntech/g2n-mcp-gcal-sse:latest \
  --push .
```

## Fluxo de Autenticação

1. Inicie o servidor usando Docker ou diretamente
2. Navegue até o endpoint `/auth` no seu navegador
3. Conceda permissões à aplicação usando sua conta Google
4. Após a autorização, o servidor armazenará tokens de atualização para acesso contínuo
5. O servidor atualizará automaticamente os tokens quando necessário

Para revogar o acesso, use o endpoint `/revoke`:
```bash
curl -X POST http://localhost:3001/revoke
```

## Uso com Aplicações Compatíveis com MCP

### Cursor AI

Você pode usar este servidor com o Cursor AI configurando a conexão MCP nas suas configurações:

1. Abra as configurações do Cursor
2. Configure a URL do servidor MCP: `http://localhost:3001/sse`
3. Comece a usar os recursos do Google Calendar através de comandos de IA

### Claude Desktop

Para o Claude Desktop:

1. Navegue até Configurações > MCP
2. Adicione uma nova conexão MCP com a URL: `http://localhost:3001/sse`
3. Acesse as funcionalidades do Google Calendar através de suas conversas

### n8n

1. No n8n, adicione um novo nó MCP
2. Configure o nó MCP com a URL do endpoint SSE: `http://localhost:3001/sse`
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

3. Navegue até a URL de autorização:
   ```
   http://localhost:3001/auth
   ```

4. Construa o projeto:
   ```bash
   npm run build
   ```

## Estrutura do Projeto

```
src/
├── auth/              # Autenticação e gerenciamento de tokens
├── services/          # Implementações de serviços principais
├── tools/             # Definições de ferramentas MCP
├── types/             # Definições de tipos com esquemas Zod
└── index.ts           # Ponto de entrada da aplicação
```

## Persistência e Gerenciamento de Dados

O servidor armazena tokens em um volume montado em `/app/data`. Isso garante que sua autenticação persista entre reinicializações do contêiner.

Para implantações no Docker Swarm, considere usar um volume compartilhado ou uma solução de armazenamento em rede para garantir a persistência dos tokens em todos os nós do swarm.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## Sobre a G2NTech

Este projeto é desenvolvido e mantido por [Gabriel Augusto](https://github.com/oaugustosgabriel) na G2NTech.

## Apoie o Projeto 💜

Se este projeto for útil para você, considere apoiá-lo via PIX:
- **Chave PIX:** `gabriel@g2ngroup.com`