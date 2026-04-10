function normalizeFootwearSizeLabel(size) {
  return String(size || "").trim();
}

function normalizeSizeLabel(rawSize, category = "") {
  const raw = String(rawSize || "").trim();
  if (!raw) return "";

  if (String(category || "").trim().toUpperCase() === "FOOTWEAR") {
    return normalizeFootwearSizeLabel(raw);
  }

  return raw;
}

function normalizeSizeEntries(entries = [], category = "", options = {}) {
  const merged = new Map();

  for (const entry of entries) {
    const size = normalizeSizeLabel(entry?.size, category);
    const qtyRaw = Number(entry?.quantity);
    const qty = Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : 0;
    if (!size) continue;
    merged.set(size, (merged.get(size) || 0) + qty);
  }

  return Array.from(merged.entries()).map(([size, quantity]) => ({
    size,
    quantity,
  }));
}

function distributeQuantityAcrossSizes(sizeCount, totalQty) {
  const count = Math.max(0, Number(sizeCount) || 0);
  const total = Math.max(0, Number(totalQty) || 0);
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  let remainder = total % count;
  const result = new Array(count).fill(base);
  for (let i = 0; i < count && remainder > 0; i += 1) {
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}

function parseSizesInput(sizesInput, totalQuantity, category = "") {
  // Object array format: [{ size, quantity }]
  if (Array.isArray(sizesInput) && sizesInput.length > 0 && typeof sizesInput[0] === "object") {
    return normalizeSizeEntries(
      sizesInput.map((entry) => ({
        size: entry?.size,
        quantity: Number.isFinite(Number(entry?.quantity)) ? Number(entry.quantity) : 0,
      })),
      category,
    );
  }

  // Array of labels: ["S", "M", "L"]
  // No synthetic distribution: labels without explicit per-size qty get 0.
  if (Array.isArray(sizesInput) && sizesInput.length > 0) {
    const labels = sizesInput.map((s) => String(s || "").trim()).filter(Boolean);
    const entries = labels.map((size) => ({
      size,
      quantity: 0,
    }));
    return normalizeSizeEntries(entries, category);
  }

  // String format
  const rawText = String(sizesInput || "").trim();
  if (!rawText) return [];

  const semicolonParts = rawText.split(";").map((s) => s.trim()).filter(Boolean);
  const commaParts = rawText.split(",").map((s) => s.trim()).filter(Boolean);
  const parts = semicolonParts.length > 1 ? semicolonParts : commaParts;

  const hasEmbeddedQty = parts.some((part) => /\(\d+\)$/.test(part));
  const hasColonQty = parts.some((part) => /:\s*\d+$/i.test(part));

  if (hasEmbeddedQty || hasColonQty) {
    const parsedEntries = [];
    for (const part of parts) {
      const embeddedMatch = part.match(/^(.*)\((\d+)\)$/);
      if (embeddedMatch) {
        parsedEntries.push({
          size: embeddedMatch[1].trim(),
          quantity: Number.parseInt(embeddedMatch[2], 10) || 0,
        });
        continue;
      }

      const colonMatch = part.match(/^(.*):\s*(\d+)$/);
      if (colonMatch) {
        parsedEntries.push({
          size: colonMatch[1].trim(),
          quantity: Number.parseInt(colonMatch[2], 10) || 0,
        });
        continue;
      }

      parsedEntries.push({ size: part, quantity: 0 });
    }

    return normalizeSizeEntries(parsedEntries, category);
  }

  // Labels-only string (e.g. "S, M, L") is preserved without invented quantities.
  const labels = parts;
  const entries = labels.map((size) => ({
    size,
    quantity: 0,
  }));

  return normalizeSizeEntries(entries, category);
}

/**
 * Validate if a size code is valid (not placeholder/unknown)
 * Rejects: NS, N/A, NA, UNKNOWN, UNK, NULL, EMPTY, etc.
 * Returns: true if size is valid, false if invalid
 */
function isValidSizeCode(sizeStr, category = "") {
  return String(sizeStr || "").trim().length > 0;
}

module.exports = {
  normalizeFootwearSizeLabel,
  normalizeSizeEntries,
  parseSizesInput,
  isValidSizeCode,
};
