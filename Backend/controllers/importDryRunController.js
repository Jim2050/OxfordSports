/**
 * Import Dry-Run Controller
 * ─────────────────────────
 * Provides a "preview before commit" pipeline for admin imports.
 *
 * POST /api/admin/import-products/dry-run
 *
 * Flow:
 *   1. Upload Excel → Parse all sheets (same logic as live import)
 *   2. Validate every row via Zod schema
 *   3. Detect anomalies (zero-stock wipeouts, price outliers, missing sizes)
 *   4. Return a structured preview with valid/failed/warning breakdowns
 *   5. Admin reviews → corrects failed SKUs → sends only valid data to live commit
 *
 * This NEVER touches the production database.
 */

const log = require('../lib/logger');
const { validateImportBatch } = require('../lib/validators');

/**
 * POST /api/admin/import-products/dry-run
 * Parse and validate an Excel file without committing to the database.
 */
exports.importDryRun = async (req, res) => {
  const filePath = req.file?.path;
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    log.info('import', 'Dry-run import started', {
      filename: req.file.originalname,
      size: req.file.size,
    });

    // ── Re-use the existing Excel parser ──
    const {
      parseExcelFile,
      normalizeParentChildSkus,
      consolidateBySku,
    } = require('../lib/importParser');

    const { rows, headers, mapping, unmappedHeaders, sheetSummary } =
      parseExcelFile(filePath);

    if (rows.length === 0) {
      cleanup(filePath);
      return res.status(400).json({
        error: 'Excel file is empty or could not be parsed.',
        dryRun: true,
      });
    }

    // ── Normalize parent-child SKUs ──
    const hasSizeMapping = !!mapping.sizes;
    const normalizedRows = normalizeParentChildSkus(rows, hasSizeMapping);

    // ── Consolidate by SKU ──
    const consolidated = consolidateBySku(normalizedRows);

    // ── Validate via Zod ──
    const validation = validateImportBatch(consolidated);

    // ── Anomaly Detection ──
    const anomalies = detectAnomalies(consolidated, validation.validRows);

    const totalMs = Date.now() - startTime;

    log.info('import', 'Dry-run complete', {
      totalRows: rows.length,
      consolidated: consolidated.length,
      valid: validation.summary.valid,
      failed: validation.summary.failed,
      anomalies: anomalies.length,
      durationMs: totalMs,
    });

    cleanup(filePath);

    res.json({
      dryRun: true,
      success: true,
      summary: {
        rawRows: rows.length,
        consolidatedProducts: consolidated.length,
        ...validation.summary,
        anomalies: anomalies.length,
        executionTimeMs: totalMs,
      },
      mapping: {
        detected: mapping,
        unmappedHeaders,
        sheetSummary,
      },
      // ── Failed SKUs: admin can fix these ──
      failedSkus: validation.failedRows.slice(0, 50).map((f) => ({
        sku: f.sku,
        rowIndex: f.rowIndex,
        errors: f.errors,
        rawData: sanitizeRawData(f.rawData),
      })),
      // ── Anomalies: warnings that need human review ──
      anomalies: anomalies.slice(0, 30),
      // ── Sample valid products for preview ──
      validSample: validation.validRows.slice(0, 10).map((r) => ({
        sku: r.sku,
        name: r.name,
        price: r.price,
        rrp: r.rrp,
        category: r.category,
        brand: r.brand,
        sizes: r.sizes,
        quantity: r.quantity,
      })),
      // ── Full list of valid SKUs (for the commit step) ──
      validSkuCount: validation.validRows.length,
    });
  } catch (err) {
    log.error('import', 'Dry-run failed', { error: err.message });
    cleanup(filePath);
    res.status(500).json({ error: `Dry-run failed: ${err.message}`, dryRun: true });
  }
};

// ── Helper: detect anomalies in the parsed data ──────────

/**
 * Detect potential data quality issues.
 * @param {Array} allRows - All consolidated rows
 * @param {Array} validRows - Zod-validated rows
 * @returns {Array<{ type: string, severity: string, message: string, skus?: string[] }>}
 */
