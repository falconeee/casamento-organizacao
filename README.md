# Casamento · Finanças

Dashboard das finanças do casamento. Os dados vêm de uma planilha Google, por uma API no Apps Script protegida por token, e a página é publicada no GitHub Pages.

- **Passo a passo de implantação e uso:** [INSTRUCOES.md](INSTRUCOES.md)
- **Ver com dados fictícios:** abra `index.html?demo` (ex.: `python3 -m http.server` e depois `http://localhost:8000/?demo`)

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html`, `styles.css`, `app.js` | Dashboard (estático, sem build, sem dependências) |
| `config.js` | URL da API (não é segredo) |
| `sample-data.json` | Dados fictícios para o modo `?demo` |
| `apps-script/Setup.gs` | Cria as abas, listas suspensas, fórmulas e formatação na planilha |
| `apps-script/Api.gs` | `doGet` que devolve o JSON (exige `?token=`) |
| `apps-script/Migracao.gs` | Dados reais migrados da planilha antiga (**fora do git**) |

Nenhum valor real nem o token ficam neste repositório.
