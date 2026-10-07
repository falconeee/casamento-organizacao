/**
 * Setup.gs — cria a estrutura nova da planilha do casamento.
 *
 * Rode `setupPlanilha` UMA vez pelo editor do Apps Script.
 * Ele cria as abas Itens, Pagamentos, Config e Listas, aplica listas suspensas,
 * fórmulas e formatação, migra os dados (Migracao.gs) e gera o token da API.
 * A aba antiga "Casamento" é renomeada para "Casamento (backup)" e não é alterada.
 */

const ABAS = {
  ITENS: 'Itens',
  PAGAMENTOS: 'Pagamentos',
  CONFIG: 'Config',
  LISTAS: 'Listas',
  ANTIGA: 'Casamento',
  BACKUP: 'Casamento (backup)',
};

// Colunas de cada aba. `titulo` é o texto do cabeçalho; a API lê pelas chaves.
const COLUNAS_ITENS = [
  { chave: 'item', titulo: 'Item', largura: 170 },
  { chave: 'grupo', titulo: 'Grupo', largura: 130 },
  { chave: 'fornecedor', titulo: 'Fornecedor', largura: 170 },
  { chave: 'status', titulo: 'Status', largura: 110 },
  { chave: 'valor', titulo: 'Valor', largura: 110 },
  { chave: 'pago', titulo: 'Pago', largura: 110, calculada: true },
  { chave: 'agendado', titulo: 'Agendado', largura: 110, calculada: true },
  { chave: 'faltaAgendar', titulo: 'Falta agendar', largura: 115, calculada: true },
  { chave: 'percentPago', titulo: '% pago', largura: 75, calculada: true },
  { chave: 'contato', titulo: 'Contato', largura: 150 },
  { chave: 'obs', titulo: 'Obs', largura: 280 },
];

const COLUNAS_PAGAMENTOS = [
  { chave: 'vencimento', titulo: 'Vencimento', largura: 100 },
  { chave: 'item', titulo: 'Item', largura: 170 },
  { chave: 'descricao', titulo: 'Descrição', largura: 140 },
  { chave: 'valor', titulo: 'Valor', largura: 110 },
  { chave: 'quemPaga', titulo: 'Quem paga', largura: 110 },
  { chave: 'forma', titulo: 'Forma', largura: 140 },
  { chave: 'status', titulo: 'Status', largura: 90 },
  { chave: 'obs', titulo: 'Obs', largura: 300 },
];

const LISTAS = {
  Grupos: ['Assessoria', 'Cerimônia', 'Local & Buffet', 'Bebidas', 'Doces', 'Decoração',
    'Foto & Vídeo', 'Atrações', 'Noivos', 'Papelaria', 'Outros'],
  'Status do item': ['A definir', 'Orçamento', 'Contratado', 'Cancelado'],
  Pessoas: ['Noivo', 'Noiva', 'Os dois'], // substituído por PESSOAS_MIGRACAO (Migracao.gs), se existir
  Formas: ['PIX', 'Cartão de crédito', 'Boleto', 'Transferência', 'Dinheiro', 'iFood'],
  'Status do pagamento': ['Pago', 'A pagar'],
};

const CONFIG_PADRAO = [
  ['Data do casamento', '', 'Formato dd/mm/aaaa. Usada na contagem regressiva.'],
  ['Noivo', '', ''],
  ['Noiva', '', ''],
  ['Orçamento máximo', '', 'Opcional. Teto de gastos para comparar no dashboard.'],
];

const COR_CABECALHO = '#1f2a44';
const FORMATO_MOEDA = '"R$" #,##0.00';

function setupPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(ABAS.ITENS) || ss.getSheetByName(ABAS.PAGAMENTOS)) {
    throw new Error('As abas "Itens"/"Pagamentos" já existem — o setup já foi executado. ' +
      'Apague-as manualmente se quiser rodar de novo.');
  }

  // Nomes reais ficam no Migracao.gs (fora do GitHub).
  if (typeof PESSOAS_MIGRACAO !== 'undefined') {
    LISTAS.Pessoas = PESSOAS_MIGRACAO;
    CONFIG_PADRAO[1][1] = PESSOAS_MIGRACAO[0];
    CONFIG_PADRAO[2][1] = PESSOAS_MIGRACAO[1];
  }

  criarListas_(ss);
  criarConfig_(ss);
  const itens = criarItens_(ss);
  const pagamentos = criarPagamentos_(ss);

  if (typeof migrarDados_ === 'function') {
    migrarDados_(itens, pagamentos);
  }
  ordenarPagamentos_(pagamentos);

  const antiga = ss.getSheetByName(ABAS.ANTIGA);
  if (antiga) antiga.setName(ABAS.BACKUP);

  ss.setActiveSheet(itens);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(pagamentos);
  ss.moveActiveSheet(2);

  const token = gerarNovoToken();
  console.log('Setup concluído. Token da API: ' + token);
}

