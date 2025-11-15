import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { createServer } from "http";
import { parse } from "url";

export class AuthService {
  constructor() {
    this.oauth2Client = null;
    this.tokenPath = path.join(process.cwd(), "token.json");
  }

  async authenticate() {
    // Configurar el cliente OAuth2 - Google manejará el puerto automáticamente
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI // http://localhost
    );

    // Intentar cargar token existente
    try {
      const tokenData = await fs.readFile(this.tokenPath, "utf8");
      const tokens = JSON.parse(tokenData);
      this.oauth2Client.setCredentials(tokens);

      // Verificar si el token es válido
      await this.oauth2Client.getAccessToken();
      console.log("✅ Token existente válido");
      return this.oauth2Client;
    } catch (error) {
      console.log("🔑 Necesario obtener nuevo token de autorización");
      return await this.getNewToken();
    }
  }

  async getNewToken() {
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
    ];

    return new Promise((resolve, reject) => {
      // Crear servidor en puerto dinámico (0 = puerto automático)
      const server = createServer(async (req, res) => {
        try {
          const url = parse(req.url, true);

          if (url.query.code) {
            const code = url.query.code;

            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // Guardar el token
            await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: green;">✅ Autorización Exitosa</h1>
                  <p>Puedes cerrar esta ventana. La aplicación continuará automáticamente.</p>
                </body>
              </html>
            `);

            server.close();
            console.log("✅ Token guardado exitosamente");
            resolve(this.oauth2Client);
          } else if (url.query.error) {
            throw new Error(`Error de autorización: ${url.query.error}`);
          }
        } catch (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Error de Autorización</h1>
                <p>${error.message}</p>
              </body>
            </html>
          `);
          server.close();
          reject(error);
        }
      });

      // Usar puerto 0 para que el sistema asigne uno automáticamente
      server.listen(0, () => {
        const port = server.address().port;
        console.log(`🌐 Servidor de autorización iniciado en puerto ${port}`);

        // Actualizar el redirect URI con el puerto asignado
        this.oauth2Client.redirectUri = `http://localhost:${port}`;

        const authUrl = this.oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: scopes,
        });

        console.log("🌐 Autoriza esta aplicación visitando esta URL:");
        console.log(authUrl);
        console.log(
          "\n📋 Después de autorizar, serás redirigido automáticamente."
        );
      });

      // Timeout después de 5 minutos
      setTimeout(() => {
        server.close();
        reject(
          new Error("Timeout: No se completó la autorización en 5 minutos")
        );
      }, 5 * 60 * 1000);
    });
  }
}
