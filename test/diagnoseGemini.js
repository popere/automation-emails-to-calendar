import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

async function testGeminiModels() {
  console.log("🔍 Verificando modelos disponibles de Gemini...\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY no encontrada en el archivo .env");
    console.log("💡 Agrega tu API key en el archivo .env:");
    console.log("   GEMINI_API_KEY=tu_api_key_aqui");
    return;
  }

  console.log(
    `🔑 API Key encontrada: ${process.env.GEMINI_API_KEY.substring(
      0,
      20
    )}...${process.env.GEMINI_API_KEY.slice(-10)}`
  );
  console.log(
    `📏 Longitud de API Key: ${process.env.GEMINI_API_KEY.length} caracteres\n`
  );

  // Primero obtener lista real de modelos
  console.log("🌐 Obteniendo lista real de modelos...");
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?key=" +
        process.env.GEMINI_API_KEY
    );

    if (response.status === 200) {
      const data = await response.json();
      console.log(
        `   ✅ Encontrados ${data.models?.length || 0} modelos totales\n`
      );

      // Filtrar solo modelos que soporten generateContent
      const generateModels =
        data.models?.filter((model) =>
          model.supportedGenerationMethods?.includes("generateContent")
        ) || [];

      console.log(
        `📝 Modelos que soportan generateContent (${generateModels.length}):`
      );
      generateModels.forEach((model) => {
        console.log(`   - ${model.name}`);
      });
      console.log("");

      // Probar los primeros 3 modelos disponibles
      if (generateModels.length > 0) {
        console.log("🧪 Probando modelos disponibles...\n");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let workingModels = [];

        for (let i = 0; i < Math.min(3, generateModels.length); i++) {
          const modelInfo = generateModels[i];
          const modelName = modelInfo.name;

          try {
            console.log(`🔬 Probando modelo: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent("Responde solo con: OK");
            const response = await result.response;
            const text = response.text();

            console.log(`   ✅ ${modelName}: Funciona - "${text.trim()}"`);
            workingModels.push(modelName);
          } catch (error) {
            console.log(
              `   ❌ ${modelName}: ${error.message.substring(0, 100)}...`
            );
          }
          console.log("");
        }

        console.log("📊 RESUMEN:");
        if (workingModels.length > 0) {
          console.log(`✅ Modelos funcionando: ${workingModels.join(", ")}`);
          console.log(`🎯 Modelo recomendado: ${workingModels[0]}`);
          console.log("");
          console.log("💡 Para usar este modelo, actualiza geminiService.js:");
          console.log(
            `   this.model = this.genAI.getGenerativeModel({ model: "${workingModels[0]}" });`
          );
        } else {
          console.log("❌ Ninguno de los modelos de prueba funcionó");
        }
      }
    } else {
      console.log(
        `   ❌ Error HTTP: ${response.status} ${response.statusText}`
      );
    }
  } catch (fetchError) {
    console.log(`   ❌ Error de conectividad: ${fetchError.message}`);
  }
}

// Función adicional para probar un modelo específico
async function testSpecificModel(modelName) {
  console.log(`🎯 Probando modelo específico: ${modelName}\n`);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const testPrompt = `
Analiza este email y devuelve solo un JSON:
Email: "Cita médica mañana 15:00"
Responde con: {"title": "CITA MÉDICA", "startDateTime": "2024-01-16T15:00:00", "endDateTime": "2024-01-16T16:00:00"}
`;

    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    console.log(`✅ Respuesta del modelo ${modelName}:`);
    console.log(text);

    // Intentar parsear JSON
    try {
      const parsed = JSON.parse(text);
      console.log("\n✅ JSON válido parseado correctamente");
      return parsed;
    } catch (parseError) {
      console.log("\n⚠️ La respuesta no es JSON válido");
      console.log("Respuesta recibida:");
      console.log(text);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error con ${modelName}:`, error.message);
    return null;
  }
}

// Ejecutar según argumentos
const args = process.argv.slice(2);

if (args.length > 0) {
  testSpecificModel(args[0]);
} else {
  testGeminiModels().catch(console.error);
}
