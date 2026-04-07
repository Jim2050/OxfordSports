const Order = require("../models/Order");
const Product = require("../models/Product");
const { getEmailQueue } = require("../utils/emailQueue");
const crypto = require("crypto");

const inFlightOrderFingerprints = new Set();

function buildOrderFingerprint(userId, items, notes) {
  const normalizedItems = [...(Array.isArray(items) ? items : [])]
    .map((item) => ({
      sku: String(item?.sku || "").trim().toUpperCase(),
      size: String(item?.size || "").trim(),
      quantity: Number(item?.quantity) || 0,
      maxStock: Number(item?.maxStock) || 0,
      lotItem: Boolean(item?.lotItem),
    }))
    .sort((a, b) =>
      `${a.sku}|${a.size}`.localeCompare(`${b.sku}|${b.size}`),
    );

  const payload = `${String(userId || "")}|${String(notes || "").trim()}|${JSON.stringify(normalizedItems)}`;
  return crypto.createHash("sha1").update(payload).digest("hex");
}

// ══════════════════════════════════════════
//  Member: Place an order (from cart)
// ══════════════════════════════════════════

/**
 * POST /api/orders
 * Body: { items: [{ sku, size, quantity }], notes? }
 * Protected — req.user must be authenticated.
 */
exports.placeOrder = async (req, res) => {
  let requestFingerprint = "";
  try {
    const { items, notes } = req.body;
    const STOCK_CONFLICT_CODE = "STOCK_CONFLICT";

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must contain at least one item." });
    }

    requestFingerprint = buildOrderFingerprint(req.user?._id, items, notes);
    if (inFlightOrderFingerprints.has(requestFingerprint)) {
      return res.status(429).json({
        error: "Duplicate order request detected. Please wait for the current submission to finish.",
      });
    }
    inFlightOrderFingerprints.add(requestFingerprint);

    const orderItems = [];
    const stockUpdates = [];
    const stockDebug = [];
    const lotSkus = new Set();

    const FOOTWEAR_THRESHOLD = 24;
    const DEFAULT_THRESHOLD = 100;
    const MIN_ORDER_TOTAL = 300;

    // ── BATCH FETCH ALL PRODUCTS ──
    const uniqueSkus = [...new Set(items.map((i) => i.sku?.toUpperCase()).filter(Boolean))];
    const productsList = await Product.find({ sku: { $in: uniqueSkus }, isActive: true });
    const productMap = new Map();
    productsList.forEach((p) => productMap.set(p.sku, p));

    for (const item of items) {
      if (!item.sku || !item.quantity || item.quantity < 1) {
        return res
          .status(400)
          .json({ error: `Invalid item: ${JSON.stringify(item)}` });
      }

      const product = productMap.get(item.sku.toUpperCase());

      if (!product) {
        return res
          .status(404)
          .json({
            error: `Product ${item.sku} not found.`,
            details: `Product not found in database. Check SKU spelling or if product is active.`
          });
      }

      const qty = parseInt(item.quantity);
      const isLotItem = Boolean(item.lotItem);
      const lotUnits = Number(item.maxStock);
      if (isLotItem && (!Number.isFinite(lotUnits) || lotUnits < 1)) {
        return res.status(400).json({
          error: `Invalid lot quantity for ${item.sku}.`,
        });
      }
      const effectiveQty = isLotItem ? Math.floor(lotUnits) : qty;
      const incomingSize = (item.size || "").trim();
      let size = incomingSize;

      const sizeEntries = Array.isArray(product.sizes) ? product.sizes : [];
      const hasSizeStock =
        sizeEntries.length > 0 && sizeEntries.some((s) => s.quantity > 0);
      const validLotSizes = sizeEntries.filter(
        (s) => s.quantity > 0 && String(s.size || "").trim() !== "",
      );
      const lotDisplaySizes = (validLotSizes.length > 0
        ? validLotSizes
        : sizeEntries.filter((s) => s.quantity > 0)
      ).map((s) => `${String(s.size || "").trim()}(${s.quantity})`);
      const lotSizeBreakdown = isLotItem ? lotDisplaySizes.join(", ") : "";

      stockDebug.push({
        sku: product.sku,
        name: product.name,
        requestedQty: qty,
        effectiveQty,
        lotItem: isLotItem,
        requestedSize: size || "N/A",
        hasSizeData: sizeEntries.length > 0,
        sizeEntries: sizeEntries.map((s) => ({ size: s.size, qty: s.quantity })),
        totalQuantity: product.totalQuantity,
        hasSizeStock,
      });

      if (isLotItem) {
        lotSkus.add(product.sku);
      }

      if (hasSizeStock) {
        if (isLotItem) {
          if (effectiveQty > product.totalQuantity) {
            return res.status(400).json({
              error: `Only ${product.totalQuantity} units available for ${product.name}.`,
            });
          }

          let remaining = effectiveQty;
          const allocatableSizes = (validLotSizes.length > 0
            ? validLotSizes
            : sizeEntries.filter((s) => s.quantity > 0)
          ).sort((a, b) => String(a.size).localeCompare(String(b.size)));

          for (const sizeEntry of allocatableSizes) {
            if (remaining <= 0) break;
            const takeQty = Math.min(sizeEntry.quantity, remaining);
            if (takeQty <= 0) continue;

            stockUpdates.push({
              updateOne: {
                filter: {
                  _id: product._id,
                  "sizes.size": sizeEntry.size,
                  "sizes.quantity": { $gte: takeQty },
                  totalQuantity: { $gte: takeQty },
                },
                update: {
                  $inc: { "sizes.$.quantity": -takeQty, totalQuantity: -takeQty },
                },
              },
            });
            remaining -= takeQty;
          }

          if (remaining > 0) {
            return res.status(400).json({
              error: `Only ${product.totalQuantity} units available for ${product.name}.`,
            });
          }
        } else {
        const normalizedIncomingSize = size.trim();

        let sizeEntry = sizeEntries.find((s) => s.size && s.size.trim() === normalizedIncomingSize);

        if (!sizeEntry && (!normalizedIncomingSize || normalizedIncomingSize === "")) {
          sizeEntry = sizeEntries.find((s) => String(s?.size || "").trim() !== "");
          if (sizeEntry) {
            size = sizeEntry.size;
          }
        }

        const available = sizeEntry ? sizeEntry.quantity : 0;

        if (!sizeEntry && product.totalQuantity > 0) {
          if (normalizedIncomingSize) {
            return res.status(400).json({
              error: `Out of stock for ${product.name} in size ${normalizedIncomingSize}.`,
            });
          }

          if (effectiveQty > product.totalQuantity) {
            return res.status(400).json({
              error: `Only ${product.totalQuantity} units available for ${product.name}.`,
            });
          }

          let remaining = effectiveQty;
          const allocatableSizes = (validLotSizes.length > 0
            ? validLotSizes
            : sizeEntries.filter((s) => s.quantity > 0)
          ).sort((a, b) => String(a.size).localeCompare(String(b.size)));

          for (const allocSizeEntry of allocatableSizes) {
            if (remaining <= 0) break;
            const takeQty = Math.min(allocSizeEntry.quantity, remaining);
            if (takeQty <= 0) continue;

            stockUpdates.push({
              updateOne: {
                filter: {
                  _id: product._id,
                  "sizes.size": allocSizeEntry.size,
                  "sizes.quantity": { $gte: takeQty },
                  totalQuantity: { $gte: takeQty },
                },
                update: {
                  $inc: { "sizes.$.quantity": -takeQty, totalQuantity: -takeQty },
                },
              },
            });
            remaining -= takeQty;
          }

          if (remaining > 0) {
            return res.status(400).json({
              error: `Only ${product.totalQuantity} units available for ${product.name}.`,
            });
          }
        } else if (!sizeEntry || available <= 0) {
          return res.status(400).json({
            error: `Out of stock for ${product.name}.`,
            debug: process.env.NODE_ENV === "production" ? undefined : {
              message: "No inventory available",
              availableSizes: sizeEntries.map((s) => ({ size: s.size, qty: s.quantity }))
            }
          });
        } else if (effectiveQty > available) {
          return res.status(400).json({
            error: `Only ${available} units available for ${product.name}.`,
          });
        } else {
          stockUpdates.push({
            updateOne: {
              filter: {
                _id: product._id,
                "sizes.size": sizeEntry.size,
                "sizes.quantity": { $gte: effectiveQty },
                totalQuantity: { $gte: effectiveQty },
              },
              update: {
                $inc: { "sizes.$.quantity": -effectiveQty, totalQuantity: -effectiveQty },
              },
            },
          });
        }
        }
      } else if (product.totalQuantity > 0) {
        if (effectiveQty > product.totalQuantity) {
          return res.status(400).json({
            error: `Only ${product.totalQuantity} available for ${product.name}.`,
          });
        }
        stockUpdates.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $inc: { totalQuantity: -effectiveQty } },
          },
        });
      } else {
        console.warn(
          `[ORDER] No stock info for ${product.sku}: no sizes array and totalQuantity=0. May need diagnostic.`,
        );
        return res.status(400).json({
          error: `Out of stock for ${product.name}.`,
          debug: process.env.NODE_ENV === "production"
            ? undefined
            : {
                sku: product.sku,
                totalQuantity: product.totalQuantity,
                sizes: sizeEntries.map((s) => ({ size: s.size, qty: s.quantity })),
              },
        });
      }

      const unitPrice = product.salePrice;
      const wasAllocated = !incomingSize && size && size !== incomingSize;

      orderItems.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        size,
        allocatedSize: wasAllocated ? size : "",
        quantity: effectiveQty,
        maxStock: isLotItem ? effectiveQty : undefined,
        lotItem: isLotItem,
        lotSizeBreakdown: isLotItem ? lotSizeBreakdown : "",
        unitPrice,
        lineTotal: +(unitPrice * effectiveQty).toFixed(2),
      });
    }

    let totalAmount = +orderItems
      .reduce((sum, i) => sum + i.lineTotal, 0)
      .toFixed(2);

    const skuMap = {};
    for (const oi of orderItems) {
      if (!skuMap[oi.sku]) skuMap[oi.sku] = { items: [], product: null };
      skuMap[oi.sku].items.push(oi);
    }
    for (const sku of Object.keys(skuMap)) {
      const p = productMap.get(sku.toUpperCase());
      if (p) skuMap[sku].product = p;
    }

    const LOT_CATEGORIES = ["JOB LOTS", "B GRADE", "UNDER £5"];
    for (const [sku, entry] of Object.entries(skuMap)) {
      const product = entry.product;
      if (!product) continue;
      if (lotSkus.has(product.sku)) continue;
      const cat = (product.category || "").toUpperCase();
      if (LOT_CATEGORIES.includes(cat)) continue;
      const isFootwear = cat === "FOOTWEAR";
      const threshold = isFootwear ? FOOTWEAR_THRESHOLD : DEFAULT_THRESHOLD;
      const totalQty = product.totalQuantity || 0;
      if (totalQty > 0 && totalQty < threshold) {
        const availableSizes = (product.sizes || [])
          .filter((s) => s.quantity > 0 && String(s.size || "").trim() !== "");
        const orderedSizes = new Set(entry.items.map((i) => (i.size || "").trim()));
        const missingSizeEntries = availableSizes.filter((s) => !orderedSizes.has(s.size.trim()));

        for (const sizeEntry of missingSizeEntries) {
          const missingSizeQty = sizeEntry.quantity;
          const trimmedSize = sizeEntry.size.trim();
          const unitPrice = product.salePrice;
          const lineTotal = +(unitPrice * missingSizeQty).toFixed(2);

          orderItems.push({
            product: product._id,
            sku: product.sku,
            name: product.name,
            size: trimmedSize,
            allocatedSize: "",
            lotItem: false,
            maxStock: undefined,
            lotSizeBreakdown: "",
            quantity: missingSizeQty,
            unitPrice,
            lineTotal,
          });

          stockUpdates.push({
            updateOne: {
              filter: {
                _id: product._id,
                "sizes.size": trimmedSize,
                "sizes.quantity": { $gte: missingSizeQty },
                totalQuantity: { $gte: missingSizeQty },
              },
              update: {
                $inc: { "sizes.$.quantity": -missingSizeQty, totalQuantity: -missingSizeQty },
              },
            },
          });

          entry.items.push({
            sku: product.sku,
            size: trimmedSize,
            quantity: missingSizeQty,
          });
        }
      }
    }

    totalAmount = +orderItems
      .reduce((sum, i) => sum + i.lineTotal, 0)
      .toFixed(2);

    if (totalAmount < MIN_ORDER_TOTAL) {
      return res.status(400).json({
        error: `Minimum order total is £${MIN_ORDER_TOTAL}. Your cart is £${totalAmount.toFixed(2)}.`,
      });
    }

    const stockRollbacks = [];
    try {
      for (const op of stockUpdates) {
        const result = await Product.bulkWrite([op], { ordered: true });
        if (result.modifiedCount !== 1) {
          const conflictError = new Error("Concurrent stock change detected");
          conflictError.code = STOCK_CONFLICT_CODE;
          throw conflictError;
        }
        stockRollbacks.push(op);
      }
    } catch (stockErr) {
      for (const op of stockRollbacks) {
        const rollback = JSON.parse(JSON.stringify(op));
        const inc = rollback.updateOne.update.$inc;
        for (const key of Object.keys(inc)) {
          inc[key] = -inc[key];
        }
        await Product.bulkWrite([rollback], { ordered: false }).catch(() => { });
      }

      if (stockErr.code === STOCK_CONFLICT_CODE) {
        return res.status(409).json({
          error: "Stock changed during checkout. Please review your cart and try again.",
        });
      }

      console.error(`[ORDER] Stock deduction failed: ${stockErr.message}`);
      return res.status(500).json({ error: "Stock deduction failed. Please try again." });
    }

    const order = await Order.create({
      customer: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerCompany: req.user.company || "",
      customerPhone: req.user.mobileNumber || "",
      deliveryAddress: req.user.deliveryAddress || "",
      items: orderItems,
      totalAmount,
      notes: notes || "",
    });

    // ── Send order confirmation email in background (non-blocking) ──
    let emailStatus = { sent: false };

    const emailQueue = getEmailQueue();
    emailQueue.add(() => sendOrderEmail(order))
      .then(() => {
        emailStatus.sent = true;
        Order.findByIdAndUpdate(
          order._id,
          { emailSent: true, emailSentAt: new Date(), emailError: "" },
          { returnDocument: 'after' }
        ).catch((err) => {
          console.warn(`[ORDER EMAIL] Failed to update emailSent flag: ${err.message}`);
        });
        console.log(`[ORDER EMAIL SUCCESS] Order ${order.orderNumber} emails sent`);
      })
      .catch((emailErr) => {
        emailStatus.sent = false;
        emailStatus.error = emailErr.message;
        Order.findByIdAndUpdate(
          order._id,
          { emailSent: false, emailError: emailErr.message },
          { returnDocument: 'after' }
        ).catch(() => { });
        console.error(`[ORDER EMAIL FAILED] Order ${order.orderNumber}: ${emailErr.message}`);
        // Log full order details to Railway console as backup notification
        logOrderToConsole(order);
      });

    res.status(201).json({ success: true, order, emailStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (requestFingerprint) {
      inFlightOrderFingerprints.delete(requestFingerprint);
    }
  }
};

