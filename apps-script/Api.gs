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
  const faixa = sh.getRange(2, col, linhas, 1);
  const listas = faixa.getRichTextValues().map(function (r) {
    return linksDaCelula_(r[0]);
  });
  // Chips (@arquivo) e =HYPERLINK() não aparecem no RichTextValue: completa pela API do Sheets.
  lerLinksViaSheetsApi_(sh, faixa).forEach(function (urls, i) {
    if (!listas[i]) listas[i] = [];
    urls.forEach(function (u) { juntarLink_(listas[i], u, ''); });
  });
  return listas;
}

function linksDaCelula_(rich) {
  const lista = [];
  if (!rich) return lista;
  rich.getRuns().forEach(function (run) {
    if (run.getLinkUrl()) juntarLink_(lista, run.getLinkUrl(), run.getText());
  });
  if (rich.getLinkUrl()) juntarLink_(lista, rich.getLinkUrl(), rich.getText());
  (rich.getText().match(/https:\/\/[^\s<>"']+/gi) || []).forEach(function (u) { juntarLink_(lista, u, ''); });
  return lista;
}

/** Adiciona um link https à lista, sem repetir. */
function juntarLink_(lista, url, texto) {
  url = String(url || '').trim().replace(/[.,;)\]]+$/, '');
  if (!/^https:\/\//i.test(url)) return;
  if (lista.some(function (c) { return c.url === url; })) return;
  texto = String(texto || '').replace(/￼/g, '').trim();
  const nome = texto && !/^https?:\/\//i.test(texto) ? texto : 'Contrato' + (lista.length ? ' ' + (lista.length + 1) : '');
  lista.push({ url: url, nome: nome });
}

/**
 * Lê chips de arquivo e hiperlinks de fórmula pela API do Sheets (serviço avançado "Sheets").
 * Devolve uma lista de URLs por linha. Sem o serviço ativado, devolve [] e nada quebra.
 */
function lerLinksViaSheetsApi_(sh, faixa) {
  if (typeof Sheets === 'undefined') return [];
  try {
    const nomeAba = "'" + sh.getName().replace(/'/g, "''") + "'";
    const resp = Sheets.Spreadsheets.get(sh.getParent().getId(), {
      ranges: [nomeAba + '!' + faixa.getA1Notation()],
      includeGridData: true,
      fields: 'sheets(data(rowData(values(hyperlink,chipRuns(chip(richLinkProperties(uri))),textFormatRuns(format(link(uri)))))))',
    });
    const dados = (((resp.sheets || [])[0] || {}).data || [])[0] || {};
    return (dados.rowData || []).map(function (linha) {
      const cel = (linha.values || [])[0] || {};
      const urls = [];
      if (cel.hyperlink) urls.push(cel.hyperlink);
      (cel.chipRuns || []).forEach(function (r) {
        const uri = r.chip && r.chip.richLinkProperties && r.chip.richLinkProperties.uri;
        if (uri) urls.push(uri);
      });
      (cel.textFormatRuns || []).forEach(function (r) {
        const uri = r.format && r.format.link && r.format.link.uri;
        if (uri) urls.push(uri);
      });
      return urls;
    });
  } catch (err) {
    console.log('Sheets API (contratos): ' + err);
    return [];
  }
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

/** Diagnóstico: rode no editor e veja em "Registro de execução" o que a API enxerga na coluna Contrato. */
function testarContratos() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABAS.ITENS);
  const itens = lerTabela_(sh, COLUNAS_ITENS, Session.getScriptTimeZone());
  const links = lerLinks_(sh, 'Contrato');
  console.log('Serviço avançado Sheets: ' + (typeof Sheets === 'undefined' ? 'NÃO ativado' : 'ativado'));
  itens.forEach(function (r, i) {
    if (!r.item) return;
    const l = links[i] || [];
    console.log(r.item + ': ' + (l.length ? l.map(function (c) { return c.nome + ' → ' + c.url; }).join(' | ')
      : 'nenhum link' + (r.contrato ? ' (célula tem texto: "' + r.contrato + '")' : '')));
  });
}
