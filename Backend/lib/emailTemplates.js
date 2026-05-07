/**
 * Email Template Builder — Order Confirmation
 * ─────────────────────────────────────────────
 * Pure function: takes an order object, returns { subject, html }.
 * Decoupled from sending logic so it can be used by both the
 * queue worker and the legacy inline path.
 */

/**
 * Escape HTML special characters to prevent XSS in email content.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a human-readable size breakdown from order items.
 * Groups items by SKU and merges size allocations.
 * @param {Array} items - Raw order items
 * @param {number} [targetQty] - Expected total quantity
 * @returns {string}
 */
function buildSizeBreakdown(items, targetQty = 0) {
  const buckets = new Map();
  let trackedQty = 0;

  for (const item of items) {
    const sizeLabel = String(item.allocatedSize || item.size || '').trim();
    const qty = Number(item.quantity) || 0;
    if (!sizeLabel || qty <= 0) continue;
    const key = sizeLabel.toUpperCase();
    const existing = buckets.get(key) || { label: sizeLabel, qty: 0 };
    existing.qty += qty;
    buckets.set(key, existing);
    trackedQty += qty;
  }

  const parts = Array.from(buckets.values()).map((e) => `${e.label}(${e.qty})`);
  const missing = Math.max(0, (Number(targetQty) || 0) - trackedQty);
  if (missing > 0) parts.push(`Unspecified(${missing})`);
  if (parts.length === 0 && targetQty > 0) return `Unspecified(${targetQty})`;
  return parts.join(', ');
}

/**
 * Consolidate raw order items into display-ready rows.
 * Lot items are grouped by SKU into a single display line.
 * @param {Array} orderItems
 * @returns {Array<{ name, sku, sizeDisplay, quantity, unitPrice, lineTotal }>}
 */
function buildEmailDisplayItems(orderItems) {
  const groups = new Map();
  for (const item of orderItems || []) {
    const sku = String(item.sku || '').trim();
    if (!sku) continue;
    if (!groups.has(sku)) groups.set(sku, []);
    groups.get(sku).push(item);
  }

  const displayItems = [];

  for (const [sku, group] of groups.entries()) {
    if (!Array.isArray(group) || group.length === 0) continue;

    const explicitLot = group.find(
      (i) => Boolean(i.lotItem) || String(i.lotSizeBreakdown || '').trim().length > 0,
    );

    if (explicitLot) {
      const anchor = explicitLot;
      const unitPrice = Number(anchor.unitPrice) || 0;
      const quantity =
        Number(anchor.maxStock) > 0
          ? Math.floor(Number(anchor.maxStock))
          : group.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

      let sizeBreakdown =
        group.map((i) => String(i.lotSizeBreakdown || '').trim()).find((s) => s.length > 0) || '';
      if (!sizeBreakdown) sizeBreakdown = buildSizeBreakdown(group, quantity);

      displayItems.push({
        name: String(anchor.name || '').trim(),
        sku,
        sizeDisplay: `LOT: ${sizeBreakdown || `Unspecified(${quantity || 0})`}`,
        quantity,
        unitPrice,
        lineTotal: +(Number(anchor.lineTotal || unitPrice * quantity)).toFixed(2),
      });
      continue;
    }

    // Regular (non-lot) items
    const quantity = group.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const lineTotal = +group.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0).toFixed(2);
    const unitPriceSet = new Set(group.map((i) => (Number(i.unitPrice) || 0).toFixed(4)));
    const unitPrice = unitPriceSet.size === 1 ? Number(group[0].unitPrice) || 0 : null;

    displayItems.push({
      name: String(group[0].name || '').trim(),
      sku,
      sizeDisplay: buildSizeBreakdown(group, quantity) || '—',
      quantity,
      unitPrice,
      lineTotal,
    });
  }

  return displayItems;
}

/**
 * Build the full order confirmation email.
 * @param {object} order - Mongoose order document (lean or hydrated)
 * @returns {{ subject: string, html: string, displayedTotal: number }}
 */
