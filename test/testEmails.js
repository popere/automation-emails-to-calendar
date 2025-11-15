import { CalendarServiceWithDuplicateDetection as CalendarService } from "../src/services/calendarServiceNew.js";
import { AuthService } from "../src/services/authService.js";
import { EventLogger } from "../src/services/eventLogger.js";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { GeminiService } from "../src/services/geminiService.js";

dotenv.config();

class EmailTestRunner {
  constructor() {
    this.geminiService = new GeminiService();
    this.calendarService = null;
    this.authService = null;
    this.testEmailsPath = path.join(process.cwd(), "test", "emails");
    this.createRealEvents = false;
  }

  async initialize(needsCalendar = false) {
    console.log("🧪 Iniciando pruebas de procesamiento de emails...\n");

    // Verificar conexión con Gemini
    const geminiConnected = await this.geminiService.testGeminiConnection();
    if (!geminiConnected) {
      console.error("❌ No se pudo conectar con Gemini API");
      return false;
    }

    // Inicializar Calendar solo si es necesario
    if (needsCalendar) {
      console.log("🔐 Inicializando servicios de Google Calendar...");
      try {
        this.authService = new AuthService();
        this.calendarService = new CalendarService();

        const auth = await this.authService.authenticate();
        await this.calendarService.initialize(auth);

        console.log("✅ Servicios de Google Calendar inicializados");
        this.createRealEvents = true;
      } catch (error) {
        console.error("❌ Error inicializando Calendar:", error.message);
        console.log("⚠️ Continuando solo con simulación...");
        this.createRealEvents = false;
      }
    }

    return true;
  }

  async runAllTests(createEvents = false) {
    const initialized = await this.initialize(createEvents);
    if (!initialized) return;

    try {
      const emailFiles = await fs.readdir(this.testEmailsPath);
      const jsonFiles = emailFiles.filter((file) => file.endsWith(".json"));

      if (jsonFiles.length === 0) {
        console.log("⚠️ No se encontraron emails de prueba en /test/emails/");
        return;
      }

      const mode =
        createEvents && this.createRealEvents
          ? "CALENDARIO REAL"
          : "SIMULACIÓN";
      console.log(
        `📧 Encontrados ${jsonFiles.length} email(s) de prueba - Modo: ${mode}\n`
      );

      for (const file of jsonFiles) {
        await this.testEmail(file);
        console.log("─".repeat(80) + "\n");
      }

      console.log("✅ Todas las pruebas completadas");
    } catch (error) {
      console.error("❌ Error ejecutando pruebas:", error.message);
    }
  }

  async testSpecificEmail(fileName, createEvents = false) {
    console.log(`🧪 Probando email específico: ${fileName}`);

    const mode = createEvents ? "CALENDARIO REAL" : "SIMULACIÓN";
    console.log(`🎯 Modo: ${mode}\n`);

    const initialized = await this.initialize(createEvents);
    if (!initialized) return;

    await this.testEmail(fileName);
  }

  async testEmail(fileName) {
    try {
      const filePath = path.join(this.testEmailsPath, fileName);
      const emailData = JSON.parse(await fs.readFile(filePath, "utf8"));

      console.log(`📨 Procesando: ${fileName}`);
      console.log(`📝 Asunto: "${emailData.subject}"`);
      console.log(`👤 De: ${emailData.from}`);
      console.log(`📅 Fecha: ${emailData.date}\n`);

      // Procesar con Gemini
      console.log("🤖 Enviando a Gemini para análisis...");
      const eventDetails = await this.geminiService.extractEventDetails(
        emailData
      );

      if (eventDetails) {
        console.log("✅ Información del evento extraída exitosamente:");
        this.displayEventDetails(eventDetails);

        // Crear evento real o simulado
        if (this.createRealEvents && this.calendarService) {
          await this.createRealEvent(eventDetails);
        } else {
          this.simulateEventCreation(eventDetails);
        }

        // Guardar resultado de prueba
        await this.saveTestResult(fileName, emailData, eventDetails);
      } else {
        console.log("❌ No se pudo extraer información del evento");
      }
    } catch (error) {
      console.error(`❌ Error procesando ${fileName}:`, error.message);
    }
  }

  displayEventDetails(eventDetails) {
    console.log("📋 Detalles del evento:");
    console.log(`   🏷️  Título: ${eventDetails.title}`);
    console.log(`   📅 Inicio: ${eventDetails.startDateTime}`);
    console.log(`   ⏰ Fin: ${eventDetails.endDateTime}`);
    console.log(`   🌍 Zona horaria: ${eventDetails.timeZone}`);

    if (eventDetails.location) {
      console.log(`   📍 Ubicación: ${eventDetails.location}`);
    }

    console.log(
      `   📝 Descripción: ${eventDetails.description.substring(0, 100)}...`
    );
  }

