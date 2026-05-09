/**
 * Order Controller (Refactored — v2)
 * ────────────────────────────────────
 * Modular, production-grade order management.
 *
 * Architecture:
 *   - Stock logic    → lib/stockService.js
 *   - Email queue    → lib/emailQueue.js (BullMQ with 5 retries)
 *   - Email template → lib/emailTemplates.js
 *   - Email sending  → lib/emailSender.js (Resend + SMTP fallback)
 *   - State machine  → lib/orderStateMachine.js
 *   - Logging        → lib/logger.js (structured JSON for Railway)
 *
 * This controller is thin — it orchestrates services, not implements them.
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const crypto = require('crypto');

const log = require('../lib/logger');
const { enqueueOrderEmail } = require('../lib/emailQueue');
const { validateAndAllocateItem, enforceMustBuyAll, executeStockDeductions } = require('../lib/stockService');
const { canTransition, transitionOrder, getNextStates } = require('../lib/orderStateMachine');
const { logOrderToConsole } = require('../lib/emailQueue');
const { validateCheckout } = require('../lib/validators');

// ── In-flight deduplication set ──
const inFlightFingerprints = new Set();

/**
 * Build a SHA-1 fingerprint for idempotency.
 */
function buildFingerprint(userId, items, notes) {
  const normalized = [...(Array.isArray(items) ? items : [])]
    .map((item) => ({
      sku: String(item?.sku || '').trim().toUpperCase(),
      size: String(item?.size || '').trim(),
      quantity: Number(item?.quantity) || 0,
      maxStock: Number(item?.maxStock) || 0,
      lotItem: Boolean(item?.lotItem),
    }))
    .sort((a, b) => `${a.sku}|${a.size}`.localeCompare(`${b.sku}|${b.size}`));

  const payload = `${String(userId || '')}|${String(notes || '').trim()}|${JSON.stringify(normalized)}`;
  return crypto.createHash('sha1').update(payload).digest('hex');
}

// ══════════════════════════════════════════
//  POST /api/orders — Place an order
// ══════════════════════════════════════════

exports.placeOrder = async (req, res) => {
  let fingerprint = '';
  const t = log.timer('order', 'placeOrder');

  try {
    const MIN_ORDER_TOTAL = 300;
    const enforceMinOrderTotal =
      String(process.env.ENFORCE_MIN_ORDER_TOTAL || 'false').toLowerCase() === 'true';

    // ── Zod schema validation ──
    const validation = validateCheckout(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid checkout request.',
        details: validation.errors,
      });
    }
    const { items, notes } = validation.data;

    // ── Idempotency guard ──
    fingerprint = buildFingerprint(req.user?._id, items, notes);
    if (inFlightFingerprints.has(fingerprint)) {
      log.warn('order', 'Duplicate order blocked', { userId: req.user?._id?.toString() });
      return res.status(429).json({
        error: 'Duplicate order request detected. Please wait for the current submission to finish.',
      });
    }
    inFlightFingerprints.add(fingerprint);

    // ── Batch-fetch all products ──
    const uniqueSkus = [...new Set(items.map((i) => i.sku?.toUpperCase()).filter(Boolean))];
    const productsList = await Product.find({ sku: { $in: uniqueSkus }, isActive: true });
    const productMap = new Map();
    productsList.forEach((p) => productMap.set(p.sku, p));

    log.info('order', 'Products fetched for checkout', {
      userId: req.user?._id?.toString(),
      requestedSkus: uniqueSkus.length,
      foundProducts: productsList.length,
    });

    // ── Validate & allocate each item ──
    const orderItems = [];
    const stockUpdates = [];
    const lotSkus = new Set();

    for (const item of items) {
      if (!item.sku || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: `Invalid item: ${JSON.stringify(item)}` });
      }

      const product = productMap.get(item.sku.toUpperCase());
      if (!product) {
        return res.status(404).json({
          error: `Product ${item.sku} not found.`,
          details: 'Product not found in database. Check SKU spelling or if product is active.',
        });
      }

      const { orderItem, stockOps } = validateAndAllocateItem(item, product);
      orderItems.push(orderItem);
      stockUpdates.push(...stockOps);

      if (item.lotItem) lotSkus.add(product.sku);
    }

    // ── Enforce "must buy all" rule for below-threshold products ──
    const skuMap = new Map();
    for (const oi of orderItems) {
      if (!skuMap.has(oi.sku)) skuMap.set(oi.sku, { items: [], product: null });
      skuMap.get(oi.sku).items.push(oi);
    }
    for (const sku of skuMap.keys()) {
      const p = productMap.get(sku.toUpperCase());
      if (p) skuMap.get(sku).product = p;
    }

    const { additionalItems, additionalOps } = enforceMustBuyAll(skuMap, lotSkus);
    orderItems.push(...additionalItems);
    stockUpdates.push(...additionalOps);

    // ── Calculate total ──
    const totalAmount = +orderItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
    let minimumOrderWarning = '';

    if (totalAmount < MIN_ORDER_TOTAL) {
      if (enforceMinOrderTotal) {
        return res.status(400).json({
          error: `Minimum order total is £${MIN_ORDER_TOTAL}. Your cart is £${totalAmount.toFixed(2)}.`,
        });
      }
      minimumOrderWarning = `Order total (£${totalAmount.toFixed(2)}) is below recommended minimum £${MIN_ORDER_TOTAL}.`;
    }

    // ── Execute stock deductions (with automatic rollback on conflict) ──
    try {
      await executeStockDeductions(stockUpdates, {
        items: orderItems.map((item) => ({
          sku: item.sku,
          size: item.size || '',
          quantity: item.quantity,
          lotItem: Boolean(item.lotItem),
        })),
      });
    } catch (stockErr) {
      if (stockErr.code === 'STOCK_CONFLICT') {
        log.warn('order', 'Stock conflict during checkout', {
          userId: req.user?._id?.toString(),
          error: stockErr.message,
          details: stockErr.details,
        });
        return res.status(409).json({
          error: 'Stock changed during checkout. Please review your cart and try again.',
        });
      }
      log.error('order', 'Stock deduction failed', { error: stockErr.message });
      return res.status(500).json({ error: 'Stock deduction failed. Please try again.' });
    }

    // ── Create the order (status: pending) ──
    const order = await Order.create({
      customer: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerCompany: req.user.company || '',
      customerPhone: req.user.mobileNumber || '',
      deliveryAddress: req.user.deliveryAddress || '',
      items: orderItems,
      totalAmount,
      notes: notes || '',
    });

    log.info('order', 'Order created successfully', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: req.user._id?.toString(),
      totalAmount,
      itemCount: orderItems.length,
    });

    // ── Enqueue email — fire-and-forget via BullMQ ──
    // This NEVER blocks the response. If Redis is down, falls back to inline.
    enqueueOrderEmail(order._id, order.orderNumber).catch((err) => {
      log.error('order', 'Failed to enqueue email', {
        orderId: order._id.toString(),
        error: err.message,
      });
    });

    // ── Build lot allocation summary for the response ──
    const lotAllocationSummary = orderItems
      .filter((entry) => Boolean(entry.lotItem))
      .map((entry) => ({
        sku: entry.sku,
        quantity: entry.quantity,
        lotSizeBreakdown: entry.lotSizeBreakdown || `Unspecified(${entry.quantity || 0})`,
      }));

    t.end({
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      totalAmount,
    });

    res.status(201).json({
      success: true,
      order,
      minimumOrder: {
        threshold: MIN_ORDER_TOTAL,
        enforced: enforceMinOrderTotal,
        warning: minimumOrderWarning,
      },
      lotAllocationSummary,
      message:
        lotAllocationSummary.length > 0
          ? 'Lot items were allocated as complete lots across all available sizes.'
          : 'Order placed successfully.',
    });

  } catch (err) {
    const statusCode = err.statusCode || 500;
    log.error('order', 'placeOrder failed', {
      userId: req.user?._id?.toString(),
      error: err.message,
      statusCode,
    });
    res.status(statusCode).json({ error: err.message });
  } finally {
    if (fingerprint) inFlightFingerprints.delete(fingerprint);
  }
};

