import { EventLogger } from "./eventLogger.js";

export class CancellationService {
  constructor(geminiService, calendarService) {
    this.geminiService = geminiService;
    this.calendarService = calendarService;
    this.eventLogger = new EventLogger();
  }

  async initialize() {
    await this.eventLogger.initialize();
  }

  async processCancellation(email) {
    try {
      console.log(`📧 Procesando cancelación: "${email.subject}"`);

      // Extraer detalles del evento a cancelar usando Gemini
      const cancellationDetails = await this.extractCancellationDetails(email);

      if (!cancellationDetails) {
        console.log(
          "❌ No se pudo extraer información de cancelación del email"
        );
        return null;
      }

      console.log("📋 Detalles de cancelación extraídos:");
      console.log(`   🏷️  Evento: ${cancellationDetails.title}`);
      console.log(`   📅 Fecha: ${cancellationDetails.startDateTime}`);
      if (cancellationDetails.location) {
        console.log(`   📍 Ubicación: ${cancellationDetails.location}`);
      }

      // Buscar evento coincidente en el calendario
      const matchingEvent = await this.findMatchingEvent(cancellationDetails);

      if (!matchingEvent) {
        console.log("⚠️ No se encontró un evento coincidente en el calendario");

        await this.eventLogger.saveEventInfo({
          action: "cancellation_not_found",
          cancellationDetails: cancellationDetails,
          sourceEmail: {
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
          },
        });

        return { success: false, reason: "Evento no encontrado" };
      }

      // Eliminar el evento
      const deleted = await this.deleteEvent(matchingEvent);

      if (deleted) {
        console.log(
          `✅ Evento eliminado exitosamente: "${matchingEvent.summary}"`
        );
        console.log(`🔗 Evento eliminado: ${matchingEvent.htmlLink}`);

        await this.eventLogger.saveEventInfo({
          action: "event_deleted",
          deletedEvent: matchingEvent,
          cancellationDetails: cancellationDetails,
          sourceEmail: {
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
          },
        });

        return { success: true, deletedEvent: matchingEvent };
      } else {
        console.log("❌ Error eliminando el evento");

        await this.eventLogger.saveEventInfo({
          action: "deletion_failed",
          targetEvent: matchingEvent,
          cancellationDetails: cancellationDetails,
          sourceEmail: {
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
          },
        });

        return { success: false, reason: "Error en eliminación" };
      }
    } catch (error) {
      console.error("❌ Error procesando cancelación:", error.message);

      await this.eventLogger.saveEventInfo({
        action: "cancellation_error",
        error: error.message,
        sourceEmail: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      });

      return { success: false, error: error.message };
    }
  }

  async extractCancellationDetails(email) {
    const prompt = `
Analiza el siguiente correo electrónico de CANCELACIÓN y extrae información del evento que se está cancelando.
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura:

{
  "title": "TÍTULO DE LA ACTIVIDAD SIN ASTERISCO Y EN MAYUSCULAS (salvo si es Pádel, que en ese caso quiero que este 'Pádel' sólo), en el caso de ser un reserva de padel, quiero que el título sea 'Pádel' sólo",
  "startDateTime": "2024-01-15T14:00:00",
  "endDateTime": "2024-01-15T15:00:00",
  "location": "Ubicación del evento (si está mencionada) -> sala y lugar",
  "timeZone": "Europe/Madrid"
}

REGLAS IMPORTANTES:
1. Extrae información del evento que se CANCELA, no del email en sí
2. Las fechas deben estar en formato ISO 8601
3. Si no hay ubicación específica, omite ese campo
4. El título debe ser conciso pero descriptivo
5. Si no encuentras fechas específicas, intenta inferirlas del contexto

CORREO DE CANCELACIÓN A ANALIZAR:
Asunto: ${email.subject}
De: ${email.from}
Fecha: ${email.date}
Contenido: ${email.body}
Resumen: ${email.snippet}

Responde ÚNICAMENTE con el objeto JSON, sin texto adicional, ni markdown:`;

    try {
      const result = await this.geminiService.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cancellationDetails = JSON.parse(text);
      return this.validateCancellationDetails(cancellationDetails);
    } catch (error) {
      console.error("Error extrayendo detalles de cancelación:", error.message);
      return null;
    }
  }

