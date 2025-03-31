export const successTemplate = `
  <html>
    <head>
      <title>Autorização concluída</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .success { color: green; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="success">Autorização concluída com sucesso!</h1>
        <p>O servidor MCP do Google Calendar foi autorizado com sucesso.</p>
        <p>Você pode fechar esta janela agora e voltar para a aplicação.</p>
      </div>
    </body>
  </html>
`;

export const errorTemplate = (error: string) => `
  <html>
    <head>
      <title>Erro na Autorização</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .error { color: red; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="error">Erro na Autorização</h1>
        <p>Ocorreu um erro durante o processo de autorização:</p>
        <p class="error">${error}</p>
        <p>Por favor, tente novamente ou contate o suporte.</p>
      </div>
    </body>
  </html>
`; 