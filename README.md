# 🤖 Automatización de Emails a Calendario

Automatización inteligente que convierte emails de confirmación en eventos de Google Calendar usando **Google Gemini AI** para el procesamiento natural del lenguaje.

## ✨ Características Principales

- 🧠 **IA Inteligente**: Usa Google Gemini para extraer información de eventos automáticamente
- 📅 **Integración Completa**: Conexión directa con Gmail y Google Calendar
- 🔍 **Detección de Duplicados**: Evita crear eventos duplicados comparando similaridad
- 🗑️ **Gestión de Cancelaciones**: Detecta emails de cancelación y elimina eventos correspondientes
- 📊 **Sistema de Registro**: Registra todas las acciones en archivos JSON detallados
- 🎛️ **Menú Interactivo**: Interfaz guiada para testing y configuración
- ⚡ **Monitoreo Automático**: Verificación periódica de nuevos emails

## 🚀 Flujo de Trabajo Completo

### Procesamiento de Confirmaciones

```
📧 Email → 🧠 Gemini → 🔍 ¿Duplicado? → ✅ Crear Evento → 📄 Registrar
```

### Procesamiento de Cancelaciones

```
📧 Email → 🧠 Gemini → 🔍 Buscar Evento → 🗑️ Eliminar → 📄 Registrar
```

## 🛠️ Instalación y Configuración

### 1. Clonar e Instalar

```bash
git clone <tu-repo>
cd automation-emails-to-calendar
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env`:

```env
# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost

# Google Gemini API
GEMINI_API_KEY=tu_gemini_api_key

# Gmail Configuration
GMAIL_QUERY=is:unread subject:"Confirmación de reserva"
GMAIL_CANCELLATION_QUERY=is:unread subject:"Cancelación" OR subject:"cancelado"
CHECK_INTERVAL_MINUTES=5

# Calendar Configuration
CALENDAR_ID=primary
```

### 3. Configurar APIs de Google

#### Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Habilita Gmail API y Calendar API
3. Crea credenciales OAuth2 (aplicación de escritorio)

#### Google AI Studio

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Genera una nueva API Key
3. Copia la clave al archivo `.env`

## 🚀 Ejecución

### Automatización Principal

```bash
# Monitoreo automático (producción)
npm start

# Desarrollo con auto-reinicio
npm run dev
```

### 🎛️ Menú Interactivo (Recomendado)

```bash
npm run interactive
```

**Funciones disponibles:**

- 🧪 Probar procesamiento de emails (simulación/real)
- 📧 Capturar emails reales de Gmail
- 📊 Ver estadísticas de eventos generados
- 🔧 Diagnosticar conexión con Gemini

## 📊 Sistema de Registro

Todas las acciones se registran en `generatedEvents/`:

### Tipos de Archivos

```
generatedEvents/
├── created-2025-11-13-boompa-abc123.json      # ✅ Evento creado
├── deleted-2025-11-13-boompa-abc123.json      # 🗑️ Evento eliminado
├── skipped-2025-11-13-boompa.json             # ⏭️ Duplicado saltado
├── cancel-not-found-2025-11-13-yoga.json     # ⚠️ Sin evento que cancelar
├── failed-2025-11-13-evento.json             # ❌ Error al crear
└── delete-failed-2025-11-13-pilates.json     # ❌ Error al eliminar
```

### Ver Estadísticas

```bash
npm run events:stats
```

**Ejemplo de salida:**

```
📊 ESTADÍSTICAS DE EVENTOS GENERADOS:
──────────────────────────────────────────────────
📈 Total de eventos procesados: 25
✅ Eventos creados en el calendario: 18
🗑️ Eventos eliminados (cancelaciones): 4
⏭️ Eventos saltados (duplicados): 2
❌ Eventos fallidos: 1

📊 Porcentajes:
   ✅ Eventos creados: 72.0%
   🗑️ Eventos eliminados: 16.0%
   ⏭️ Saltados: 8.0%
   ❌ Fallos: 4.0%
```

## 🔧 Configuración Avanzada

### Queries de Gmail

#### Confirmaciones de Eventos

```env
# Gym/Fitness
GMAIL_QUERY=is:unread subject:"Confirmación de reserva" from:virtuagym.com

# Citas médicas
GMAIL_QUERY=is:unread subject:"Confirmación" from:clinica.com

# Múltiples fuentes
GMAIL_QUERY=is:unread (subject:"Confirmación" OR subject:"Reserva confirmada")
```

