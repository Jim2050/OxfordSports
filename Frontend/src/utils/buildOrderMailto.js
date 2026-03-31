/**
 * Build a mailto: link for order confirmation
 * Opens user's email client with pre-filled order details
 */
export function buildOrderMailto(order) {
  const to = "sales@oxfordsports.online";

  const subject = encodeURIComponent(
    `Order #${order.orderNumber || order._id} - ${order.customerName}`,
  );

  // Build order items text
  const itemsList = order.items
    .map((item, idx) => {
      const lineTotal = item.lineTotal || item.unitPrice * item.quantity;
      return `${idx + 1}. ${item.name} (SKU: ${item.sku})${item.size ? ` - Size: ${item.size}` : ""}\n   Quantity: ${item.quantity} × £${item.unitPrice.toFixed(2)} = £${lineTotal.toFixed(2)}`;
    })
    .join("\n\n");

  const bodyText = `Hi Oxford Sports,

I have placed the following order:

Order ID: ${order._id}
Date: ${new Date(order.createdAt).toLocaleString("en-GB")}

CUSTOMER DETAILS
----------------
Name: ${order.customerName}
Email: ${order.customerEmail}
Company: ${order.customerCompany || "N/A"}

ORDER ITEMS
-----------
${itemsList}

TOTAL AMOUNT: £${order.totalAmount.toFixed(2)}

${order.notes ? `NOTES:\n${order.notes}\n\n` : ""}Please confirm this order and send me an invoice.

Thank you`;

  const body = encodeURIComponent(bodyText);

  return `mailto:${to}?subject=${subject}&body=${body}`;
}