/**
 * Log order details to console — used as fallback when email fails
 * so Jim can always find order details in Railway logs.
 */
function logOrderToConsole(order) {
  const divider = "=".repeat(70);
  const itemLines = order.items
    .map((i) => {
      const lotMeta = i.lotItem
        ? ` | LOT: ${i.lotSizeBreakdown || `Unspecified(${i.maxStock || i.quantity || 0})`}`
        : "";
      return `  • ${i.name} (${i.sku}) | Size: ${i.size || "N/A"} | Qty: ${i.quantity} | £${i.lineTotal.toFixed(2)}${lotMeta}`;
    })
    .join("\n");

  console.log(`
${divider}
[ORDER DETAILS — EMAIL FAILED, CHECK HERE]
${divider}
Order Number : ${order.orderNumber}
Date         : ${new Date(order.createdAt).toLocaleString("en-GB")}
Customer     : ${order.customerName}
Email        : ${order.customerEmail}
Company      : ${order.customerCompany || "N/A"}
Phone        : ${order.customerPhone || "N/A"}
Address      : ${order.deliveryAddress || "N/A"}

Items:
${itemLines}

TOTAL: £${order.totalAmount.toFixed(2)}
${order.notes ? `Notes: ${order.notes}` : ""}
${divider}
`);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSizeBreakdown(items, targetQty = 0) {
  const buckets = new Map();
  let trackedQty = 0;

  for (const item of items) {
    const sizeLabel = String(item.allocatedSize || item.size || "").trim();
    const qty = Number(item.quantity) || 0;
    if (!sizeLabel || qty <= 0) continue;
    const key = sizeLabel.toUpperCase();
    const existing = buckets.get(key) || { label: sizeLabel, qty: 0 };
    existing.qty += qty;
    buckets.set(key, existing);
    trackedQty += qty;
  }

  const parts = Array.from(buckets.values()).map((entry) => `${entry.label}(${entry.qty})`);
  const missingQty = Math.max(0, (Number(targetQty) || 0) - trackedQty);
  if (missingQty > 0) {
    parts.push(`Unspecified(${missingQty})`);
  }

  if (parts.length === 0 && targetQty > 0) {
    return `Unspecified(${targetQty})`;
  }

  return parts.join(", ");
}

function buildEmailDisplayItems(orderItems) {
  const groups = new Map();
  for (const item of orderItems || []) {
    const sku = String(item.sku || "").trim();
    if (!sku) continue;
    if (!groups.has(sku)) groups.set(sku, []);
    groups.get(sku).push(item);
  }

  const displayItems = [];

  for (const [sku, group] of groups.entries()) {
    if (!Array.isArray(group) || group.length === 0) continue;

    const explicitLot = group.find(
      (i) => Boolean(i.lotItem) || String(i.lotSizeBreakdown || "").trim().length > 0,
    );
    const legacyLotAnchor = group.find((i) => {
      const qty = Number(i.quantity) || 0;
      const unitPrice = Number(i.unitPrice) || 0;
      const lineTotal = Number(i.lineTotal) || 0;
      return qty === 1 && unitPrice > 0 && lineTotal > unitPrice * qty + 0.01;
    });
    const isLotGroup = Boolean(explicitLot || legacyLotAnchor);

    if (isLotGroup) {
      const anchor = explicitLot || legacyLotAnchor || group[0];
      const unitPrice = Number(anchor.unitPrice) || 0;
      const qtyFromMax =
        explicitLot && Number(explicitLot.maxStock) > 0
          ? Math.floor(Number(explicitLot.maxStock))
          : 0;
      const qtyFromLegacy =
        !qtyFromMax && legacyLotAnchor && unitPrice > 0
          ? Math.round((Number(legacyLotAnchor.lineTotal) || 0) / unitPrice)
          : 0;
      const qtyFromSum = group.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
      const quantity = qtyFromMax || (qtyFromLegacy > 0 ? qtyFromLegacy : qtyFromSum);

      let sizeBreakdown = group
        .map((i) => String(i.lotSizeBreakdown || "").trim())
        .find((s) => s.length > 0) || "";
      if (!sizeBreakdown) {
        sizeBreakdown = buildSizeBreakdown(group, quantity);
      }

      const lineTotalValue = explicitLot
        ? Number(explicitLot.lineTotal)
        : legacyLotAnchor
          ? Number(legacyLotAnchor.lineTotal)
          : unitPrice * quantity;

      displayItems.push({
        name: String(anchor.name || "").trim(),
        sku,
        sizeDisplay: `LOT: ${sizeBreakdown || `Unspecified(${quantity || 0})`}`,
        quantity,
        unitPrice,
        lineTotal: +(Number(lineTotalValue || 0)).toFixed(2),
      });

      continue;
    }

    const quantity = group.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const lineTotal = +group
      .reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0)
      .toFixed(2);

    const unitPriceSet = new Set(
      group.map((i) => (Number(i.unitPrice) || 0).toFixed(4)),
    );
    const unitPrice = unitPriceSet.size === 1 ? Number(group[0].unitPrice) || 0 : null;

    displayItems.push({
      name: String(group[0].name || "").trim(),
      sku,
      sizeDisplay: buildSizeBreakdown(group, quantity) || "—",
      quantity,
      unitPrice,
      lineTotal,
    });
  }

  return displayItems;
}

