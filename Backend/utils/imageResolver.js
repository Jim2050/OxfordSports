/**
 * ═══════════════════════════════════════════════════════════════
 *  Image Resolver Service
 * ═══════════════════════════════════════════════════════════════
 *
 *  Resolves product image URLs automatically:
 *   1. Parses Google search URLs to extract search query
 *   2. Uses DuckDuckGo "vqd" + image search to find real images
 *   3. Falls back to brand-specific CDN patterns
 *   4. Validates Content-Type is image/*
 *   5. Stores resolved direct image URL in MongoDB
 *
 *  Zero external dependencies — uses Node built-in https.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// ── Timeouts ──
const FETCH_TIMEOUT = 8000;
const HEAD_TIMEOUT = 5000;

// ── Known image extensions ──
const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i;

/**
 * Simple HTTP(S) GET returning { statusCode, headers, body }.
 */
function httpGet(url, { timeout = FETCH_TIMEOUT, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        timeout,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,*/*",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      },
      (res) => {
        // Follow redirects
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          maxRedirects > 0
        ) {
          const next = new URL(res.headers.location, url).href;
          return httpGet(next, { timeout, maxRedirects: maxRedirects - 1 })
            .then(resolve)
            .catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", reject);
  });
}

/**
 * HTTP HEAD to verify a URL serves an image (Content-Type: image/*).
 */
function verifyImageUrl(url) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.request(
        url,
        {
          method: "HEAD",
          timeout: HEAD_TIMEOUT,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
        (res) => {
          const ct = (res.headers["content-type"] || "").toLowerCase();
          resolve(
            res.statusCode >= 200 &&
              res.statusCode < 400 &&
              ct.startsWith("image/"),
          );
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Extract the search query from a Google image search URL.
 * e.g. "https://www.google.com/search?tbm=isch&q=adidas+S80602" → "adidas S80602"
 */
function extractGoogleQuery(url) {
  try {
    const u = new URL(url);
    // Try ?q= parameter first
    const q = u.searchParams.get("q");
    if (q) return q.replace(/\+/g, " ").trim();
    // No query found
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract image URLs from raw HTML using regex.
 * Looks for patterns commonly found in search result pages.
 */
function extractImageUrlsFromHtml(html) {
  const urls = new Set();

  // Pattern: URLs ending in image extensions
  const urlRe =
    /https?:\/\/[^\s"'<>()]+?\.(jpe?g|png|webp)(?:\?[^\s"'<>()]*)?/gi;
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    const url = m[0];
    // Skip tiny thumbnails and icons
    if (
      url.includes("favicon") ||
      url.includes("logo") ||
      url.includes("icon") ||
      url.includes("1x1") ||
      url.includes("pixel") ||
      url.includes("tracking") ||
      url.includes("google.com") ||
      url.includes("gstatic.com") ||
      url.includes("duckduckgo.com")
    )
      continue;
    urls.add(url);
  }

  return [...urls];
}

/**
 * Strategy 1: DuckDuckGo image search (no API key needed).
 * Fetches the HTML page and extracts image URLs from the response.
 */
async function searchDuckDuckGo(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " product image")}&iax=images&ia=images`;
    const res = await httpGet(searchUrl, { timeout: FETCH_TIMEOUT });
    if (res.statusCode !== 200) return [];
    return extractImageUrlsFromHtml(res.body);
  } catch {
    return [];
  }
}

/**
 * Strategy 2: Bing image search (scrape HTML, no API key).
 */
async function searchBing(query) {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await httpGet(searchUrl, { timeout: FETCH_TIMEOUT });
    if (res.statusCode !== 200) return [];

    // Bing embeds image URLs in data attributes like murl="..."
    const murlRe = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/gi;
    const urls = [];
    let m;
    while ((m = murlRe.exec(res.body)) !== null) {
      const url = m[1]
        .replace(/&amp;/g, "&")
        .replace(/\\u002f/gi, "/")
        .replace(/\\u003a/gi, ":");
      if (IMG_EXT_RE.test(url)) urls.push(url);
    }
    // Also try generic extraction
    urls.push(...extractImageUrlsFromHtml(res.body));
    return [...new Set(urls)];
  } catch {
    return [];
  }
}

/**
 * Strategy 3: Brand-specific CDN URL patterns.
 * For adidas, construct known CDN URL patterns.
 */
function brandCdnCandidates(sku, brand) {
  const candidates = [];
  const b = (brand || "").toLowerCase();
  const s = (sku || "").toUpperCase();

  if (b.includes("adidas")) {
    // adidas assets CDN pattern (common format)
    candidates.push(
      `https://assets.adidas.com/images/w_600,f_auto,q_auto/assets/${s}_1.jpg`,
    );
  }
  if (b.includes("nike")) {
    candidates.push(`https://static.nike.com/a/images/t_PDP_1280_v1/${s}.jpg`);
  }

  return candidates;
}

/**
 * Resolve a single product's image. Returns the resolved direct image URL
 * or null if resolution fails.
 *
 * @param {Object} opts
 * @param {string} opts.sku - Product SKU
 * @param {string} opts.brand - Product brand name
 * @param {string} opts.name - Product name
 * @param {string} opts.currentUrl - Current imageUrl (may be Google search link)
 * @returns {Promise<string|null>}
 */
async function resolveProductImage({ sku, brand, name, currentUrl }) {
  // 1. If it's already a direct image, verify it
  if (currentUrl && IMG_EXT_RE.test(currentUrl)) {
    const valid = await verifyImageUrl(currentUrl);
    if (valid) return currentUrl;
  }

  // 2. Extract query from Google search URL
  let query = extractGoogleQuery(currentUrl || "");
  if (!query) {
    // Build query from product metadata
    query = [brand, sku, name].filter(Boolean).join(" ");
  }
  if (!query) return null;

  // 3. Try brand CDN patterns first (fastest)
  const cdnUrls = brandCdnCandidates(sku, brand);
  for (const url of cdnUrls) {
    const valid = await verifyImageUrl(url);
    if (valid) return url;
  }

  // 4. Search Bing for product images
  let candidates = await searchBing(query);
  for (const url of candidates.slice(0, 5)) {
    const valid = await verifyImageUrl(url);
    if (valid) return url;
  }

  // 5. Fallback: DuckDuckGo
  candidates = await searchDuckDuckGo(query);
  for (const url of candidates.slice(0, 5)) {
    const valid = await verifyImageUrl(url);
    if (valid) return url;
  }

  return null;
}

/**
 * Batch-resolve images for multiple products.
 * Processes concurrently with a concurrency limit.
 *
 * @param {Array<Object>} products - Array of { sku, brand, name, currentUrl }
 * @param {number} concurrency - Max parallel resolutions
 * @param {function} onProgress - Callback (resolved, failed, total)
 * @returns {Promise<{ resolved: Array, failed: Array }>}
 */
async function batchResolveImages(products, concurrency = 3, onProgress) {
  const resolved = [];
  const failed = [];
  let idx = 0;

  async function worker() {
    while (idx < products.length) {
      const i = idx++;
      const p = products[i];
      try {
        const url = await resolveProductImage(p);
        if (url) {
          resolved.push({ sku: p.sku, imageUrl: url });
        } else {
          failed.push({ sku: p.sku, reason: "No image found" });
        }
      } catch (err) {
        failed.push({ sku: p.sku, reason: err.message });
      }
      if (onProgress)
        onProgress(resolved.length, failed.length, products.length);
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, products.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return { resolved, failed };
}

module.exports = {
  resolveProductImage,
  batchResolveImages,
  verifyImageUrl,
  extractGoogleQuery,
  isDirectImageUrl: (url) => {
    if (!url) return false;
    const s = String(url).trim().toLowerCase();
    if (s.length < 10) return false;
    if (s.includes("google.com/search") || s.includes("tbm=isch")) return false;
    if (!s.startsWith("http://") && !s.startsWith("https://")) return false;
    if (IMG_EXT_RE.test(s)) return true;
    if (
      s.includes("cloudinary.com") ||
      s.includes("imgur.com") ||
      s.includes("images.unsplash.com") ||
      s.includes("cdn.shopify.com")
    )
      return true;
    return false;
  },
};
