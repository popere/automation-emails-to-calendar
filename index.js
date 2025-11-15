import dotenv from "dotenv";
import { GmailService } from "./src/services/gmailService.js";
import { CalendarServiceWithDuplicateDetection as CalendarService } from "./src/services/calendarServiceNew.js";
import { GeminiService } from "./src/services/geminiService.js";
import { AuthService } from "./src/services/authService.js";
import { CancellationService } from "./src/services/cancellationService.js";

dotenv.config();

class EmailToCalendarAutomation {
  constructor() {
    this.authService = new AuthService();
    this.gmailService = new GmailService();
    this.calendarService = new CalendarService();
    this.geminiService = new GeminiService();
    this.cancellationService = null; // Se inicializará después
  }

  async initialize() {
    console.log("🔐 Inicializando servicios...");

    try {
      // Autenticar con Google
      const auth = await this.authService.authenticate();

      // Inicializar servicios
      await this.gmailService.initialize(auth);
      await this.calendarService.initialize(auth);

      // Inicializar servicio de cancelaciones
      this.cancellationService = new CancellationService(
        this.geminiService,
        this.calendarService
      );
      await this.cancellationService.initialize();

      console.log("✅ Todos los servicios inicializados correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error inicializando servicios:", error.message);
      return false;
    }
  }

  async processEmails() {
    try {
      console.log("📧 Buscando nuevos emails...");

      // Procesar emails de confirmación (crear eventos)
      await this.processConfirmationEmails();

      // Procesar emails de cancelación (eliminar eventos)
      await this.processCancellationEmails();
    } catch (error) {
      console.error("❌ Error procesando emails:", error.message);
    }
  }

  async processConfirmationEmails() {
    try {
      const query = process.env.GMAIL_QUERY;
      if (!query) {
        console.log("⚠️ GMAIL_QUERY no configurada para confirmaciones");
        return;
      }

      console.log(`📨 Buscando emails de confirmación: "${query}"`);

      // Obtener emails no leídos que coincidan con la query
      const emails = await this.gmailService.getEmailsByQuery(query);

      if (emails.length === 0) {
        console.log("📭 No se encontraron emails de confirmación nuevos");
        return;
      }

      console.log(`📧 Encontrados ${emails.length} email(s) de confirmación`);

      for (const email of emails) {
        await this.processConfirmationEmail(email);
      }
    } catch (error) {
      console.error(
        "❌ Error procesando emails de confirmación:",
        error.message
      );
    }
  }

  async processCancellationEmails() {
    try {
      const query = process.env.GMAIL_CANCELLATION_QUERY;
      if (!query) {
        console.log("⚠️ GMAIL_CANCELLATION_QUERY no configurada");
        return;
      }

      console.log(`🗑️ Buscando emails de cancelación: "${query}"`);

      // Obtener emails no leídos de cancelación
      const cancellationEmails = await this.gmailService.getEmailsByQuery(
        query
      );

      if (cancellationEmails.length === 0) {
        console.log("📭 No se encontraron emails de cancelación nuevos");
        return;
      }

      console.log(
        `📧 Encontrados ${cancellationEmails.length} email(s) de cancelación`
      );

      for (const email of cancellationEmails) {
        await this.processCancellationEmail(email);
      }
    } catch (error) {
      console.error(
        "❌ Error procesando emails de cancelación:",
        error.message
      );
    }
  }

  async processConfirmationEmail(email) {
    try {
      console.log(`\n📨 Procesando confirmación: "${email.subject}"`);
      console.log(`👤 De: ${email.from}`);

      // Extraer detalles del evento usando Gemini
      const eventDetails = await this.geminiService.extractEventDetails(email);

      if (eventDetails) {
        console.log("✅ Detalles del evento extraídos exitosamente");

        // Crear evento en el calendario (con detección de duplicados)
        const calendarEvent = await this.calendarService.createEvent(
          eventDetails,
          {
            emailId: email.id,
            emailSubject: email.subject,
            emailFrom: email.from,
          }
        );

        if (calendarEvent && !calendarEvent.skipped) {
          // Marcar email como leído
          await this.gmailService.markAsRead(email.id);
          console.log("📬 Email marcado como leído");
        } else if (calendarEvent && calendarEvent.skipped) {
          // También marcar como leído si se saltó por duplicado
          await this.gmailService.markAsRead(email.id);
          console.log("📬 Email marcado como leído (evento duplicado)");
        }
      } else {
        console.log("❌ No se pudo extraer información del evento");
      }
    } catch (error) {
      console.error(
        `❌ Error procesando email de confirmación ${email.id}:`,
        error.message
      );
    }
  }

  async processCancellationEmail(email) {
    try {
      console.log(`\n🗑️ Procesando cancelación: "${email.subject}"`);
      console.log(`👤 De: ${email.from}`);

      // Procesar cancelación
      const result = await this.cancellationService.processCancellation(email);

      if (result && result.success) {
        console.log("✅ Cancelación procesada exitosamente");
        // Marcar email como leído
        await this.gmailService.markAsRead(email.id);
        console.log("📬 Email de cancelación marcado como leído");
      } else {
        console.log(
          `⚠️ Cancelación no procesada: ${
            result?.reason || "Error desconocido"
          }`
        );
        // También marcar como leído para evitar reprocesar
        await this.gmailService.markAsRead(email.id);
        console.log("📬 Email marcado como leído");
      }
    } catch (error) {
      console.error(
        `❌ Error procesando email de cancelación ${email.id}:`,
        error.message
      );
    }
  }

  async start() {
    console.log("🤖 Iniciando automatización de emails a calendario...");

    // Inicializar servicios
    const initialized = await this.initialize();
    if (!initialized) {
      console.log("❌ No se pudieron inicializar los servicios. Terminando.");
      return;
    }

    // Configurar intervalo de verificación
    const checkInterval =
      (parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5) * 60 * 1000;
    console.log(
      `⏰ Verificando emails cada ${
        process.env.CHECK_INTERVAL_MINUTES || 5
      } minuto(s)`
    );

    // Procesar emails inmediatamente
    await this.processEmails();

    // Configurar verificación periódica
    setInterval(async () => {
      console.log("\n" + "=".repeat(60));
      console.log(
        `⏰ ${new Date().toLocaleString("es-ES")} - Verificación programada`
      );
      await this.processEmails();
    }, checkInterval);

    console.log(
      "✅ Automatización en funcionamiento. Presiona Ctrl+C para detener."
    );
  }
}

// Iniciar la aplicación
const automation = new EmailToCalendarAutomation();
automation.start().catch(console.error);