function detectAnomalies(allRows, validRows) {
  const anomalies = [];

  // 1. Zero-stock wipeout check
  const zeroStockCount = validRows.filter(
    (r) => (r.quantity === 0 || r.quantity === null) && !r.sizes
  ).length;
  const zeroStockRatio = validRows.length > 0 ? zeroStockCount / validRows.length : 0;

  if (zeroStockRatio > 0.5) {
    anomalies.push({
      type: 'ZERO_STOCK_WIPEOUT',
      severity: 'critical',
      message: `${zeroStockCount} of ${validRows.length} products (${(zeroStockRatio * 100).toFixed(0)}%) have ZERO stock. This will wipe out inventory for most products.`,
      affectedCount: zeroStockCount,
    });
  }

  // 2. Missing price
  const noPriceCount = validRows.filter((r) => r.price === null || r.price === 0).length;
  if (noPriceCount > 10) {
    anomalies.push({
      type: 'MISSING_PRICES',
      severity: 'high',
      message: `${noPriceCount} products have no price. They will default to £0.00.`,
      affectedCount: noPriceCount,
      sampleSkus: validRows
        .filter((r) => r.price === null || r.price === 0)
        .slice(0, 5)
        .map((r) => r.sku),
    });
  }

  // 3. Price outliers (suspiciously high or low)
  const prices = validRows
    .map((r) => r.price)
    .filter((p) => typeof p === 'number' && p > 0);
  if (prices.length > 10) {
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const outliers = validRows.filter(
      (r) => typeof r.price === 'number' && r.price > 0 && r.price > median * 10
    );
    if (outliers.length > 0) {
      anomalies.push({
        type: 'PRICE_OUTLIERS',
        severity: 'medium',
        message: `${outliers.length} products have prices >10x the median (£${median.toFixed(2)}). Possible data error.`,
        sampleSkus: outliers.slice(0, 5).map((r) => `${r.sku} (£${r.price})`),
      });
    }
  }

  // 4. Missing size data
  const noSizeCount = validRows.filter((r) => !r.sizes || r.sizes === '').length;
  if (noSizeCount > validRows.length * 0.5) {
    anomalies.push({
      type: 'MISSING_SIZES',
      severity: 'medium',
      message: `${noSizeCount} of ${validRows.length} products have no size data.`,
      affectedCount: noSizeCount,
    });
  }

  // 5. Missing category
  const noCatCount = validRows.filter((r) => !r.category).length;
  if (noCatCount > validRows.length * 0.3) {
    anomalies.push({
      type: 'MISSING_CATEGORIES',
      severity: 'low',
      message: `${noCatCount} products have no category. Auto-categorization will attempt to classify them.`,
      affectedCount: noCatCount,
    });
  }

  return anomalies;
}

/**
 * Strip internal fields from raw data for safe display.
 */
function sanitizeRawData(raw) {
  if (!raw) return {};
  const clean = { ...raw };
  delete clean._sheetName;
  delete clean._sizeExtractedFromDescription;
  delete clean._rawPrice;
  return clean;
}

/**
 * Delete temp file silently.
 */
function cleanup(filePath) {
  if (!filePath) return;
  try {
    const fs = require('fs');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Silently ignore cleanup failures
  }
}

/**
 * Get the internal helper functions from importController.
 * These are defined as module-scope functions in importController.js
 * but not exported. We extract them by re-requiring the source.
 *
 * In production, we should refactor these into lib/importParser.js,
 * but for now this bridge approach avoids rewriting 2400 lines.
 */
function getImportHelpers() {
  // These are the same functions used by the live import.
  // We use a dynamic require to access them.
  // If they haven't been extracted yet, provide stubs that
  // redirect to the full importProducts flow.

  try {
    const helpers = require('../lib/importParser');
    return helpers;
  } catch {
    // Fallback: the helpers haven't been extracted yet.
    // Use a minimal parser that calls XLSX directly.
    const XLSX = require('xlsx');

    return {
      parseExcelFile(filePath) {
        const workbook = XLSX.readFile(filePath);
        const allRows = [];
        const sheetSummary = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (rawData.length === 0) {
            sheetSummary.push({ name: sheetName, rows: 0 });
            continue;
          }

          const headers = Object.keys(rawData[0]);
          for (const raw of rawData) {
            const values = Object.values(raw).filter(
              (v) => v !== '' && v !== null && v !== undefined
            );
            if (values.length === 0) continue;
            allRows.push({ _sheetName: sheetName, ...raw });
          }
          sheetSummary.push({ name: sheetName, rows: rawData.length });
        }

        return {
          rows: allRows,
          headers: allRows.length > 0 ? Object.keys(allRows[0]) : [],
          mapping: {},
          unmappedHeaders: [],
          sheetSummary,
        };
      },

      normalizeParentChildSkus(rows) {
        return rows;
      },

      consolidateBySku(rows) {
        const map = new Map();
        for (const row of rows) {
          const sku = String(row.sku || row.Code || row.SKU || '').trim().toUpperCase();
          if (!sku) continue;
          if (!map.has(sku)) {
            map.set(sku, { ...row, sku });
          }
        }
        return Array.from(map.values());
      },
    };
  }
}
