/**
 * @fileoverview Servicios de lógica de negocio para DOOMCER
 * @author Rakon Technology
 */

// ============ CRUD GENÉRICO ============

function getAll(sheetName) {
  if (!CONFIG || !CONFIG.SHEET_ID) {
    console.error('CONFIG.SHEET_ID no está definido');
    return [];
  }
  
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    console.warn(`getAll: Hoja "${sheetName}" no encontrada`);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    console.log(`getAll: Hoja "${sheetName}" tiene ${data.length} filas (sin datos)`);
    return [];
  }
  
  // Leer encabezados exactamente como aparecen
  const rawHeaders = data[0];
  // Normalizar: trim y lowercase
  const headers = rawHeaders.map(h => String(h).trim().toLowerCase());
  
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val === undefined || val === null) val = '';
      obj[h] = val;
    });
    return obj;
  });
  
  console.log(`getAll: Hoja "${sheetName}" → ${rows.length} registros leídos`);
  return rows;
}

function getById(sheetName, id) {
  const all = getAll(sheetName);
  // Buscar por ID normalizado (por si acaso)
  return all.find(r => String(r.id).trim() === String(id).trim()) || null;
}

function create(sheetName, rowData) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error(`Hoja ${sheetName} no existe`);
  sheet.appendRow(rowData.map(sanitize));
  return true;
}

function updateById(sheetName, id, updates) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      Object.keys(updates).forEach(key => {
        const normalizedKey = key.trim().toLowerCase();
        const colIdx = headers.indexOf(normalizedKey);
        if (colIdx >= 0) {
          sheet.getRange(i + 1, colIdx + 1).setValue(sanitize(updates[key]));
        }
      });
      return true;
    }
  }
  return false;
}

function deleteById(sheetName, id) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function generateId(sheetName, prefix) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  let num = 1;
  if (lastRow > 1) {
    const lastId = sheet.getRange(lastRow, 1).getValue();
    const match = String(lastId).match(/\d+/);
    if (match) num = parseInt(match[0]) + 1;
  }
  return prefix + num.toString().padStart(4, '0');
}

// ============ SEGURIDAD ============

function sanitize(value) {
  if (typeof value !== 'string') return value;
  const dangerous = ['=', '+', '-', '@', '\t', '\r', '\n'];
  if (dangerous.some(ch => value.startsWith(ch))) return "'" + value;
  return value;
}

function isRateLimited(key, cooldownSeconds = 60) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rl_' + key.replace(/\D/g, '');
  if (cache.get(cacheKey)) return true;
  cache.put(cacheKey, '1', cooldownSeconds);
  return false;
}

// ============ NOTIFICACIONES ============

function whatsappLink(phone, message) {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}

function sendNotification(to, subject, htmlBody) {
  GmailApp.sendEmail(to, subject, '', { htmlBody: htmlBody, name: CONFIG.BUSINESS_NAME });
}

// ============ UTILIDADES ============

function formatCurrency(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function setupDatabase(schema) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  schema.forEach(cfg => {
    let sheet = ss.getSheetByName(cfg.name) || ss.insertSheet(cfg.name);
    const range = sheet.getRange(1, 1, 1, cfg.headers.length);
    if (range.getValues()[0].every(v => !v)) range.setValues([cfg.headers]);
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, cfg.headers.length);
    if (cfg.color) sheet.setTabColor(cfg.color);
  });
  return { ok: true, message: 'Base de datos configurada' };
}

// ============ CONFIG EN SHEETS ============
function getConfigValue(key) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEETS.CONFIG);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function setConfigValue(key, value) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEETS.CONFIG);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return true;
    }
  }
  sheet.appendRow([key, value]);
  return true;
}

// ============ LÓGICA ESPECÍFICA DOOMCER ============

function getActiveBeats() {
  const allBeats = getAll(CONFIG.SHEETS.BEATS);
  // Filtro redundante y robusto
  return allBeats.filter(b => {
    // Intentar varias posibles claves (por si la columna tiene variaciones)
    const activoRaw = b.activo || b.Activo || b.ACTIVO || b['activo'] || b['Activo'] || '';
    const valorActivo = String(activoRaw).trim().toLowerCase();
    return valorActivo === 'true' || valorActivo === '1' || valorActivo === 'yes' || valorActivo === '';
  });
}

function getBeatDetails(beatId) {
  const beat = getById(CONFIG.SHEETS.BEATS, beatId);
  if (!beat) return null;
  beat.licencias = getAll(CONFIG.SHEETS.LICENCIAS);
  return beat;
}

