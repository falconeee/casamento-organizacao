# Instruções de implantação — Dashboard do casamento 💍

Passo a passo para reorganizar a planilha, publicar a API no Google Apps Script e colocar o dashboard no ar pelo GitHub Pages.
Tempo estimado: 30–40 minutos na primeira vez.

```
Planilha Google  ──(Apps Script lê as abas)──►  API JSON (/exec?token=...)  ◄──fetch──  Dashboard (GitHub Pages)
```

- **Planilha**: onde vocês continuam lançando tudo.
- **API (Apps Script)**: devolve os dados da planilha em JSON, só para quem tem o token.
- **Dashboard (GitHub Pages)**: página estática que busca a API toda vez que abre (e a cada 5 minutos).

---

## 1. Pré-requisitos

- Conta Google com permissão de **edição** na planilha.
- Conta no [GitHub](https://github.com).
- `git` instalado no Mac (já está, se `git --version` funciona no Terminal).

## 2. Faça um backup da planilha

Na planilha: **Arquivo → Fazer uma cópia**. Guarde essa cópia. O setup não apaga nada (a aba antiga só muda de nome), mas o backup garante.

## 3. Cole os scripts no Apps Script

1. Na planilha, abra **Extensões → Apps Script**.
2. Já existe um arquivo `Código.gs`. Renomeie-o para `Setup` (clique nos ⋮ ao lado do nome → Renomear) e substitua todo o conteúdo pelo de [`apps-script/Setup.gs`](apps-script/Setup.gs).
3. Clique em **+ → Script**, crie o arquivo `Migracao` e cole o conteúdo de `apps-script/Migracao.gs`.
   > Esse arquivo tem os dados reais e **não** vai para o GitHub. Ele está só na pasta local do projeto.
4. Clique em **+ → Script**, crie o arquivo `Api` e cole o conteúdo de [`apps-script/Api.gs`](apps-script/Api.gs).
5. Salve (ícone de disquete ou `Cmd+S`).
6. (Recomendado) Em **⚙️ Configurações do projeto**, ajuste o **Fuso horário** para `(GMT-03:00) São Paulo`.

## 4. Rode o setup (uma única vez)

1. No topo do editor, no seletor de funções, escolha **`setupPlanilha`** e clique em **▶ Executar**.
2. O Google vai pedir autorização: **Revisar permissões → escolha sua conta → "O Google não verificou este app" → Avançado → Acessar (não seguro) → Permitir**.
   Isso é normal: o "app" é o seu próprio script.
3. Ao terminar, o **Registro de execução** mostra: `Setup concluído. Token da API: XXXXXXXX...`. **Copie esse token.**
4. Volte para a planilha e recarregue a página. Você vai ver:
   - **Itens**: um item/contrato por linha (Grupo, Fornecedor, Status, Valor). As colunas cinzas (Pago, Agendado, Falta agendar, % pago) são calculadas sozinhas.
   - **Pagamentos**: uma linha por pagamento ou parcela, com vencimento, quem paga, forma e status.
   - **Config**: data do casamento, nomes e orçamento máximo (opcional).
   - **Listas**: opções das listas suspensas.
   - **Casamento (backup)**: a aba antiga, intacta. A aba **Apê** não é alterada.
   - Um menu novo **💍 Casamento** (mostrar ou trocar o token).
5. Na aba **Config**, preencha a **Data do casamento** (dd/mm/aaaa) para ativar a contagem regressiva.

> Se rodar `setupPlanilha` de novo, ele para com um erro de propósito, para não duplicar dados. Para refazer do zero, apague as abas Itens, Pagamentos, Config e Listas e renomeie "Casamento (backup)" de volta para "Casamento".

## 5. Revise a migração ⚠️

Algumas informações da planilha antiga estavam em texto livre e precisaram de suposições:
- Parcelas mensais começam 1 mês depois da entrada, no mesmo dia, e as que já venceram entraram como "Pago".
- Datas desconhecidas ficaram em branco.
- Itens com valor e sem pagamento ficaram como "Orçamento".

Na aba **Pagamentos**, filtre a coluna **Obs** por "⚠" e corrija o que for preciso. A lista detalhada, item por item, está no arquivo local **`REVISAO-MIGRACAO.md`**. Ele não vai para o GitHub porque contém valores reais.

## 6. Publique a API

1. No editor do Apps Script: **Implantar → Nova implantação**.
2. Em "Selecione o tipo" (⚙️), escolha **App da Web**.
3. Preencha:
   - Descrição: `API dashboard`
   - **Executar como: Eu** (seu e-mail)
   - **Quem pode acessar: Qualquer pessoa**
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
5. Teste no navegador: abra `URL_DO_APP?token=SEU_TOKEN`. Deve aparecer um JSON começando com `{"ok":true,...`.
   Sem o token (ou com um token errado), o resultado deve ser `{"ok":false,"error":"unauthorized"}`.

> "Qualquer pessoa" é necessário para o GitHub Pages conseguir chamar a API. A proteção vem do token: sem ele, a API não devolve nenhum dado.

## 7. Configure o dashboard

Edite o arquivo [`config.js`](config.js) e cole a URL:

```js
window.DASHBOARD_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  atualizarACadaMinutos: 5,
};
```

Para testar localmente: `python3 -m http.server 8000` na pasta do projeto e abrir `http://localhost:8000`.
Para ver só o visual com dados fictícios: `http://localhost:8000/?demo`.

## 8. Publique no GitHub Pages

1. No GitHub, crie um repositório novo (ex.: `casamento-organizacao`), **sem** README.
   > O GitHub Pages gratuito exige repositório **público**. Não há dados no código: os valores ficam só na planilha, e o `Migracao.gs` está no `.gitignore`.
2. No Terminal, na pasta do projeto:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/casamento-organizacao.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
4. Em 1–2 minutos o site fica em `https://SEU_USUARIO.github.io/casamento-organizacao/`.

## 9. Primeiro acesso e compartilhamento com a noiva

- Abra uma vez em cada aparelho o link com o token no final:
  `https://SEU_USUARIO.github.io/casamento-organizacao/#token=SEU_TOKEN`
  O token fica salvo no navegador e some da barra de endereço. Depois disso, basta o link normal.
- Mande esse link com `#token=` para ela por uma conversa privada.
- Também dá para abrir o link normal e colar o token na tela de acesso.
- No celular: **Compartilhar → Adicionar à Tela de Início** para ter um "app".
- O botão **Sair** no topo esquece o token naquele aparelho.

## 10. Segurança

- **Desligue o link público da planilha**: na planilha, clique em **Compartilhar → Acesso geral → Restrito** e mantenha só vocês dois como editores. O dashboard continua funcionando, porque a API roda com a sua conta.
- **Trocar o token** (se o link vazar): na planilha, **💍 Casamento → Gerar novo token**. O token antigo para de funcionar na hora, e vocês precisam abrir o link com o novo `#token=` de novo.
- Nunca coloque o token no `config.js` nem em nenhum arquivo do repositório.

## 11. Uso no dia a dia

**Novo fornecedor/item**
1. Aba **Itens**: preencha Item (nome único), Grupo, Fornecedor, Status e Valor.
2. Status: **A definir** (ainda pesquisando) → **Orçamento** (tem preço, não fechou) → **Contratado** (fechou). Use **Cancelado** se desistirem. "Quitado" aparece sozinho no dashboard quando o pago chega ao valor.

**Novo pagamento**
1. Aba **Pagamentos**: uma linha por pagamento. Escolha o **Item** na lista, informe Vencimento, Valor, Quem paga, Forma e Status.
2. Parcelado em PIX/boleto: **uma linha por parcela** (Descrição "Parcela 1/10", "Parcela 2/10"...). Dica: preencha a primeira linha, copie para baixo e ajuste datas e descrições.
3. Cartão de crédito: **uma linha só**, com o valor total e status **Pago** (o fornecedor já recebeu). Anote as parcelas do cartão na Obs.

**Pagou uma parcela?** Mude o Status de "A pagar" para **Pago**. Linhas vencidas e ainda "A pagar" ficam vermelhas, e as que vencem em até 30 dias ficam amarelas.

**Renomear um item:** use **Editar → Localizar e substituir** em todas as abas, porque o nome é o que liga Itens e Pagamentos.

**Novas opções nas listas** (outro grupo, forma de pagamento...): adicione no fim da coluna correspondente da aba **Listas**.

## 12. Atualizar o código da API

Ao editar `Api.gs` ou `Setup.gs` no Apps Script, a URL `/exec` continua servindo a versão antiga até você publicar uma nova versão:
**Implantar → Gerenciar implantações → ✏️ Editar → Versão: Nova versão → Implantar**. A URL não muda.

Mudanças só no dashboard (`index.html`, `app.js`, `styles.css`, `config.js`): `git commit` + `git push`, e o GitHub Pages atualiza em ~1 minuto.
O GitHub Pages deixa o navegador guardar os arquivos por até 10 minutos. Para todo mundo receber a versão nova na hora, aumente o número `?v=` nas linhas de `styles.css`, `config.js` e `app.js` do `index.html` (ex.: `?v=2` → `?v=3`). Para ver a mudança só no seu navegador, recarregue com `Cmd+Shift+R`.

## 13. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Token inválido" | Token digitado errado ou trocado | Copie de novo em **💍 Casamento → Mostrar token** |
| "Configure a URL da API em config.js" | `apiUrl` vazio, ou o navegador ainda usa o `config.js` antigo (cache de até 10 min do GitHub Pages) | Passo 7; depois recarregue com `Cmd+Shift+R` |
| "Não foi possível carregar os dados (Failed to fetch)" | Implantação sem acesso "Qualquer pessoa", ou URL `/dev` em vez de `/exec` | Refaça o passo 6 e use a URL `/exec` |
| Mudei a planilha e o dashboard não mudou | Ainda não atualizou | Clique em **↻ Atualizar** (ele também atualiza sozinho a cada 5 min) |
| Mudei o `Api.gs` e nada mudou | Implantação ainda na versão antiga | Passo 12 |
| Item aparece com "Item não cadastrado na aba Itens" | Pagamento com nome de item que não existe em Itens | Cadastre o item ou corrija o nome |
| Erro "Exception: ... permission" ao abrir a API | Autorização expirou | Rode qualquer função no editor e autorize de novo |
