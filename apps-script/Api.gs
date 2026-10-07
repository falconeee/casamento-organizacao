/**
 * Api.gs — API JSON lida pelo dashboard no GitHub Pages.
 *
 * Implantar como App da Web: Executar como "Eu", acesso "Qualquer pessoa".
 * Toda requisição precisa de ?token=... igual ao gerado no setup (Propriedades do script).
 */

const CONFIG_CHAVES = {
  'Data do casamento': 'dataCasamento',
  'Noivo': 'noivo',
  'Noiva': 'noiva',
  'Orçamento máximo': 'orcamentoMaximo',
};

function doGet(e) {
  const token = (e && e.parameter && e.parameter.token) || '';
  const esperado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!esperado || !iguais_(token, esperado)) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    return json_({
      ok: true,
      updatedAt: new Date().toISOString(),
      config: lerConfig_(ss, tz),
      itens: lerTabela_(ss.getSheetByName(ABAS.ITENS), COLUNAS_ITENS, tz)
        .filter(function (r) { return r.item; }),
      pagamentos: lerTabela_(ss.getSheetByName(ABAS.PAGAMENTOS), COLUNAS_PAGAMENTOS, tz)
        .filter(function (r) { return r.item && r.valor !== ''; }),
    });
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

/** Lê uma aba pelo texto do cabeçalho, então reordenar colunas não quebra a API. */
function lerTabela_(sh, colunas, tz) {
  if (!sh) return [];
  const valores = sh.getDataRange().getValues();
  if (valores.length < 2) return [];
  const cabecalho = valores[0].map(function (h) { return String(h).trim(); });
  const indices = colunas.map(function (c) { return cabecalho.indexOf(c.titulo); });
  return valores.slice(1).map(function (linha) {
    const obj = {};
    colunas.forEach(function (c, i) {
      obj[c.chave] = indices[i] < 0 ? '' : normalizar_(linha[indices[i]], tz);
    });
    return obj;
  });
}

function lerConfig_(ss, tz) {
  const sh = ss.getSheetByName(ABAS.CONFIG);
  const cfg = {};
  if (!sh) return cfg;
  sh.getDataRange().getValues().slice(1).forEach(function (linha) {
    const chave = CONFIG_CHAVES[String(linha[0]).trim()];
    if (chave) cfg[chave] = normalizar_(linha[1], tz);
  });
  return cfg;
}

function normalizar_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  if (typeof v === 'string') return v.trim();
  return v;
}

function iguais_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
