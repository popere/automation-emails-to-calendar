import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { createServer } from "http";
import { parse } from "url";

export class AuthService {
  constructor(tokenPath = "token.json") {
    this.oauth2Client = null;
    this.tokenPath = path.join(process.cwd(), tokenPath);
    this.accountName = path.basename(tokenPath, ".json");
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
      try {
        await this.oauth2Client.getAccessToken();
        console.log(`✅ [${this.accountName}] Token existente válido`);
        return this.oauth2Client;
      } catch (error) {
        // Si el access_token expiró, intentar usar refresh_token
        if (tokens.refresh_token) {
          console.log(
            `🔄 [${this.accountName}] Access token expirado, refrescando automáticamente...`
          );
          return await this.refreshToken();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.log(
        `🔑 [${this.accountName}] Necesario obtener nuevo token de autorización`
      );
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

  async refreshToken() {
    console.log(`🔄 [${this.accountName}] Refrescando token de Google...`);
    try {
      // Intentar usar el refresh_token para obtener un nuevo access_token
      const tokenData = await fs.readFile(this.tokenPath, "utf8");
      const tokens = JSON.parse(tokenData);

      if (tokens.refresh_token) {
        console.log(
          `🔑 [${this.accountName}] Usando refresh_token para obtener nuevo access_token...`
        );

        // Configurar las credenciales con el refresh_token
        this.oauth2Client.setCredentials({
          refresh_token: tokens.refresh_token,
        });

        // Obtener un nuevo access_token usando el refresh_token
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        // Actualizar las credenciales
        this.oauth2Client.setCredentials(credentials);

        // Guardar el nuevo token (incluye el refresh_token original)
        await fs.writeFile(
          this.tokenPath,
          JSON.stringify(credentials, null, 2)
        );

        console.log(
          `✅ [${this.accountName}] Token refrescado exitosamente usando refresh_token`
        );
        return this.oauth2Client;
      } else {
        // Si no hay refresh_token, solicitar autorización completa
        console.log(
          `⚠️ [${this.accountName}] No se encontró refresh_token, solicitando nueva autorización...`
        );
        await fs.unlink(this.tokenPath).catch(() => {});
        const newAuth = await this.getNewToken();
        console.log(`✅ [${this.accountName}] Nueva autorización completada`);
        return newAuth;
      }
    } catch (error) {
      console.error(
        `❌ [${this.accountName}] Error refrescando token:`,
        error.message
      );
      // Si falla el refresh, intentar obtener un nuevo token
      console.log(
        `🔄 [${this.accountName}] Intentando obtener nueva autorización...`
      );
      await fs.unlink(this.tokenPath).catch(() => {});
      const newAuth = await this.getNewToken();
      return newAuth;
    }
  }

  async shouldRefreshToken() {
    try {
      const tokenData = await fs.readFile(this.tokenPath, "utf8");
      const tokens = JSON.parse(tokenData);

      // Si no hay expiry_date, asumir que necesita refresh
      if (!tokens.expiry_date) {
        return true;
      }

      const now = Date.now();
      const expiryDate = tokens.expiry_date;
      const timeUntilExpiry = expiryDate - now;

      // Refrescar si falta menos de 30 minutos para expirar
      const thirtyMinutes = 30 * 60 * 1000;

      return timeUntilExpiry < thirtyMinutes;
    } catch (error) {
      console.error("Error verificando expiración del token:", error.message);
      return true; // Si hay error, intentar refrescar
    }
  }

  async proactiveRefresh() {
    try {
      const needsRefresh = await this.shouldRefreshToken();

      if (needsRefresh) {
        console.log(
          `🔄 [${this.accountName}] Realizando refresh proactivo del token...`
        );
        await this.refreshToken();
        return true;
      } else {
        const tokenData = await fs.readFile(this.tokenPath, "utf8");
        const tokens = JSON.parse(tokenData);
        const expiryDate = new Date(tokens.expiry_date);
        const timeUntilExpiry = tokens.expiry_date - Date.now();

        const days = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));
        const hours = Math.floor(
          (timeUntilExpiry % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
        );
        const minutes = Math.floor(
          (timeUntilExpiry % (60 * 60 * 1000)) / (60 * 1000)
        );

        console.log(
          `✅ [${
            this.accountName
          }] Token aún válido, caduca en ${days}d ${hours}h ${minutes}m (${expiryDate.toLocaleString()})`
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ [${this.accountName}] Error en refresh proactivo:`,
        error.message
      );
      return false;
    }
  }

  static async discoverTokenFiles() {
    try {
      const files = await fs.readdir(process.cwd());
      const tokenFiles = files.filter(
        (file) => file.startsWith("token") && file.endsWith(".json")
      );

      if (tokenFiles.length === 0) {
        console.log("⚠️ No se encontraron archivos de token (token*.json)");
        return ["token.json"]; // Por defecto, usar token.json
      }

      console.log(
        `📋 Encontrados ${
          tokenFiles.length
        } archivo(s) de token: ${tokenFiles.join(", ")}`
      );
      return tokenFiles;
    } catch (error) {
      console.error("❌ Error descubriendo archivos de token:", error.message);
      return ["token.json"];
    }
  }
}
