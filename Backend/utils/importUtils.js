/**
 * ═══════════════════════════════════════════════════════════════
 *  Import Utilities — shared helpers for Excel import pipeline
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Normalize a header string for alias matching.
 * Converts to lowercase, removes special chars (except spaces, (), £).
 *
 * Examples:
 *   "Trade Price (£)" → "trade price (£)"
 *   "Image URL"       → "image url"
 *   "__EMPTY_1"       → "empty1"
 *   "UK Size"         → "uk size"
 */
function normalizeHeader(h) {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ()£]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Safely parse a numeric price from various Excel formats.
 * Handles: £ symbol, $ symbol, € symbol, commas, string values, raw numbers.
 *
 * @param {*} raw - Raw cell value from Excel
 * @returns {{ value: number|null, error: string|null }}
 *
 * Examples:
 *   parsePrice(26.44)       → { value: 26.44, error: null }
 *   parsePrice("£29.99")    → { value: 29.99, error: null }
 *   parsePrice("1,299.00")  → { value: 1299, error: null }
 *   parsePrice("")          → { value: null, error: "empty" }
 *   parsePrice("N/A")       → { value: null, error: 'unparseable: "N/A"' }
 */
function parsePrice(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { value: null, error: "empty" };
  }
  if (typeof raw === "number") {
    if (isNaN(raw)) return { value: null, error: "NaN" };
    if (raw < 0) return { value: null, error: `negative: ${raw}` };
    return { value: raw, error: null };
  }
  const cleaned = String(raw)
    .replace(/[£$€,\s]/g, "")
    .replace(/[^0-9.\-]/g, "");
  if (!cleaned) return { value: null, error: `unparseable: "${raw}"` };
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { value: null, error: `NaN after parse: "${raw}"` };
  if (num < 0) return { value: null, error: `negative: ${num}` };
  return { value: num, error: null };
}

/**
 * Validate a URL string — must start with http:// or https://.
 * Rejects bare text like "Google Images" and very short strings.
 * Also rejects Google/Bing search page URLs.
 *
 * @param {*} url - Raw URL value from Excel
 * @returns {boolean}
 */
function isValidImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (s.length < 10) return false;
  const lower = s.toLowerCase();
  if (lower === "google images" || lower === "google image") return false;
  if (
    lower.includes("google.com/search") ||
    lower.includes("bing.com/images") ||
    lower.includes("tbm=isch")
  )
    return false;
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/** Known image file extensions */
const IMG_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|bmp|avif)(\?.*)?$/i;

/**
 * Strict validation — URL must point to an actual image file.
 * Rejects search-engine URLs, landing pages, etc.
 *
 * @param {*} url - Raw URL value from Excel
 * @returns {boolean}
 */
function isDirectImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (s.length < 10) return false;
  const lower = s.toLowerCase();
  if (lower === "google images" || lower === "google image") return false;
  if (
    lower.includes("google.com/search") ||
    lower.includes("bing.com/images") ||
    lower.includes("tbm=isch")
  )
    return false;
  if (!lower.startsWith("http://") && !lower.startsWith("https://"))
    return false;
  if (IMG_EXTENSIONS.test(lower)) return true;
  if (
    lower.includes("cloudinary.com") ||
    lower.includes("imgur.com") ||
    lower.includes("images.unsplash.com") ||
    lower.includes("cdn.shopify.com")
  )
    return true;
  return false;
}

/**
 * Create a URL-friendly slug from a string.
 *   "Men's Rugby" → "mens-rugby"
 */
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  normalizeHeader,
  parsePrice,
  isValidImageUrl,
  isDirectImageUrl,
  slugify,
};