/** Menu na planilha para consultar/trocar o token sem abrir o editor. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💍 Casamento')
    .addItem('Mostrar token do dashboard', 'mostrarToken')
    .addItem('Gerar novo token', 'gerarNovoTokenComAviso')
    .addToUi();
}

function mostrarToken() {
  const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  SpreadsheetApp.getUi().alert(token ? 'Token do dashboard:\n\n' + token
    : 'Nenhum token gerado ainda. Rode setupPlanilha ou "Gerar novo token".');
}

function gerarNovoTokenComAviso() {
  const token = gerarNovoToken();
  SpreadsheetApp.getUi().alert('Novo token gerado (o anterior parou de funcionar):\n\n' + token);
}

function gerarNovoToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  return token;
}

// ---------------------------------------------------------------------------

function criarListas_(ss) {
  const sh = ss.insertSheet(ABAS.LISTAS);
  const nomes = Object.keys(LISTAS);
  const maior = Math.max.apply(null, nomes.map(function (n) { return LISTAS[n].length; }));
  const linhas = [nomes];
  for (let i = 0; i < maior; i++) {
    linhas.push(nomes.map(function (n) { return LISTAS[n][i] || ''; }));
  }
  sh.getRange(1, 1, linhas.length, nomes.length).setValues(linhas);
  estilizarCabecalho_(sh, nomes.length);
  nomes.forEach(function (_, i) { sh.setColumnWidth(i + 1, 160); });
  sh.getRange(linhas.length + 2, 1)
    .setValue('Pode adicionar valores novos no fim de cada coluna — as listas suspensas se atualizam.')
    .setFontColor('#777777').setFontStyle('italic');
  return sh;
}

function criarConfig_(ss) {
  const sh = ss.insertSheet(ABAS.CONFIG);
  sh.getRange(1, 1, 1, 3).setValues([['Configuração', 'Valor', 'Ajuda']]);
  sh.getRange(2, 1, CONFIG_PADRAO.length, 3).setValues(CONFIG_PADRAO);
  estilizarCabecalho_(sh, 3);
  sh.setColumnWidth(1, 170);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 380);
  sh.getRange('B2').setNumberFormat('dd/mm/yyyy')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
  sh.getRange('B5').setNumberFormat(FORMATO_MOEDA);
  sh.getRange('C2:C').setFontColor('#777777');
  return sh;
}

function criarItens_(ss) {
  const sh = ss.insertSheet(ABAS.ITENS);
  prepararAba_(sh, COLUNAS_ITENS);

  // Colunas calculadas: a fórmula fica no cabeçalho, então cobre linhas novas e
  // continua funcionando se a tabela for ordenada.
  const chave = 'Pagamentos!B2:B&"|"&Pagamentos!G2:G';
  sh.getRange('F1').setFormula('={"Pago";ARRAYFORMULA(IF(A2:A="","",SUMIF(' + chave + ',A2:A&"|Pago",Pagamentos!D2:D)))}');
  sh.getRange('G1').setFormula('={"Agendado";ARRAYFORMULA(IF(A2:A="","",SUMIF(' + chave + ',A2:A&"|A pagar",Pagamentos!D2:D)))}');
  sh.getRange('H1').setFormula('={"Falta agendar";ARRAYFORMULA(IF(A2:A="","",IF((D2:D="Cancelado")+(E2:E-F2:F-G2:G<=0),0,E2:E-F2:F-G2:G)))}');
  sh.getRange('I1').setFormula('={"% pago";ARRAYFORMULA(IF((A2:A="")+(E2:E<=0),"",F2:F/E2:E))}');

  sh.getRange('E2:H').setNumberFormat(FORMATO_MOEDA);
  sh.getRange('I2:I').setNumberFormat('0%');
  sh.getRange('F1:I1').setNote('Coluna calculada automaticamente a partir da aba Pagamentos. Não edite.');
  sh.getRange('F2:I').setBackground('#f4f6f9').setFontColor('#444444');

  validarLista_(sh.getRange('B2:B'), 'Grupos');
  validarLista_(sh.getRange('D2:D'), 'Status do item');
  sh.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false)
    .setHelpText('Valor total do item (contratado ou estimado), em reais.').build());

  const area = sh.getRange('A2:K');
  const regras = [
    regraFormula_('=AND($A2<>"",$E2>0,$F2>=$E2)', area, '#e6f4ea', '#1e6b34'),        // quitado
    regraFormula_('=$D2="Cancelado"', area, '#f1f1f1', '#9a9a9a'),
    regraFormula_('=$D2="A definir"', sh.getRange('D2:D'), '#fde8e8', '#a52a2a'),
    regraFormula_('=$D2="Orçamento"', sh.getRange('D2:D'), '#fff4d6', '#8a5a00'),
    regraFormula_('=$D2="Contratado"', sh.getRange('D2:D'), '#e3edfb', '#1c4f95'),
  ];
  sh.setConditionalFormatRules(regras);
  return sh;
}

function criarPagamentos_(ss) {
  const sh = ss.insertSheet(ABAS.PAGAMENTOS);
  prepararAba_(sh, COLUNAS_PAGAMENTOS);

  sh.getRange('A2:A').setNumberFormat('dd/mm/yyyy')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Data de vencimento ou do pagamento (dd/mm/aaaa).').build());
  sh.getRange('D2:D').setNumberFormat(FORMATO_MOEDA)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThan(0)
      .setAllowInvalid(false).build());

  sh.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(ABAS.ITENS + '!A2:A'), true).setAllowInvalid(false)
    .setHelpText('Escolha um item da aba Itens. Para um item novo, cadastre-o lá primeiro.').build());
  validarLista_(sh.getRange('E2:E'), 'Pessoas');
  validarLista_(sh.getRange('F2:F'), 'Formas');
  validarLista_(sh.getRange('G2:G'), 'Status do pagamento');

  const area = sh.getRange('A2:H');
  sh.setConditionalFormatRules([
    regraFormula_('=AND($G2="A pagar",$A2<>"",$A2<TODAY())', area, '#fde8e8', '#a52a2a'),       // vencido
    regraFormula_('=AND($G2="A pagar",$A2<>"",$A2<=TODAY()+30)', area, '#fff4d6', '#6b4700'), // vence em 30 dias
    regraFormula_('=$G2="Pago"', area, null, '#7a7a7a'),
  ]);
  return sh;
}

function ordenarPagamentos_(sh) {
  const n = sh.getLastRow() - 1;
  if (n > 1) {
    sh.getRange(2, 1, n, COLUNAS_PAGAMENTOS.length).sort([{ column: 1, ascending: true }, { column: 2, ascending: true }]);
  }
}

// ---------------------------------------------------------------------------

function prepararAba_(sh, colunas) {
  sh.getRange(1, 1, 1, colunas.length).setValues([colunas.map(function (c) { return c.titulo; })]);
  estilizarCabecalho_(sh, colunas.length);
  colunas.forEach(function (c, i) { sh.setColumnWidth(i + 1, c.largura); });
  const extras = sh.getMaxColumns() - colunas.length;
  if (extras > 0) sh.deleteColumns(colunas.length + 1, extras);
  sh.getRange(1, 1, sh.getMaxRows(), colunas.length).setVerticalAlignment('middle');
  sh.getRange(1, 1, sh.getMaxRows(), colunas.length).createFilter();
}

function estilizarCabecalho_(sh, ncols) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, ncols)
    .setBackground(COR_CABECALHO).setFontColor('#ffffff').setFontWeight('bold');
  sh.setRowHeight(1, 30);
}

function validarLista_(range, nomeLista) {
  const coluna = Object.keys(LISTAS).indexOf(nomeLista) + 1;
  const letra = String.fromCharCode(64 + coluna);
  const origem = range.getSheet().getParent().getRange(ABAS.LISTAS + '!' + letra + '2:' + letra);
  range.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(origem, true).setAllowInvalid(false).build());
}

function regraFormula_(formula, range, fundo, texto) {
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([range]);
  if (fundo) b.setBackground(fundo);
  if (texto) b.setFontColor(texto);
  return b.build();
}
