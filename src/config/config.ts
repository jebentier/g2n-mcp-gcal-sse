import { z } from 'zod';

// Definição do esquema de configuração
export const ConfigSchema = z.object({
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_REDIRECT_PATH: z.string().default('/oauth/callback'),
  PUBLIC_URL: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Função para carregar configurações do ambiente
export const loadConfig = (): Config => {
  try {
    return ConfigSchema.parse({
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_PATH: process.env.OAUTH_REDIRECT_PATH,
      PUBLIC_URL: process.env.PUBLIC_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Erro de configuração:');
      error.errors.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('Erro desconhecido ao carregar configuração:', error);
    }
    process.exit(1);
  }
};

// Função para construir a URL base
export const buildBaseUrl = (config: Config): string => {
  let baseUrl: string;
  
  if (config.PUBLIC_URL) {
    const publicUrl = config.PUBLIC_URL.trim();
    
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      baseUrl = publicUrl;
    } else {
      baseUrl = `https://${publicUrl}`;
      console.log(`ATENÇÃO: PUBLIC_URL não contém protocolo, usando HTTPS por padrão: ${baseUrl}`);
      console.log(`Se você está usando HTTP, defina explicitamente PUBLIC_URL=http://${publicUrl}`);
    }
  } else if (config.HOST === '0.0.0.0') {
    baseUrl = `http://localhost:${config.PORT}`;
  } else {
    const host = config.HOST.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      baseUrl = `${host}:${config.PORT}`;
    } else {
      baseUrl = `http://${host}:${config.PORT}`;
    }
  }
  
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}; 