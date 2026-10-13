// Pubblicazione su Instagram Business + Facebook Page via Meta Graph API.
// Richiede un Page Access Token di lunga durata con permessi:
// pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, pages_show_list

const GRAPH_VERSION = "v21.0";

function graphUrl(path) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

async function graphPost(path, body) {
  const res = await fetch(graphUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta Graph API error su ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function graphGet(path) {
  const res = await fetch(graphUrl(path));
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta Graph API error su ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Instagram scarica ed elabora l'immagine in background dopo la creazione del
// "contenitore": bisogna aspettare che status_code sia FINISHED prima di
// poter chiamare media_publish, altrimenti Meta risponde con errore 9007.
async function waitUntilMediaReady(creationId, accessToken, { retries = 10, delayMs = 3000 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { status_code } = await graphGet(
      `${creationId}?fields=status_code&access_token=${accessToken}`
    );
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") {
      throw new Error(`Instagram non è riuscito a elaborare il contenuto multimediale (creation id ${creationId})`);
    }
    await sleep(delayMs);
  }
  throw new Error(`Il contenuto multimediale non è pronto dopo ${retries} tentativi (creation id ${creationId})`);
}

export async function postToInstagram({ imageUrl, caption }) {
  const igUserId = process.env.META_IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  const { id: creationId } = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

  await waitUntilMediaReady(creationId, accessToken);

  return graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
}

export async function postToInstagramStory({ imageUrl }) {
  const igUserId = process.env.META_IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  const { id: creationId } = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: accessToken,
  });

  await waitUntilMediaReady(creationId, accessToken);

  return graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
}

// Il token dell'utente di sistema funziona per le API Instagram, ma per
// pubblicare "come" la Pagina Facebook serve il suo Page Access Token
// specifico, ottenibile scambiando il token dell'utente di sistema.
async function getPageAccessToken(pageId, systemUserToken) {
  const { access_token } = await graphGet(
    `${pageId}?fields=access_token&access_token=${systemUserToken}`
  );
  return access_token;
}

export async function postToFacebook({ imageUrl, caption }) {
  const pageId = process.env.META_PAGE_ID;
  const pageAccessToken = await getPageAccessToken(pageId, process.env.META_PAGE_ACCESS_TOKEN);

  return graphPost(`${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: pageAccessToken,
  });
}

// ---------------------------------------------------------------------------
// Contenuti "straordinari" (lancio nuovo sito): carosello e post multi-foto.
// ---------------------------------------------------------------------------

// Carosello Instagram: ogni slide è un "contenitore figlio" da elaborare
// prima di creare il contenitore padre (media_type CAROUSEL). Tutte le slide
// devono avere le stesse proporzioni della prima (qui 4:5, 1080x1350).
export async function postToInstagramCarousel({ imageUrls, caption }) {
  const igUserId = process.env.META_IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  const children = [];
  for (const imageUrl of imageUrls) {
    const { id } = await graphPost(`${igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: accessToken,
    });
    await waitUntilMediaReady(id, accessToken);
    children.push(id);
  }

  const { id: creationId } = await graphPost(`${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: accessToken,
  });
  await waitUntilMediaReady(creationId, accessToken);

  return graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
}

export async function getInstagramPermalink(mediaId) {
  const { permalink } = await graphGet(
    `${mediaId}?fields=permalink&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
  );
  return permalink;
}

// Post Facebook con più foto: ogni foto si carica come "non pubblicata" e poi
// si allegano tutte a un unico post sul feed della Pagina.
export async function postToFacebookMultiPhoto({ imageUrls, caption }) {
  const pageId = process.env.META_PAGE_ID;
  const pageAccessToken = await getPageAccessToken(pageId, process.env.META_PAGE_ACCESS_TOKEN);

  const photoIds = [];
  for (const imageUrl of imageUrls) {
    const { id } = await graphPost(`${pageId}/photos`, {
      url: imageUrl,
      published: false,
      access_token: pageAccessToken,
    });
    photoIds.push(id);
  }

  return graphPost(`${pageId}/feed`, {
    message: caption,
    attached_media: photoIds.map((id) => ({ media_fbid: id })),
    access_token: pageAccessToken,
  });
}
