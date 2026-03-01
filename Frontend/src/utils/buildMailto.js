/**
 * Build a mailto: link pre-filled with product order details.
 * Uses salePrice (with price fallback) as single source of truth.
 */
export function buildMailto(product) {
  const to = import.meta.env.VITE_ORDER_EMAIL || "sales@oxfordsports.net";
  const price = Number(product.salePrice) || Number(product.price) || 0;
  const sizesArr = Array.isArray(product.sizes) ? product.sizes : [];
  const sizesStr = sizesArr
    .map((s) => (typeof s === "object" ? `${s.size}(${s.quantity})` : s))
    .join(", ");
  const subject = encodeURIComponent(
    `Order Enquiry – ${product.name} [${product.sku}]`,
  );
  const body = encodeURIComponent(
    `Hi Oxford Sports,\n\nI would like to place an order for the following item:\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku}\n` +
      `Sale Price: £${price.toFixed(2)}\n` +
      (sizesStr ? `Sizes Available: ${sizesStr}\n` : "") +
      `\nPlease send me an invoice.\n\nThank you`,
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
