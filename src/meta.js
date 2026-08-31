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

export async function postToInstagram({ imageUrl, caption }) {
  const igUserId = process.env.META_IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  const { id: creationId } = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

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

  return graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
}

export async function postToFacebook({ imageUrl, caption }) {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  return graphPost(`${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: accessToken,
  });
}
