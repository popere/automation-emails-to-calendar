import fs from "fs/promises";
import path from "path";

export class EventLogger {
  constructor() {
    this.generatedEventsPath = path.join(process.cwd(), "generatedEvents");
  }

  async initialize() {
    // Crear directorio para eventos generados si no existe
    await fs.mkdir(this.generatedEventsPath, { recursive: true });
  }

  async saveEventInfo(eventInfo) {
    try {
      await this.initialize();

      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split("T")[0]; // YYYY-MM-DD

      // Generar nombre de archivo basado en el evento
      let fileName;
      if (eventInfo.action === "created" && eventInfo.calendarEvent) {
        const eventTitle =
          eventInfo.calendarEvent.summary || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `created-${dateStr}-${cleanTitle}-${eventInfo.calendarEvent.id}.json`;
      } else if (eventInfo.action === "event_deleted") {
        const eventTitle =
          eventInfo.deletedEvent?.summary || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `deleted-${dateStr}-${cleanTitle}-${
          eventInfo.deletedEvent?.id || "unknown"
        }.json`;
      } else if (eventInfo.action === "cancellation_not_found") {
        const eventTitle =
          eventInfo.cancellationDetails?.title || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `cancel-not-found-${dateStr}-${cleanTitle}.json`;
      } else if (eventInfo.action === "deletion_failed") {
        const eventTitle =
          eventInfo.targetEvent?.summary || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `delete-failed-${dateStr}-${cleanTitle}.json`;
      } else if (eventInfo.action === "cancellation_error") {
        fileName = `cancel-error-${dateStr}-${Date.now()}.json`;
      } else if (eventInfo.action === "skipped") {
        const eventTitle =
          eventInfo.attemptedEvent?.title || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `skipped-${dateStr}-${cleanTitle}.json`;
      } else if (eventInfo.action === "failed") {
        const eventTitle = eventInfo.eventDetails?.title || "evento-sin-titulo";
        const cleanTitle = eventTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 30);
        fileName = `failed-${dateStr}-${cleanTitle}.json`;
      } else {
        fileName = `event-${dateStr}-${Date.now()}.json`;
      }

      const filePath = path.join(this.generatedEventsPath, fileName);

      const eventRecord = {
        timestamp: timestamp,
        action: eventInfo.action,
        ...eventInfo,
      };

      await fs.writeFile(filePath, JSON.stringify(eventRecord, null, 2));
      console.log(
        `📄 Información del evento guardada en: generatedEvents/${fileName}`
      );

      return fileName;
    } catch (error) {
      console.error("Error guardando información del evento:", error.message);
    }
  }

  async getEventStats() {
    try {
      await this.initialize();
      const files = await fs.readdir(this.generatedEventsPath);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      let stats = {
        total: jsonFiles.length,
        created: 0,
        skipped: 0,
        failed: 0,
        deleted: 0,
        cancellationNotFound: 0,
        deletionFailed: 0,
        cancellationError: 0,
        byDate: {},
      };

      for (const file of jsonFiles) {
        if (file.startsWith("created-")) stats.created++;
        if (file.startsWith("skipped-")) stats.skipped++;
        if (file.startsWith("failed-")) stats.failed++;
        if (file.startsWith("deleted-")) stats.deleted++;
        if (file.startsWith("cancel-not-found-")) stats.cancellationNotFound++;
        if (file.startsWith("delete-failed-")) stats.deletionFailed++;
        if (file.startsWith("cancel-error-")) stats.cancellationError++;

        // Extraer fecha del nombre del archivo
        const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          const date = dateMatch[0];
          stats.byDate[date] = (stats.byDate[date] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error.message);
      return null;
    }
  }
}
