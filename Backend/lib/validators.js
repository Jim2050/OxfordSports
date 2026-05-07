/**
 * Import Validation Schemas (Zod)
 * ────────────────────────────────
 * Strict schema validation for incoming data at the API boundary.
 * Prevents malformed data from ever reaching the database layer.
 *
 * Schemas:
 *   - importRowSchema:    Validates a single parsed Excel row
 *   - checkoutItemSchema: Validates a single cart item in a checkout request
 *   - checkoutSchema:     Validates the full checkout request body
 *
 * Usage:
 *   const { validateImportRow } = require('./lib/validators');
 *   const { success, data, errors } = validateImportRow(rawRow);
 */

const { z } = require('zod');

// ── Import Row Schema ──────────────────────────────────────

const importRowSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .transform((v) => v.trim().toUpperCase()),

  name: z
    .string()
    .default('')
    .transform((v) => v.trim()),

  description: z
    .string()
    .default('')
    .transform((v) => v.trim()),

  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return null;
      const cleaned = String(v).replace(/[£$€,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) || num < 0 ? null : +num.toFixed(2);
    }),

  rrp: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return 0;
      const cleaned = String(v).replace(/[£$€,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) || num < 0 ? 0 : +num.toFixed(2);
    }),

  category: z.string().default('').transform((v) => v.trim()),
  subcategory: z.string().default('').transform((v) => v.trim()),
  brand: z.string().default('').transform((v) => v.trim()),
  color: z.string().default('').transform((v) => v.trim()),
  barcode: z.string().default('').transform((v) => v.trim()),
  sizes: z.string().default(''),
  quantity: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      const num = parseInt(String(v));
      return isNaN(num) || num < 0 ? 0 : num;
    }),
  imageUrl: z.string().default('').transform((v) => v.trim()),
});

// ── Checkout Item Schema ───────────────────────────────────

const checkoutItemSchema = z.object({
  sku: z
    .string({ required_error: 'SKU is required' })
    .min(1, 'SKU cannot be empty')
    .transform((v) => v.trim().toUpperCase()),

  size: z
    .string()
    .default('')
    .transform((v) => v.trim()),

  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),

  lotItem: z.boolean().default(false),

  maxStock: z
    .number()
    .optional()
    .transform((v) => (v != null && v > 0 ? Math.floor(v) : undefined)),
});

// ── Full Checkout Request Schema ───────────────────────────

const checkoutSchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(200, 'Maximum 200 items per order'),

  notes: z
    .string()
    .max(2000, 'Notes cannot exceed 2000 characters')
    .default(''),
});

// ── Validation Helpers ─────────────────────────────────────

/**
 * Validate a single import row. Returns structured result.
 * @param {object} rawRow
 * @returns {{ success: boolean, data?: object, errors?: Array<{ field: string, message: string }> }}
 */
function validateImportRow(rawRow) {
  const result = importRowSchema.safeParse(rawRow);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
  return { success: false, errors };
}

/**
 * Validate a full checkout request body.
 * @param {object} body - req.body
 * @returns {{ success: boolean, data?: object, errors?: Array<{ field: string, message: string }> }}
 */
function validateCheckout(body) {
  const result = checkoutSchema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
  return { success: false, errors };
}

/**
 * Validate a batch of import rows. Returns summary + per-row results.
 * @param {Array<object>} rows
 * @returns {{ validRows: object[], failedRows: Array<{ rowIndex: number, sku: string, errors: object[] }>, summary: { total: number, valid: number, failed: number } }}
 */
function validateImportBatch(rows) {
  const validRows = [];
  const failedRows = [];

  for (let i = 0; i < rows.length; i++) {
    const result = validateImportRow(rows[i]);
    if (result.success) {
      validRows.push({ ...result.data, _rowIndex: i });
    } else {
      failedRows.push({
        rowIndex: i,
        sku: String(rows[i]?.sku || '').trim().toUpperCase() || `ROW-${i + 1}`,
        rawData: rows[i],
        errors: result.errors,
      });
    }
  }

  return {
    validRows,
    failedRows,
    summary: {
      total: rows.length,
      valid: validRows.length,
      failed: failedRows.length,
    },
  };
}

module.exports = {
  importRowSchema,
  checkoutItemSchema,
  checkoutSchema,
  validateImportRow,
  validateCheckout,
  validateImportBatch,
};
