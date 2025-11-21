import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { AuthService } from "../src/services/authService.js";
import { GmailService } from "../src/services/gmailService.js";

dotenv.config();

class EmailCapture {
  constructor() {
    this.authService = new AuthService();
    this.gmailService = new GmailService(this.authService);
    this.testEmailsPath = path.join(process.cwd(), "test", "emails");
  }

  async initialize() {
    console.log("🔐 Autenticando con Google...");

    try {
      const auth = await this.authService.authenticate();
      await this.gmailService.initialize(auth);
      console.log("✅ Autenticación completada");
      return true;
    } catch (error) {
      console.error("❌ Error de autenticación:", error.message);
      return false;
    }
  }

  async captureFirstEmail(customQuery = null) {
    const initialized = await this.initialize();
    if (!initialized) return;

    try {
      // Usar query personalizada o la del .env
      const query = customQuery || process.env.GMAIL_QUERY || "is:unread";
      console.log(`📧 Buscando emails con query: "${query}"`);

      // Obtener emails que coincidan con la query
      const emails = await this.gmailService.getEmailsByQuery(query);

      if (emails.length === 0) {
        console.log("📭 No se encontraron emails que coincidan con la query");
        console.log("💡 Sugerencias:");
        console.log("   - Verifica que haya emails no leídos");
        console.log("   - Modifica la query en .env o usa una personalizada");
        console.log(
          '   - Ejemplo: npm run capture:email "from:ejemplo@gmail.com"'
        );
        return;
      }

      const firstEmail = emails[0];
      console.log(`📨 Email encontrado: "${firstEmail.subject}"`);
      console.log(`👤 De: ${firstEmail.from}`);
      console.log(`📅 Fecha: ${firstEmail.date}`);

      // Generar nombre de archivo único
      const fileName = this.generateFileName(firstEmail);
      const filePath = path.join(this.testEmailsPath, fileName);

      // Asegurar que el directorio existe
      await fs.mkdir(this.testEmailsPath, { recursive: true });

      // Guardar el email como JSON
      const emailData = {
        id: firstEmail.id,
        subject: firstEmail.subject,
        from: firstEmail.from,
        date: firstEmail.date,
        snippet: firstEmail.snippet,
        body: firstEmail.body,
        capturedAt: new Date().toISOString(),
        originalQuery: query,
      };

      await fs.writeFile(filePath, JSON.stringify(emailData, null, 2));

      console.log(`💾 Email guardado como: ${fileName}`);
      console.log(`📂 Ubicación: test/emails/${fileName}`);
      console.log("\n🧪 Ahora puedes probarlo con:");
      console.log(`   npm run test:emails:specific ${fileName}`);

      return fileName;
    } catch (error) {
      console.error("❌ Error capturando email:", error.message);
    }
  }

  async captureMultipleEmails(count = 3, customQuery = null) {
    const initialized = await this.initialize();
    if (!initialized) return;

    try {
      const query = customQuery || process.env.GMAIL_QUERY || "is:unread";
      console.log(`📧 Buscando hasta ${count} emails con query: "${query}"`);

      const emails = await this.gmailService.getEmailsByQuery(query);
      const emailsToCapture = emails.slice(0, count);

      if (emailsToCapture.length === 0) {
        console.log("📭 No se encontraron emails");
        return;
      }

      console.log(`📨 Capturando ${emailsToCapture.length} email(s)...\n`);

      const capturedFiles = [];

      for (let i = 0; i < emailsToCapture.length; i++) {
        const email = emailsToCapture[i];
        console.log(
          `📧 [${i + 1}/${emailsToCapture.length}] "${email.subject}"`
        );

        const fileName = this.generateFileName(email, i + 1);
        const filePath = path.join(this.testEmailsPath, fileName);

        await fs.mkdir(this.testEmailsPath, { recursive: true });

        const emailData = {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          snippet: email.snippet,
          body: email.body,
          capturedAt: new Date().toISOString(),
          originalQuery: query,
        };

        await fs.writeFile(filePath, JSON.stringify(emailData, null, 2));
        capturedFiles.push(fileName);
        console.log(`   💾 Guardado como: ${fileName}`);
      }

      console.log(`\n✅ Capturados ${capturedFiles.length} email(s)`);
      console.log("\n🧪 Puedes probarlos con:");
      capturedFiles.forEach((file) => {
        console.log(`   npm run test:emails:specific ${file}`);
      });

      return capturedFiles;
    } catch (error) {
      console.error("❌ Error capturando emails:", error.message);
    }
  }

