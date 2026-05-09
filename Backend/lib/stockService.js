/**
 * Stock Allocation Service
 * ────────────────────────
 * Extracted stock validation and deduction logic.
 * Handles: lot items, footwear threshold, size allocation, and rollbacks.
 *
 * This is the "source of truth" for inventory operations during checkout.
 */

const Product = require('../models/Product');
const log = require('./logger');

/** Business rule thresholds */
const FOOTWEAR_THRESHOLD = 24;
const DEFAULT_THRESHOLD = 100;
const LOT_CATEGORIES = ['JOB LOTS', 'UNDER £5'];

/**
 * Validate a single cart item against the live product data.
 * Returns the enriched order item + stock update operations.
 *
 * @param {object} item - Cart item { sku, size, quantity, lotItem, maxStock }
 * @param {object} product - Mongoose product document
 * @returns {{ orderItem: object, stockOps: object[] }}
 */
function validateAndAllocateItem(item, product) {
  const isLotItem = Boolean(item.lotItem);
  const qty = parseInt(item.quantity);
  const sizeEntries = Array.isArray(product.sizes) ? product.sizes : [];
  const hasSizeStock = sizeEntries.length > 0 && sizeEntries.some((s) => s.quantity > 0);
  const validLotSizes = sizeEntries.filter((s) => s.quantity > 0 && String(s.size || '').trim() !== '');

  const effectiveQty = isLotItem
    ? Math.floor(Math.max(0, Number(product.totalQuantity) || 0))
    : qty;

  const incomingSize = isLotItem ? '' : (item.size || '').trim();
  let size = incomingSize;

  // Build lot display breakdown
  const lotDisplaySizes = (validLotSizes.length > 0
    ? validLotSizes
    : sizeEntries.filter((s) => s.quantity > 0)
  ).map((s) => `${String(s.size || '').trim()}(${s.quantity})`);
  const lotSizeBreakdown = isLotItem ? lotDisplaySizes.join(', ') : '';

  if (isLotItem && effectiveQty < 1) {
    throw createError(400, `No lot inventory available for ${product.name}.`);
  }

  if (!isLotItem && (!Number.isFinite(qty) || qty < 1)) {
    throw createError(400, `Invalid quantity for ${item.sku}.`);
  }

  const stockOps = [];

  if (hasSizeStock) {
    if (isLotItem) {
      // Lot allocation: take from all sizes proportionally
      const ops = allocateAcrossAllSizes(product, effectiveQty, validLotSizes, sizeEntries);
      stockOps.push(...ops);
    } else {
      // Regular item: allocate specific size
      const result = allocateSpecificSize(product, size, effectiveQty, sizeEntries, validLotSizes);
      size = result.size;
      stockOps.push(...result.ops);
    }
  } else if (product.totalQuantity > 0) {
    if (effectiveQty > product.totalQuantity) {
      throw createError(400, `Only ${product.totalQuantity} available for ${product.name}.`);
    }
    stockOps.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $inc: { totalQuantity: -effectiveQty } },
      },
    });
  } else {
    throw createError(400, `Out of stock for ${product.name}.`);
  }

  const unitPrice = product.salePrice;
  const wasAllocated = !incomingSize && size && size !== incomingSize;

  const orderItem = {
    product: product._id,
    sku: product.sku,
    name: product.name,
    size,
    allocatedSize: wasAllocated ? size : '',
    quantity: effectiveQty,
    maxStock: isLotItem ? effectiveQty : undefined,
    lotItem: isLotItem,
    lotSizeBreakdown: isLotItem ? lotSizeBreakdown : '',
    unitPrice,
    lineTotal: +(unitPrice * effectiveQty).toFixed(2),
  };

  return { orderItem, stockOps };
}

/**
 * Allocate stock across all available sizes (lot-style).
 */
function allocateAcrossAllSizes(product, effectiveQty, validLotSizes, sizeEntries) {
  if (effectiveQty > product.totalQuantity) {
    throw createError(400, `Only ${product.totalQuantity} units available for ${product.name}.`);
  }

  let remaining = effectiveQty;
  const allocatable = (validLotSizes.length > 0
    ? validLotSizes
    : sizeEntries.filter((s) => s.quantity > 0)
  ).sort((a, b) => String(a.size).localeCompare(String(b.size)));

  const ops = [];
  for (const sizeEntry of allocatable) {
    if (remaining <= 0) break;
    const takeQty = Math.min(sizeEntry.quantity, remaining);
    if (takeQty <= 0) continue;

    ops.push({
      updateOne: {
        filter: {
          _id: product._id,
          'sizes.size': sizeEntry.size,
          'sizes.quantity': { $gte: takeQty },
          totalQuantity: { $gte: takeQty },
        },
        update: {
          $inc: { 'sizes.$.quantity': -takeQty, totalQuantity: -takeQty },
        },
      },
    });
    remaining -= takeQty;
  }

  if (remaining > 0) {
    throw createError(400, `Only ${product.totalQuantity} units available for ${product.name}.`);
  }

  return ops;
}

