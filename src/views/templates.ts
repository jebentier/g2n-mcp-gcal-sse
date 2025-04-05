export const successTemplate = `
  <html>
    <head>
      <title>Authorization Completed</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .success { color: green; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="success">Authorization Successfully Completed!</h1>
        <p>The Google Calendar MCP server has been successfully authorized.</p>
        <p>You can now close this window and return to the application.</p>
      </div>
    </body>
  </html>
`;

export const errorTemplate = (error: string) => `
  <html>
    <head>
      <title>Authorization Error</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .error { color: red; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="error">Authorization Error</h1>
        <p>An error occurred during the authorization process:</p>
        <p class="error">${error}</p>
        <p>Please try again or contact support.</p>
      </div>
    </body>
  </html>
`;
