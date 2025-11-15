import readline from "readline";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

dotenv.config();

class InteractiveMenu {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.testEmailsPath = path.join(process.cwd(), "test", "emails");
  }

  async start() {
    console.clear();
    console.log("🤖 AUTOMATIZACIÓN DE EMAILS A CALENDARIO");
    console.log("═".repeat(50));
    console.log("Menú Interactivo de Herramientas de Desarrollo\n");

    await this.showMainMenu();
  }

  async showMainMenu() {
    console.log("📋 ¿Qué acción deseas realizar?\n");
    console.log("1. 🧪 Probar procesamiento de emails");
    console.log("2. 📧 Capturar emails reales de Gmail");
    console.log("3. 📊 Ver estadísticas de eventos generados");
    console.log("4. 🔧 Diagnosticar conexión con Gemini");
    console.log("5. ❌ Salir\n");

    const choice = await this.prompt("Selecciona una opción (1-5): ");

    switch (choice.trim()) {
      case "1":
        await this.testEmailsMenu();
        break;
      case "2":
        await this.captureEmailsMenu();
        break;
      case "3":
        await this.showStats();
        break;
      case "4":
        await this.geminiDiagnosticMenu();
        break;
      case "5":
        console.log("\n👋 ¡Hasta luego!");
        this.rl.close();
        return;
      default:
        console.log("\n❌ Opción inválida. Intenta de nuevo.\n");
        await this.showMainMenu();
    }
  }

  async testEmailsMenu() {
    console.clear();
    console.log("🧪 PRUEBAS DE PROCESAMIENTO DE EMAILS");
    console.log("═".repeat(40));
    console.log("");
    console.log("1. 🎭 Simular procesamiento (no crea eventos reales)");
    console.log("2. 🔥 Crear eventos reales en el calendario");
    console.log("3. 📋 Listar emails de prueba disponibles");
    console.log("4. ⬅️  Volver al menú principal\n");

    const choice = await this.prompt("Selecciona una opción (1-4): ");

    switch (choice.trim()) {
      case "1":
        await this.selectEmailForTesting(false);
        break;
      case "2":
        await this.selectEmailForTesting(true);
        break;
      case "3":
        await this.listAvailableEmails();
        break;
      case "4":
        console.clear();
        await this.showMainMenu();
        break;
      default:
        console.log("\n❌ Opción inválida. Intenta de nuevo.\n");
        await this.testEmailsMenu();
    }
  }

  async selectEmailForTesting(createRealEvents) {
    console.clear();
    const mode = createRealEvents ? "🔥 CREACIÓN REAL" : "🎭 SIMULACIÓN";
    console.log(`🧪 PRUEBAS DE EMAILS - MODO: ${mode}`);
    console.log("═".repeat(50));
    console.log("");

    const emails = await this.getAvailableEmails();

    if (emails.length === 0) {
      console.log("📭 No se encontraron emails de prueba.");
      console.log("💡 Primero captura algunos emails reales desde Gmail.\n");
      await this.prompt("Presiona Enter para continuar...");
      await this.testEmailsMenu();
      return;
    }

    console.log("📧 Emails de prueba disponibles:\n");
    console.log("0. 🔄 Procesar TODOS los emails");

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`${i + 1}. ${email.fileName} - "${email.subject}"`);
    }

    console.log(`${emails.length + 1}. ⬅️  Volver\n`);

    const choice = await this.prompt(
      `Selecciona un email (0-${emails.length + 1}): `
    );
    const index = parseInt(choice.trim());

    if (index === 0) {
      // Procesar todos
      await this.runCommand("node", [
        "test/testEmails.js",
        createRealEvents ? "calendar" : "",
      ]);
    } else if (index >= 1 && index <= emails.length) {
      // Procesar email específico
      const selectedEmail = emails[index - 1];
      const args = createRealEvents
        ? ["test/testEmails.js", "calendar-test", selectedEmail.fileName]
        : ["test/testEmails.js", "test", selectedEmail.fileName];
      await this.runCommand("node", args);
    } else if (index === emails.length + 1) {
      await this.testEmailsMenu();
      return;
    } else {
      console.log("\n❌ Opción inválida. Intenta de nuevo.\n");
      await this.selectEmailForTesting(createRealEvents);
      return;
    }

    await this.prompt("\nPresiona Enter para continuar...");
    await this.testEmailsMenu();
  }

  async captureEmailsMenu() {
    console.clear();
    console.log("📧 CAPTURA DE EMAILS REALES");
    console.log("═".repeat(30));
    console.log("");
    console.log("1. 📨 Capturar primer email que coincida con la query");
    console.log("2. 📦 Capturar múltiples emails");
    console.log("3. 📋 Listar emails en Gmail (sin capturar)");
    console.log("4. ⬅️  Volver al menú principal\n");

    const choice = await this.prompt("Selecciona una opción (1-4): ");

    switch (choice.trim()) {
      case "1":
        await this.captureEmailOptions("single");
        break;
      case "2":
        await this.captureEmailOptions("multiple");
        break;
      case "3":
        await this.captureEmailOptions("list");
        break;
      case "4":
        console.clear();
        await this.showMainMenu();
        break;
      default:
        console.log("\n❌ Opción inválida. Intenta de nuevo.\n");
        await this.captureEmailsMenu();
    }
  }

  async captureEmailOptions(type) {
    console.clear();
    console.log("📧 CONFIGURACIÓN DE CAPTURA");
    console.log("═".repeat(25));
    console.log("");

    const currentQuery = process.env.GMAIL_QUERY || "is:unread";
    console.log(`📋 Query actual: "${currentQuery}"\n`);
    console.log("1. 📝 Usar query actual del .env");
    console.log("2. ✏️  Usar query personalizada\n");

    const choice = await this.prompt("Selecciona una opción (1-2): ");
    let query = null; // Cambio: inicializar como null

    if (choice.trim() === "2") {
      console.log("\n💡 Ejemplos de queries:");
      console.log("   is:unread from:clinica@ejemplo.com");
      console.log('   subject:"cita médica"');
      console.log("   is:unread has:attachment\n");

      const customQuery = await this.prompt("Ingresa tu query personalizada: ");
      if (customQuery.trim()) {
        query = customQuery.trim();
      }
    } else if (choice.trim() === "1") {
      query = currentQuery; // Usar la query del .env
    }

    let args = ["test/captureEmails.js"];

    if (type === "single") {
      args.push("capture");
      if (query) args.push(query);
    } else if (type === "multiple") {
      const count = await this.prompt(
        "¿Cuántos emails capturar? (por defecto 3): "
      );
      const emailCount = parseInt(count.trim()) || 3;
      args.push("capture-multiple", emailCount.toString());
      if (query) args.push(query);
    } else if (type === "list") {
      const limit = await this.prompt(
        "¿Cuántos emails listar? (por defecto 10): "
      );
      const emailLimit = parseInt(limit.trim()) || 10;
      args.push("list", emailLimit.toString());
      if (query) args.push(query);
    }

    await this.runCommand("node", args);
    await this.prompt("\nPresiona Enter para continuar...");
    await this.captureEmailsMenu();
  }

  async showStats() {
    console.clear();
    console.log("📊 ESTADÍSTICAS DE EVENTOS");
    console.log("═".repeat(25));
    console.log("");

    await this.runCommand("node", ["test/showEventStats.js"]);

    await this.prompt("\nPresiona Enter para continuar...");
    console.clear();
    await this.showMainMenu();
  }

  async geminiDiagnosticMenu() {
    console.clear();
    console.log("🔧 DIAGNÓSTICO DE GEMINI");
    console.log("═".repeat(22));
    console.log("");
    console.log("1. 🔍 Probar todos los modelos disponibles");
    console.log("2. 🎯 Probar un modelo específico");
    console.log("3. ⬅️  Volver al menú principal\n");

    const choice = await this.prompt("Selecciona una opción (1-3): ");

    switch (choice.trim()) {
      case "1":
        await this.runCommand("node", ["test/diagnoseGemini.js"]);
        break;
      case "2":
        const modelName = await this.prompt(
          "Ingresa el nombre del modelo a probar: "
        );
        if (modelName.trim()) {
          await this.runCommand("node", [
            "test/diagnoseGemini.js",
            modelName.trim(),
          ]);
        }
        break;
      case "3":
        console.clear();
        await this.showMainMenu();
        return;
      default:
        console.log("\n❌ Opción inválida. Intenta de nuevo.\n");
        await this.geminiDiagnosticMenu();
        return;
    }

    await this.prompt("\nPresiona Enter para continuar...");
    await this.geminiDiagnosticMenu();
  }

  async getAvailableEmails() {
    try {
      const files = await fs.readdir(this.testEmailsPath);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      const emails = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.testEmailsPath, file);
          const content = await fs.readFile(filePath, "utf8");
          const emailData = JSON.parse(content);

          emails.push({
            fileName: file,
            subject: emailData.subject || "Sin asunto",
            from: emailData.from || "Desconocido",
            date: emailData.date || "Fecha desconocida",
          });
        } catch (error) {
          // Ignorar archivos corruptos
        }
      }

      return emails;
    } catch (error) {
      return [];
    }
  }

  async listAvailableEmails() {
    console.clear();
    console.log("📧 EMAILS DE PRUEBA DISPONIBLES");
    console.log("═".repeat(32));
    console.log("");

    const emails = await this.getAvailableEmails();

    if (emails.length === 0) {
      console.log("📭 No se encontraron emails de prueba.");
      console.log("💡 Primero captura algunos emails reales desde Gmail.\n");
    } else {
      for (const email of emails) {
        console.log(`📄 ${email.fileName}`);
        console.log(`   📝 Asunto: "${email.subject}"`);
        console.log(`   👤 De: ${email.from}`);
        console.log(`   📅 Fecha: ${email.date}`);
        console.log("");
      }
    }

    await this.prompt("Presiona Enter para continuar...");
    await this.testEmailsMenu();
  }

  async runCommand(command, args = []) {
    return new Promise((resolve) => {
      console.log(""); // Línea en blanco antes de la ejecución
      const child = spawn(command, args, {
        stdio: "inherit",
        shell: false, // Cambiar a false para evitar interpretación de shell
      });

      child.on("close", (code) => {
        resolve(code);
      });
    });
  }

  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Ejecutar el menú interactivo
const menu = new InteractiveMenu();
menu.start().catch(console.error);
