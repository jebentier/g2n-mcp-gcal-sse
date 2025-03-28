# Servidor G2N MCP Google Calendar SSE

🌎 Este README está disponível em vários idiomas:
- 🇺🇸 [Inglês](README.md)
- 🇧🇷 [Português](README.pt-br.md)

## Visão Geral

O G2N MCP Google Calendar SSE Server é uma implementação de servidor Model Context Protocol (MCP) que fornece integração com o Google Calendar através de Server-Sent Events (SSE). Este servidor expõe a funcionalidade do Google Calendar como ferramentas que podem ser usadas por modelos de IA e aplicações como Cursor, Claude e n8n para interagir com o Google Calendar.

Construído com a versão mais recente do SDK MCP, este servidor oferece uma integração robusta entre modelos de IA compatíveis com MCP e serviços do Google Calendar.

## Funcionalidades

O servidor fornece as seguintes ferramentas MCP para gerenciamento do Google Calendar:

- `list-calendars`: Listar todos os calendários disponíveis
- `get-calendar`: Obter detalhes de um calendário específico
- `list-events`: Listar eventos de um calendário com opções de filtragem
- `get-event`: Obter informações detalhadas sobre um evento específico
- `create-event`: Criar um novo evento de calendário
- `update-event`: Atualizar um evento de calendário existente
- `delete-event`: Excluir um evento de calendário
- `list-colors`: Listar cores disponíveis para eventos e calendários

### Novidades na v0.1.2

- **Suporte Docker multi-plataforma**: Agora compilado para AMD64, ARM64 e ARMv7
- **Pronto para Docker Swarm**: Adicionadas configurações de implantação Swarm e limites de recursos
- **Verificações de saúde do contêiner aprimoradas**: Monitoramento aprimorado do contêiner
- **Integração com GitHub Actions**: Builds automatizados para imagens multi-arquitetura
- **Gerenciamento de recursos aprimorado**: Configurações otimizadas de memória e CPU
- **Correção de versão**: Correção da numeração de versão em todos os arquivos do projeto

## Arquitetura

O projeto segue uma abordagem de arquitetura limpa com:

- **Tipagem forte**: Definições de tipo consistentes usando esquemas Zod e TypeScript
- **Design modular**: Separação de preocupações entre autenticação, serviços e ferramentas
- **Suporte Docker**: Implantação de contêiner multi-plataforma para facilidade de uso
- **Pronto para Swarm**: Configuração otimizada para implantações Docker Swarm

## Começando

### Pré-requisitos

- Docker e Docker Compose instalados
- Projeto do Google Cloud com API Calendar ativada
- ID do Cliente OAuth 2.0 e Secret do Cliente

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

3. Edite o arquivo `.env` e preencha suas credenciais da API do Google:
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

7. Uma vez que a autorização esteja completa, o servidor estará disponível em http://localhost:3001

### Implantação Docker Swarm

Para implantação em produção com Docker Swarm:

```bash
# Inicialize o swarm se ainda não estiver feito
docker swarm init

# Crie secrets do Docker para informações sensíveis (recomendado)
echo "seu-client-id" | docker secret create google_client_id -
echo "seu-client-secret" | docker secret create google_client_secret -

# Implante o stack
docker stack deploy -c docker-compose.yml g2n-mcp-gcal
```

Para uma configuração mais segura com Docker Swarm, descomente e use os exemplos no arquivo `docker-compose.yml` para usar secrets em vez de variáveis de ambiente.

Após a implantação, navegue até `http://seu-servidor:3001/auth` para completar o fluxo de autorização OAuth.

## Suporte Multi-plataforma

A imagem Docker é construída para múltiplas plataformas, incluindo:
- linux/amd64 (Processadores Intel/AMD)
- linux/arm64 (Processadores ARM64 como Raspberry Pi 4, Apple Silicon M1/M2/M3)
- linux/arm/v7 (Processadores ARMv7 como Raspberry Pi 3)

Para construir uma imagem multi-arquitetura usando nosso script fornecido:

```bash
npm run docker:build-multi
```

Ou manualmente:

```bash
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t gabrielg2n/g2n-mcp-gcal-sse:0.1.2 \
  --push .
```

## Fluxo de Autenticação

1. Inicie o servidor usando Docker ou diretamente
2. Navegue até o endpoint `/auth` em seu navegador
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
3. Comece a usar os recursos do Google Calendar através de comandos AI

### Claude Desktop

Para o Claude Desktop:

1. Navegue até Configurações > MCP
2. Adicione uma nova conexão MCP com a URL: `http://localhost:3001/sse`
3. Acesse a funcionalidade do Google Calendar através de suas conversas

### n8n

1. No n8n, adicione um novo nó MCP
2. Configure o nó MCP com a URL do endpoint SSE: `http://localhost:3001/sse`
3. Use as ferramentas de calendário expostas em seus workflows

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

5. Construa a imagem Docker:
   ```bash
   npm run docker:build
   ```

6. Envie a imagem Docker:
   ```bash
   npm run docker:push
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

## CI/CD com GitHub Actions

O projeto inclui um workflow do GitHub Actions que:

1. Constrói a imagem Docker para múltiplas plataformas
2. Envia a imagem para o Docker Hub
3. Cria tags apropriadas baseadas em tags git (para releases) e commits

Para criar uma nova release:

```bash
git tag v0.1.2
git push origin v0.1.2
```

Isso acionará o workflow para construir e publicar a release marcada.

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