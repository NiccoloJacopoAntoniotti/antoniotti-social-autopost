# Social autopost — Antoniotti Autoricambi

Pubblica in automatico 4 contenuti a settimana (lun/mer/ven/dom, 08:00 UTC) su
Instagram (feed + storia) e Facebook, senza alcuna approvazione manuale. Vedi
`.github/workflows/social-autopost.yml`.

Il negozio non ha ordini reali su Shopify (è una vetrina, si vende via
WhatsApp), quindi non esiste un concetto di "best seller". I contenuti
vengono pescati dalle **collezioni in evidenza** del catalogo (elenco handle
in `src/shopify.js`, costante `FEATURED_COLLECTION_HANDLES`) — usano le foto
prodotto reali già caricate sul sito, niente da caricare a mano né rischi di
copyright.

Ogni esecuzione:
1. Legge i prodotti (con foto) dalle collezioni in evidenza su Shopify.
2. Evita di ripetere lo stesso prodotto per 45 giorni
   (`data/posted-history.json`, aggiornato e committato automaticamente ad
   ogni run).
3. Genera la caption in italiano con Claude, con CTA verso WhatsApp.
4. Pubblica la foto + caption sul feed Instagram e sulla Pagina Facebook.
5. Genera una versione della foto per la **storia Instagram** con logo,
   titolo prodotto e numero WhatsApp sovrapposti (`src/storyImage.js`),
   la salva in `data/story-image.jpg` e la committa/pusha nel repo — serve
   perché l'API di Instagram richiede un URL pubblico per il contenuto, e
   `raw.githubusercontent.com` lo fornisce gratis per i repo pubblici
   (**per questo il repo deve restare pubblico**: non contiene alcun
   segreto, quelli sono solo nei GitHub Secrets).

Nota: le storie su **Facebook** (a differenza di Instagram) non hanno
un'API pubblica affidabile per la pubblicazione automatica di terze parti,
quindi su Facebook viene pubblicato solo il post normale, non la storia.

Nota 2: se cambia il nome utente/repo GitHub, aggiorna la costante `REPO`
in `src/index.js` (usata per costruire l'URL pubblico dell'immagine storia).

## Setup una tantum (da fare tu, non automatizzabile)

Queste operazioni richiedono i tuoi login/account: nessuno può farle al posto
tuo, ma vanno fatte una sola volta.

### 1. Shopify — token Admin API
Le nuove app custom (create dalla Dev Dashboard di Shopify) richiedono uno
scambio OAuth per ottenere un vero Admin API token (il "Token di
automazione dell'app" mostrato nell'interfaccia serve solo per il CLI, NON
funziona per le chiamate API):
- Crea un'app sulla Dev Dashboard con scope `read_products` (e installala
  sul negozio)
- Genera il token con:
  `https://TUO-NEGOZIO.myshopify.com/admin/oauth/authorize?client_id=CLIENT_ID&scope=read_products&redirect_uri=https://example.com/callback&state=xyz`
  (apri il link, prendi il `code` dall'URL di redirect anche se la pagina
  finale dà errore, poi scambialo con
  `curl -X POST https://TUO-NEGOZIO.myshopify.com/admin/oauth/access_token -d client_id=CLIENT_ID -d client_secret=CLIENT_SECRET -d code=CODE`)
- Il valore `access_token` nella risposta (`shpat_...`) è il vero token da
  usare

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

### 4. Aggiungere/togliere collezioni da cui pescare
Modifica l'array `FEATURED_COLLECTION_HANDLES` in `src/shopify.js` con gli
handle delle collezioni Shopify da includere (si vedono nell'URL, es.
`.../collections/NOME-QUI` → handle è `NOME-QUI`).

### 5. Aggiungere contenuti "al volo" senza toccare il codice
C'è una collezione apposta, **"Social - In evidenza"** (handle
`social-in-evidenza`), pensata per buttarci dentro qualsiasi prodotto/foto
senza doverlo legare a un brand specifico:
- Crea il prodotto su Shopify (titolo, foto, prezzo)
- Impostalo in **Stato: Bozza** (o togli la spunta al canale "Negozio
  online") se non vuoi che sia visibile/acquistabile sul sito pubblico —
  resta comunque letto dal bot, perché usa l'Admin API
- Assegnalo alla collezione "Social - In evidenza"

Il prossimo run del bot può pescarlo, senza nessun intervento sul codice.

## Test manuale
Dalla tab **Actions** del repo → "Social autopost" → **Run workflow**, per
lanciare una pubblicazione subito senza aspettare il cron.

Per testare in locale senza pubblicare per sbaglio, commenta le righe
`postToInstagram`/`postToFacebook` in `src/index.js` e lascia solo i log.
