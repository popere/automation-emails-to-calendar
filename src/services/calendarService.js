import { google } from "googleapis";

export class CalendarService {
  constructor() {
    this.calendar = null;
  }

  async initialize(auth) {
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async createEvent(eventDetails) {
    try {
      const calendarId = process.env.CALENDAR_ID || "primary";

      // Verificar si existe un evento similar
      const existingEvent = await this.findSimilarEvent(
        eventDetails,
        calendarId
      );
      if (existingEvent) {
        console.log(
          `⚠️ Ya existe un evento similar: "${existingEvent.summary}"`
        );
        console.log(
          `📅 Fecha: ${new Date(
            existingEvent.start.dateTime || existingEvent.start.date
          ).toLocaleString("es-ES")}`
        );
        console.log(`🔗 Ver evento: ${existingEvent.htmlLink}`);
        return {
          ...existingEvent,
          skipped: true,
          reason: "Evento similar ya existe",
        };
      }

      // Construir el evento
      const event = {
        summary: eventDetails.title,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.startDateTime,
          timeZone: eventDetails.timeZone || "Europe/Madrid",
        },
        end: {
          dateTime: eventDetails.endDateTime,
          timeZone: eventDetails.timeZone || "Europe/Madrid",
        },
      };

      // Agregar ubicación si está disponible
      if (eventDetails.location) {
        event.location = eventDetails.location;
      }

      // Agregar recordatorios por defecto
      event.reminders = {
        useDefault: true,
        // overrides: [
        //   { method: "email", minutes: 24 * 60 }, // 24 horas antes
        //   { method: "popup", minutes: 30 }, // 30 minutos antes
        // ],
      };

      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
      });

      console.log(`📅 Evento creado: ${response.data.htmlLink}`);
      return response.data;
    } catch (error) {
      console.error("Error creando evento en calendario:", error.message);
      return null;
    }
  }

  // Función para verificar si existe un evento similar
  async findSimilarEvent(eventDetails, calendarId) {
    try {
      const startDate = new Date(eventDetails.startDateTime);
      const endDate = new Date(eventDetails.endDateTime);

      // Buscar eventos en un rango de 2 horas antes y después
      const searchStart = new Date(startDate.getTime() - 2 * 60 * 60 * 1000); // 2 horas antes
      const searchEnd = new Date(endDate.getTime() + 2 * 60 * 60 * 1000); // 2 horas después

      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: searchStart.toISOString(),
        timeMax: searchEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      // Buscar evento similar basado en varios criterios
      for (const event of events) {
        const similarity = this.calculateEventSimilarity(eventDetails, event);

        // Si la similaridad es alta (> 0.7), consideramos que es un evento similar
        if (similarity > 0.7) {
          console.log(
            `🔍 Evento similar encontrado (similaridad: ${(
              similarity * 100
            ).toFixed(1)}%)`
          );
          return event;
        }
      }

      return null;
    } catch (error) {
      console.error("Error buscando eventos similares:", error.message);
      return null; // En caso de error, permitir crear el evento
    }
  }

  // Calcular similaridad entre eventos
  calculateEventSimilarity(newEvent, existingEvent) {
    let similarity = 0;
    let factors = 0;

    // Comparar títulos (peso: 40%)
    const titleSimilarity = this.stringSimilarity(
      this.normalizeString(newEvent.title),
      this.normalizeString(existingEvent.summary || "")
    );
    similarity += titleSimilarity * 0.4;
    factors += 0.4;

    // Comparar ubicaciones (peso: 20%)
    if (newEvent.location && existingEvent.location) {
      const locationSimilarity = this.stringSimilarity(
        this.normalizeString(newEvent.location),
        this.normalizeString(existingEvent.location)
      );
      similarity += locationSimilarity * 0.2;
      factors += 0.2;
    } else if (!newEvent.location && !existingEvent.location) {
      similarity += 0.2; // Ambos sin ubicación
      factors += 0.2;
    }

    // Comparar fechas y horas (peso: 40%)
    const newStart = new Date(newEvent.startDateTime);
    const existingStart = new Date(
      existingEvent.start.dateTime || existingEvent.start.date
    );

    const timeDiffMinutes =
      Math.abs(newStart.getTime() - existingStart.getTime()) / (1000 * 60);

    // Si la diferencia es menor a 30 minutos, consideramos muy similar
    let timeSimilarity = 0;
    if (timeDiffMinutes <= 30) {
      timeSimilarity = 1;
    } else if (timeDiffMinutes <= 60) {
      timeSimilarity = 0.8;
    } else if (timeDiffMinutes <= 120) {
      timeSimilarity = 0.5;
    } else {
      timeSimilarity = 0;
    }

    similarity += timeSimilarity * 0.4;
    factors += 0.4;

    return factors > 0 ? similarity / factors : 0;
  }

  // Calcular similaridad entre strings
  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Algoritmo simple de similaridad basado en palabras comunes
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter((word) =>
      words2.some((w) => w.includes(word) || word.includes(w))
    );

    const maxWords = Math.max(words1.length, words2.length);
    return maxWords > 0 ? commonWords.length / maxWords : 0;
  }

  // Normalizar strings para comparación
  normalizeString(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u")
      .replace(/[^a-z0-9\s]/g, ""); // Quitar caracteres especiales
  }
}
