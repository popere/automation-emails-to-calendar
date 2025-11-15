import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
    });
  }

  async extractEventDetails(email) {
    try {
      const prompt = this.buildPrompt(email);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Intentar parsear la respuesta JSON
      try {
        const eventDetails = JSON.parse(text);
        return this.validateEventDetails(eventDetails);
      } catch (parseError) {
        console.error(
          "Error parseando respuesta de Gemini:",
          parseError.message
        );
        console.log("Respuesta recibida:", text);
        return null;
      }
    } catch (error) {
      console.error("Error con Gemini API:", error.message);
      return null;
    }
  }

  buildPrompt(email) {
    return `
Analiza el siguiente correo electrónico y extrae información para crear un evento de calendario.
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura:

{
  "title": "TÍTULO DE LA ACTIVIDAD SIN ASTERISCO Y EN MAYUSCULAS (salvo si es Pádel, que en ese caso quiero que este 'Pádel' sólo), en el caso de ser un reserva de padel, quiero que el título sea 'Pádel' sólo",
  "description": "Descripción detallada del evento",
  "startDateTime": "2024-01-15T14:00:00",
  "endDateTime": "2024-01-15T15:00:00",
  "location": "Ubicación del evento (si está mencionada) -> sala y lugar",
  "timeZone": "Europe/Madrid"
}

REGLAS IMPORTANTES:
1. Si no encuentras una fecha/hora específica, usa una fecha futura razonable
2. Si no se especifica duración, asume 1 hora
3. Las fechas deben estar en formato ISO 8601
4. Si no hay ubicación, omite ese campo
5. Extrae toda la información relevante para la descripción
6. El título debe ser conciso pero descriptivo

CORREO A ANALIZAR:
Asunto: ${email.subject}
De: ${email.from}
Fecha: ${email.date}
Contenido: ${email.body}
Resumen: ${email.snippet}

Responde ÚNICAMENTE con el objeto JSON, sin texto adicional, ni markdown:`;
  }

  validateEventDetails(eventDetails) {
    // Validar campos requeridos
    if (
      !eventDetails.title ||
      !eventDetails.startDateTime ||
      !eventDetails.endDateTime
    ) {
      console.error("Faltan campos requeridos en la respuesta de Gemini");
      return null;
    }

    // Validar formato de fechas
    try {
      new Date(eventDetails.startDateTime);
      new Date(eventDetails.endDateTime);
    } catch (error) {
      console.error("Formato de fecha inválido:", error.message);
      return null;
    }

    // Asegurar que la fecha de fin sea posterior a la de inicio
    if (
      new Date(eventDetails.endDateTime) <= new Date(eventDetails.startDateTime)
    ) {
      console.error("La fecha de fin debe ser posterior a la de inicio");
      return null;
    }

    // Valores por defecto
    eventDetails.timeZone = eventDetails.timeZone || "Europe/Madrid";
    eventDetails.description =
      eventDetails.description ||
      `Evento creado automáticamente desde correo: ${eventDetails.title}`;

    return eventDetails;
  }

  async testGeminiConnection() {
    try {
      const result = await this.model.generateContent(
        'Responde con "OK" si puedes procesar este mensaje.'
      );
      const response = await result.response;
      const text = response.text();

      console.log("✅ Conexión con Gemini exitosa:", text.trim());
      return true;
    } catch (error) {
      console.error("❌ Error conectando con Gemini:", error.message);
      return false;
    }
  }
}