// ══════════════════════════════════════════
//  GET /api/orders/mine — Member's order history
// ══════════════════════════════════════════

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ orders });
  } catch (err) {
    log.error('order', 'getMyOrders failed', { userId: req.user?._id?.toString(), error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════
//  GET /api/orders — Admin: all orders (paginated)
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
    log.error('order', 'getOrders failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════
//  PUT /api/orders/:id/status — Admin: update order status
//  Uses the state machine to enforce valid transitions.
// ══════════════════════════════════════════

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, carrier, reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Use the state machine for validation
    if (!canTransition(order.status, status)) {
      return res.status(400).json({
        error: `Cannot change status from "${order.status}" to "${status}".`,
        allowedTransitions: getNextStates(order.status),
      });
    }

    await transitionOrder(order, status, {
      actor: req.user?.email || 'admin',
      reason: reason || '',
    });

    // ── Auto-send shipped email ──
    if (status === 'shipped' && order.customerEmail) {
      const { buildOrderShippedEmail } = require('../lib/emailTemplates');
      const { sendEmail } = require('../lib/emailSender');

      const { subject, html } = buildOrderShippedEmail(order, {
        trackingNumber: trackingNumber || '',
        carrier: carrier || '',
      });

      // Fire-and-forget via BullMQ or inline
      sendEmail({
        to: order.customerEmail,
        subject,
        html,
      }).catch((err) => {
        log.error('order', 'Failed to send shipped email', {
          orderId: order._id.toString(),
          error: err.message,
        });
      });

      log.info('order', 'Shipped email queued', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        trackingNumber: trackingNumber || 'none',
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    log.error('order', 'updateOrderStatus failed', {
      orderId: req.params.id,
      error: err.message,
    });
    res.status(statusCode).json({ error: err.message });
  }
};

// ══════════════════════════════════════════
//  GET /api/orders/export — Admin: CSV export
// ══════════════════════════════════════════

exports.exportOrders = async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const headers = [
      'Order ID', 'Date', 'Customer Name', 'Company', 'Email', 'Phone',
      'Delivery Address', 'Product Name', 'SKU', 'Size', 'Quantity',
      'Unit Price', 'Line Total', 'Order Total', 'Status',
    ];

    const csvRows = [headers.join(',')];

    function csvSafe(val) {
      const str = String(val || '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) return `"'${str}"`;
      return `"${str}"`;
    }

    for (const order of orders) {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      for (const item of order.items) {
        csvRows.push(
          [
            csvSafe(order.orderNumber), date,
            csvSafe(order.customerName), csvSafe(order.customerCompany),
            csvSafe(order.customerEmail), csvSafe(order.customerPhone),
            csvSafe(order.deliveryAddress), csvSafe(item.name),
            csvSafe(item.sku), csvSafe(item.size),
            item.quantity, item.unitPrice.toFixed(2),
            item.lineTotal.toFixed(2), order.totalAmount.toFixed(2),
            order.status,
          ].join(','),
        );
      }
    }

    const csv = csvRows.join('\n');
    const filename = `oxford-sports-orders-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    log.error('order', 'exportOrders failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};