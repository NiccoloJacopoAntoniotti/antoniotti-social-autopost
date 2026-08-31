# Social autopost — Antoniotti Autoricambi

Pubblica in automatico 4 contenuti a settimana (lun/mer/ven/dom, 08:00 UTC) su
Instagram (feed + storia) e Facebook, senza alcuna approvazione manuale. Vedi
`.github/workflows/social-autopost.yml`.

Ogni esecuzione:
1. Legge i prodotti più venduti negli ultimi 30 giorni dallo Shopify Admin API
   (3 post su 4 in media), oppure pesca un fornitore/servizio da
   `config/suppliers.json` (1 post su 4).
2. Evita di ripetere lo stesso prodotto/fornitore per 45 giorni
   (`data/posted-history.json`, aggiornato e committato automaticamente ad
   ogni run).
3. Genera la caption in italiano con Claude, con CTA verso WhatsApp.
4. Pubblica la foto + caption sul feed Instagram, la stessa foto come storia
   Instagram, e la foto + caption sulla Pagina Facebook.

Nota: le storie su **Facebook** (a differenza di Instagram) non hanno
un'API pubblica affidabile per la pubblicazione automatica di terze parti,
quindi su Facebook viene pubblicato solo il post normale, non la storia.

## Setup una tantum (da fare tu, non automatizzabile)

Queste operazioni richiedono i tuoi login/account: nessuno può farle al posto
tuo, ma vanno fatte una sola volta.

### 1. Shopify — token Admin API
- Shopify admin → Impostazioni → App e canali di vendita → **Sviluppa app**
- Crea una nuova app privata, scope `read_orders` + `read_products`
- Installa l'app e copia l'**Admin API access token**

### 2. Meta — Pagina Facebook + Instagram Business collegati
- L'account Instagram deve essere di tipo **Business/Creator** e collegato
  alla Pagina Facebook del negozio (Impostazioni Pagina → Account collegati)
- Vai su [developers.facebook.com](https://developers.facebook.com) → crea
  un'app di tipo "Business"
- In **Graph API Explorer**, seleziona l'app, la Pagina, e genera un token
  utente con i permessi: `pages_manage_posts`, `pages_read_engagement`,
  `instagram_basic`, `instagram_content_publish`, `pages_show_list`
- Scambia il token utente con un **long-lived Page Access Token** (dura ~60
  giorni e va rinnovato, oppure creando un System User in Business Manager
  ottieni un token che non scade)
- Recupera `META_PAGE_ID` (dalla Pagina) e `META_IG_USER_ID` (endpoint
  `GET /{page-id}?fields=instagram_business_account`)

### 3. Configura i secrets su GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret,
per ognuna delle chiavi elencate in testa a
`.github/workflows/social-autopost.yml`.

### 4. Fornitori/servizi da sponsorizzare
Compila `config/suppliers.json` con le voci reali (immagine, titolo,
descrizione). Mandami le foto/dati dei fornitori che vuoi includere e le
aggiungo io.

## Test manuale
Dalla tab **Actions** del repo → "Social autopost" → **Run workflow**, per
lanciare una pubblicazione subito senza aspettare il cron.

Per testare in locale senza pubblicare per sbaglio, commenta le righe
`postToInstagram`/`postToFacebook` in `src/index.js` e lascia solo i log.
