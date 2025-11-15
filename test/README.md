# Pruebas de Emails

Esta carpeta contiene emails de prueba en formato JSON para probar el procesamiento de Gemini sin necesidad de conectarse a Gmail.

## 📧 Emails de Prueba Incluidos

- `medical-appointment.json` - Cita médica con fecha/hora específica
- `work-meeting.json` - Reunión de trabajo con agenda
- `birthday-party.json` - Evento social/celebración

## 🧪 Comandos de Prueba

### Ejecutar todas las pruebas

```bash
npm run test:emails
```

### Listar emails disponibles

```bash
npm run test:emails:list
```

### Probar un email específico

```bash
npm run test:emails:specific medical-appointment.json
```

## 📁 Estructura de Archivos

```
test/
├── emails/           # Emails de prueba en JSON
├── results/          # Resultados de las pruebas (generado automáticamente)
└── testEmails.js     # Script principal de pruebas
```

## 📝 Formato de Email de Prueba

```json
{
  "id": "identificador-unico",
  "subject": "Asunto del correo",
  "from": "remitente@ejemplo.com",
  "date": "2024-01-15T14:00:00Z",
  "snippet": "Resumen corto del correo",
  "body": "Contenido completo del correo..."
}
```

## 📊 Resultados

Los resultados se guardan automáticamente en `test/results/` con el formato:

- `archivo-result.json` - Resultado del procesamiento
- Incluye entrada, salida y timestamp
- Facilita debugging y análisis de rendimiento

## ✨ Agregar Nuevos Emails de Prueba

1. Crea un nuevo archivo JSON en `test/emails/`
2. Sigue el formato establecido
3. Ejecuta las pruebas para validar

Los emails de prueba te permiten:

- Probar diferentes tipos de eventos
- Validar el procesamiento de Gemini
- Desarrollar sin usar cuota de APIs
- Crear casos de prueba específicos
