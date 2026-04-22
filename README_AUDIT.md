# Auditoría de DOOMCER Beat Store – Google Apps Script

## 🧩 Contexto del proyecto

DOOMCER es una tienda de beats musicales construida con Google Apps Script como full‑stack:
- **Backend**: Google Apps Script (`.gs`)
- **Frontend**: HTML/CSS/JS inline (`.html`)
- **Base de datos**: Google Sheets (hoja `Beats`)
- **Almacenamiento de audio**: Google Drive (carpeta `DOOMCER_AUDIO`)
- **Autenticación de administrador**: Token vía `CacheService` + `PropertiesService`

La aplicación tiene dos vistas:
- `MainView`: Tienda pública.
- `AdminView`: Panel de administración (acceso con contraseña).

## ❗ Problema crítico

**Los beats creados desde el panel de administración se guardan correctamente en la hoja de cálculo (`Beats`), pero NO se muestran en la tienda pública (`MainView`).**

### Síntomas observados

1. **En el panel de administración**:
   - Al guardar un beat se muestra mensaje de éxito.
   - La tabla "EXISTING_BEATS" se actualiza y muestra el beat.
   - En Google Sheets la fila aparece con todos los campos, incluyendo `activo = true` (minúsculas).

2. **En la tienda pública (`MainView`)**:
   - Se agregó un panel de diagnóstico que muestra `[BOOT] Iniciando...` pero **nunca se actualiza** a pesar de que la función `loadBeats()` se ejecuta.
   - La consola del navegador muestra que `fetch` se realiza, pero no se ven los beats.
   - La respuesta de la API `getBeats` a veces parece no ser procesada correctamente.

3. **En el backend** (`Code.gs`):
   - Se añadieron logs extensos. En el editor de Apps Script, al ejecutar manualmente `getActiveBeats()` devuelve los beats correctamente.
   - Sin embargo, en la Web App desplegada el endpoint `?app=api&action=getBeats` parece retornar `data: []` o el frontend no logra parsearlo.

### Intentos de solución ya realizados (sin éxito)

- Normalización agresiva de cabeceras en `getAll()` (trim + lowercase).
- Filtro robusto de `activo`: se aceptan `true`, `'true'`, `'TRUE'`, `1`, `'yes'`, vacío.
- Cambio del scope de Drive a `drive` completo para evitar problemas de permisos.
- Uso de `PropertiesService` para almacenar el ID de la carpeta de audio.
- Adición de `console.log` y `console.table` en el frontend.
- Implementación de un panel de diagnóstico visual (`debugStatus`).
- Timeout y manejo de errores en el `fetch`.
- Delegación de eventos en la rejilla de beats (eliminando `onclick` inline).
- Despliegue de nuevas versiones de la Web App tras cada cambio.

A pesar de todo, el panel de diagnóstico se queda congelado en `[BOOT] Iniciando...` o muestra `[FETCH] ...` pero nunca `[OK] X beats`.

## 📁 Archivos incluidos en este repositorio

- `appsscript.json` – Manifiesto con scopes.
- `Config.gs` – Constantes (SHEET_ID placeholder).
- `Services.gs` – Lógica de negocio, CRUD, upload a Drive.
- `Code.gs` – Router, endpoints API, setup.
- `MainView.html` – Tienda pública con diagnóstico.
- `AdminView.html` – Panel de administración.

**Nota**: Los valores sensibles (`SHEET_ID`, `ADMIN_PASSWORD`, `BUSINESS_PHONE`) han sido reemplazados por placeholders (`ID_DEL_SPREADSHEET`, `doomcer2024`, etc.).

## 🔍 Preguntas concretas para Claude

1. **¿Por qué `loadBeats()` en `MainView.html` no actualiza el panel de diagnóstico más allá de `[BOOT]` o `[FETCH]`?**  
   Revisar la función `loadBeats()` y `setDebug()`. ¿Hay algún error silencioso que impida que se ejecute el resto del código?

2. **¿Está correctamente construida la respuesta JSON desde `handleAPI` en `Code.gs`?**  
   ¿Puede haber un problema de CORS, MIME type, o de `ContentService` que cause que el frontend no pueda parsear la respuesta?

3. **¿Hay algún error en la lógica de `getAll()` o `getActiveBeats()` que solo se manifieste en el contexto de la Web App?**  
   Por ejemplo, ¿`SpreadsheetApp.openById()` podría estar fallando silenciosamente y devolviendo `null`?

4. **¿Existe alguna condición de carrera o problema de asincronía en `MainView.html` que provoque que el DOM no se actualice?**

5. **¿Recomiendas alguna refactorización específica o herramienta de depuración adicional para aislar el problema?**

## 🎯 Objetivo final

Lograr que los beats guardados en la hoja `Beats` aparezcan listados en la tienda pública y que el reproductor funcione correctamente.

---

**Agradezco de antemano tu análisis detallado. Por favor, si encuentras la causa raíz, proporciona el código corregido de los archivos afectados.**
