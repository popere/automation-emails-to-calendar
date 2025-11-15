import dotenv from "dotenv";
import { CalendarServiceWithDuplicateDetection as CalendarService } from "../src/services/calendarServiceNew.js";
import { EventLogger } from "../src/services/eventLogger.js";

dotenv.config();

class EventGenerationService {
  constructor() {
    this.calendarService = new CalendarService();
    this.eventLogger = new EventLogger();
  }

  async initialize() {
    // Inicializar servicios
    await this.eventLogger.initialize();
    console.log("📊 Servicios de generación de eventos inicializados");
  }

  async createEventFromDetails(eventDetails, sourceInfo = null) {
    try {
      console.log(`🔄 Procesando evento: "${eventDetails.title}"`);
      console.log(
        `📅 Fecha: ${eventDetails.startDateTime} - ${eventDetails.endDateTime}`
      );

      if (eventDetails.location) {
        console.log(`📍 Ubicación: ${eventDetails.location}`);
      }

      // Intentar crear el evento
      const result = await this.calendarService.createEvent(eventDetails);

      if (result && result.skipped) {
        // Evento saltado por duplicado
        await this.eventLogger.saveEventInfo({
          action: "skipped",
          reason: result.reason,
          existingEvent: {
            id: result.id,
            summary: result.summary,
            htmlLink: result.htmlLink,
            start: result.start,
            end: result.end,
          },
          attemptedEvent: eventDetails,
          sourceInfo: sourceInfo,
        });

        return { success: false, skipped: true, reason: result.reason };
      } else if (result) {
        // Evento creado exitosamente
        await this.eventLogger.saveEventInfo({
          action: "created",
          calendarEvent: result,
          eventDetails: eventDetails,
          sourceInfo: sourceInfo,
        });

        return { success: true, calendarEvent: result };
      } else {
        // Error creando evento
        await this.eventLogger.saveEventInfo({
          action: "failed",
          error: "Error desconocido al crear evento",
          eventDetails: eventDetails,
          sourceInfo: sourceInfo,
        });

        return { success: false, error: "Error desconocido" };
      }
    } catch (error) {
      console.error("❌ Error en generación de evento:", error.message);

      await this.eventLogger.saveEventInfo({
        action: "failed",
        error: error.message,
        eventDetails: eventDetails,
        sourceInfo: sourceInfo,
      });

      return { success: false, error: error.message };
    }
  }

  async getStats() {
    const stats = await this.eventLogger.getEventStats();

    if (stats) {
      console.log("\n📊 ESTADÍSTICAS DE EVENTOS GENERADOS:");
      console.log(`   📈 Total: ${stats.total}`);
      console.log(`   ✅ Creados: ${stats.created}`);
      console.log(`   ⏭️  Saltados: ${stats.skipped}`);
      console.log(`   ❌ Fallidos: ${stats.failed}`);

      if (Object.keys(stats.byDate).length > 0) {
        console.log("\n📅 Por fecha:");
        Object.entries(stats.byDate)
          .sort()
          .forEach(([date, count]) => {
            console.log(`   ${date}: ${count} evento(s)`);
          });
      }
    }

    return stats;
  }
}

export { EventGenerationService };
