/**
 * @fileoverview Router principal de DOOMCER + Setup automático
 * @author Rakon Technology
 */

function doGet(e) {
  const app = e?.parameter?.app || 'main';
  let template;
  
  switch(app) {
    case 'main':
      template = HtmlService.createTemplateFromFile('MainView');
      break;
    case 'admin':
      template = HtmlService.createTemplateFromFile('AdminView');
      break;
    case 'api':
      return handleAPI(e);
    default:
      template = HtmlService.createTemplateFromFile('MainView');
  }
  
  template.webAppUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle('DOOMCER // LEAKED ARCHIVES')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = processAction(payload);
    return jsonResponse(result);
  } catch(err) {
    console.error('doPost error:', err);
    return jsonResponse({ ok: false, error: 'System corruption: invalid request' });
  }
}

function handleAPI(e) {
  const action = e.parameter.action || '';
  let result = { ok: false };
  
  try {
    switch(action) {
      case 'getBeats':
        {
          console.log('[DEBUG] API getBeats llamado');
          
          // Verificar CONFIG
          if (!CONFIG || !CONFIG.SHEET_ID) {
            console.error('[DEBUG] CONFIG.SHEET_ID no definido');
            result = { ok: false, error: 'Configuración incompleta' };
            break;
          }
          console.log('[DEBUG] SHEET_ID:', CONFIG.SHEET_ID);
          console.log('[DEBUG] SHEETS.BEATS:', CONFIG.SHEETS.BEATS);
          
          // Intentar obtener beats
          let beats;
          try {
            beats = getActiveBeats();
            console.log('[DEBUG] getActiveBeats() retornó', beats.length, 'beats');
            if (beats.length > 0) {
              console.log('[DEBUG] Primer beat:', JSON.stringify(beats[0]));
            }
          } catch (err) {
            console.error('[DEBUG] Error en getActiveBeats():', err.toString());
            beats = [];
          }
          
          // Obtener info de la hoja para diagnóstico
          let totalRows = 0, dataRows = 0;
          try {
            const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
            const sheet = ss.getSheetByName(CONFIG.SHEETS.BEATS);
            if (sheet) {
              totalRows = sheet.getLastRow();
              dataRows = totalRows > 1 ? totalRows - 1 : 0;
              console.log('[DEBUG] Hoja Beats - total filas:', totalRows, 'filas de datos:', dataRows);
            } else {
              console.error('[DEBUG] Hoja Beats no encontrada');
            }
          } catch (err) {
            console.error('[DEBUG] Error al abrir spreadsheet:', err.toString());
          }
          
          result = { 
            ok: true, 
            data: beats,
            debug: {
              rowsFound: beats.length,
              sheetName: CONFIG.SHEETS.BEATS,
              sheetId: CONFIG.SHEET_ID,
              totalRows: totalRows,
              dataRows: dataRows
            }
          };
        }
        break;
        
      case 'getBeat':
        const beatId = e.parameter.id;
        if (!beatId) throw new Error('Missing beat ID');
        result = { ok: true, data: getBeatDetails(beatId) };
        break;
        
      case 'likeBeat':
        const likeId = e.parameter.id;
        if (!likeId) throw new Error('Missing beat ID');
        incrementCounter(likeId, 'likes');
        result = { ok: true };
        break;
        
      case 'downloadBeat':
        const dlId = e.parameter.id;
        if (!dlId) throw new Error('Missing beat ID');
        incrementCounter(dlId, 'descargas');
        const beat = getById(CONFIG.SHEETS.BEATS, dlId);
        result = { ok: true, url: beat?.url_audio || '' };
        break;
        
      default:
        result = { ok: false, error: 'Unknown API action' };
    }
  } catch(err) {
    console.error('[DEBUG] API error general:', err.toString());
    result = { ok: false, error: 'Internal system error' };
  }
  
  return jsonResponse(result);
}

function processAction(payload) {
  switch(payload.action) {
    case 'adminLogin':
      if (payload.password === CONFIG.ADMIN_PASSWORD) {
        const token = generateAdminToken();
        console.log('Admin login successful, token generated:', token);
        return { ok: true, token: token };
      }
      console.warn('Admin login failed: invalid password');
      return { ok: false };
      
    case 'adminSaveBeat':
      if (!validateAdminToken(payload.token)) {
        console.warn('adminSaveBeat: invalid token', payload.token);
        return { ok: false, error: 'Invalid token' };
      }
      console.log('[DEBUG] adminSaveBeat:', JSON.stringify(payload.beat));
      saveBeat(payload.beat);
      return { ok: true };
      
    case 'adminDeleteBeat':
      if (!validateAdminToken(payload.token)) {
        console.warn('adminDeleteBeat: invalid token', payload.token);
        return { ok: false, error: 'Invalid token' };
      }
      deleteBeat(payload.beatId);
      return { ok: true };
      
    case 'adminUploadAudio':
      if (!validateAdminToken(payload.token)) {
        console.warn('adminUploadAudio: invalid token', payload.token);
        return { ok: false, error: 'Invalid token' };
      }
      return uploadAudioFile(payload.data, payload.filename, payload.mimeType);
      
    default:
      return { ok: false, error: 'Action not implemented' };
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== FUNCIÓN DE SETUP AUTOMÁTICO ==========
function inicializarTodo() {
  if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID === 'ID_DEL_SPREADSHEET') {
    throw new Error('❌ Debes reemplazar CONFIG.SHEET_ID con el ID real de tu Google Sheet.');
  }

  const schema = [
    {
      name: CONFIG.SHEETS.BEATS,
      headers: ['id', 'titulo', 'genero', 'bpm', 'fecha', 'tags', 'precio_base_mp3', 'precio_base_wav', 'precio_exclusive', 'url_audio', 'url_imagen', 'waveform_data', 'likes', 'descargas', 'activo'],
      color: '#1BB6B1'
    },
    {
      name: CONFIG.SHEETS.LICENCIAS,
      headers: ['id', 'nombre', 'descripcion', 'precio_mod'],
      color: '#FF0055'
    },
    {
      name: CONFIG.SHEETS.PEDIDOS,
      headers: ['id', 'timestamp', 'cliente_nombre', 'cliente_email', 'cliente_telefono', 'beat_id', 'licencia_id', 'total', 'estado'],
      color: '#00E0FF'
    },
    {
      name: CONFIG.SHEETS.CONFIG,
      headers: ['clave', 'valor'],
      color: '#444444'
    }
  ];

  const resultado = setupDatabase(schema);
  Logger.log('✅ ' + resultado.message);
  
  try {
    const initResult = initFileSystem();
    Logger.log('📁 ' + initResult.message);
  } catch(e) {
    Logger.log('⚠️ Error al inicializar carpeta de audio: ' + e.toString());
  }
  
  return resultado;
}
