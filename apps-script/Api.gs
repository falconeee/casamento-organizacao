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
    const abaItens = ss.getSheetByName(ABAS.ITENS);
    const itens = lerTabela_(abaItens, COLUNAS_ITENS, tz);
    const links = lerLinks_(abaItens, 'Contrato');
    itens.forEach(function (r, i) {
      r.contratos = links[i] || [];
      delete r.contrato; // só os links vão para o dashboard
    });
    return json_({
      ok: true,
      updatedAt: new Date().toISOString(),
      config: lerConfig_(ss, tz),
      itens: itens.filter(function (r) { return r.item; }),
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

/**
 * Links de uma coluna, linha a linha (mesma ordem de lerTabela_).
 * Aceita URL colada, hiperlink (Ctrl+K), chip de arquivo (@) e vários links na mesma célula.
 * Só devolve endereços https.
 */
function lerLinks_(sh, titulo) {
  if (!sh) return [];
  const linhas = sh.getLastRow() - 1;
  if (linhas < 1) return [];
  const cabecalho = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  const col = cabecalho.indexOf(titulo) + 1;
  if (!col) return [];
  return sh.getRange(2, col, linhas, 1).getRichTextValues().map(function (r) {
    return linksDaCelula_(r[0]);
  });
}

function linksDaCelula_(rich) {
  const vistos = {};
  const lista = [];
  function add(url, texto) {
    url = String(url || '').trim().replace(/[.,;)\]]+$/, '');
    if (!/^https:\/\//i.test(url) || vistos[url]) return;
    vistos[url] = true;
    texto = String(texto || '').trim();
    const nome = texto && !/^https?:\/\//i.test(texto) ? texto : 'Contrato' + (lista.length ? ' ' + (lista.length + 1) : '');
    lista.push({ url: url, nome: nome });
  }
  if (!rich) return lista;
  rich.getRuns().forEach(function (run) {
    if (run.getLinkUrl()) add(run.getLinkUrl(), run.getText());
  });
  if (rich.getLinkUrl()) add(rich.getLinkUrl(), rich.getText());
  (rich.getText().match(/https:\/\/[^\s<>"']+/gi) || []).forEach(function (u) { add(u, ''); });
  return lista;
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