  validateCancellationDetails(details) {
    if (!details.title || !details.startDateTime) {
      console.error("Faltan campos requeridos en los detalles de cancelación");
      return null;
    }

    // Validar formato de fechas
    try {
      new Date(details.startDateTime);
      if (details.endDateTime) {
        new Date(details.endDateTime);
      }
    } catch (error) {
      console.error("Formato de fecha inválido en cancelación:", error.message);
      return null;
    }

    // Valores por defecto
    details.timeZone = details.timeZone || "Europe/Madrid";

    return details;
  }

  async findMatchingEvent(cancellationDetails) {
    try {
      const calendarId = process.env.CALENDAR_ID || "primary";
      const startDate = new Date(cancellationDetails.startDateTime);

      // Buscar eventos en un rango de ±12 horas del evento a cancelar
      const searchStart = new Date(startDate.getTime() - 12 * 60 * 60 * 1000);
      const searchEnd = new Date(startDate.getTime() + 12 * 60 * 60 * 1000);

      const response = await this.calendarService.calendar.events.list({
        calendarId: calendarId,
        timeMin: searchStart.toISOString(),
        timeMax: searchEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      // Buscar evento más similar
      let bestMatch = null;
      let highestSimilarity = 0;

      for (const event of events) {
        const similarity = this.calculateCancellationSimilarity(
          cancellationDetails,
          event
        );

        if (similarity > 0.8 && similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = event;
        }
      }

      if (bestMatch) {
        console.log(
          `🔍 Evento coincidente encontrado (similaridad: ${(
            highestSimilarity * 100
          ).toFixed(1)}%)`
        );
        console.log(
          `   📅 "${bestMatch.summary}" - ${new Date(
            bestMatch.start.dateTime
          ).toLocaleString("es-ES")}`
        );
      }

      return bestMatch;
    } catch (error) {
      console.error("Error buscando evento coincidente:", error.message);
      return null;
    }
  }

  calculateCancellationSimilarity(cancellationDetails, calendarEvent) {
    let similarity = 0;
    let factors = 0;

    // Comparar títulos (peso: 50%)
    const titleSimilarity = this.calendarService.stringSimilarity(
      this.calendarService.normalizeString(cancellationDetails.title),
      this.calendarService.normalizeString(calendarEvent.summary || "")
    );
    similarity += titleSimilarity * 0.5;
    factors += 0.5;

    // Comparar ubicaciones (peso: 20%)
    if (cancellationDetails.location && calendarEvent.location) {
      const locationSimilarity = this.calendarService.stringSimilarity(
        this.calendarService.normalizeString(cancellationDetails.location),
        this.calendarService.normalizeString(calendarEvent.location)
      );
      similarity += locationSimilarity * 0.2;
      factors += 0.2;
    } else if (!cancellationDetails.location && !calendarEvent.location) {
      similarity += 0.2;
      factors += 0.2;
    }

    // Comparar fechas y horas (peso: 30%)
    const cancellationStart = new Date(cancellationDetails.startDateTime);
    const eventStart = new Date(
      calendarEvent.start.dateTime || calendarEvent.start.date
    );

    const timeDiffMinutes =
      Math.abs(cancellationStart.getTime() - eventStart.getTime()) /
      (1000 * 60);

    let timeSimilarity = 0;
    if (timeDiffMinutes <= 15) {
      timeSimilarity = 1;
    } else if (timeDiffMinutes <= 60) {
      timeSimilarity = 0.8;
    } else if (timeDiffMinutes <= 180) {
      timeSimilarity = 0.5;
    } else {
      timeSimilarity = 0;
    }

    similarity += timeSimilarity * 0.3;
    factors += 0.3;

    return factors > 0 ? similarity / factors : 0;
  }

  async deleteEvent(event) {
    try {
      const calendarId = process.env.CALENDAR_ID || "primary";

      await this.calendarService.calendar.events.delete({
        calendarId: calendarId,
        eventId: event.id,
      });

      return true;
    } catch (error) {
      console.error("Error eliminando evento:", error.message);
      return false;
    }
  }
}
