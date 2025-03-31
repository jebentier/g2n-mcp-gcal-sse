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

## Começando

### Pré-requisitos

- Docker e Docker Compose instalados
- Projeto do Google Cloud com API Calendar ativada
- ID do Cliente OAuth 2.0 e Secret do Cliente

### Variáveis de Ambiente

O servidor utiliza as seguintes variáveis de ambiente:

```env
PORT=3001                                # Porta do servidor (padrão: 3001)
PUBLIC_URL=https://seu-dominio.com       # URL pública para callbacks OAuth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}     # ID do Cliente OAuth do Google
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} # Secret do Cliente OAuth do Google
OAUTH_REDIRECT_PATH=/oauth/callback      # Caminho do callback OAuth (padrão: /oauth/callback)
```

**Notas Importantes:**
- Ao usar o Traefik, certifique-se de configurá-lo para apontar para a porta especificada na variável de ambiente `PORT`
- Isso é crucial para receber o refresh token do Google com sucesso
- A `PUBLIC_URL` deve ser acessível pela internet para que os callbacks OAuth funcionem

## Fluxo de Autenticação

1. Inicie o servidor usando Docker ou diretamente
2. Navegue até o endpoint `/auth` em seu navegador
3. Conceda permissões à aplicação usando sua conta Google
4. Após a autorização, o servidor armazenará tokens de atualização para acesso contínuo
5. O servidor atualizará automaticamente os tokens quando necessário

Para revogar o acesso, use o endpoint `/revoke`:
```bash
curl -X POST https://seu-dominio.com/revoke
```

## Uso com Aplicações Compatíveis com MCP

### URLs de Conexão

Dependendo do seu cenário de implantação, use o formato de URL apropriado:

1. **Docker Swarm / acesso interno n8n:**
   ```
   http://[nome-do-servico-na-stack]:3001/sse
   ```
   Exemplo: Se seu serviço se chama `g2n-mcp-gcal-sse` na stack, use:
   ```
   http://g2n-mcp-gcal-sse:3001/sse
   ```

2. **Acesso externo (Cursor, Claude, etc.):**
   ```
   https://seu-dominio.com/sse
   ```

3. **Desenvolvimento local:**
   ```
   http://localhost:3001/sse
   ```

### Cursor AI

Você pode usar este servidor com o Cursor AI configurando a conexão MCP nas suas configurações:

1. Abra as configurações do Cursor
2. Configure a URL do servidor MCP usando seu domínio público:
   ```
   https://seu-dominio.com/sse
   ```
3. Comece a usar os recursos do Google Calendar através de comandos AI

### Claude Desktop

Para o Claude Desktop:

1. Navegue até Configurações > MCP
2. Adicione uma nova conexão MCP com sua URL pública:
   ```
   https://seu-dominio.com/sse
   ```
3. Acesse a funcionalidade do Google Calendar através de suas conversas

### n8n

1. No n8n, adicione um novo nó MCP
2. Configure o nó MCP com a URL do serviço interno:
   ```
   http://[nome-do-servico-na-stack]:3001/sse
   ```
3. Use as ferramentas de calendário expostas em seus workflows

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## Sobre a G2NTech

Este projeto é desenvolvido e mantido por [Gabriel Augusto](https://github.com/oaugustosgabriel) na G2NTech.

## Apoie o Projeto 💜

Se este projeto for útil para você, considere apoiá-lo via PIX:
- **Chave PIX:** `gabriel@g2ngroup.com`