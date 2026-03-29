const Order = require("../models/Order");
const Product = require("../models/Product");
const nodemailer = require("nodemailer");
const { isValidSizeCode } = require("../utils/sizeStockUtils");

// ══════════════════════════════════════════
//  Member: Place an order (from cart)
// ══════════════════════════════════════════

/**
 * POST /api/orders
 * Body: { items: [{ sku, size, quantity }], notes? }
 * Protected — req.user must be authenticated.
 */
exports.placeOrder = async (req, res) => {
  try {
    const { items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must contain at least one item." });
    }

    // ── Validate each item against DB stock ──
    const orderItems = [];
    const stockUpdates = []; // bulk ops to deduct stock
    const stockDebug = []; // for logging

    // ── MOQ thresholds (must match frontend api.js) ──
    const FOOTWEAR_THRESHOLD = 24;
    const DEFAULT_THRESHOLD = 100;
    const MIN_ORDER_TOTAL = 300;

    for (const item of items) {
      if (!item.sku || !item.quantity || item.quantity < 1) {
        return res
          .status(400)
          .json({ error: `Invalid item: ${JSON.stringify(item)}` });
      }

      const product = await Product.findOne({
        sku: item.sku.toUpperCase(),
        isActive: true,
      });

      if (!product) {
        return res
          .status(404)
          .json({ 
            error: `Product ${item.sku} not found.`,
            details: `Product not found in database. Check SKU spelling or if product is active.` 
          });
      }

      const qty = parseInt(item.quantity);
      const incomingSize = (item.size || "").trim();
      let size = incomingSize; // Will be updated if auto-allocated

      // ── Stock validation ──
      const sizeEntries = Array.isArray(product.sizes) ? product.sizes : [];
      const hasSizeStock =
        sizeEntries.length > 0 && sizeEntries.some((s) => s.quantity > 0);

      // Log for debugging Issue #5
      stockDebug.push({
        sku: product.sku,
        name: product.name,
        requestedQty: qty,
        requestedSize: size || "N/A",
        hasSizeData: sizeEntries.length > 0,
        sizeEntries: sizeEntries.map((s) => ({ size: s.size, qty: s.quantity })),
        totalQuantity: product.totalQuantity,
        hasSizeStock,
      });

      if (hasSizeStock) {
        // Per-size stock mode using new sizes array
        // Normalize the incoming size for consistent matching
        const normalizedIncomingSize = size.trim();
        
        // Try to find exact size match first (with trimmed comparison)
        let sizeEntry = sizeEntries.find((s) => s.size && s.size.trim() === normalizedIncomingSize);
        
        // If no exact match and user didn't specify size (empty string), use first available VALID size
        if (!sizeEntry && (!normalizedIncomingSize || normalizedIncomingSize === "")) {
          sizeEntry = sizeEntries.find((s) => isValidSizeCode(s.size, product.category));
          if (sizeEntry) {
            // Update size variable to the auto-selected size for stock deduction
            size = sizeEntry.size;
          }
        }
        
        const available = sizeEntry ? sizeEntry.quantity : 0;
        
        // FALLBACK: If no valid size found but totalQuantity exists, use flat stock mode
        if (!sizeEntry && product.totalQuantity > 0) {
          if (qty > product.totalQuantity) {
            return res.status(400).json({
              error: `Only ${product.totalQuantity} units available for ${product.name}.`,
            });
          }
          stockUpdates.push({
            updateOne: {
              filter: { _id: product._id },
              update: { $inc: { totalQuantity: -qty } },
            },
          });
        } else if (!sizeEntry || available <= 0) {
          return res.status(400).json({
            error: `Out of stock for ${product.name}.`,
            debug: process.env.NODE_ENV === "production" ? undefined : {
              message: "No inventory available",
              availableSizes: sizeEntries.map((s) => ({ size: s.size, qty: s.quantity }))
            }
          });
        } else if (qty > available) {
          return res.status(400).json({
            error: `Only ${available} units available for ${product.name}.`,
          });
        } else {
          stockUpdates.push({
            updateOne: {
              filter: {
                _id: product._id,
                "sizes.size": sizeEntry.size,  // Use the matched entry's size value directly
                "sizes.quantity": { $gte: qty },
                totalQuantity: { $gte: qty },
              },
              update: {
                $inc: { "sizes.$.quantity": -qty, totalQuantity: -qty },
              },
            },
          });
        }
      } else if (product.totalQuantity > 0) {
        // Flat stock mode
        if (qty > product.totalQuantity) {
          return res.status(400).json({
            error: `Only ${product.totalQuantity} available for ${product.name}.`,
          });
        }
        stockUpdates.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $inc: { totalQuantity: -qty } },
          },
        });
      } else {
        // No stock data — log warning
        console.warn(
          `[ORDER] No stock info for ${product.sku}: no sizes array and totalQuantity=0. May need diagnostic.`,
        );
      }
      // If totalQuantity == 0, we allow ordering (wholesale — no strict stock enforcement)

      const unitPrice = product.salePrice;
      // Track if backend auto-selected this size (only auto-select if user didn't provide one)
      const wasAllocated = !incomingSize && size && size !== incomingSize;
      // For lot items (buying ALL units), use maxStock. Otherwise use quantity.
      // Frontend sends maxStock when item.lotItem = true
      const priceQuantity = item.maxStock && item.lotItem ? item.maxStock : qty;
      
      orderItems.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        size,
        allocatedSize: wasAllocated ? size : "", // Set if auto-allocated
        quantity: qty,
        maxStock: item.maxStock || undefined,  // Store for reference
        lotItem: item.lotItem || false,        // Store lot flag
        unitPrice,
        lineTotal: +(unitPrice * priceQuantity).toFixed(2),  // Use maxStock for lots
      });
    }

    // ── Calculate total BEFORE adding missing sizes ──
    let totalAmount = +orderItems
      .reduce((sum, i) => sum + i.lineTotal, 0)
      .toFixed(2);

    // ── MOQ enforcement: must-buy-all products (auto-add missing sizes) ──
    // Group order items by SKU to check per-product MOQ
    const skuMap = {};
    for (const oi of orderItems) {
      if (!skuMap[oi.sku]) skuMap[oi.sku] = { items: [], product: null };
      skuMap[oi.sku].items.push(oi);
    }
    // Fetch products for MOQ check
    for (const sku of Object.keys(skuMap)) {
      const product = await Product.findOne({ sku: sku.toUpperCase(), isActive: true }).lean();
      if (product) skuMap[sku].product = product;
    }
    // ── Auto-add missing sizes for "must-buy-all" products ──
    const LOT_CATEGORIES = ["JOB LOTS", "B GRADE", "UNDER £5"];
    for (const [sku, entry] of Object.entries(skuMap)) {
      const product = entry.product;
      if (!product) continue;
      const cat = (product.category || "").toUpperCase();
      if (LOT_CATEGORIES.includes(cat)) {
        continue;
      }
      const isFootwear = cat === "FOOTWEAR";
      const threshold = isFootwear ? FOOTWEAR_THRESHOLD : DEFAULT_THRESHOLD;
      const totalQty = product.totalQuantity || 0;
      if (totalQty > 0 && totalQty < threshold) {
        // Must buy ALL available sizes — auto-add any missing sizes
        // Filter out invalid size codes (NS, N/A, etc.) to avoid false missing sizes
        const availableSizes = (product.sizes || [])
          .filter((s) => s.quantity > 0 && isValidSizeCode(s.size, product.category));
        const orderedSizes = new Set(entry.items.map((i) => (i.size || "").trim()));
        const missingSizeEntries = availableSizes.filter((s) => !orderedSizes.has(s.size.trim()));
        
        // Auto-add missing sizes to the order
        for (const sizeEntry of missingSizeEntries) {
          const missingSizeQty = sizeEntry.quantity;
          const trimmedSize = sizeEntry.size.trim();
          const unitPrice = product.salePrice;
          const lineTotal = +(unitPrice * missingSizeQty).toFixed(2);
          
          // Add to orderItems
          orderItems.push({
            product: product._id,
            sku: product.sku,
            name: product.name,
            size: trimmedSize,
            allocatedSize: "", // Not auto-allocated by system choice, but by missing-size requirement
            quantity: missingSizeQty,
            unitPrice,
            lineTotal,
          });
          
          // Add stock deduction for this size
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
          
          // Add to entry.items for future reference
          entry.items.push({
            sku: product.sku,
            size: trimmedSize,
            quantity: missingSizeQty,
          });
        }
      }
    }

    // ── Recalculate total AFTER adding missing sizes ──
    totalAmount = +orderItems
      .reduce((sum, i) => sum + i.lineTotal, 0)
      .toFixed(2);

    // ── MOQ enforcement: minimum cart total ──
    if (totalAmount < MIN_ORDER_TOTAL) {
      return res.status(400).json({
        error: `Minimum order total is £${MIN_ORDER_TOTAL}. Your cart is £${totalAmount.toFixed(2)}.`,
      });
    }

    // ── Deduct stock BEFORE creating order (atomic per-product) ──
    const stockRollbacks = [];
    try {
      for (const op of stockUpdates) {
        const result = await Product.bulkWrite([op], { ordered: true });
        if (result.modifiedCount !== 1) {
          throw new Error("Concurrent stock change detected");
        }
        stockRollbacks.push(op);
      }
    } catch (stockErr) {
      // Rollback any successful deductions
      for (const op of stockRollbacks) {
        const rollback = JSON.parse(JSON.stringify(op));
        const inc = rollback.updateOne.update.$inc;
        for (const key of Object.keys(inc)) {
          inc[key] = -inc[key];
        }
        await Product.bulkWrite([rollback], { ordered: false }).catch(() => {});
      }
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
    
    // Send email asynchronously without blocking response
    sendOrderEmail(order).then(() => {
      emailStatus.sent = true;
      console.log(`[ORDER EMAIL SUCCESS] Order ${order.orderNumber} sent`);
    }).catch((emailErr) => {
      emailStatus.sent = false;
      emailStatus.error = emailErr.message;
      console.error(`[ORDER EMAIL FAILED] Order ${order.orderNumber}:`, emailErr.message);
    });

    res.status(201).json({ success: true, order, emailStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Send order confirmation email to admin + customer.
 * Throws error if SMTP fails; caller should handle with try-catch.
 */
async function sendOrderEmail(order) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  // Early return if SMTP not configured
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP not configured. Email delivery disabled.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const adminEmail = process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net";

  const itemRows = order.items
    .map(
      (i) => {
        // Show allocatedSize info in email when applicable
        const sizeDisplay = i.allocatedSize ? `${i.size} (auto)` : (i.size || "—");
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${i.name}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${i.sku}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${sizeDisplay}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;">£${i.unitPrice.toFixed(2)}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;">£${i.lineTotal.toFixed(2)}</td>
        </tr>`;
      }
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">
      <h2 style="color:#1a1281;">Oxford Sports — Order Confirmation</h2>
      <p><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString("en-GB")}</p>
      <hr style="border:1px solid #e5e7eb;">
      <h3>Customer Details</h3>
      <p><strong>Name:</strong> ${order.customerName}</p>
      <p><strong>Email:</strong> ${order.customerEmail}</p>
      <p><strong>Company:</strong> ${order.customerCompany || "—"}</p>
      <p><strong>Phone:</strong> ${order.customerPhone || "—"}</p>
      <p><strong>Delivery Address:</strong> ${order.deliveryAddress || "—"}</p>
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""}
      <hr style="border:1px solid #e5e7eb;">
      <h3>Order Items</h3>
      <table style="border-collapse:collapse;width:100%;font-size:0.9rem;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Product</th>
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">SKU</th>
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Size</th>
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">Unit Price</th>
            <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="text-align:right;font-size:1.1rem;margin-top:1rem;"><strong>Order Total: £${order.totalAmount.toFixed(2)}</strong></p>
      <hr style="border:1px solid #e5e7eb;">
      <p style="color:#6b7280;font-size:0.85rem;">This is an automated confirmation from Oxford Sports. If you have any questions, please reply to this email or contact us at ${adminEmail}.</p>
    </div>
  `;

  const subject = `Order ${order.orderNumber} — £${order.totalAmount.toFixed(2)} — ${order.customerName}`;

  // Wrap email sending in try-catch with detailed logging
  try {
    // Send to admin
    await transporter.sendMail({
      from: `"Oxford Sports" <${smtpUser}>`,
      to: adminEmail,
      subject: `[NEW ORDER] ${subject}`,
      html,
    });

    // Send confirmation to customer
    if (order.customerEmail) {
      await transporter.sendMail({
        from: `"Oxford Sports" <${smtpUser}>`,
        to: order.customerEmail,
        subject: `Order Confirmed — ${order.orderNumber}`,
        html,
      });
    }
    console.log(`[ORDER EMAIL SUCCESS] ${order.orderNumber} sent to ${order.customerEmail}`);
  } catch (mailErr) {
    console.error(`[ORDER EMAIL ERROR] ${order.orderNumber}:`, mailErr.message);
    throw mailErr; // Bubble up for caller to handle
  }
}

// ══════════════════════════════════════════
//  Member: View own orders
// ══════════════════════════════════════════

/**
 * GET /api/orders/mine
 * Returns the authenticated user's orders.
 */
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

/**
 * GET /api/admin/orders
 * Query: ?status=pending&page=1&limit=50
 */
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

/**
 * PUT /api/admin/orders/:id/status
 * Body: { status: "confirmed" | "processing" | ... }
 */
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
      { new: true },
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

/**
 * GET /api/admin/export-orders
 * Query: ?status=confirmed&from=2026-01-01&to=2026-12-31
 * Returns CSV file download.
 */
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

    // ── Build CSV rows (one row per order item — Adidas spreadsheet format) ──
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

    // Sanitize CSV cell values to prevent formula injection
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