#### Cancelaciones

```env
# Genérica (recomendada)
GMAIL_CANCELLATION_QUERY=is:unread subject:"Cancelación" OR subject:"cancelado" OR subject:"anulado"

# Con fuente específica
GMAIL_CANCELLATION_QUERY=is:unread (subject:"Cancelación" OR subject:"cancelado") from:virtuagym.com

# Con más palabras clave
GMAIL_CANCELLATION_QUERY=is:unread subject:"Cancelación" OR subject:"reprogramar" OR subject:"anular"
```

### Intervalos de Verificación

```env
CHECK_INTERVAL_MINUTES=1    # Testing (cada minuto)
CHECK_INTERVAL_MINUTES=5    # Recomendado (cada 5 min)
CHECK_INTERVAL_MINUTES=30   # Uso ligero (cada 30 min)
```

## 🎯 Algoritmos de Detección

### Detección de Duplicados (70% umbral)

- **Título** (40%): Comparación de palabras clave
- **Ubicación** (20%): Similaridad de lugar
- **Fecha/Hora** (40%): Diferencia temporal (±2 horas)

### Coincidencia de Cancelaciones (80% umbral)

- **Título** (50%): Nombre del evento
- **Ubicación** (20%): Lugar del evento
- **Fecha/Hora** (30%): Momento del evento (±12 horas)

## 📋 Comandos de Testing

### Simulación (Sin crear eventos reales)

```bash
npm run test:emails                          # Todos los emails
npm run test:emails:specific archivo.json   # Email específico
npm run test:emails:list                     # Listar disponibles
```

### Eventos Reales (Crea en calendario)

```bash
npm run test:emails:calendar                 # Todos los emails
npm run test:emails:real archivo.json       # Email específico
```

### Captura de Emails

```bash
npm run capture:email                        # Primer email
npm run capture:emails                       # Múltiples emails
npm run list:emails                          # Solo listar
```

### Diagnóstico

```bash
npm run test:gemini                          # Probar todos los modelos
npm run test:gemini:model nombre-modelo     # Modelo específico
npm run events:stats                         # Ver estadísticas
```

## 🎭 Modos de Operación

### 🎭 Modo Simulación

- Procesa con Gemini
- Muestra resultado esperado
- **NO** modifica el calendario
- Perfecto para desarrollo

### 🔥 Modo Real

- Procesa con Gemini
- **Crea/elimina eventos reales**
- Requiere autenticación completa
- Para uso en producción

## 📱 Casos de Uso

### Gym/Fitness Centers

```
📧 "Confirmación de reserva BOOMPA - 19:00" → ✅ Crear evento
📧 "Cancelación - Actividad FLOW" → 🗑️ Eliminar evento
```

### Citas Médicas

```
📧 "Cita confirmada Dr. García - 15:00" → ✅ Crear evento
📧 "Cita cancelada - Reprogramar" → 🗑️ Eliminar evento
```

### Restaurantes/Reservas

```
📧 "Reserva confirmada - Mesa para 4" → ✅ Crear evento
📧 "Cancelación de reserva" → 🗑️ Eliminar evento
```

## 🆘 Troubleshooting

### Problemas Comunes

**Gemini no responde:**

```bash
npm run test:gemini  # Diagnostica modelos disponibles
```

**No encuentra eventos para cancelar:**

- Verifica similaridad de títulos/fechas
- Revisa logs en `generatedEvents/`
- Usa menú interactivo para testing

**Autenticación falló:**

- Regenera credenciales OAuth2
- Verifica permisos de APIs
- Confirma configuración en Google Cloud

**Sin emails encontrados:**

- Verifica queries de Gmail
- Confirma permisos Gmail API
- Prueba con queries más amplias

### Logs Útiles

```bash
# Ver todos los archivos generados
ls -la generatedEvents/

# Ver estadísticas detalladas
npm run events:stats

# Probar conectividad
npm run test:gemini
```

## 📄 Licencia

ISC License

## 🤝 Contribución

1. Fork el proyecto
2. Crea feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Agregar nueva funcionalidad'`
4. Push branch: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

---

**¿Necesitas ayuda?** Usa `npm run interactive` para una experiencia guiada paso a paso.