function buildOrderConfirmationEmail(order) {
  const adminEmail = process.env.CONTACT_EMAIL_TO || 'uksportswarehouse@googlemail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'sales@oxfordsports.online';
  const displayItems = buildEmailDisplayItems(order.items || []);
  const displayedTotal = +displayItems
    .reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0)
    .toFixed(2);

  const itemRows = displayItems
    .map((i) => {
      const unitPriceDisplay =
        i.unitPrice === null ? 'Varies' : `£${Number(i.unitPrice || 0).toFixed(2)}`;
      return `<tr>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:14px;color:#1f2937;font-weight:600;">${escapeHtml(i.name)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#374151;">${escapeHtml(i.sku)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#374151;">${escapeHtml(i.sizeDisplay)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#111827;text-align:center;">${Number(i.quantity || 0)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#111827;text-align:right;">${unitPriceDisplay}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f2d5c;text-align:right;font-weight:700;">£${Number(i.lineTotal || 0).toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const customerName = escapeHtml(order.customerName || 'Customer');
  const customerEmail = escapeHtml(order.customerEmail || '—');
  const customerCompany = escapeHtml(order.customerCompany || '—');
  const customerPhone = escapeHtml(order.customerPhone || '—');
  const deliveryAddress = escapeHtml(order.deliveryAddress || '—');
  const notes = String(order.notes || '').trim();

  const html = `
    <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:760px;margin:0 auto;padding:24px 16px;">
        <div style="background:#0f2d5c;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;">Oxford Sports — Order Confirmation</h1>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.95;">Order ${escapeHtml(order.orderNumber)}</p>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <div>
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;">Order Number</p>
              <p style="margin:4px 0 0 0;font-size:15px;color:#0f2d5c;font-weight:700;">${escapeHtml(order.orderNumber)}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;">Order Date</p>
              <p style="margin:4px 0 0 0;font-size:15px;color:#111827;font-weight:700;">${new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <h3 style="margin:0 0 10px 0;font-size:14px;color:#0f2d5c;">Customer Details</h3>
            <p style="margin:4px 0;font-size:13px;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Email:</strong> ${customerEmail}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Company:</strong> ${customerCompany}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Phone:</strong> ${customerPhone}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Delivery Address:</strong> ${deliveryAddress}</p>
            ${notes ? `<p style="margin:8px 0 0 0;font-size:13px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px;">
            <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <h3 style="margin:0;font-size:14px;color:#0f2d5c;">Order Items</h3>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">Product</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">SKU</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">Size Breakdown</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">Unit Price</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">Line Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
            <div style="min-width:240px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Order Total</p>
              <p style="margin:0;font-size:22px;color:#0f2d5c;font-weight:800;">£${displayedTotal.toFixed(2)}</p>
            </div>
          </div>

          <div style="background:#eef6ff;border:1px solid #cfe3ff;border-radius:10px;padding:14px 16px;">
            <h3 style="margin:0 0 8px 0;font-size:14px;color:#0f2d5c;">Need Help? Contact Us</h3>
            <p style="margin:4px 0;font-size:13px;color:#1f2937;">Email: <a href="mailto:${escapeHtml(adminEmail)}" style="color:#0f2d5c;">${escapeHtml(adminEmail)}</a></p>
            <p style="margin:4px 0;font-size:13px;color:#1f2937;">Reply-to: <a href="mailto:${escapeHtml(fromEmail)}" style="color:#0f2d5c;">${escapeHtml(fromEmail)}</a></p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#374151;">For any issue with quantities or invoice, contact us and mention Order Number ${escapeHtml(order.orderNumber)}.</p>
          </div>

          <p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;text-align:center;">This is an automated confirmation from Oxford Sports.</p>
        </div>
      </div>
    </div>
  `;

  const subject = `Order ${order.orderNumber} — £${displayedTotal.toFixed(2)} — ${order.customerName}`;

  return { subject, html, displayedTotal };
}

/**
 * Build an "Order Shipped" notification email.
 * Sent when admin transitions an order to "shipped".
 * @param {object} order - Mongoose order document
 * @param {{ trackingNumber?: string, carrier?: string }} opts
 * @returns {{ subject: string, html: string }}
 */
function buildOrderShippedEmail(order, opts = {}) {
  const customerName = escapeHtml(order.customerName || 'Customer');
  const trackingNumber = escapeHtml(opts.trackingNumber || '');
  const carrier = escapeHtml(opts.carrier || 'our courier service');
  const adminEmail = process.env.CONTACT_EMAIL_TO || 'uksportswarehouse@googlemail.com';

  const trackingSection = trackingNumber
    ? `<div style="background:#f0f4f8;border:1px solid #d1dce8;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
         <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;">Tracking Number</p>
         <p style="margin:6px 0 0 0;font-size:18px;color:#0f2d5c;font-weight:800;letter-spacing:0.05em;">${trackingNumber}</p>
         <p style="margin:4px 0 0 0;font-size:13px;color:#374151;">Carrier: ${carrier}</p>
       </div>`
    : '';

  const html = `
    <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
        <div style="background:#0f2d5c;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;">📦 Your Order Has Shipped!</h1>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.95;">Order ${escapeHtml(order.orderNumber)}</p>
        </div>
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
          <p style="font-size:15px;margin:0 0 16px 0;">Hi ${customerName},</p>
          <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px 0;">
            Great news! Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been dispatched 
            and is on its way to you via ${carrier}.
          </p>
          ${trackingSection}
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;font-weight:700;">Delivery Details</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Address:</strong> ${escapeHtml(order.deliveryAddress || '—')}</p>
          </div>
          <div style="background:#eef6ff;border:1px solid #cfe3ff;border-radius:10px;padding:14px 16px;">
            <p style="margin:0;font-size:13px;color:#1f2937;">
              If you have any questions about your delivery, contact us at 
              <a href="mailto:${escapeHtml(adminEmail)}" style="color:#0f2d5c;font-weight:600;">${escapeHtml(adminEmail)}</a>
            </p>
          </div>
          <p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;text-align:center;">Oxford Sports — Thank you for your business.</p>
        </div>
      </div>
    </div>
  `;

  const subject = `Your Order ${order.orderNumber} Has Shipped! 📦`;
  return { subject, html };
}

module.exports = {
  escapeHtml,
  buildSizeBreakdown,
  buildEmailDisplayItems,
  buildOrderConfirmationEmail,
  buildOrderShippedEmail,
};
