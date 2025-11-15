import dotenv from "dotenv";
import { EventLogger } from "../src/services/eventLogger.js";

dotenv.config();

async function showEventStats() {
  console.log("📊 Obteniendo estadísticas de eventos generados...\n");

  const eventLogger = new EventLogger();
  const stats = await eventLogger.getEventStats();

  if (!stats) {
    console.log("❌ No se pudieron obtener las estadísticas");
    return;
  }

  if (stats.total === 0) {
    console.log("📭 No se han generado eventos aún");
    console.log(
      "💡 Ejecuta algunas pruebas con eventos reales para ver estadísticas aquí"
    );
    return;
  }

  console.log("📊 ESTADÍSTICAS DE EVENTOS GENERADOS:");
  console.log("─".repeat(50));
  console.log(`📈 Total de eventos procesados: ${stats.total}`);
  console.log(`✅ Eventos creados en el calendario: ${stats.created}`);
  console.log(`🗑️ Eventos eliminados (cancelaciones): ${stats.deleted || 0}`);
  console.log(`⏭️  Eventos saltados (duplicados): ${stats.skipped}`);
  console.log(`❌ Eventos fallidos: ${stats.failed}`);
  console.log(
    `⚠️ Cancelaciones no encontradas: ${stats.cancellationNotFound || 0}`
  );
  console.log(`❌ Eliminaciones fallidas: ${stats.deletionFailed || 0}`);
  console.log(`🔧 Errores de cancelación: ${stats.cancellationError || 0}`);

  if (stats.total > 0) {
    const successRate = ((stats.created / stats.total) * 100).toFixed(1);
    const deleteRate = (((stats.deleted || 0) / stats.total) * 100).toFixed(1);
    const skipRate = ((stats.skipped / stats.total) * 100).toFixed(1);
    const failRate = ((stats.failed / stats.total) * 100).toFixed(1);

    console.log("\n📊 Porcentajes:");
    console.log(`   ✅ Eventos creados: ${successRate}%`);
    console.log(`   🗑️ Eventos eliminados: ${deleteRate}%`);
    console.log(`   ⏭️  Saltados: ${skipRate}%`);
    console.log(`   ❌ Fallos: ${failRate}%`);
  }

  if (Object.keys(stats.byDate).length > 0) {
    console.log("\n📅 Actividad por fecha:");
    console.log("─".repeat(30));
    Object.entries(stats.byDate)
      .sort()
      .forEach(([date, count]) => {
        const formattedDate = new Date(date).toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        console.log(`   ${formattedDate}: ${count} evento(s)`);
      });
  }

  console.log("\n💡 Los archivos detallados están en: generatedEvents/");
  console.log("   📁 created-* = Eventos creados exitosamente");
  console.log("   📁 deleted-* = Eventos eliminados por cancelación");
  console.log("   📁 skipped-* = Eventos saltados (duplicados)");
  console.log(
    "   📁 cancel-not-found-* = Cancelaciones sin evento correspondiente"
  );
  console.log("   📁 failed-* = Errores al crear eventos");
}

// Ejecutar
showEventStats().catch(console.error);
