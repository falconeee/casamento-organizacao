/**
 * Lembretes.gs — e-mail diário com os pagamentos que vencem nos próximos dias.
 *
 * - Roda uma vez por dia (gatilho criado por `ativarLembretes`).
 * - Junta tudo em UM e-mail por dia, agrupado por data de vencimento:
 *   dois pagamentos no mesmo dia nunca geram dois e-mails.
 * - Só envia quando há algo para lembrar, e no máximo uma vez por dia.
 *
 * Configuração na aba Config (as linhas são criadas por `ativarLembretes`):
 *   E-mails para lembretes · Lembrar com quantos dias · Link do dashboard
 */

const LEMBRETE_CONFIG = [
  ['E-mails para lembretes', '', 'Separe por vírgula. Ex.: voce@gmail.com, ela@gmail.com'],
  ['Lembrar com quantos dias', '3, 1', 'Dias antes do vencimento em que o lembrete é enviado. Use 0 para lembrar no próprio dia.'],
  ['Link do dashboard', '', 'Endereço do GitHub Pages, para o botão do e-mail.'],
];
const LEMBRETE_HORA = 8; // hora aproximada do envio diário
const PROP_ULTIMO_ENVIO = 'LEMBRETE_ULTIMO_ENVIO';
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ---------------------------------------------------------------------------
// Ações do menu / editor

/** Cria as linhas na aba Config (se faltarem) e o gatilho diário. */
function ativarLembretes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  garantirConfigLembretes_(ss);
  removerGatilhos_();
  ScriptApp.newTrigger('enviarLembretes').timeBased().everyDays(1).atHour(LEMBRETE_HORA).create();
  const msg = 'Lembretes ativados: todo dia por volta das ' + LEMBRETE_HORA + 'h.\n\n' +
    'Confira na aba Config os e-mails, os dias de antecedência e o link do dashboard.';
  console.log(msg);
  avisar_(msg);
}

function desativarLembretes() {
  removerGatilhos_();
  console.log('Lembretes desativados.');
  avisar_('Lembretes desativados. Nenhum e-mail automático será enviado.');
}

/** Envia agora um e-mail de exemplo com os próximos pagamentos, ignorando os dias configurados. */
function enviarEmailDeTeste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  garantirConfigLembretes_(ss);
  const ctx = carregarContexto_(ss);
  const proximos = ctx.aPagar.filter(function (p) { return p.dias >= 0; })
    .sort(function (a, b) { return a.dias - b.dias; });
  // Pega as 2 próximas datas com pagamento, para mostrar o agrupamento.
  const datas = [];
  proximos.forEach(function (p) { if (datas.indexOf(p.vencimento) < 0 && datas.length < 2) datas.push(p.vencimento); });
  const selecionados = proximos.filter(function (p) { return datas.indexOf(p.vencimento) >= 0; });
  if (!selecionados.length) {
    avisar_('Não há pagamentos futuros "A pagar" com data para montar o e-mail de teste.');
    return;
  }
  enviar_(ctx, selecionados, true);
  avisar_('E-mail de teste enviado para: ' + ctx.destinatarios.join(', '));
}

/** Chamado pelo gatilho diário. */
function enviarLembretes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ctx = carregarContexto_(ss);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_ULTIMO_ENVIO) === ctx.hoje) {
    console.log('Lembrete de hoje já enviado.');
    return;
  }
  const selecionados = ctx.aPagar.filter(function (p) { return ctx.diasAntes.indexOf(p.dias) >= 0; });
  if (!selecionados.length) {
    console.log('Nenhum pagamento para lembrar hoje.');
    return;
  }
  enviar_(ctx, selecionados, false);
  props.setProperty(PROP_ULTIMO_ENVIO, ctx.hoje);
}

// ---------------------------------------------------------------------------
// Dados

