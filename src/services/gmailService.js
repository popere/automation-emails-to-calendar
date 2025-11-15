import { google } from "googleapis";

export class GmailService {
  constructor() {
    this.gmail = null;
  }

  async initialize(auth) {
    this.gmail = google.gmail({ version: "v1", auth });
  }

  async getUnreadEmails() {
    try {
      const query = process.env.GMAIL_QUERY || "is:unread";

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
      });

      const messages = response.data.messages || [];
      const emails = [];

      for (const message of messages.slice(0, 10)) {
        // Limitar a 10 correos por vez
        const email = await this.getEmailDetails(message.id);
        if (email) {
          emails.push(email);
        }
      }

      return emails;
    } catch (error) {
      console.error("Error obteniendo correos:", error.message);
      return [];
    }
  }

  async getEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      const message = response.data;
      const headers = message.payload.headers;

      const getHeader = (name) => {
        const header = headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        );
        return header ? header.value : "";
      };

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const date = getHeader("Date");

      // Extraer el cuerpo del correo
      let body = "";
      if (message.payload.parts) {
        body = this.extractBodyFromParts(message.payload.parts);
      } else if (message.payload.body && message.payload.body.data) {
        body = Buffer.from(message.payload.body.data, "base64").toString(
          "utf-8"
        );
      }

      return {
        id: messageId,
        subject,
        from,
        date,
        body: body.substring(0, 2000), // Limitar el tamaño del cuerpo
        snippet: message.snippet,
      };
    } catch (error) {
      console.error(
        `Error obteniendo detalles del correo ${messageId}:`,
        error.message
      );
      return null;
    }
  }

  extractBodyFromParts(parts) {
    let body = "";

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        body += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        body += this.extractBodyFromParts(part.parts);
      }
    }

    return body;
  }

  async markAsRead(messageId) {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
      return true;
    } catch (error) {
      console.error(
        `Error marcando correo ${messageId} como leído:`,
        error.message
      );
      return false;
    }
  }

  // Método para buscar emails con query personalizada
  async getEmailsByQuery(query) {
    try {
      console.log(`🔍 Buscando emails con query: "${query}"`);

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10,
      });

      const messages = response.data.messages || [];
      const emails = [];

      for (const message of messages) {
        const email = await this.getEmailDetails(message.id);
        if (email) {
          emails.push(email);
        }
      }

      return emails;
    } catch (error) {
      console.error("Error obteniendo emails por query:", error.message);
      return [];
    }
  }
}
