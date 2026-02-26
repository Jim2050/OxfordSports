/**
 * Build a mailto: link pre-filled with product order details.
 */
export function buildMailto(product) {
  const to = import.meta.env.VITE_ORDER_EMAIL || "sales@oxfordsports.net";
  const subject = encodeURIComponent(
    `Order Enquiry – ${product.name} [${product.sku}]`,
  );
  const body = encodeURIComponent(
    `Hi Oxford Sports,\n\nI would like to place an order for the following item:\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku}\n` +
      `Price: £${Number(product.price).toFixed(2)}\n` +
      (product.sizes ? `Sizes Available: ${product.sizes}\n` : "") +
      `\nPlease send me an invoice.\n\nThank you`,
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