  async createRealEvent(eventDetails) {
    console.log("\n🔥 CREANDO EVENTO REAL EN GOOGLE CALENDAR...");

    try {
      const calendarEvent = await this.calendarService.createEvent(
        eventDetails
      );

      if (calendarEvent) {
        console.log("✅ ¡EVENTO CREADO EXITOSAMENTE EN TU CALENDARIO!");
        console.log(`🔗 Ver evento: ${calendarEvent.htmlLink}`);
        console.log(`🆔 ID del evento: ${calendarEvent.id}`);
      } else {
        console.log("❌ Error creando el evento en el calendario");
      }
    } catch (error) {
      console.error("❌ Error creando evento real:", error.message);
    }
  }

  simulateEventCreation(eventDetails) {
    console.log(
      "\n🎭 SIMULANDO CREACIÓN DE EVENTO (no se creará en el calendario):"
    );
    console.log("📝 El evento que se crearía sería:");
    console.log(`   📅 Título: "${eventDetails.title}"`);
    console.log(
      `   🕐 ${this.formatDateTime(
        eventDetails.startDateTime
      )} - ${this.formatDateTime(eventDetails.endDateTime)}`
    );

    if (eventDetails.location) {
      console.log(`   📍 En: ${eventDetails.location}`);
    }

    console.log(`   📋 Descripción: ${eventDetails.description}`);
    console.log("");
    console.log(
      "💡 Para crear eventos reales, usa: npm run test:emails:calendar"
    );
  }

  formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async saveTestResult(fileName, emailData, eventDetails) {
    try {
      const resultPath = path.join(process.cwd(), "test", "results");
      await fs.mkdir(resultPath, { recursive: true });

      const result = {
        timestamp: new Date().toISOString(),
        mode: this.createRealEvents ? "real-calendar" : "simulation",
        input: {
          fileName,
          email: emailData,
        },
        output: eventDetails,
        success: true,
      };

      const resultFileName = fileName.replace(".json", "-result.json");
      const resultFilePath = path.join(resultPath, resultFileName);

      await fs.writeFile(resultFilePath, JSON.stringify(result, null, 2));
      console.log(`💾 Resultado guardado en: test/results/${resultFileName}`);
    } catch (error) {
      console.error("⚠️ Error guardando resultado:", error.message);
    }
  }

  async listAvailableEmails() {
    try {
      const emailFiles = await fs.readdir(this.testEmailsPath);
      const jsonFiles = emailFiles.filter((file) => file.endsWith(".json"));

      console.log("📧 Emails de prueba disponibles:");
      for (const file of jsonFiles) {
        const filePath = path.join(this.testEmailsPath, file);
        const emailData = JSON.parse(await fs.readFile(filePath, "utf8"));
        console.log(`   📄 ${file} - "${emailData.subject}"`);
      }
    } catch (error) {
      console.error("❌ Error listando emails:", error.message);
    }
  }
}

// Ejecutar según argumentos de línea de comandos
async function main() {
  const testRunner = new EmailTestRunner();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Sin argumentos: ejecutar todas las pruebas en modo simulación
    await testRunner.runAllTests(false);
  } else if (args[0] === "list") {
    // Listar emails disponibles
    await testRunner.listAvailableEmails();
  } else if (args[0] === "test" && args[1]) {
    // Probar email específico en modo simulación
    await testRunner.testSpecificEmail(args[1], false);
  } else if (args[0] === "calendar") {
    // Ejecutar todas las pruebas creando eventos reales
    await testRunner.runAllTests(true);
  } else if (args[0] === "calendar-test" && args[1]) {
    // Probar email específico creando evento real
    await testRunner.testSpecificEmail(args[1], true);
  } else {
    console.log("📖 Uso:");
    console.log(
      "  npm run test:emails                      # Simular todas las pruebas"
    );
    console.log(
      "  npm run test:emails:calendar             # Crear eventos REALES de todas las pruebas"
    );
    console.log(
      "  npm run test:emails:list                 # Listar emails disponibles"
    );
    console.log(
      "  npm run test:emails:specific <archivo>   # Simular email específico"
    );
    console.log(
      "  npm run test:emails:real <archivo>       # Crear evento REAL de email específico"
    );
    console.log("");
    console.log("🎭 Modo SIMULACIÓN: Solo muestra como sería el evento");
    console.log("🔥 Modo REAL: Crea eventos reales en tu Google Calendar");
  }
}

main().catch(console.error);
