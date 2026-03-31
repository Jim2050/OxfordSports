const Order = require("../models/Order");
const Product = require("../models/Product");
const nodemailer = require("nodemailer");
const { isValidSizeCode } = require("../utils/sizeStockUtils");
const { getEmailQueue } = require("../utils/emailQueue");

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

    const orderItems = [];
    const stockUpdates = [];
    const stockDebug = [];

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
      const incomingSize = (item.size || "").trim();
      let size = incomingSize;

      const sizeEntries = Array.isArray(product.sizes) ? product.sizes : [];
      const hasSizeStock =
        sizeEntries.length > 0 && sizeEntries.some((s) => s.quantity > 0);

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
        const normalizedIncomingSize = size.trim();
        
        let sizeEntry = sizeEntries.find((s) => s.size && s.size.trim() === normalizedIncomingSize);
        
        if (!sizeEntry && (!normalizedIncomingSize || normalizedIncomingSize === "")) {
          sizeEntry = sizeEntries.find((s) => isValidSizeCode(s.size, product.category));
          if (sizeEntry) {
            size = sizeEntry.size;
          }
        }
        
        const available = sizeEntry ? sizeEntry.quantity : 0;
        
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
                "sizes.size": sizeEntry.size,
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
        console.warn(
          `[ORDER] No stock info for ${product.sku}: no sizes array and totalQuantity=0. May need diagnostic.`,
        );
      }

      const unitPrice = product.salePrice;
      const wasAllocated = !incomingSize && size && size !== incomingSize;
      const priceQuantity = item.maxStock && item.lotItem ? item.maxStock : qty;
      
      orderItems.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        size,
        allocatedSize: wasAllocated ? size : "",
        quantity: qty,
        maxStock: item.maxStock || undefined,
        lotItem: item.lotItem || false,
        unitPrice,
        lineTotal: +(unitPrice * priceQuantity).toFixed(2),
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
      const cat = (product.category || "").toUpperCase();
      if (LOT_CATEGORIES.includes(cat)) continue;
      const isFootwear = cat === "FOOTWEAR";
      const threshold = isFootwear ? FOOTWEAR_THRESHOLD : DEFAULT_THRESHOLD;
      const totalQty = product.totalQuantity || 0;
      if (totalQty > 0 && totalQty < threshold) {
        const availableSizes = (product.sizes || [])
          .filter((s) => s.quantity > 0 && isValidSizeCode(s.size, product.category));
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
          throw new Error("Concurrent stock change detected");
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
        ).catch(() => {});
        console.error(`[ORDER EMAIL FAILED] Order ${order.orderNumber}: ${emailErr.message}`);
        // Log full order details to Railway console as backup notification
        logOrderToConsole(order);
      });

    res.status(201).json({ success: true, order, emailStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Log order details to console — used as fallback when email fails
 * so Jim can always find order details in Railway logs.
 */
function logOrderToConsole(order) {
  const divider = "=".repeat(70);
  const itemLines = order.items
    .map((i) => `  • ${i.name} (${i.sku}) | Size: ${i.size || "N/A"} | Qty: ${i.quantity} | £${i.lineTotal.toFixed(2)}`)
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

/**
 * Send order confirmation email to admin + customer.
 * Tries Outlook first, then Gmail as fallback if GMAIL_PASS is set.
 */
async function sendOrderEmail(order) {
  console.log(`[ORDER EMAIL] Starting email send for order ${order.orderNumber}...`);
  
  const adminEmail = process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net";

  const itemRows = order.items
    .map((i) => {
      const sizeDisplay = i.allocatedSize ? `${i.size} (auto)` : (i.size || "—");
      return `<tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${i.name}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${i.sku}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${sizeDisplay}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;">£${i.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;">£${i.lineTotal.toFixed(2)}</td>
      </tr>`;
    })
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

  // ── Try each provider in sequence ──
  const providers = buildEmailProviders();
  
  if (providers.length === 0) {
    throw new Error("No SMTP providers configured. Set SMTP_PASS or GMAIL_PASS in Railway environment variables.");
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`[ORDER EMAIL] Trying provider: ${provider.name} (${provider.user})`);

      // ── Force IPv4 resolution for SMTP host ──
      // Railway containers cannot reach IPv6 addresses (ENETUNREACH).
      // Manually resolve to IPv4 and pass the raw IP as host.
      if (provider.config.host) {
        try {
          const dns = require("dns");
          const ipv4 = await new Promise((resolve, reject) => {
            dns.resolve4(provider.config.host, (err, addresses) => {
              if (err || !addresses || addresses.length === 0) {
                reject(err || new Error("No IPv4 address found"));
              } else {
                resolve(addresses[0]);
              }
            });
          });
          console.log(`[ORDER EMAIL] DNS: ${provider.config.host} → ${ipv4} (IPv4)`);
          // Keep the original hostname for TLS certificate validation
          provider.config.tls = {
            ...(provider.config.tls || {}),
            servername: provider.config.host,
            rejectUnauthorized: false,
          };
          provider.config.host = ipv4; // Use raw IPv4 IP
        } catch (dnsErr) {
          console.warn(`[ORDER EMAIL] IPv4 DNS resolution failed: ${dnsErr.message}, using hostname as fallback`);
        }
      }

      // Remove 'service' key — we are providing explicit host/port/secure
      delete provider.config.service;

      const transporter = nodemailer.createTransport(provider.config);
      
      await sendMailWithTimeout(transporter, {
        from: `"Oxford Sports" <${provider.user}>`,
        to: adminEmail,
        subject: `[NEW ORDER] ${subject}`,
        html,
      }, 20000);
      console.log(`[ORDER EMAIL] Admin email sent via ${provider.name} to ${adminEmail}`);

      if (order.customerEmail) {
        await sendMailWithTimeout(transporter, {
          from: `"Oxford Sports" <${provider.user}>`,
          to: order.customerEmail,
          subject: `Order Confirmed — ${order.orderNumber}`,
          html,
        }, 20000);
        console.log(`[ORDER EMAIL] Customer email sent via ${provider.name} to ${order.customerEmail}`);
      }

      console.log(`[ORDER EMAIL SUCCESS] ${order.orderNumber} sent via ${provider.name}`);
      return; // Success — exit
    } catch (err) {
      console.error(`[ORDER EMAIL] Provider ${provider.name} failed: ${err.message}`);
      lastError = err;
      // Continue to next provider
    }
  }

  // All providers failed
  throw lastError || new Error("All email providers failed");
}

/**
 * Build list of email providers to try, in priority order.
 * Outlook first (if configured), then Gmail (if GMAIL_PASS set).
 */
function buildEmailProviders() {
  const providers = [];

  // Provider 1: Outlook / Office365 (existing config)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass && !smtpPass.includes("CONFIGURE")) {
    providers.push({
      name: "Outlook",
      user: smtpUser,
      config: {
        host: process.env.SMTP_HOST || "smtp.office365.com",
        port: 587,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
        socketTimeout: 15000,
        greetingTimeout: 10000,
      },
    });
  }

  // Provider 2: Gmail (set GMAIL_USER + GMAIL_PASS in Railway to enable)
  const gmailPass = process.env.GMAIL_PASS;
  const gmailUser = process.env.GMAIL_USER || "noreply@oxfordsports.net";
  if (gmailPass && !gmailPass.includes("CONFIGURE")) {
    providers.push({
      name: "Gmail",
      user: gmailUser,
      config: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
        connectionTimeout: 20000,
        socketTimeout: 20000,
        greetingTimeout: 15000,
      },
    });
  }

  return providers;
}

/**
 * Send email with timeout protection.
 */
function sendMailWithTimeout(transporter, mailOptions, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      transporter.close();
      reject(new Error(`Email send timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    transporter.sendMail(mailOptions, (err, info) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(info);
    });
  });
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