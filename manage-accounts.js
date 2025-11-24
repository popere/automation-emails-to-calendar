#!/usr/bin/env node

import dotenv from "dotenv";
import { AuthService } from "./src/services/authService.js";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function listAccounts() {
  console.log("\n📋 Cuentas Configuradas:\n");
  const tokenFiles = await AuthService.discoverTokenFiles();

  for (const tokenFile of tokenFiles) {
    const tokenPath = path.join(process.cwd(), tokenFile);
    const accountName = path.basename(tokenFile, ".json");

    try {
      const tokenData = await fs.readFile(tokenPath, "utf8");
      const tokens = JSON.parse(tokenData);

      const expiryDate = new Date(tokens.expiry_date);
      const timeUntilExpiry = tokens.expiry_date - Date.now();
      const isExpired = timeUntilExpiry < 0;

      const days = Math.floor(
        Math.abs(timeUntilExpiry) / (24 * 60 * 60 * 1000)
      );
      const hours = Math.floor(
        (Math.abs(timeUntilExpiry) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
      );
      const minutes = Math.floor(
        (Math.abs(timeUntilExpiry) % (60 * 60 * 1000)) / (60 * 1000)
      );

      console.log(`${isExpired ? "❌" : "✅"} ${accountName}`);
      console.log(`   Archivo: ${tokenFile}`);
      console.log(
        `   Token: ${isExpired ? "EXPIRADO" : "Válido"} - ${
          isExpired ? "Expiró" : "Caduca en"
        } ${days}d ${hours}h ${minutes}m`
      );
      console.log(
        `   Fecha: ${expiryDate.toLocaleString("es-ES", {
          dateStyle: "full",
          timeStyle: "short",
        })}`
      );
      console.log();
    } catch (error) {
      console.log(`⚠️  ${accountName}`);
      console.log(`   Archivo: ${tokenFile}`);
      console.log(`   Estado: Token no encontrado o inválido`);
      console.log();
    }
  }
}

async function addAccount() {
  console.log("\n➕ Agregar Nueva Cuenta\n");

  const accountName = await question(
    "Nombre de la cuenta (ej: ali, work, personal): "
  );

  if (!accountName || accountName.trim() === "") {
    console.log("❌ Nombre inválido");
    return;
  }

  const tokenFile = `token-${accountName.trim()}.json`;
  const tokenPath = path.join(process.cwd(), tokenFile);

  // Verificar si ya existe
  try {
    await fs.access(tokenPath);
    console.log(`⚠️  La cuenta "${accountName}" ya existe (${tokenFile})`);
    const overwrite = await question("¿Sobrescribir? (s/n): ");
    if (overwrite.toLowerCase() !== "s") {
      console.log("Operación cancelada");
      return;
    }
  } catch (error) {
    // No existe, continuar
  }

  console.log(`\n🔐 Autenticando cuenta "${accountName}"...`);
  console.log(
    "Se abrirá tu navegador para autorizar el acceso a Google Calendar y Gmail.\n"
  );

  try {
    const authService = new AuthService(tokenFile);
    await authService.authenticate();
    console.log(`\n✅ Cuenta "${accountName}" agregada exitosamente!`);
    console.log(`   Token guardado en: ${tokenFile}`);
  } catch (error) {
    console.error(`\n❌ Error agregando cuenta: ${error.message}`);
  }
}

async function removeAccount() {
  console.log("\n🗑️  Eliminar Cuenta\n");

  const tokenFiles = await AuthService.discoverTokenFiles();

  if (tokenFiles.length === 0) {
    console.log("❌ No hay cuentas configuradas");
    return;
  }

  console.log("Cuentas disponibles:");
  tokenFiles.forEach((file, index) => {
    const accountName = path.basename(file, ".json");
    console.log(`${index + 1}. ${accountName} (${file})`);
  });

  const choice = await question(
    "\nSelecciona el número de cuenta a eliminar (0 para cancelar): "
  );
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= tokenFiles.length || isNaN(index)) {
    console.log("Operación cancelada");
    return;
  }

  const tokenFile = tokenFiles[index];
  const accountName = path.basename(tokenFile, ".json");

  const confirm = await question(
    `¿Estás seguro de eliminar "${accountName}"? (s/n): `
  );

  if (confirm.toLowerCase() !== "s") {
    console.log("Operación cancelada");
    return;
  }

  try {
    const tokenPath = path.join(process.cwd(), tokenFile);
    await fs.unlink(tokenPath);
    console.log(`\n✅ Cuenta "${accountName}" eliminada exitosamente`);
  } catch (error) {
    console.error(`\n❌ Error eliminando cuenta: ${error.message}`);
  }
}

async function refreshAccount() {
  console.log("\n🔄 Refrescar Token de Cuenta\n");

  const tokenFiles = await AuthService.discoverTokenFiles();

  if (tokenFiles.length === 0) {
    console.log("❌ No hay cuentas configuradas");
    return;
  }

  console.log("Cuentas disponibles:");
  tokenFiles.forEach((file, index) => {
    const accountName = path.basename(file, ".json");
    console.log(`${index + 1}. ${accountName} (${file})`);
  });

  const choice = await question(
    "\nSelecciona el número de cuenta a refrescar (0 para cancelar): "
  );
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= tokenFiles.length || isNaN(index)) {
    console.log("Operación cancelada");
    return;
  }

  const tokenFile = tokenFiles[index];
  const accountName = path.basename(tokenFile, ".json");

  console.log(`\n🔄 Refrescando token de "${accountName}"...`);

  try {
    const authService = new AuthService(tokenFile);
    await authService.authenticate();
    await authService.refreshToken();
    console.log(`\n✅ Token de "${accountName}" refrescado exitosamente`);
  } catch (error) {
    console.error(`\n❌ Error refrescando token: ${error.message}`);
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("👥 GESTOR DE CUENTAS - Automatización Multi-Cuenta");
  console.log("=".repeat(60));

  while (true) {
    console.log("\n📋 Menú Principal:\n");
    console.log("1. 📋 Listar cuentas configuradas");
    console.log("2. ➕ Agregar nueva cuenta");
    console.log("3. 🗑️  Eliminar cuenta");
    console.log("4. 🔄 Refrescar token de cuenta");
    console.log("5. ❌ Salir\n");

    const choice = await question("Selecciona una opción (1-5): ");

    switch (choice) {
      case "1":
        await listAccounts();
        break;
      case "2":
        await addAccount();
        break;
      case "3":
        await removeAccount();
        break;
      case "4":
        await refreshAccount();
        break;
      case "5":
        console.log("\n👋 ¡Hasta luego!\n");
        rl.close();
        process.exit(0);
      default:
        console.log("\n❌ Opción inválida\n");
    }
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  rl.close();
  process.exit(1);
});
