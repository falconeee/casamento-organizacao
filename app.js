(function () {
  'use strict';

  const CFG = window.DASHBOARD_CONFIG || {};
  const LS = { token: 'casamento.token', cache: 'casamento.cache', tema: 'casamento.tema' };
  const DEMO = new URLSearchParams(location.search).has('demo');
  const DIAS_PROXIMOS = 60;

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sem storage */ } },
  };

  // ---------- formatação ----------
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const moeda = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? brl0 : brl2).format(v);
  const moedaCurta = (v) => (v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(v)));
  const pct = (v) => Math.round(v * 100) + '%';
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dataCurta = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')) || 0);
  // "MARIA" → "Maria"; textos já em caixa mista ficam como estão.
  const capitalizar = (s) => {
    const t = String(s || '').trim();
    return t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
  };

  function parseData(v) {
    if (!v) return null;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const br = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
    return null;
  }
  function inicioDoDia(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
  const diasEntre = (a, b) => Math.round((inicioDoDia(b) - inicioDoDia(a)) / 86400000);

  // ---------- estado ----------
  const estado = {
    bruto: null,
    modelo: null,
    carregadoEm: null,
    ordem: { col: 'valor', dir: 'desc' },
    abertos: new Set(),
    carregando: false,
  };

  // ---------- tema ----------
  function aplicarTema(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  aplicarTema(store.get(LS.tema));
  $('btn-tema').addEventListener('click', () => {
    const escuro = getComputedStyle(document.documentElement).colorScheme.includes('dark');
    const novo = escuro ? 'light' : 'dark';
    store.set(LS.tema, novo);
    aplicarTema(novo);
  });

  // ---------- token ----------
  function lerTokenDoLink() {
    const m = location.hash.match(/token=([^&]+)/);
    if (m) {
      store.set(LS.token, decodeURIComponent(m[1]).trim());
      history.replaceState(null, '', location.pathname + location.search);
    }
    return !!m;
  }
  // Abrir o link com #token= numa aba que já está na página não recarrega; só muda o hash.
  window.addEventListener('hashchange', () => { if (lerTokenDoLink()) carregar(); });

  function mostrarTelaToken(msg) {
    $('painel').hidden = true;
    $('tela-token').hidden = false;
    $('btn-sair').hidden = true;
    $('erro-token').hidden = !msg;
    $('erro-token').textContent = msg || '';
    $('input-token').focus();
  }

  $('form-token').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const t = $('input-token').value.trim();
    if (!t) return;
    store.set(LS.token, t);
    $('input-token').value = '';
    carregar();
  });

  $('btn-sair').addEventListener('click', () => {
    store.del(LS.token);
    store.del(LS.cache);
    estado.bruto = null;
    mostrarTelaToken();
  });

  function avisar(msg, forte) {
    const el = $('aviso');
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('erro-forte', !!forte);
  }

  // ---------- carga ----------
  async function carregar() {
    if (estado.carregando) return;
    let url;
    if (DEMO) {
      url = 'sample-data.json';
    } else {
      if (!CFG.apiUrl) {
        avisar('Configure a URL da API em config.js (veja INSTRUCOES.md). Para ver um exemplo, abra com ?demo no endereço.', true);
        return;
      }
      const token = store.get(LS.token);
      if (!token) { mostrarTelaToken(); return; }
      url = CFG.apiUrl + (CFG.apiUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    }

    estado.carregando = true;
    $('btn-atualizar').classList.add('carregando');
    if (!estado.bruto) avisar('Carregando dados da planilha…');
    try {
      const resp = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const dados = await resp.json();
      if (!dados.ok) {
        if (dados.error === 'unauthorized') {
          store.del(LS.token);
          store.del(LS.cache);
          mostrarTelaToken('Token inválido. Confira o token no menu 💍 Casamento da planilha.');
          return;
        }
        throw new Error(dados.message || dados.error || 'erro desconhecido');
      }
      estado.carregadoEm = new Date();
      if (!DEMO) store.set(LS.cache, JSON.stringify({ em: estado.carregadoEm.toISOString(), dados }));
      avisar(DEMO ? 'Modo demonstração: dados fictícios.' : '');
      renderizar(dados);
    } catch (err) {
      const msg = estado.bruto
        ? 'Não foi possível atualizar agora (' + err.message + '). Mostrando os últimos dados carregados.'
        : 'Não foi possível carregar os dados (' + err.message + '). Verifique a URL da API e a conexão.';
      avisar(msg, !estado.bruto);
    } finally {
      estado.carregando = false;
      $('btn-atualizar').classList.remove('carregando');
      atualizarCarimbo();
    }
  }

  function atualizarCarimbo() {
    const el = $('atualizado');
    if (!estado.carregadoEm) { el.textContent = ''; return; }
    const min = Math.floor((Date.now() - estado.carregadoEm) / 60000);
    el.textContent = min < 1 ? 'Atualizado agora' : 'Atualizado há ' + min + ' min';
    el.title = estado.carregadoEm.toLocaleString('pt-BR');
  }

  // ---------- modelo ----------
  function montarModelo(d) {
    const hoje = inicioDoDia(new Date());
    const porItem = new Map();
    const itens = (d.itens || []).map((i) => {
      const it = {
        item: String(i.item), grupo: i.grupo || 'Outros', fornecedor: i.fornecedor || '',
        status: i.status || 'A definir', valor: num(i.valor), contato: i.contato || '', obs: i.obs || '',
        pagamentos: [],
      };
      porItem.set(it.item, it);
      return it;
    });

    const pagamentos = (d.pagamentos || []).map((p) => ({
      data: parseData(p.vencimento), item: String(p.item), descricao: p.descricao || '',
      valor: num(p.valor), quem: capitalizar(p.quemPaga) || 'Não definido', forma: p.forma || '',
      pago: String(p.status).trim().toLowerCase() === 'pago', obs: p.obs || '',
    }));

    pagamentos.forEach((p) => {
      let it = porItem.get(p.item);
      if (!it) {
        it = { item: p.item, grupo: 'Outros', fornecedor: '', status: 'Contratado', valor: 0, contato: '', obs: 'Item não cadastrado na aba Itens', pagamentos: [] };
        porItem.set(p.item, it);
        itens.push(it);
      }
      p.vencido = !p.pago && p.data && p.data < hoje;
      it.pagamentos.push(p);
    });

    itens.forEach((it) => {
      it.pagamentos.sort((a, b) => (a.data || Infinity) - (b.data || Infinity));
      it.pago = soma(it.pagamentos.filter((p) => p.pago));
      it.agendado = soma(it.pagamentos.filter((p) => !p.pago));
      const cancelado = it.status === 'Cancelado';
      it.total = cancelado ? it.pago : Math.max(it.valor, it.pago + it.agendado);
      it.falta = cancelado ? 0 : Math.max(0, it.valor - it.pago - it.agendado);
      it.pct = it.total > 0 ? it.pago / it.total : 0;
      it.vencido = it.pagamentos.some((p) => p.vencido);
      it.exibido = cancelado ? 'Cancelado' : (it.valor > 0 && it.pago >= it.valor - 0.005 ? 'Quitado' : it.status);
    });

    const ativos = itens.filter((i) => i.status !== 'Cancelado');
    const tot = {
      total: somaCampo(itens, 'total'), pago: somaCampo(itens, 'pago'),
      agendado: somaCampo(itens, 'agendado'), falta: somaCampo(itens, 'falta'),
      contratado: somaCampo(ativos.filter((i) => i.status === 'Contratado' || i.exibido === 'Quitado'), 'total'),
      orcamento: somaCampo(ativos.filter((i) => i.status === 'Orçamento' && i.exibido !== 'Quitado'), 'total'),
    };

    return { hoje, itens, pagamentos, tot, config: d.config || {} };
  }
  const soma = (ps) => ps.reduce((s, p) => s + p.valor, 0);
  const somaCampo = (xs, c) => xs.reduce((s, x) => s + (x[c] || 0), 0);

  // ---------- render ----------
  function renderizar(dados) {
    estado.bruto = dados;
    const m = montarModelo(dados);
    estado.modelo = m;
    $('tela-token').hidden = true;
    $('painel').hidden = false;
    $('btn-sair').hidden = DEMO;

    renderTopo(m);
    renderResumo(m);
    renderProximos(m);
    renderFechar(m);
    renderMensal(m);
    renderGrupos(m);
    renderPessoas(m);
    preencherFiltros(m);
    renderTabela();
  }

  function renderTopo(m) {
    const c = m.config;
    const nomes = [c.noivo, c.noiva].filter(Boolean).join(' & ');
    $('titulo').textContent = nomes ? 'Casamento ' + nomes : 'Casamento';
    document.title = (nomes ? nomes + ' · ' : '') + 'Finanças do casamento';
    const data = parseData(c.dataCasamento);
    const el = $('contagem');
    if (!data) { el.hidden = true; return; }
    const dias = diasEntre(m.hoje, data);
    const quando = data.getDate() + ' de ' + data.toLocaleDateString('pt-BR', { month: 'long' }) + ' de ' + data.getFullYear();
    el.textContent = dias > 0 ? 'Faltam ' + dias.toLocaleString('pt-BR') + ' dias · ' + quando
      : dias === 0 ? 'É hoje! 💍' : 'Casados desde ' + quando;
    el.hidden = false;
  }

  function segmentos(partes, base) {
    return partes.filter((p) => p.v > 0).map((p) =>
      '<div style="flex:0 1 ' + (base > 0 ? (p.v / base) * 100 : 0) + '%;background:var(--' + p.cor + ')"></div>').join('');
  }

  function renderResumo(m) {
    const t = m.tot;
    $('kpi-pago').textContent = moeda(t.pago);
    $('kpi-pago-de').textContent = 'de ' + moeda(t.total) + (t.total > 0 ? ' (' + pct(t.pago / t.total) + ')' : '');

    const meter = $('meter');
    meter.innerHTML = segmentos([{ v: t.pago, cor: 'pago' }, { v: t.agendado, cor: 'agendado' }, { v: t.falta, cor: 'falta' }], t.total);
    meter.setAttribute('aria-label', 'Pago ' + moeda(t.pago) + ', a pagar ' + moeda(t.agendado) + ', falta agendar ' + moeda(t.falta));
    tooltip(meter, () => linhasTT('Orçamento total ' + moeda(t.total), [
      ['pago', 'Pago', t.pago], ['agendado', 'A pagar', t.agendado], ['falta', 'Falta agendar', t.falta]]));

    const teto = num(m.config.orcamentoMaximo);
    $('kpi-total').textContent = moeda(t.total);
    $('kpi-total-sub').textContent = moeda(t.contratado) + ' contratado · ' + moeda(t.orcamento) + ' em orçamento' +
      (teto > 0 ? ' · teto ' + moeda(teto) + (t.total > teto ? ' (acima!)' : '') : '');

    const aPagar = m.pagamentos.filter((p) => !p.pago);
    const vencidos = aPagar.filter((p) => p.vencido);
    const proxima = aPagar.filter((p) => p.data && !p.vencido).sort((a, b) => a.data - b.data)[0];
    $('kpi-agendado').textContent = moeda(t.agendado);
    $('kpi-agendado-sub').textContent = aPagar.length + ' pagamento' + (aPagar.length === 1 ? '' : 's') +
      (vencidos.length ? ' · ⚠ ' + vencidos.length + ' vencido' + (vencidos.length === 1 ? '' : 's') : '') +
      (proxima ? ' · próximo em ' + dataCurta(proxima.data) : '');

    const comFalta = m.itens.filter((i) => i.falta > 0.005);
    $('kpi-falta').textContent = moeda(t.falta);
    $('kpi-falta-sub').textContent = comFalta.length ? 'em ' + comFalta.length + ' ite' + (comFalta.length === 1 ? 'm' : 'ns') + ' sem pagamento marcado' : 'tudo agendado';

    const aDefinir = m.itens.filter((i) => i.exibido === 'A definir').length;
    const emOrc = m.itens.filter((i) => i.exibido === 'Orçamento').length;
    $('kpi-fechar').textContent = String(aDefinir + emOrc);
    $('kpi-fechar-sub').textContent = aDefinir + ' a definir · ' + emOrc + ' em orçamento';
  }

  function chipData(d) {
    if (!d) return '<div class="data-chip">sem<br>data</div>';
    return '<div class="data-chip"><b>' + String(d.getDate()).padStart(2, '0') + '</b>' + MESES[d.getMonth()] + '/' + String(d.getFullYear()).slice(2) + '</div>';
  }

  function renderProximos(m) {
    const limite = new Date(m.hoje); limite.setDate(limite.getDate() + DIAS_PROXIMOS);
    const lista = m.pagamentos.filter((p) => !p.pago && p.data && p.data <= limite).sort((a, b) => a.data - b.data);
    const ul = $('lista-proximos');
    const semData = agruparSemData(m.pagamentos.filter((p) => !p.pago && !p.data));
    const VISIVEIS = 6;

    let html = lista.length ? '' : '<li class="vazio" style="display:block">Nada vencendo nos próximos ' + DIAS_PROXIMOS + ' dias.</li>';
    lista.forEach((p, i) => {
      const dias = diasEntre(m.hoje, p.data);
      const quando = p.vencido ? '<span class="selo vencido">! Vencido há ' + -dias + ' dia' + (dias === -1 ? '' : 's') + '</span> '
        : dias === 0 ? '<b>Hoje</b> · ' : dias === 1 ? 'Amanhã · ' : 'em ' + dias + ' dias · ';
      html += '<li class="' + (p.vencido ? 'vencido' : '') + '"' + (i >= VISIVEIS ? ' data-extra hidden' : '') + '>' + chipData(p.data) +
        '<div><div class="titulo">' + esc(p.item) + ' <span class="detalhe">· ' + esc(p.descricao) + '</span></div>' +
        '<div class="detalhe">' + quando + esc(p.quem) + (p.forma ? ' · ' + esc(p.forma) : '') + '</div></div>' +
        '<div class="montante">' + moeda(p.valor) + '</div></li>';
    });
    ul.innerHTML = html;
    if (lista.length > VISIVEIS) {
      const btn = document.createElement('button');
      btn.className = 'mais';
      btn.type = 'button';
      btn.textContent = 'Ver mais ' + (lista.length - VISIVEIS);
      btn.onclick = () => { ul.querySelectorAll('[data-extra]').forEach((li) => { li.hidden = false; }); btn.remove(); };
      ul.appendChild(btn);
    }
    if (semData.length) {
      const sub = document.createElement('div');
      sub.innerHTML = '<p class="subtitulo">A pagar sem data definida</p><ul class="lista">' + semData.map((g) =>
        '<li>' + chipData(null) + '<div><div class="titulo">' + esc(g.item) + '</div><div class="detalhe">' + g.n + ' pagamento' + (g.n === 1 ? '' : 's') + ' · ' + esc(g.quem) + '</div></div>' +
        '<div class="montante">' + moeda(g.valor) + '</div></li>').join('') + '</ul>';
      ul.appendChild(sub);
    }
  }

  function agruparSemData(ps) {
    const g = new Map();
    ps.forEach((p) => {
      const x = g.get(p.item) || { item: p.item, n: 0, valor: 0, quem: p.quem };
      x.n++; x.valor += p.valor;
      if (x.quem !== p.quem) x.quem = 'Vários';
      g.set(p.item, x);
    });
    return [...g.values()];
  }

  function renderFechar(m) {
    const semContrato = m.itens.filter((i) => i.exibido === 'A definir' || i.exibido === 'Orçamento')
      .sort((a, b) => (a.exibido === b.exibido ? b.valor - a.valor : a.exibido === 'A definir' ? -1 : 1));
    const saldo = m.itens.filter((i) => i.status === 'Contratado' && i.falta > 0.005).sort((a, b) => b.falta - a.falta);
    let html = '<p class="subtitulo">Sem contrato (' + semContrato.length + ')</p>';
    html += semContrato.length ? '<ul class="lista">' + semContrato.map((i) =>
      '<li style="grid-template-columns:1fr auto">' +
      '<div><div class="titulo">' + esc(i.item) + ' ' + selo(i.exibido) + '</div><div class="detalhe">' + (i.fornecedor ? esc(i.fornecedor) : 'sem fornecedor') + '</div></div>' +
      '<div class="montante">' + (i.valor ? moeda(i.valor) : '<span class="detalhe">sem valor</span>') + '</div></li>').join('') + '</ul>'
      : '<p class="vazio">Tudo contratado 🎉</p>';
    html += '<p class="subtitulo">Saldo sem pagamento agendado (' + saldo.length + ')</p>';
    html += saldo.length ? '<ul class="lista">' + saldo.map((i) =>
      '<li style="grid-template-columns:1fr auto"><div><div class="titulo">' + esc(i.item) + '</div><div class="detalhe">' + esc(i.fornecedor) + ' · contrato ' + moeda(i.valor) + '</div></div>' +
      '<div class="montante">' + moeda(i.falta) + '</div></li>').join('') + '</ul>'
      : '<p class="vazio">Todos os saldos têm pagamento agendado.</p>';
    $('lista-fechar').innerHTML = html;
  }

  function passoBonito(max, n) {
    const bruto = max / n;
    const p = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= bruto) return f * p;
    return 10 * p;
  }

  function renderMensal(m) {
    const el = $('grafico-mensal');
    const datados = m.pagamentos.filter((p) => p.data);
    const semData = m.pagamentos.filter((p) => !p.data && !p.pago);
    const nota = $('mensal-sem-data');
    nota.hidden = !semData.length;
    nota.textContent = semData.length ? moeda(soma(semData)) + ' a pagar ainda sem data não aparece no gráfico.' : '';
    if (!datados.length) { el.innerHTML = '<p class="vazio">Nenhum pagamento com data.</p>'; return; }

    const chave = (d) => d.getFullYear() * 12 + d.getMonth();
    const atual = chave(m.hoje);
    let ini = Math.min(atual, ...datados.map((p) => chave(p.data)));
    const fim = Math.max(atual, ...datados.map((p) => chave(p.data)));
    const meses = [];
    for (let k = ini; k <= fim; k++) meses.push({ k, pago: 0, aPagar: 0, itens: [] });
    datados.forEach((p) => {
      const b = meses[chave(p.data) - ini];
      b[p.pago ? 'pago' : 'aPagar'] += p.valor;
      b.itens.push(p);
    });
    const maxV = Math.max(...meses.map((b) => b.pago + b.aPagar));
    const passo = passoBonito(maxV, 4);
    const topo = Math.ceil(maxV / passo) * passo || passo;

    let grade = '';
    let rotulosY = '';
    for (let v = 0; v <= topo + 0.001; v += passo) {
      const y = 100 - (v / topo) * 100;
      grade += '<div class="' + (v === 0 ? 'base' : '') + '" style="top:' + y + '%"></div>';
      rotulosY += '<span style="top:' + y + '%">' + moedaCurta(v) + '</span>';
    }
    const cols = meses.map((b, i) => {
      const h = (v) => (v / topo) * 100;
      return '<div class="coluna" data-i="' + i + '" tabindex="0"><div class="coluna-pilha" style="height:' + h(b.pago + b.aPagar) + '%">' +
        (b.pago > 0 ? '<div style="flex:' + b.pago + ' 0 0;background:var(--pago)"></div>' : '') +
        (b.aPagar > 0 ? '<div style="flex:' + b.aPagar + ' 0 0;background:var(--agendado)"></div>' : '') +
        '</div></div>';
    }).join('');
    const rotulos = meses.map((b) => '<span class="' + (b.k === atual ? 'atual' : '') + '">' + MESES[b.k % 12] + '<br>' + String(Math.floor(b.k / 12)).slice(2) + '</span>').join('');
    // O eixo Y fica fora da área que rola, para continuar visível no celular.
    el.innerHTML = '<div class="eixo-y" aria-hidden="true">' + rotulosY + '</div><div class="rolagem"><div class="colunas-area"><div class="colunas-eixo">' + grade + '</div>' + cols +
      '</div><div class="colunas-rotulos">' + rotulos + '</div></div>';

    el.querySelectorAll('.coluna').forEach((c) => {
      const b = meses[+c.dataset.i];
      const titulo = MESES[b.k % 12] + '/' + Math.floor(b.k / 12);
      tooltip(c, () => {
        const linhas = linhasTT(titulo + ' · ' + moeda(b.pago + b.aPagar), [['pago', 'Pago', b.pago], ['agendado', 'A pagar', b.aPagar]]);
        const top = b.itens.slice().sort((x, y) => y.valor - x.valor).slice(0, 4)
          .map((p) => '<div class="tt-linha"><span>' + esc(p.item) + '</span><span>' + moeda(p.valor) + '</span></div>').join('');
        return linhas + (top ? '<div style="border-top:1px solid var(--grid);margin-top:6px;padding-top:6px">' + top + '</div>' : '');
      });
    });
    // Começa mostrando o mês atual quando o gráfico rola na horizontal.
    const rolagem = el.querySelector('.rolagem');
    rolagem.scrollLeft = Math.max(0, (atual - ini) * 44 - rolagem.clientWidth / 3);
  }

  function barras(container, linhas, maximo, textoValor) {
    container.innerHTML = linhas.map((l, i) =>
      '<div class="barra-linha"><div class="barra-rotulo" title="' + esc(l.nome) + '">' + esc(l.nome) + '</div>' +
      '<div class="barra-trilho" data-i="' + i + '">' + segmentos(l.partes, maximo) + '</div>' +
      '<div class="barra-valor">' + textoValor(l) + '</div></div>').join('') || '<p class="vazio">Sem dados.</p>';
    container.querySelectorAll('.barra-trilho').forEach((t) => {
      const l = linhas[+t.dataset.i];
      tooltip(t, () => linhasTT(l.nome, l.partes.map((p) => [p.cor, p.nome, p.v])));
    });
  }

  function renderGrupos(m) {
    const g = new Map();
    m.itens.forEach((i) => {
      if (i.total <= 0) return;
      const x = g.get(i.grupo) || { nome: i.grupo, total: 0, pago: 0, agendado: 0, falta: 0 };
      x.total += i.total; x.pago += i.pago; x.agendado += i.agendado; x.falta += i.falta;
      g.set(i.grupo, x);
    });
    const linhas = [...g.values()].sort((a, b) => b.total - a.total).map((x) => ({
      ...x, partes: [{ cor: 'pago', nome: 'Pago', v: x.pago }, { cor: 'agendado', nome: 'A pagar', v: x.agendado }, { cor: 'falta', nome: 'Falta agendar', v: x.falta }],
    }));
    const max = Math.max(0, ...linhas.map((l) => l.total));
    barras($('grafico-grupos'), linhas, max, (l) => moeda(l.total) + ' · ' + pct(l.total ? l.pago / l.total : 0) + ' pago');
  }

  function renderPessoas(m) {
    const g = new Map();
    m.pagamentos.forEach((p) => {
      const x = g.get(p.quem) || { nome: p.quem, pago: 0, aPagar: 0 };
      x[p.pago ? 'pago' : 'aPagar'] += p.valor;
      g.set(p.quem, x);
    });
    const linhas = [...g.values()].sort((a, b) => (a.nome === 'Não definido') - (b.nome === 'Não definido') || (b.pago + b.aPagar) - (a.pago + a.aPagar))
      .map((x) => ({ ...x, partes: [{ cor: 'pago', nome: 'Pago', v: x.pago }, { cor: 'agendado', nome: 'A pagar', v: x.aPagar }] }));
    const max = Math.max(0, ...linhas.map((l) => l.pago + l.aPagar));
    barras($('grafico-pessoas'), linhas, max, (l) => moeda(l.pago) + ' pago · ' + moeda(l.aPagar) + ' a pagar');
  }

  // ---------- tabela ----------
  const SELOS = {
    'Quitado': ['quitado', '✓'], 'Contratado': ['contratado', '●'], 'Orçamento': ['orcamento', '◔'],
    'A definir': ['a-definir', '○'], 'Cancelado': ['cancelado', '✕'],
  };
  function selo(s) {
    const [cls, ic] = SELOS[s] || ['', '•'];
    return '<span class="selo ' + cls + '"><span aria-hidden="true">' + ic + '</span>' + esc(s) + '</span>';
  }

  function preencherFiltros(m) {
    const preencher = (sel, valores) => {
      const atual = sel.value;
      const primeiro = sel.options[0].outerHTML;
      sel.innerHTML = primeiro + valores.map((v) => '<option>' + esc(v) + '</option>').join('');
      sel.value = valores.includes(atual) ? atual : '';
    };
    const ordemStatus = ['A definir', 'Orçamento', 'Contratado', 'Quitado', 'Cancelado'];
    preencher($('filtro-status'), ordemStatus.filter((s) => m.itens.some((i) => i.exibido === s)));
    preencher($('filtro-grupo'), [...new Set(m.itens.map((i) => i.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  }

  function renderTabela() {
    const m = estado.modelo;
    if (!m) return;
    const busca = $('filtro-busca').value.trim().toLowerCase();
    const st = $('filtro-status').value;
    const gr = $('filtro-grupo').value;
    const { col, dir } = estado.ordem;
    const ordemStatus = { 'A definir': 0, 'Orçamento': 1, 'Contratado': 2, 'Quitado': 3, 'Cancelado': 4 };
    const chaveOrdem = (i) => (col === 'status' ? ordemStatus[i.exibido] : col === 'item' ? i.item.toLowerCase() : col === 'valor' ? i.total : i[col]);

    const linhas = m.itens.filter((i) =>
      (!st || i.exibido === st) && (!gr || i.grupo === gr) &&
      (!busca || (i.item + ' ' + i.fornecedor).toLowerCase().includes(busca)))
      .sort((a, b) => {
        const x = chaveOrdem(a); const y = chaveOrdem(b);
        const r = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y;
        return dir === 'asc' ? r : -r;
      });

    const tbody = document.querySelector('#tabela-itens tbody');
    tbody.innerHTML = linhas.map((i) => {
      const aberto = estado.abertos.has(i.item);
      let html = '<tr class="item-linha" tabindex="0" aria-expanded="' + aberto + '" data-item="' + esc(i.item) + '">' +
        '<td>' + esc(i.item) + (i.vencido ? ' <span class="selo vencido" title="Tem pagamento vencido">!</span>' : '') +
        '<span class="forn">' + esc(i.fornecedor || '—') + ' · ' + esc(i.grupo) + '</span><span class="so-mobile">' + selo(i.exibido) + '</span></td>' +
        '<td class="col-status">' + selo(i.exibido) + '</td>' +
        '<td class="num">' + (i.total ? moeda(i.total) : '—') + '</td>' +
        '<td class="num">' + (i.pago ? moeda(i.pago) : '—') + '</td>' +
        '<td class="num col-opcional">' + (i.agendado ? moeda(i.agendado) : '—') + '</td>' +
        '<td class="num col-opcional">' + (i.falta ? moeda(i.falta) : '—') + '</td>' +
        '<td class="col-progresso">' + (i.total > 0
          ? '<div class="mini-meter">' + segmentos([{ v: i.pago, cor: 'pago' }, { v: i.agendado, cor: 'agendado' }, { v: i.falta, cor: 'falta' }], i.total) + '</div><span class="pct">' + pct(i.pct) + '</span>'
          : '') + '</td></tr>';
      if (aberto) html += detalheItem(i);
      return html;
    }).join('') || '<tr><td colspan="7" class="vazio">Nenhum item encontrado.</td></tr>';

    const t = { total: somaCampo(linhas, 'total'), pago: somaCampo(linhas, 'pago'), agendado: somaCampo(linhas, 'agendado'), falta: somaCampo(linhas, 'falta') };
    document.querySelector('#tabela-itens tfoot').innerHTML = '<tr><td>Total (' + linhas.length + ')</td><td class="col-status"></td>' +
      '<td class="num">' + moeda(t.total) + '</td><td class="num">' + moeda(t.pago) + '</td>' +
      '<td class="num col-opcional">' + moeda(t.agendado) + '</td><td class="num col-opcional">' + moeda(t.falta) + '</td>' +
      '<td class="pct">' + (t.total ? pct(t.pago / t.total) : '') + '</td></tr>';

    document.querySelectorAll('#tabela-itens thead th').forEach((th) => {
      if (th.dataset.ordem === col) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  function detalheItem(i) {
    const info = [i.contato && 'Contato: ' + esc(i.contato), i.obs && esc(i.obs)].filter(Boolean).join(' · ');
    const pags = i.pagamentos.length
      ? '<table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Quem</th><th>Forma</th><th>Status</th><th class="num">Valor</th></tr></thead><tbody>' +
        i.pagamentos.map((p) => '<tr><td>' + (p.data ? dataCurta(p.data) : 'sem data') + '</td><td>' + esc(p.descricao) +
          (p.obs ? '<div class="obs">' + esc(p.obs) + '</div>' : '') + '</td><td>' + esc(p.quem) + '</td><td>' + esc(p.forma) + '</td><td>' +
          (p.pago ? '<span class="selo quitado">✓ Pago</span>' : p.vencido ? '<span class="selo vencido">! Vencido</span>' : '<span class="selo">A pagar</span>') +
          '</td><td class="num">' + moeda(p.valor) + '</td></tr>').join('') + '</tbody></table>'
      : '<p class="vazio">Nenhum pagamento lançado.</p>';
    return '<tr class="detalhe-linha"><td colspan="7">' + (info ? '<p class="nota" style="margin:0 0 8px">' + info + '</p>' : '') +
      '<div style="overflow-x:auto">' + pags + '</div></td></tr>';
  }

  const tbody = document.querySelector('#tabela-itens tbody');
  function alternarLinha(tr) {
    const nome = tr.dataset.item;
    if (estado.abertos.has(nome)) estado.abertos.delete(nome); else estado.abertos.add(nome);
    renderTabela();
  }
  tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr.item-linha');
    if (tr) alternarLinha(tr);
  });
  tbody.addEventListener('keydown', (ev) => {
    const tr = ev.target.closest('tr.item-linha');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); alternarLinha(tr); }
  });
  document.querySelectorAll('#tabela-itens thead th').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.ordem;
      estado.ordem = { col, dir: estado.ordem.col === col && estado.ordem.dir === 'desc' ? 'asc' : (col === 'item' && estado.ordem.col !== col ? 'asc' : 'desc') };
      renderTabela();
    });
  });
  ['filtro-busca', 'filtro-status', 'filtro-grupo'].forEach((id) => $(id).addEventListener('input', renderTabela));

  // ---------- tooltip ----------
  const tt = $('tooltip');
  const ttFns = new WeakMap();
  function tooltip(el, fn) { ttFns.set(el, fn); }
  function linhasTT(titulo, linhas) {
    return '<b>' + esc(titulo) + '</b>' + linhas.map(([cor, nome, v]) =>
      '<div class="tt-linha"><span><i style="background:var(--' + cor + ')"></i>' + esc(nome) + '</span><span>' + moeda(v) + '</span></div>').join('');
  }
  function alvoTT(node) {
    while (node && node !== document.body) {
      if (ttFns.has(node)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function posicionarTT(x, y) {
    const r = tt.getBoundingClientRect();
    let left = x + 14; let top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tt.style.left = Math.max(8, left) + 'px';
    tt.style.top = Math.max(8, top) + 'px';
  }
  let ttAlvo = null;
  document.addEventListener('pointermove', (ev) => {
    const alvo = alvoTT(ev.target);
    if (!alvo) { if (ev.pointerType === 'mouse') { tt.hidden = true; ttAlvo = null; } return; }
    if (alvo !== ttAlvo) { tt.innerHTML = ttFns.get(alvo)(); ttAlvo = alvo; }
    tt.hidden = false;
    posicionarTT(ev.clientX, ev.clientY);
  });
  document.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    const alvo = alvoTT(ev.target);
    if (!alvo) { tt.hidden = true; ttAlvo = null; return; }
    tt.innerHTML = ttFns.get(alvo)(); ttAlvo = alvo; tt.hidden = false;
    posicionarTT(ev.clientX, ev.clientY);
  });
  document.addEventListener('focusin', (ev) => {
    const alvo = alvoTT(ev.target);
    if (!alvo) { tt.hidden = true; return; }
    tt.innerHTML = ttFns.get(alvo)(); tt.hidden = false;
    const r = alvo.getBoundingClientRect();
    posicionarTT(r.left + r.width / 2, r.top);
  });
  window.addEventListener('scroll', () => { tt.hidden = true; ttAlvo = null; }, { passive: true });

  // ---------- início ----------
  $('btn-atualizar').addEventListener('click', carregar);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!estado.carregadoEm || Date.now() - estado.carregadoEm > 60000)) carregar();
  });
  setInterval(() => { if (!document.hidden) carregar(); }, Math.max(1, CFG.atualizarACadaMinutos || 5) * 60000);
  setInterval(atualizarCarimbo, 30000);

  lerTokenDoLink();
  if (!DEMO && store.get(LS.token)) {
    try {
      const c = JSON.parse(store.get(LS.cache) || 'null');
      if (c && c.dados) { estado.carregadoEm = new Date(c.em); renderizar(c.dados); atualizarCarimbo(); }
    } catch (e) { /* cache inválido */ }
  }
  carregar();
})();
