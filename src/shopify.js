// Legge gli ordini degli ultimi N giorni dallo Shopify Admin API e calcola
// i prodotti più venduti (best seller), perché il piano Shopify di base non
// espone un endpoint "bestsellers" diretto: va derivato dagli order line items.

const API_VERSION = "2024-10";

function shopifyUrl(path) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN; // es: antoniotti-autoricambi.myshopify.com
  return `https://${domain}/admin/api/${API_VERSION}/${path}`;
}

async function shopifyFetch(path) {
  const res = await fetch(shopifyUrl(path), {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status} su ${path}: ${await res.text()}`);
  }
  return res.json();
}

export async function getBestSellingProducts({ days = 30, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const soldQtyByProductId = new Map();

  let path = `orders.json?status=any&created_at_min=${since}&limit=250&fields=id,line_items`;
  while (path) {
    const data = await shopifyFetch(path);
    for (const order of data.orders ?? []) {
      for (const item of order.line_items ?? []) {
        if (!item.product_id) continue;
        const prev = soldQtyByProductId.get(item.product_id) ?? 0;
        soldQtyByProductId.set(item.product_id, prev + item.quantity);
      }
    }
    path = null; // niente paginazione cursor-based per restare semplici: 250 ordini/30gg bastano per un negozio di questa scala
  }

  const rankedIds = [...soldQtyByProductId.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const products = [];
  for (const id of rankedIds) {
    const { product } = await shopifyFetch(
      `products/${id}.json?fields=id,title,handle,body_html,images,variants`
    );
    if (!product?.images?.length) continue; // niente immagine, niente post
    products.push({
      id: product.id,
      title: product.title,
      handle: product.handle,
      price: product.variants?.[0]?.price,
      imageUrl: product.images[0].src,
      productUrl: `https://${process.env.SHOPIFY_PUBLIC_DOMAIN}/products/${product.handle}`,
      soldQty: soldQtyByProductId.get(id),
    });
  }
  return products;
}
