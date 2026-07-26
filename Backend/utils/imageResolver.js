/**
 * ═══════════════════════════════════════════════════════════════
 *  Image Resolver Service (STRICT CLOUDINARY ONLY)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Resolves product image URLs:
 *   1. Checks Cloudinary for images named EXACTLY after the SKU.
 *   2. Validates Content-Type is image/*
 *   3. NO external web scraping or brand guessing.
 */

const https = require("https");
const http = require("http");

// ── Timeouts ──
const HEAD_TIMEOUT = 3000;

/**
 * HTTP HEAD to verify a URL serves an image (Content-Type: image/*).
 */
function verifyImageUrl(url) {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.request(
        url,
        {
          method: "HEAD",
          timeout: HEAD_TIMEOUT,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OxfordSports/1.0",
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
 * Strategy: Internal Cloudinary Store check only.
 */
function getCloudinaryCandidates(sku) {
  const candidates = [];
  const s = (sku || "").toUpperCase().trim();
  if (!s) return candidates;

  const cName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cName && cName !== "your_cloud_name") {
    const encodedSku = encodeURIComponent(s);
    // Standard path for uploaded product images
    candidates.push(`https://res.cloudinary.com/${cName}/image/upload/oxford-sports/products/${encodedSku}.jpg`);
    candidates.push(`https://res.cloudinary.com/${cName}/image/upload/v1/oxford-sports/products/${encodedSku}.jpg`);
  }

  return candidates;
}

/**
 * Resolve a product's image using ONLY Cloudinary.
 *
 * @param {Object} opts
 * @param {string} opts.sku - Product SKU
 * @returns {Promise<string|null>}
 */
async function resolveProductImage({ sku }) {
  if (!sku) return null;

  // Try Cloudinary candidates
  const cdnUrls = getCloudinaryCandidates(sku);
  for (const url of cdnUrls) {
    const valid = await verifyImageUrl(url);
    if (valid) return url;
  }

  return null;
}

/**
 * Batch-resolve images using only Cloudinary.
 */
async function batchResolveImages(products, concurrency = 5, onProgress) {
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
          failed.push({ sku: p.sku, reason: "Not found in Cloudinary" });
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
  isDirectImageUrl: (url) => {
    if (!url) return false;
    const s = String(url).trim().toLowerCase();
    // Only allow Cloudinary URLs as "direct" valid URLs
    if (s.includes("cloudinary.com") && s.startsWith("https://")) return true;
    return false;
  },
  isValidImageUrl: (url) => {
    if (!url) return false;
    const s = String(url).trim().toLowerCase();
    // Don't treat search engine links as valid anymore
    if (s.includes("google.com") || s.includes("bing.com") || s.includes("duckduckgo.com")) return false;
    return s.startsWith("https://res.cloudinary.com");
  },
};
