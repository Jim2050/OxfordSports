function normalizeFootwearSizeLabel(size) {
  const raw = String(size || "").trim().toUpperCase();
  if (!raw) return "";

  const numeric = raw.match(/^-?\d+(?:\.\d+)?$/);
  if (numeric) {
    const absolute = Math.abs(Number(raw));
    if (!Number.isFinite(absolute)) return "";

    // Accept practical footwear ranges while rejecting obvious corruption.
    // - UK/adult style values: 1..15.5
    // - Junior/EU-style values seen in client feed: 16..55
    // - Reject >55 and tiny/invalid numbers.
    if (absolute < 1 || absolute > 55) return "";

    // Prevent noisy decimal precision in source feeds.
    const rounded = Math.round(absolute * 2) / 2;
    if (rounded < 1 || rounded > 55) return "";
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  if (/^\d{4,}$/.test(raw)) return "";
  return raw;
}

function normalizeSizeLabel(rawSize, category = "") {
  const categoryUpper = String(category || "").trim().toUpperCase();
  const raw = String(rawSize || "").trim();
  if (!raw) return "";

  if (categoryUpper === "FOOTWEAR") {
    return normalizeFootwearSizeLabel(raw);
  }

  const cleaned = raw
    .replace(/^-(?=\d)/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  // Labels containing brackets are usually corrupted parse artifacts.
  if (/[()]/.test(cleaned)) return "";

  const numeric = cleaned.match(/^\d+(?:\.\d+)?$/);
  if (numeric) {
    const value = Number(cleaned);
    if (!Number.isFinite(value)) return "";
    // Generic non-footwear numeric sizes outside practical apparel ranges are invalid.
    if (value < 1 || value > 60) return "";
  }

  // Reject obvious concatenation artifacts such as 1161 or 34341.
  if (/^\d{4,}$/.test(cleaned)) return "";
  return cleaned;
}

function normalizeSizeEntries(entries = [], category = "", options = {}) {
  const { dropOneSizeWhenSpecific = true } = options;
  const merged = new Map();

  for (const entry of entries) {
    const size = normalizeSizeLabel(entry?.size, category);
    const qty = Math.max(0, Number(entry?.quantity) || 0);
    if (!size || qty <= 0) continue;
    merged.set(size, (merged.get(size) || 0) + qty);
  }

  let normalized = Array.from(merged.entries()).map(([size, quantity]) => ({
    size,
    quantity,
  }));

  if (dropOneSizeWhenSpecific) {
    const hasSpecificSizes = normalized.some(
      (entry) => entry.size.toUpperCase() !== "ONE SIZE",
    );
    if (hasSpecificSizes) {
      normalized = normalized.filter(
        (entry) => entry.size.toUpperCase() !== "ONE SIZE",
      );
    }
  }

  return normalized;
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
    return normalizeSizeEntries(sizesInput, category);
  }

  // Array of labels: ["S", "M", "L"]
  if (Array.isArray(sizesInput) && sizesInput.length > 0) {
    const labels = sizesInput.map((s) => String(s || "").trim()).filter(Boolean);
    const qtyDistribution = distributeQuantityAcrossSizes(
      labels.length,
      Number(totalQuantity) || 0,
    );
    const entries = labels.map((size, idx) => ({
      size,
      quantity: qtyDistribution[idx] || 0,
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

  const labels = parts;
  const qtyDistribution = distributeQuantityAcrossSizes(
    labels.length,
    Number(totalQuantity) || 0,
  );
  const entries = labels.map((size, idx) => ({
    size,
    quantity: qtyDistribution[idx] || 0,
  }));

  return normalizeSizeEntries(entries, category);
}

module.exports = {
  normalizeFootwearSizeLabel,
  normalizeSizeEntries,
  parseSizesInput,
};
