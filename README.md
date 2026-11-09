# Wedding · Finances

Dashboard for the wedding finances. The data comes from a Google Sheet through a token-protected Apps Script API, and the page is published on GitHub Pages.

- **Step-by-step deployment and usage guide:** [SETUP.md](SETUP.md)
- **View with sample data:** open `index.html?demo` (e.g. `python3 -m http.server`, then `http://localhost:8000/?demo`)

## Structure

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | Dashboard (static, no build step, no dependencies) |
| `config.js` | API URL (not a secret) |
| `sample-data.json` | Sample data for `?demo` mode |
| `apps-script/Setup.gs` | Creates the tabs, dropdown lists, formulas and formatting in the spreadsheet |
| `apps-script/Api.gs` | `doGet` that returns the JSON (requires `?token=`) |
| `apps-script/Lembretes.gs` | Daily consolidated e-mail with the payments due in the next few days |
| `apps-script/Migracao.gs` | Real data migrated from the old spreadsheet (**not in git**) |

No real values and no token are stored in this repository.
