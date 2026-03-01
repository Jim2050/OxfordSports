const Order = require("../models/Order");
const Product = require("../models/Product");
const nodemailer = require("nodemailer");

// ══════════════════════════════════════════
//  Helper: Send order notification email
// ══════════════════════════════════════════

async function sendOrderNotificationEmail(order) {
  try {
    // Skip if SMTP not configured (development)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "📧 Order notification (SMTP not configured — logged only):",
        );
        console.log(`   Order ID: ${order._id}`);
        console.log(
          `   Customer: ${order.customerName} <${order.customerEmail}>`,
        );
        console.log(`   Total: £${order.totalAmount}`);
      }
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Build order items table (text)
    const itemsText = order.items
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.name} (SKU: ${item.sku})${item.size ? ` - Size: ${item.size}` : ""}\n   Quantity: ${item.quantity} × £${item.unitPrice.toFixed(2)} = £${item.lineTotal.toFixed(2)}`,
      )
      .join("\n\n");

    // Build order items table (HTML)
    const itemsHTML = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.sku}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.size || "N/A"}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">£${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>£${item.lineTotal.toFixed(2)}</strong></td>
        </tr>`,
      )
      .join("");

    const textBody = `
NEW ORDER RECEIVED
==================

Order ID: ${order._id}
Date: ${new Date(order.createdAt).toLocaleString("en-GB")}
Status: ${order.status || "Pending"}

CUSTOMER DETAILS
----------------
Name: ${order.customerName}
Email: ${order.customerEmail}
Company: ${order.customerCompany || "N/A"}

ORDER ITEMS
-----------
${itemsText}

TOTAL AMOUNT: £${order.totalAmount.toFixed(2)}

${order.notes ? `CUSTOMER NOTES:\n${order.notes}\n` : ""}
---
This order has been saved to the database and is awaiting your confirmation.
Log in to the admin panel to manage this order.
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: #1e3a8a; color: white; padding: 20px; text-align: center; }
    .section { margin: 20px 0; padding: 15px; background: #f9fafb; border-left: 4px solid #1e3a8a; }
    .section h3 { margin-top: 0; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #1e3a8a; color: white; padding: 10px; text-align: left; }
    .total { background: #fee; font-size: 1.2em; padding: 15px; text-align: right; margin: 10px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 New Order Received</h1>
      <p>Order #${order._id}</p>
    </div>

    <div class="section">
      <h3>📅 Order Information</h3>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString("en-GB")}</p>
      <p><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">${order.status || "PENDING"}</span></p>
    </div>

    <div class="section">
      <h3>👤 Customer Details</h3>
      <p><strong>Name:</strong> ${order.customerName}</p>
      <p><strong>Email:</strong> <a href="mailto:${order.customerEmail}">${order.customerEmail}</a></p>
      <p><strong>Company:</strong> ${order.customerCompany || "N/A"}</p>
    </div>

    <div class="section">
      <h3>📦 Order Items</h3>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Size</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <div class="total">
        <strong>TOTAL AMOUNT: £${order.totalAmount.toFixed(2)}</strong>
      </div>
    </div>

    ${
      order.notes
        ? `
    <div class="section">
      <h3>📝 Customer Notes</h3>
      <p>${order.notes.replace(/\n/g, "<br />")}</p>
    </div>
    `
        : ""
    }

    <div class="footer">
      <p>This order has been saved to the database and is awaiting your confirmation.</p>
      <p>Log in to the <strong>Admin Panel</strong> to manage this order, update its status, and process fulfillment.</p>
      <hr />
      <p style="text-align: center; color: #999;">Oxford Sports Wholesale • Automated Order Notification</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    await transporter.sendMail({
      from: `"Oxford Sports Orders" <${process.env.SMTP_USER}>`,
      replyTo: order.customerEmail,
      to: process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net",
      subject: `🛒 New Order #${order._id} - ${order.customerName} - £${order.totalAmount.toFixed(2)}`,
      text: textBody,
      html: htmlBody,
    });

    console.log(`✓ Order notification email sent for order ${order._id}`);
  } catch (err) {
    console.error(`✗ Failed to send order notification email:`, err.message);
    // Don't throw — email failure shouldn't break order placement
  }
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
          .json({ error: `Product ${item.sku} not found.` });
      }

      const qty = parseInt(item.quantity);
      const size = (item.size || "").trim();

      // ── Stock validation ──
      const sizeEntries = Array.isArray(product.sizes) ? product.sizes : [];
      const hasSizeStock =
        sizeEntries.length > 0 && sizeEntries.some((s) => s.quantity > 0);

      if (hasSizeStock) {
        // Per-size stock mode using new sizes array
        const sizeEntry = sizeEntries.find((s) => s.size === size);
        const available = sizeEntry ? sizeEntry.quantity : 0;
        if (available > 0 && qty > available) {
          return res.status(400).json({
            error: `Only ${available} of size ${size} available for ${product.name}.`,
          });
        }
        if (available > 0) {
          stockUpdates.push({
            updateOne: {
              filter: { _id: product._id, "sizes.size": size },
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
      }
      // If totalQuantity == 0, we allow ordering (wholesale — no strict stock enforcement)

      const unitPrice = product.salePrice;
      orderItems.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        size,
        quantity: qty,
        unitPrice,
        lineTotal: +(unitPrice * qty).toFixed(2),
      });
    }

    const totalAmount = +orderItems
      .reduce((sum, i) => sum + i.lineTotal, 0)
      .toFixed(2);

    const order = await Order.create({
      customer: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerCompany: req.user.company || "",
      items: orderItems,
      totalAmount,
      notes: notes || "",
    });

    // ── Deduct stock (best-effort — order is already saved) ──
    if (stockUpdates.length > 0) {
      await Product.bulkWrite(stockUpdates, { ordered: false }).catch((err) =>
        console.error("Stock deduction error:", err.message),
      );
    }

    // ── Send order notification email to admin ──
    sendOrderNotificationEmail(order).catch((err) =>
      console.error("Email notification error:", err.message),
    );

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

    for (const order of orders) {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      for (const item of order.items) {
        csvRows.push(
          [
            `"${order.orderNumber}"`,
            date,
            `"${(order.customerName || "").replace(/"/g, '""')}"`,
            `"${(order.customerCompany || "").replace(/"/g, '""')}"`,
            `"${order.customerEmail}"`,
            `"${(item.name || "").replace(/"/g, '""')}"`,
            `"${item.sku}"`,
            `"${item.size || ""}"`,
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
