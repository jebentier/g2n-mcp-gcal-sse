FROM node:18-alpine AS builder

WORKDIR /app

# Copia arquivos de configuração do projeto
COPY package*.json tsconfig.json ./

# Instala dependências
RUN npm ci

# Copia todo o código-fonte
COPY src/ ./src/

# Constrói o projeto
RUN npm run build

# Imagem final - multi-plataforma
FROM node:18-alpine

WORKDIR /app

# Copia arquivos de configuração
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --production && \
    npm cache clean --force

# Copia código compilado
COPY --from=builder /app/build ./build

# Healthcheck para garantir que o serviço está rodando corretamente
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/health || exit 1

# Expõe a porta configurada ou 3001 como padrão
EXPOSE ${PORT:-3001}

# Define comando de inicialização
CMD ["node", "build/index.js"] 