function carregarContexto_(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const hoje = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const cfg = lerConfigLembretes_(ss, tz);
  const itens = lerTabela_(ss.getSheetByName(ABAS.ITENS), COLUNAS_ITENS, tz);
  const fornecedorDe = {};
  itens.forEach(function (i) { if (i.item) fornecedorDe[i.item] = i.fornecedor || ''; });

  const aPagar = lerTabela_(ss.getSheetByName(ABAS.PAGAMENTOS), COLUNAS_PAGAMENTOS, tz)
    .filter(function (p) { return p.item && p.valor !== '' && p.status === 'A pagar' && /^\d{4}-\d{2}-\d{2}$/.test(p.vencimento); })
    .map(function (p) {
      p.valor = Number(p.valor) || 0;
      p.dias = diasEntre_(hoje, p.vencimento);
      p.fornecedor = fornecedorDe[p.item] || '';
      return p;
    });

  const destinatarios = String(cfg['E-mails para lembretes'] || '').split(/[,;\s]+/)
    .map(function (e) { return e.trim(); }).filter(function (e) { return /@/.test(e); });
  if (!destinatarios.length) destinatarios.push(Session.getEffectiveUser().getEmail());

  const diasAntes = String(cfg['Lembrar com quantos dias'] === '' || cfg['Lembrar com quantos dias'] == null ? '3, 1' : cfg['Lembrar com quantos dias'])
    .split(/[,;\s]+/).map(Number).filter(function (n) { return !isNaN(n) && n >= 0; });

  return {
    tz: tz,
    hoje: hoje,
    aPagar: aPagar,
    vencidos: aPagar.filter(function (p) { return p.dias < 0; }),
    destinatarios: destinatarios,
    diasAntes: diasAntes,
    linkDashboard: String(cfg['Link do dashboard'] || ''),
    linkPlanilha: ss.getUrl(),
    noivo: cfg['Noivo'] || '',
    noiva: cfg['Noiva'] || '',
    dataCasamento: cfg['Data do casamento'] || '',
  };
}

function lerConfigLembretes_(ss, tz) {
  const sh = ss.getSheetByName(ABAS.CONFIG);
  const cfg = {};
  if (!sh) return cfg;
  sh.getDataRange().getValues().slice(1).forEach(function (l) {
    cfg[String(l[0]).trim()] = normalizar_(l[1], tz);
  });
  return cfg;
}

function garantirConfigLembretes_(ss) {
  const sh = ss.getSheetByName(ABAS.CONFIG);
  if (!sh) throw new Error('Aba Config não encontrada. Rode o setupPlanilha primeiro.');
  const existentes = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(function (l) { return String(l[0]).trim(); });
  LEMBRETE_CONFIG.forEach(function (linha) {
    if (existentes.indexOf(linha[0]) >= 0) return;
    const valor = linha[0] === 'E-mails para lembretes' ? Session.getEffectiveUser().getEmail() : linha[1];
    sh.appendRow([linha[0], '', linha[2]]);
    const r = sh.getLastRow();
    // Texto puro antes do valor: evita que "3,1" vire o número 3,1.
    sh.getRange(r, 2).setNumberFormat('@').setValue(valor);
    sh.getRange(r, 3).setFontColor('#777777');
  });
}

function removerGatilhos_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarLembretes') ScriptApp.deleteTrigger(t);
  });
}

function diasEntre_(isoA, isoB) {
  const a = isoA.split('-').map(Number);
  const b = isoB.split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function avisar_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* rodando pelo editor ou gatilho: só log */ }
}

// ---------------------------------------------------------------------------
// E-mail

function enviar_(ctx, selecionados, teste) {
  const email = montarEmailLembrete_(ctx, selecionados, teste);
  MailApp.sendEmail({
    to: ctx.destinatarios.join(','),
    subject: email.assunto,
    htmlBody: email.html,
    body: email.texto,
    name: 'Casamento 💍',
  });
  console.log('Enviado: ' + email.assunto + ' → ' + ctx.destinatarios.join(', '));
}

