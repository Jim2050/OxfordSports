/**
 * Image matching service.
 * Matches image filenames (minus extension) to product SKUs.
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const productStore = require("./productStore");

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Extract a ZIP of product images and match them to products by SKU.
 * Images are saved to /uploads/products/ with SKU-based filenames.
 *
 * @param {string} zipPath - Path to uploaded .zip file
 * @returns {{ matched: number, unmatched: number, unmatchedFiles: string[], errors: string[] }}
 */
function matchImagesFromZip(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const outputDir = path.join(__dirname, "..", "uploads", "products");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let matched = 0;
  let unmatched = 0;
  const unmatchedFiles = [];
  const errors = [];

  for (const entry of entries) {
    // Skip directories and hidden files
    if (entry.isDirectory) continue;
    const filename = path.basename(entry.entryName);
    if (filename.startsWith(".") || filename.startsWith("__")) continue;

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;

    // Strip extension → expected SKU
    const stem = path.basename(filename, ext).trim().toUpperCase();
    if (!stem) continue;

    // Find product by SKU
    const product = productStore.getBySku(stem);

    if (product) {
      // Save image
      const destFilename = `${stem}${ext}`;
      const destPath = path.join(outputDir, destFilename);
      try {
        fs.writeFileSync(destPath, entry.getData());
        // Update product's imageUrl to the served path
        const imageUrl = `/uploads/products/${destFilename}`;
        productStore.setImage(stem, imageUrl);
        matched++;
      } catch (err) {
        errors.push(`Failed to save ${filename}: ${err.message}`);
      }
    } else {
      unmatched++;
      unmatchedFiles.push(filename);
    }
  }

  // Clean up the zip file
  try {
    fs.unlinkSync(zipPath);
  } catch {}

  return { matched, unmatched, unmatchedFiles, errors };
}

module.exports = { matchImagesFromZip };
