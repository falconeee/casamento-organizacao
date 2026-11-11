# Deployment guide — Wedding dashboard 💍

Step by step to reorganize the spreadsheet, publish the API on Google Apps Script and put the dashboard online on GitHub Pages.
Estimated time: 30–40 minutes the first time.

```
Google Sheet  ──(Apps Script reads the tabs)──►  JSON API (/exec?token=...)  ◄──fetch──  Dashboard (GitHub Pages)
```

- **Spreadsheet**: where you keep entering everything.
- **API (Apps Script)**: returns the spreadsheet data as JSON, only to whoever has the token.
- **Dashboard (GitHub Pages)**: static page that calls the API every time it opens (and every 5 minutes).

> The spreadsheet, its tabs, menus and dropdown values are in Portuguese. Those labels are quoted below exactly as they appear (e.g. `Itens`, `Pagamentos`, `A pagar`, `💍 Casamento`).

---

## 1. Prerequisites

- Google account with **edit** permission on the spreadsheet.
- A [GitHub](https://github.com) account.
- `git` installed on the Mac (it already is if `git --version` works in Terminal).

## 2. Back up the spreadsheet

In the spreadsheet: **File → Make a copy**. Keep that copy. The setup does not delete anything (the old tab is only renamed), but the backup makes sure.

## 3. Paste the scripts into Apps Script

1. In the spreadsheet, open **Extensions → Apps Script**.
2. There is already a file named `Código.gs` (`Code.gs`). Rename it to `Setup` (click the ⋮ next to the name → Rename) and replace its whole content with [`apps-script/Setup.gs`](apps-script/Setup.gs).
3. Click **+ → Script**, create the file `Migracao` and paste the content of `apps-script/Migracao.gs`.
   > This file holds the real data and does **not** go to GitHub. It only exists in the local project folder.
4. Click **+ → Script**, create the file `Api` and paste the content of [`apps-script/Api.gs`](apps-script/Api.gs).
   Do the same for `Lembretes` with [`apps-script/Lembretes.gs`](apps-script/Lembretes.gs) (e-mail reminders; see section 14).
5. Save (floppy-disk icon or `Cmd+S`).
6. (Recommended) In **⚙️ Project settings**, set the **Time zone** to `(GMT-03:00) São Paulo`.

## 4. Run the setup (only once)

1. At the top of the editor, in the function selector, choose **`setupPlanilha`** and click **▶ Run**.
2. Google will ask for authorization: **Review permissions → choose your account → "Google hasn't verified this app" → Advanced → Go to (unsafe) → Allow**.
   This is expected: the "app" is your own script.
3. When it finishes, the **Execution log** shows: `Setup concluído. Token da API: XXXXXXXX...`. **Copy that token.**
4. Go back to the spreadsheet and reload the page. You will see:
   - **`Itens`** (items): one item/contract per row (Group, Supplier, Status, Amount). The grey columns (Paid, Scheduled, Left to schedule, % paid) are computed automatically. The last column, **Contrato**, holds links to the signed contracts (see section 15).
   - **`Pagamentos`** (payments): one row per payment or installment, with due date, who pays, method and status.
   - **`Config`**: wedding date, names and maximum budget (optional).
   - **`Listas`** (lists): options for the dropdown lists.
   - **`Casamento (backup)`**: the old tab, untouched. The **`Apê`** tab is not changed.
   - A new **💍 Casamento** menu (show or rotate the token).
5. In the **`Config`** tab, fill in the **wedding date** (`Data do casamento`, dd/mm/yyyy) to enable the countdown.

> If you run `setupPlanilha` again, it stops with an error on purpose so that data is not duplicated. To start over, delete the `Itens`, `Pagamentos`, `Config` and `Listas` tabs and rename "Casamento (backup)" back to "Casamento".

## 5. Review the migration ⚠️

Some information in the old spreadsheet was free text and required assumptions:
- Monthly installments start 1 month after the down payment, on the same day, and the ones already due were entered as "Pago" (paid).
- Unknown dates were left blank.
- Items with an amount and no payment were set to "Orçamento" (quote).

In the **`Pagamentos`** tab, filter the **Obs** column by "⚠" and fix what is needed. The detailed list, item by item, is in the local file **`REVISAO-MIGRACAO.md`**. It does not go to GitHub because it contains real amounts.

## 6. Publish the API

1. In the Apps Script editor: **Deploy → New deployment**.
2. Under "Select type" (⚙️), choose **Web app**.
3. Fill in:
   - Description: `API dashboard`
   - **Execute as: Me** (your e-mail)
   - **Who has access: Anyone**
4. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Test it in the browser: open `APP_URL?token=YOUR_TOKEN`. You should see JSON starting with `{"ok":true,...`.
   Without the token (or with a wrong one), the result must be `{"ok":false,"error":"unauthorized"}`.

> "Anyone" is required so that GitHub Pages can call the API. Protection comes from the token: without it, the API returns no data.

## 7. Configure the dashboard

Edit [`config.js`](config.js) and paste the URL:

```js
window.DASHBOARD_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  atualizarACadaMinutos: 5,
};
```

To test locally: run `python3 -m http.server 8000` in the project folder and open `http://localhost:8000`.
To see only the layout with sample data: `http://localhost:8000/?demo`.

## 8. Publish on GitHub Pages

1. On GitHub, create a new repository (e.g. `casamento-organizacao`) **without** a README.
   > Free GitHub Pages requires a **public** repository. There is no data in the code: the amounts live only in the spreadsheet, and `Migracao.gs` is in `.gitignore`.
2. In Terminal, in the project folder:
   ```bash
   git remote add origin https://github.com/YOUR_USER/casamento-organizacao.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
4. Within 1–2 minutes the site is live at `https://YOUR_USER.github.io/casamento-organizacao/`.

## 9. First access and sharing with your partner

- On each device, open the link with the token at the end once:
  `https://YOUR_USER.github.io/casamento-organizacao/#token=YOUR_TOKEN`
  The token is saved in the browser and disappears from the address bar. After that, the plain link is enough.
- Send that `#token=` link to your partner through a private conversation.
- You can also open the plain link and paste the token on the access screen.
- On a phone: **Share → Add to Home Screen** to get an "app".
- The **Sair** (sign out) button at the top forgets the token on that device.

## 10. Security

- **Turn off the spreadsheet's public link**: in the spreadsheet, click **Share → General access → Restricted** and keep only the two of you as editors. The dashboard keeps working, because the API runs under your account.
- **Rotate the token** (if the link leaks): in the spreadsheet, **💍 Casamento → Gerar novo token**. The old token stops working immediately, and you need to open the link with the new `#token=` again.
- Never put the token in `config.js` or in any file in the repository.

## 11. Day-to-day use

**New supplier/item**
1. **`Itens`** tab: fill in Item (unique name), Group, Supplier, Status and Amount.
2. Status: **A definir** (still researching) → **Orçamento** (has a price, not closed) → **Contratado** (signed). Use **Cancelado** if you give up on it. "Quitado" (paid off) appears automatically on the dashboard when the paid amount reaches the total.

**New payment**
1. **`Pagamentos`** tab: one row per payment. Pick the **Item** from the list and fill in Due date, Amount, Who pays, Method and Status.
2. Installments via PIX/bank slip: **one row per installment** (Description "Parcela 1/10", "Parcela 2/10"...). Tip: fill in the first row, copy it down and adjust dates and descriptions.
3. Credit card: **a single row**, with the total amount and status **Pago** (the supplier has already been paid). Note the card installments in Obs.

**Paid an installment?** Change the Status from "A pagar" (to pay) to **Pago**. Rows that are overdue and still "A pagar" turn red, and those due within 30 days turn yellow.

**Signed a contract?** Upload the PDF to the contracts folder in Drive and link it in the item's **Contrato** column (see section 15).

**Renaming an item:** use **Edit → Find and replace** across all tabs, because the name is what links `Itens` and `Pagamentos`.

**New dropdown options** (another group, payment method...): add them at the end of the matching column in the **`Listas`** tab.

## 12. Updating the API code

When you edit `Api.gs` or `Setup.gs` in Apps Script, the `/exec` URL keeps serving the old version until you publish a new one:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL does not change.

Changes to the dashboard only (`index.html`, `app.js`, `styles.css`, `config.js`): `git commit` + `git push`, and GitHub Pages updates in ~1 minute.
GitHub Pages lets the browser cache files for up to 10 minutes. For everyone to get the new version right away, bump the `?v=` number on the `styles.css`, `config.js` and `app.js` lines of `index.html` (e.g. `?v=2` → `?v=3`). To see the change only in your browser, reload with `Cmd+Shift+R`.

## 13. Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| "Token inválido" (invalid token) | Token mistyped or rotated | Copy it again from **💍 Casamento → Mostrar token** |
| "Configure a URL da API em config.js" | Empty `apiUrl`, or the browser still uses the old `config.js` (GitHub Pages caches for up to 10 min) | Step 7; then reload with `Cmd+Shift+R` |
| "Não foi possível carregar os dados (Failed to fetch)" | Deployment without "Anyone" access, or a `/dev` URL instead of `/exec` | Redo step 6 and use the `/exec` URL |
| I changed the spreadsheet and the dashboard did not change | Not refreshed yet | Click **↻ Atualizar** (it also refreshes itself every 5 min) |
| I changed `Api.gs` and nothing changed | Deployment still on the old version | Step 12 |
| Item shows "Item não cadastrado na aba Itens" | Payment with an item name that does not exist in `Itens` | Add the item or fix the name |
| "Exception: ... permission" error when opening the API | Authorization expired | Run any function in the editor and authorize again |
| Reminder did not arrive | Trigger not enabled, no payment on the configured day, or it went to spam | Run **Enviar e-mail de teste**; check the days in the `Config` tab and the spam folder |

## 14. E-mail reminders 📧

Every day, around 8 a.m., the script looks for **"A pagar"** payments due in N days and sends **a single e-mail** with all of them, grouped by date. Two payments on the same day (or on different days that fall in the same reminder) become one e-mail. If there are overdue payments still marked "A pagar", they show up in a warning at the end of the e-mail.

**To enable it (once):**
1. In Apps Script, create the file `Lembretes` (**+ → Script**) and paste the content of [`apps-script/Lembretes.gs`](apps-script/Lembretes.gs).
2. Replace the content of `Setup` with the current version of [`apps-script/Setup.gs`](apps-script/Setup.gs), which adds the new menu items. Save.
3. Reload the spreadsheet. In the **💍 Casamento** menu, click **Ativar lembretes por e-mail**.
   Google asks for authorization again, now to **send e-mail as you** and **run in the background**: Advanced → Go to → Allow.
4. The **`Config`** tab gets 3 new rows. Adjust them:
   - **E-mails para lembretes** (reminder e-mails): starts with your e-mail; add your partner's, separated by a comma.
   - **Lembrar com quantos dias** (days before): default `3, 1` (3 days before and the day before). Use `0` to be reminded on the day itself. E.g. `7, 3, 1, 0`.
   - **Link do dashboard**: the GitHub Pages address, used by the "Abrir dashboard" button in the e-mail.
5. Click **💍 Casamento → Enviar e-mail de teste** to see what it looks like. It uses the next 2 dates with payments, without waiting for the right day.

**Details:**
- An e-mail is sent only when there is something to remind, and at most one per day.
- The e-mails come from your Google account (sender "Casamento 💍"). Gmail's free limit is 100 recipients per day, far above what is needed.
- After paying, change the status to **Pago**: the payment drops out of the next reminders.
- To stop: **💍 Casamento → Desativar lembretes**.
- There is no need to create a new API deployment: the reminder runs directly in the spreadsheet, not through the Web app.

## 15. Signed contracts 📄

The contract files stay in **Google Drive**. The spreadsheet keeps only a link, and the dashboard shows a document icon next to the item that opens the file.

**Why Drive:**
- The repository is public, so files cannot go to GitHub.
- The links only reach the dashboard through the API, which requires the token.
- Even if a link leaks, Drive asks for a login with one of the accounts the folder is shared with.

**Setup (once):**
1. In Drive, create a folder (e.g. `Casamento – Contratos`). Click **Share**:
   - add your partner as **Editor**;
   - keep **General access: Restricted**. Files inside the folder inherit this.
2. In Apps Script, replace the content of `Setup` and `Api` with the current [`apps-script/Setup.gs`](apps-script/Setup.gs) and [`apps-script/Api.gs`](apps-script/Api.gs). Save.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (the URL does not change).
4. Reload the spreadsheet. The **Contrato** column is created at the end of the `Itens` tab automatically (only the first time).

**Linking a contract:** upload the PDF to the folder and, in the item's **Contrato** cell, use one of these:
- paste the file link (**Share → Copy link**);
- type a name (e.g. `Contrato assinado`), select it and press **Ctrl+K** / **Cmd+K** to attach the link. The name is shown on the dashboard;
- type **@** and pick the file (smart chip).

More than one file in the same cell (contract + amendment) also works: use one hyperlink per piece of text, or paste the links separated by spaces. Only `https://` links are accepted.

If a smart chip does not show up on the dashboard, use a pasted link or Ctrl+K instead.

On the dashboard:
- the icon next to the item opens the first file;
- expanding the item lists every file;
- items marked **Contratado** with no file show "Contrato assinado não anexado".