function incrementCounter(beatId, field) {
  const beat = getById(CONFIG.SHEETS.BEATS, beatId);
  if (!beat) return false;
  const current = parseInt(beat[field] || '0');
  return updateById(CONFIG.SHEETS.BEATS, beatId, { [field]: current + 1 });
}

// ============ ADMIN AUTH ============

function validateAdminToken(token) {
  if (!token || token === 'null' || token === 'undefined') return false;
  const cache = CacheService.getScriptCache();
  const cached = cache.get('admin_token_' + token);
  if (cached === 'valid') return true;
  
  const props = PropertiesService.getScriptProperties();
  const storedTime = props.getProperty('admin_token_' + token);
  if (storedTime) {
    const created = new Date(storedTime);
    const now = new Date();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    if (hoursDiff < 8) {
      cache.put('admin_token_' + token, 'valid', 28800);
      return true;
    } else {
      props.deleteProperty('admin_token_' + token);
    }
  }
  return false;
}

function generateAdminToken() {
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  cache.put('admin_token_' + token, 'valid', 28800);
  props.setProperty('admin_token_' + token, new Date().toISOString());
  cleanOldTokens();
  return token;
}

function cleanOldTokens() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = new Date();
  for (let key in all) {
    if (key.startsWith('admin_token_')) {
      try {
        const created = new Date(all[key]);
        if ((now - created) / (1000 * 60 * 60) > 8) {
          props.deleteProperty(key);
        }
      } catch(e) {}
    }
  }
}

// ============ GESTIÓN DE BEATS (ADMIN) ============

function saveBeat(beatData) {
  const sheetName = CONFIG.SHEETS.BEATS;
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (beatData.id) {
    const id = beatData.id;
    delete beatData.id;
    return updateById(sheetName, id, beatData);
  } else {
    const newId = generateId(sheetName, 'BEAT-');
    const newBeat = { id: newId, ...beatData, likes: '0', descargas: '0' };
    const rowData = headers.map(h => newBeat[h] || '');
    return create(sheetName, rowData);
  }
}

function deleteBeat(beatId) {
  return deleteById(CONFIG.SHEETS.BEATS, beatId);
}

// ============ UPLOAD DE AUDIO A DRIVE ============

function uploadAudioFile(base64Data, filename, mimeType) {
  try {
    const sizeInBytes = Utilities.base64Decode(base64Data).length;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    if (sizeInMB > 9.5) {
      return { ok: false, error: `Archivo demasiado grande (${sizeInMB.toFixed(1)} MB). Límite ~10 MB.` };
    }

    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    const folder = getAudioFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const directUrl = `https://drive.google.com/uc?export=download&id=${file.getId()}`;
    return { 
      ok: true, 
      url: directUrl,
      fileName: file.getName(), 
      fileId: file.getId() 
    };
  } catch(e) {
    console.error('Upload error:', e.toString());
    return { ok: false, error: e.toString() };
  }
}

function getAudioFolder() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('DOOMCER_AUDIO_FOLDER_ID');
  
  if (!folderId) {
    throw new Error('Carpeta de audio no inicializada. Ejecuta initFileSystem() primero.');
  }
  
  try {
    return DriveApp.getFolderById(folderId);
  } catch(e) {
    throw new Error('No se pudo acceder a la carpeta de audio. Verifica el ID o ejecuta initFileSystem() de nuevo.');
  }
}

function initFileSystem() {
  const folderName = 'DOOMCER_AUDIO';
  const props = PropertiesService.getScriptProperties();
  
  const existingId = props.getProperty('DOOMCER_AUDIO_FOLDER_ID');
  if (existingId) {
    try {
      DriveApp.getFolderById(existingId);
      Logger.log('✅ Carpeta ya existe y es accesible. ID: ' + existingId);
      return { ok: true, folderId: existingId, message: 'Carpeta ya inicializada.' };
    } catch(e) {
      Logger.log('⚠️ ID guardado no válido, se creará una nueva carpeta.');
    }
  }
  
  const folders = DriveApp.getFoldersByName(folderName);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
    Logger.log('📁 Carpeta encontrada por nombre.');
  } else {
    folder = DriveApp.createFolder(folderName);
    Logger.log('🆕 Carpeta creada: ' + folderName);
  }
  
  const folderId = folder.getId();
  props.setProperty('DOOMCER_AUDIO_FOLDER_ID', folderId);
  Logger.log('💾 ID guardado en PropertiesService: ' + folderId);
  
  return { ok: true, folderId: folderId, message: 'Sistema de archivos inicializado correctamente.' };
}
