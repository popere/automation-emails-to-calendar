import dotenv from "dotenv";
import { AuthService } from "../src/services/authService.js";
import { GmailService } from "../src/services/gmailService.js";

dotenv.config();

async function diagnoseQuery() {
  console.log("🔍 Diagnóstico de GMAIL_QUERY\n");

  const authService = new AuthService();
  const gmailService = new GmailService(authService);

  console.log("🔐 Autenticando...");
  const auth = await authService.authenticate();
  await gmailService.initialize(auth);
  console.log("✅ Autenticación completada\n");

  // Leer la query del .env
  const envQuery = process.env.GMAIL_QUERY;
  console.log(`📝 Query del .env: "${envQuery}"\n`);

  // Probar diferentes variaciones de la query
  const queries = [
    envQuery,
    "is:unread subject:Confirmación",
    'is:unread subject:"Confirmación"',
    "is:unread subject:confirmación",
    "subject:Confirmación",
    "from:noreply@virtuagym.com subject:Confirmación",
  ];

  for (const query of queries) {
    console.log(`\n🔍 Probando query: "${query}"`);
    try {
      const emails = await gmailService.getEmailsByQuery(query);
      console.log(`   ✅ Resultados: ${emails.length} email(s)`);
      if (emails.length > 0) {
        console.log(`   📧 Primer email: "${emails[0].subject}"`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

diagnoseQuery().catch(console.error);