  generateFileName(email, index = null) {
    // Limpiar el asunto para usarlo como nombre de archivo
    const cleanSubject = email.subject
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Quitar caracteres especiales
      .replace(/\s+/g, "-") // Espacios a guiones
      .substring(0, 50); // Limitar longitud

    // Agregar timestamp para evitar duplicados
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const indexSuffix = index ? `-${index}` : "";
    return `captured-${timestamp}-${cleanSubject}${indexSuffix}.json`;
  }

  async listRecentEmails(limit = 10, customQuery = null) {
    const initialized = await this.initialize();
    if (!initialized) return;

    try {
      const query = customQuery || process.env.GMAIL_QUERY || "is:unread";
      console.log(`📧 Listando hasta ${limit} emails con query: "${query}"\n`);

      const emails = await this.gmailService.getEmailsByQuery(query);
      const emailsToShow = emails.slice(0, limit);

      if (emailsToShow.length === 0) {
        console.log("📭 No se encontraron emails");
        return;
      }

      console.log(`📨 Encontrados ${emailsToShow.length} email(s):\n`);

      emailsToShow.forEach((email, index) => {
        console.log(`${index + 1}. "${email.subject}"`);
        console.log(`   👤 De: ${email.from}`);
        console.log(`   📅 ${email.date}`);
        console.log(`   📝 ${email.snippet.substring(0, 100)}...`);
        console.log("");
      });
    } catch (error) {
      console.error("❌ Error listando emails:", error.message);
    }
  }
}

// Ejecutar según argumentos de línea de comandos
async function main() {
  const capture = new EmailCapture();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("📖 Uso del capturador de emails:");
    console.log("");
    console.log("Comandos disponibles:");
    console.log(
      "  npm run capture:email                    # Capturar primer email"
    );
    console.log(
      '  npm run capture:email "query"            # Capturar con query personalizada'
    );
    console.log(
      "  npm run capture:emails 3                # Capturar 3 emails"
    );
    console.log(
      '  npm run capture:emails 5 "from:x@y.com" # Capturar 5 emails con query'
    );
    console.log(
      "  npm run list:emails                      # Listar emails disponibles"
    );
    console.log(
      "  npm run list:emails 15                   # Listar 15 emails"
    );
    console.log(
      '  npm run list:emails 10 "subject:cita"   # Listar con query personalizada'
    );
    console.log("");
    console.log("Ejemplos de queries:");
    console.log('  "is:unread"                             # Emails no leídos');
    console.log(
      '  "from:clinica@ejemplo.com"              # De remitente específico'
    );
    console.log(
      '  "subject:cita"                          # Con palabra en asunto'
    );
    console.log(
      '  "is:unread has:attachment"              # No leídos con adjuntos'
    );
    return;
  }

  const command = args[0];

  switch (command) {
    case "capture":
      if (args[1]) {
        await capture.captureFirstEmail(args[1]);
      } else {
        await capture.captureFirstEmail();
      }
      break;

    case "capture-multiple":
      const count = parseInt(args[1]) || 3;
      const query = args[2] || null;
      await capture.captureMultipleEmails(count, query);
      break;

    case "list":
      const limit = parseInt(args[1]) || 10;
      const listQuery = args[2] || null;
      await capture.listRecentEmails(limit, listQuery);
      break;

    default:
      // Por defecto, capturar un email
      await capture.captureFirstEmail(args[0]);
  }
}

main().catch(console.error);