/**
 * Send order confirmation email to admin + customer.
 * Tries Outlook first, then Gmail as fallback if GMAIL_PASS is set.
 */
async function sendOrderEmail(order) {
  console.log(`[ORDER EMAIL] Starting email send for order ${order.orderNumber}...`);
  const adminEmail = process.env.CONTACT_EMAIL_TO || "uksportswarehouse@googlemail.com";

  const fromEmail = process.env.RESEND_FROM_EMAIL || "sales@oxfordsports.online";
  const displayItems = buildEmailDisplayItems(order.items || []);
  const displayedTotal = +displayItems
    .reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0)
    .toFixed(2);

  const itemRows = displayItems
    .map((i) => {
      const unitPriceDisplay = i.unitPrice === null ? "Varies" : `£${Number(i.unitPrice || 0).toFixed(2)}`;
      return `<tr>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:14px;color:#1f2937;font-weight:600;">${escapeHtml(i.name)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#374151;">${escapeHtml(i.sku)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#374151;">${escapeHtml(i.sizeDisplay)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#111827;text-align:center;">${Number(i.quantity || 0)}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#111827;text-align:right;">${unitPriceDisplay}</td>
        <td style="padding:12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f2d5c;text-align:right;font-weight:700;">£${Number(i.lineTotal || 0).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const customerName = escapeHtml(order.customerName || "Customer");
  const customerEmail = escapeHtml(order.customerEmail || "—");
  const customerCompany = escapeHtml(order.customerCompany || "—");
  const customerPhone = escapeHtml(order.customerPhone || "—");
  const deliveryAddress = escapeHtml(order.deliveryAddress || "—");
  const notes = String(order.notes || "").trim();

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
              <p style="margin:4px 0 0 0;font-size:15px;color:#111827;font-weight:700;">${new Date(order.createdAt).toLocaleDateString("en-GB")}</p>
            </div>
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <h3 style="margin:0 0 10px 0;font-size:14px;color:#0f2d5c;">Customer Details</h3>
            <p style="margin:4px 0;font-size:13px;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Email:</strong> ${customerEmail}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Company:</strong> ${customerCompany}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Phone:</strong> ${customerPhone}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Delivery Address:</strong> ${deliveryAddress}</p>
            ${notes ? `<p style="margin:8px 0 0 0;font-size:13px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
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

  // ── Use Resend API via HTTP (Bypasses all SMTP Firewalls) ──
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY environment variable is missing.");
  }

  console.log(`[ORDER EMAIL] Sending via Resend API from ${fromEmail}`);

  try {
    // 1. Send Admin Notification
    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Oxford Sports <${fromEmail}>`,
        to: adminEmail,
        subject: `[NEW ORDER] ${subject}`,
        html: html
      })
    });

    if (!adminRes.ok) {
      const errorText = await adminRes.text();
      throw new Error(`Resend Admin API Error: ${adminRes.status} ${errorText}`);
    }
    console.log(`[ORDER EMAIL] Admin email sent via Resend to ${adminEmail}`);

    // 2. Send Customer Notification
    if (order.customerEmail) {
      const customerRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `Oxford Sports <${fromEmail}>`,
          to: order.customerEmail,
          subject: `Order Confirmed — ${order.orderNumber}`,
          html: html
        })
      });

      if (!customerRes.ok) {
        const errorText = await customerRes.text();
        throw new Error(`Resend Customer API Error: ${customerRes.status} ${errorText}`);
      }
      console.log(`[ORDER EMAIL] Customer email sent via Resend to ${order.customerEmail}`);
    }

    console.log(`[ORDER EMAIL SUCCESS] ${order.orderNumber} sent perfectly via Resend API`);
  } catch (err) {
    console.error(`[ORDER EMAIL FINAL FAILURE] Resend API failed: ${err.message}`);
    throw err;
  }
}

// ══════════════════════════════════════════
//  Member: View own orders
// ══════════════════════════════════════════

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════
//  Admin: View all orders
// ══════════════════════════════════════════

exports.getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' },
    );

    if (!order) return res.status(404).json({ error: "Order not found." });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════
//  Admin: Export orders as CSV
// ══════════════════════════════════════════

exports.exportOrders = async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + "T23:59:59.999Z");
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const headers = [
      "Order ID",
      "Date",
      "Customer Name",
      "Company",
      "Email",
      "Phone",
      "Delivery Address",
      "Product Name",
      "SKU",
      "Size",
      "Quantity",
      "Unit Price",
      "Line Total",
      "Order Total",
      "Status",
    ];

    const csvRows = [headers.join(",")];

    function csvSafe(val) {
      const str = String(val || "").replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) return `"'${str}"`;
      return `"${str}"`;
    }

    for (const order of orders) {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      for (const item of order.items) {
        csvRows.push(
          [
            csvSafe(order.orderNumber),
            date,
            csvSafe(order.customerName),
            csvSafe(order.customerCompany),
            csvSafe(order.customerEmail),
            csvSafe(order.customerPhone),
            csvSafe(order.deliveryAddress),
            csvSafe(item.name),
            csvSafe(item.sku),
            csvSafe(item.size),
            item.quantity,
            item.unitPrice.toFixed(2),
            item.lineTotal.toFixed(2),
            order.totalAmount.toFixed(2),
            order.status,
          ].join(","),
        );
      }
    }

    const csv = csvRows.join("\n");
    const filename = `oxford-sports-orders-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};