/**
 * Allocate a specific size for a regular (non-lot) item.
 */
function allocateSpecificSize(product, size, effectiveQty, sizeEntries, validLotSizes) {
  const normalizedSize = size.trim();
  let sizeEntry = sizeEntries.find((s) => s.size && s.size.trim() === normalizedSize);

  // Auto-select if only one valid size and none specified
  if (!sizeEntry && (!normalizedSize || normalizedSize === '')) {
    const validSizes = sizeEntries.filter((s) => String(s?.size || '').trim() !== '');
    if (validSizes.length === 1) {
      sizeEntry = validSizes[0];
      size = sizeEntry.size;
    }
  }

  const available = sizeEntry ? sizeEntry.quantity : 0;

  if (!sizeEntry && product.totalQuantity > 0) {
    if (normalizedSize) {
      throw createError(400, `Out of stock for ${product.name} in size ${normalizedSize}.`);
    }
    // Fallback: allocate across all sizes
    const ops = allocateAcrossAllSizes(product, effectiveQty, validLotSizes, sizeEntries);
    return { size, ops };
  }

  if (!sizeEntry || available <= 0) {
    throw createError(400, `Out of stock for ${product.name}.`);
  }

  if (effectiveQty > available) {
    throw createError(400, `Only ${available} units available for ${product.name}.`);
  }

  const ops = [{
    updateOne: {
      filter: {
        _id: product._id,
        'sizes.size': sizeEntry.size,
        'sizes.quantity': { $gte: effectiveQty },
        totalQuantity: { $gte: effectiveQty },
      },
      update: {
        $inc: { 'sizes.$.quantity': -effectiveQty, totalQuantity: -effectiveQty },
      },
    },
  }];

  return { size: sizeEntry.size, ops };
}

/**
 * Enforce "must buy all" rule for below-threshold products.
 * Auto-adds missing sizes to the order so the client buys the full product.
 *
 * @param {Map<string, { items: object[], product: object }>} skuMap
 * @param {Set<string>} lotSkus - SKUs already flagged as lots
 * @returns {{ additionalItems: object[], additionalOps: object[] }}
 */
function enforceMustBuyAll(skuMap, lotSkus) {
  const additionalItems = [];
  const additionalOps = [];

  for (const [sku, entry] of skuMap.entries()) {
    const product = entry.product;
    if (!product) continue;
    if (lotSkus.has(product.sku)) continue;

    const cat = (product.category || '').toUpperCase();
    if (LOT_CATEGORIES.includes(cat)) continue;

    const isFootwear = cat === 'FOOTWEAR';
    const threshold = isFootwear ? FOOTWEAR_THRESHOLD : DEFAULT_THRESHOLD;
    const totalQty = product.totalQuantity || 0;

    if (totalQty <= 0 || totalQty >= threshold) continue;

    // Fix: If the user already bought the entire product stock (e.g. clicked "Buy all items"),
    // skip adding missing sizes to avoid duplicate allocations and stock conflicts.
    const orderedQty = entry.items.reduce((sum, i) => sum + i.quantity, 0);
    if (orderedQty >= totalQty) continue;

    const availableSizes = (product.sizes || [])
      .filter((s) => s.quantity > 0 && String(s.size || '').trim() !== '');
    const orderedSizes = new Set(entry.items.map((i) => (i.size || '').trim()));

    for (const sizeEntry of availableSizes) {
      const trimmedSize = sizeEntry.size.trim();
      if (orderedSizes.has(trimmedSize)) continue;

      const missingSizeQty = sizeEntry.quantity;
      const unitPrice = product.salePrice;
      const lineTotal = +(unitPrice * missingSizeQty).toFixed(2);

      additionalItems.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        size: trimmedSize,
        allocatedSize: '',
        lotItem: false,
        maxStock: undefined,
        lotSizeBreakdown: '',
        quantity: missingSizeQty,
        unitPrice,
        lineTotal,
      });

      additionalOps.push({
        updateOne: {
          filter: {
            _id: product._id,
            'sizes.size': sizeEntry.size,
            'sizes.quantity': { $gte: missingSizeQty },
            totalQuantity: { $gte: missingSizeQty },
          },
          update: {
            $inc: { 'sizes.$.quantity': -missingSizeQty, totalQuantity: -missingSizeQty },
          },
        },
      });

      entry.items.push({ sku: product.sku, size: trimmedSize, quantity: missingSizeQty });
    }
  }

  return { additionalItems, additionalOps };
}