/** Monta assunto, HTML e texto. Função pura (sem chamadas ao Google), fácil de testar. */
function montarEmailLembrete_(ctx, selecionados, teste) {
  const grupos = {};
  selecionados.forEach(function (p) { (grupos[p.vencimento] = grupos[p.vencimento] || []).push(p); });
  const datas = Object.keys(grupos).sort();
  const total = selecionados.reduce(function (s, p) { return s + p.valor; }, 0);
  const n = selecionados.length;
  const nomes = [ctx.noivo, ctx.noiva].filter(String).join(' & ');

  // Assunto
  let assunto;
  if (datas.length === 1) {
    const d = grupos[datas[0]][0].dias;
    assunto = (n === 1 ? '1 pagamento ' : n + ' pagamentos ') + quando_(d) + ' (' + dataCurta_(datas[0]) + ') · ' + moeda_(total);
  } else {
    assunto = n + ' pagamentos nos próximos dias · ' + moeda_(total);
  }
  assunto = (teste ? '[Teste] ' : '') + '💍 ' + assunto;

  // Contagem regressiva
  let contagem = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(ctx.dataCasamento)) {
    const faltam = diasEntre_(ctx.hoje, ctx.dataCasamento);
    if (faltam > 0) contagem = 'Faltam ' + faltam + ' dias para o casamento';
  }

  // Paleta (inline: clientes de e-mail ignoram <style>)
  const C = {
    fundo: '#f6f5f1', cartao: '#ffffff', texto: '#1b1b1a', texto2: '#52514e', mudo: '#8a8882',
    linha: '#ebeae4', azul: '#2a78d6', azulClaro: '#e8f1fc', vermelho: '#b32727', vermelhoClaro: '#fdecec', dourado: '#b08d57',
  };
  const fonte = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

  const blocos = datas.map(function (iso) {
    const ps = grupos[iso];
    const d = ps[0].dias;
    const sub = ps.reduce(function (s, p) { return s + p.valor; }, 0);
    const p0 = iso.split('-').map(Number);
    const linhas = ps.map(function (p, i) {
      const meta = [p.descricao, p.quemPaga, p.forma].filter(String).map(esc_).join(' · ');
      return '<tr>' +
        '<td style="padding:12px 0;' + (i ? 'border-top:1px solid ' + C.linha + ';' : '') + '">' +
          '<div style="' + fonte + 'font-size:15px;font-weight:600;color:' + C.texto + ';">' + esc_(p.item) +
            (p.fornecedor ? ' <span style="font-weight:400;color:' + C.mudo + ';">· ' + esc_(p.fornecedor) + '</span>' : '') + '</div>' +
          '<div style="' + fonte + 'font-size:13px;color:' + C.texto2 + ';padding-top:2px;">' + meta + '</div>' +
          (p.obs ? '<div style="' + fonte + 'font-size:12px;color:' + C.mudo + ';padding-top:2px;">' + esc_(p.obs) + '</div>' : '') +
        '</td>' +
        '<td align="right" valign="top" style="padding:12px 0 12px 12px;white-space:nowrap;' + (i ? 'border-top:1px solid ' + C.linha + ';' : '') +
          fonte + 'font-size:15px;font-weight:600;color:' + C.texto + ';">' + moeda_(p.valor) + '</td>' +
      '</tr>';
    }).join('');
    return '<tr><td style="padding:0 0 16px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.cartao + ';border:1px solid ' + C.linha + ';border-radius:12px;">' +
        '<tr><td style="padding:18px 20px 6px;">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
            '<td width="56" valign="top">' +
              '<table role="presentation" cellpadding="0" cellspacing="0" style="background:' + C.azulClaro + ';border-radius:10px;" width="52"><tr>' +
                '<td align="center" style="padding:6px 0 7px;' + fonte + '">' +
                  '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:' + C.azul + ';">' + MESES_CURTOS[p0[1] - 1] + '</div>' +
                  '<div style="font-size:22px;font-weight:700;line-height:1.1;color:' + C.texto + ';">' + p0[2] + '</div>' +
                '</td></tr></table>' +
            '</td>' +
            '<td valign="middle" style="padding-left:12px;' + fonte + '">' +
              '<div style="font-size:16px;font-weight:600;color:' + C.texto + ';">' + capitalizar_(quando_(d)) + '</div>' +
              '<div style="font-size:13px;color:' + C.texto2 + ';padding-top:2px;">' + dataExtenso_(iso) + '</div>' +
            '</td>' +
            '<td align="right" valign="middle" style="' + fonte + 'white-space:nowrap;">' +
              '<div style="font-size:12px;color:' + C.mudo + ';">' + (ps.length === 1 ? '1 pagamento' : ps.length + ' pagamentos') + '</div>' +
              '<div style="font-size:18px;font-weight:700;color:' + C.texto + ';">' + moeda_(sub) + '</div>' +
            '</td>' +
          '</tr></table>' +
        '</td></tr>' +
        '<tr><td style="padding:0 20px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhas + '</table></td></tr>' +
      '</table></td></tr>';
  }).join('');

  // Vencidos ainda em aberto (aparecem só quando já existe um e-mail sendo enviado)
  let vencidosHtml = '';
  if (ctx.vencidos.length) {
    const tv = ctx.vencidos.reduce(function (s, p) { return s + p.valor; }, 0);
    vencidosHtml = '<tr><td style="padding:0 0 16px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.vermelhoClaro + ';border-radius:12px;">' +
      '<tr><td style="padding:14px 20px;' + fonte + 'font-size:14px;color:' + C.vermelho + ';">' +
        '<b>⚠ ' + (ctx.vencidos.length === 1 ? '1 pagamento vencido' : ctx.vencidos.length + ' pagamentos vencidos') + ' ainda como "A pagar" · ' + moeda_(tv) + '</b>' +
        '<div style="padding-top:6px;color:' + C.texto2 + ';font-size:13px;">' +
          ctx.vencidos.slice(0, 5).map(function (p) { return esc_(p.item) + ' (' + dataCurta_(p.vencimento) + ') ' + moeda_(p.valor); }).join(' · ') +
          (ctx.vencidos.length > 5 ? ' · e mais ' + (ctx.vencidos.length - 5) : '') +
          '<br>' + (ctx.vencidos.length === 1 ? 'Se já foi pago' : 'Se já foram pagos') + ', marque como "Pago" na planilha.</div>' +
      '</td></tr></table></td></tr>';
  }

  const botao = function (url, texto, primario) {
    return '<td style="padding:0 6px 8px;"><a href="' + esc_(url) + '" style="display:inline-block;' + fonte + 'font-size:14px;font-weight:600;text-decoration:none;' +
      'padding:12px 20px;border-radius:8px;' + (primario ? 'background:' + C.azul + ';color:#ffffff;' : 'background:' + C.cartao + ';color:' + C.texto + ';border:1px solid ' + C.linha + ';') +
      '">' + texto + '</a></td>';
  };
  const botoes = (ctx.linkDashboard ? botao(ctx.linkDashboard, 'Abrir dashboard', true) : '') + botao(ctx.linkPlanilha, 'Abrir planilha', !ctx.linkDashboard);

  const preheader = (n === 1 ? '1 pagamento' : n + ' pagamentos') + ' somando ' + moeda_(total) + (datas.length === 1 ? ' ' + quando_(grupos[datas[0]][0].dias) : '');

  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>' + esc_(assunto) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.fundo + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.fundo + ';"><tr><td align="center" style="padding:28px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">' +
      (teste ? '<tr><td style="padding:0 0 12px;' + fonte + 'font-size:12px;color:' + C.mudo + ';text-align:center;">E-mail de teste — exemplo com os próximos pagamentos</td></tr>' : '') +
      // Cabeçalho
      '<tr><td align="center" style="padding:0 0 22px;' + fonte + '">' +
        '<div style="font-size:28px;line-height:1;">💍</div>' +
        '<div style="font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:' + C.dourado + ';padding-top:10px;">' +
          (nomes ? esc_(nomes) : 'Nosso casamento') + '</div>' +
        '<div style="font-size:24px;font-weight:700;color:' + C.texto + ';padding-top:6px;">Lembrete de pagamento</div>' +
        (contagem ? '<div style="font-size:14px;color:' + C.texto2 + ';padding-top:4px;">' + contagem + '</div>' : '') +
      '</td></tr>' +
      // Resumo
      '<tr><td style="padding:0 0 16px;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.texto + ';border-radius:12px;"><tr>' +
          '<td style="padding:18px 20px;' + fonte + 'color:#ffffff;">' +
            '<div style="font-size:13px;opacity:.75;">' + (datas.length === 1 ? capitalizar_(quando_(grupos[datas[0]][0].dias)) : 'Nos próximos dias') + '</div>' +
            '<div style="font-size:30px;font-weight:700;padding-top:2px;">' + moeda_(total) + '</div>' +
          '</td>' +
          '<td align="right" style="padding:18px 20px;' + fonte + 'color:#ffffff;font-size:14px;opacity:.85;">' +
            (n === 1 ? '1 pagamento' : n + ' pagamentos') + (datas.length > 1 ? '<br>em ' + datas.length + ' datas' : '') +
          '</td>' +
        '</tr></table>' +
      '</td></tr>' +
      blocos + vencidosHtml +
      // Botões
      '<tr><td align="center" style="padding:8px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' + botoes + '</tr></table></td></tr>' +
    '</table></td></tr></table></body></html>';

  // Versão em texto puro
  const texto = [
    'Lembrete de pagamento' + (nomes ? ' — ' + nomes : ''),
    contagem,
    '',
    'Total: ' + moeda_(total) + ' (' + (n === 1 ? '1 pagamento' : n + ' pagamentos') + ')',
    '',
  ].concat(datas.map(function (iso) {
    return capitalizar_(quando_(grupos[iso][0].dias)) + ' — ' + dataExtenso_(iso) + '\n' +
      grupos[iso].map(function (p) {
        return '  • ' + p.item + (p.fornecedor ? ' (' + p.fornecedor + ')' : '') + ' — ' + moeda_(p.valor) +
          ' — ' + [p.descricao, p.quemPaga, p.forma].filter(String).join(' · ');
      }).join('\n');
  })).concat(ctx.vencidos.length ? ['', '⚠ Vencidos ainda "A pagar": ' + ctx.vencidos.map(function (p) { return p.item + ' ' + dataCurta_(p.vencimento); }).join(', ')] : [])
    .concat(['', 'Planilha: ' + ctx.linkPlanilha].concat(ctx.linkDashboard ? ['Dashboard: ' + ctx.linkDashboard] : []))
    .filter(function (l) { return l !== null; }).join('\n');

  return { assunto: assunto, html: html, texto: texto };
}

function quando_(dias) {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias > 1) return 'em ' + dias + ' dias';
  return 'vencido há ' + (-dias) + (dias === -1 ? ' dia' : ' dias');
}

function dataCurta_(iso) {
  const p = iso.split('-');
  return p[2] + '/' + p[1];
}

function dataExtenso_(iso) {
  const p = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return capitalizar_(DIAS_SEMANA[dow]) + ', ' + p[2] + ' de ' + MESES_EXTENSO[p[1] - 1] + ' de ' + p[0];
}

function moeda_(v) {
  const neg = v < 0;
  const partes = Math.abs(v).toFixed(2).split('.');
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + inteiro + (partes[1] === '00' ? '' : ',' + partes[1]);
}

function capitalizar_(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