/**
 * Execute stock deductions atomically, with retry and manual rollback on failure.
 *
 * Strategy:
 *   1. Send ALL operations in a single bulkWrite so MongoDB processes them
 *      in one round-trip. This eliminates the window between sequential writes
 *      that caused false-positive STOCK_CONFLICT errors.
 *   2. Verify that every operation modified exactly one document.
 *      If not, the stock genuinely changed between validation and deduction.
 *   3. Retry once (with a short jitter delay) before declaring a real conflict,
 *      to handle the rare case where a concurrent write resolves immediately.
 *   4. On confirmed failure, roll back all successful deductions.
 *
 * @param {object[]} stockUpdates - Array of bulkWrite operations
 * @param {number} [attempt=1] - Internal retry counter (max 2 attempts)
 * @returns {Promise<void>}
 */
async function executeStockDeductions(stockUpdates, attempt = 1) {
  if (!stockUpdates || stockUpdates.length === 0) return;

  const MAX_ATTEMPTS = 2;

  try {
    // Execute all deductions in a single bulkWrite call.
    // ordered:true ensures ops run sequentially and stop on first error.
    const result = await Product.bulkWrite(stockUpdates, { ordered: true });

    if (result.modifiedCount !== stockUpdates.length) {
      // Some ops did not match — stock changed between validation and deduction.
      // With ordered:true, bulkWrite stops at the first unmatched op, so
      // modifiedCount tells us exactly how many succeeded before the failure.
      const appliedOps = stockUpdates.slice(0, result.modifiedCount);

      if (attempt < MAX_ATTEMPTS) {
        // Roll back what succeeded, then retry after a short jitter delay.
        await rollbackOps(appliedOps, stockUpdates.length);
        const jitter = 50 + Math.floor(Math.random() * 100); // 50–150 ms
        await new Promise((resolve) => setTimeout(resolve, jitter));
        log.warn('stock', 'Stock deduction partial match — retrying', {
          attempt,
          matched: result.modifiedCount,
          expected: stockUpdates.length,
        });
        return executeStockDeductions(stockUpdates, attempt + 1);
      }

      // Genuine conflict after retries — roll back and surface to caller.
      await rollbackOps(appliedOps, stockUpdates.length);
      const err = new Error('Concurrent stock change detected');
      err.code = 'STOCK_CONFLICT';
      throw err;
    }

    log.info('stock', 'Stock deductions applied', {
      ops: stockUpdates.length,
      attempt,
    });
  } catch (err) {
    if (err.code === 'STOCK_CONFLICT') {
      // Already rolled back inside the retry path above; just re-throw.
      throw err;
    }

    // Unexpected DB error — log and re-throw; caller handles the 500 response.
    log.error('stock', 'Stock deduction DB error', {
      error: err.message,
      attempt,
    });
    throw err;
  }
}

/**
 * Reverse a set of stock deduction operations.
 * @param {object[]} ops - Operations to reverse
 * @param {number} totalOps - Total ops in the original batch (for logging)
 */
async function rollbackOps(ops, totalOps) {
  if (!ops || ops.length === 0) return;

  log.warn('stock', 'Rolling back stock deductions', {
    successfulOps: ops.length,
    totalOps,
  });

  const rollbacks = ops.map((op) => {
    const rollback = JSON.parse(JSON.stringify(op));
    const inc = rollback.updateOne.update.$inc;
    for (const key of Object.keys(inc)) {
      inc[key] = -inc[key];
    }
    return rollback;
  });

  await Product.bulkWrite(rollbacks, { ordered: false }).catch((rbErr) => {
    log.error('stock', 'Rollback failed — manual intervention may be required', {
      error: rbErr.message,
      ops: rollbacks.length,
    });
  });
}

/** Helper to create errors with status codes */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = {
  FOOTWEAR_THRESHOLD,
  DEFAULT_THRESHOLD,
  LOT_CATEGORIES,
  validateAndAllocateItem,
  enforceMustBuyAll,
  executeStockDeductions,
};
