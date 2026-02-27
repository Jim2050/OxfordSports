/**
 * ═══════════════════════════════════════════════════════════════
 *  FOLDER-BASED IMAGE UPLOADER
 * ═══════════════════════════════════════════════════════════════
 *
 *  HOW TO USE:
 *  1. Put all product images in: Backend/uploads/product-images/
 *  2. Name images by SKU:  S80602.jpg, S80116.png, etc.
 *  3. Run: node upload-folder-images.js
 *
 *  This will:
 *  - Upload all images to Cloudinary
 *  - Match them to products by SKU (filename)
 *  - Update database with Cloudinary URLs
 *  - Keep fallback placeholder for products without images
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const Product = require("./models/Product");
const cloudinary = require("./config/cloudinary");

const IMAGES_FOLDER = path.join(__dirname, "uploads", "product-images");

async function uploadFolderImages() {
  console.log("═══ FOLDER IMAGE UPLOADER ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check if folder exists
    if (!fs.existsSync(IMAGES_FOLDER)) {
      console.log(`❌ Folder not found: ${IMAGES_FOLDER}`);
      console.log(`\nPlease create the folder and add images named by SKU:`);
      console.log(`   Example: S80602.jpg, S80116.png, etc.\n`);
      fs.mkdirSync(IMAGES_FOLDER, { recursive: true });
      console.log(`✅ Created folder: ${IMAGES_FOLDER}`);
      console.log(`   Add your images there and run this script again.`);
      return;
    }

    // Get all image files
    const files = fs
      .readdirSync(IMAGES_FOLDER)
      .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

    if (files.length === 0) {
      console.log(`❌ No images found in: ${IMAGES_FOLDER}`);
      console.log(`\nSupported formats: .jpg, .jpeg, .png, .gif, .webp`);
      console.log(`Name files by SKU: S80602.jpg, S80116.png, etc.\n`);
      return;
    }

    console.log(`Found ${files.length} images\n`);

    let uploaded = 0;
    let matched = 0;
    let notFound = 0;
    let errors = 0;

    for (const file of files) {
      try {
        // Extract SKU from filename  (e.g., "S80602.jpg" → "S80602")
        const sku = path.basename(file, path.extname(file)).trim();

        // Find product
        const product = await Product.findOne({ sku });

        if (!product) {
          notFound++;
          console.log(`✗ ${file}: Product SKU "${sku}" not found in database`);
          continue;
        }

        // Upload to Cloudinary
        const filePath = path.join(IMAGES_FOLDER, file);
        console.log(`⬆️  Uploading ${file} for SKU ${sku}...`);

        const result = await cloudinary.uploader.upload(filePath, {
          folder: "oxford-sports",
          public_id: `product-${sku}`,
          resource_type: "image",
          overwrite: true,
        });

        // Update product
        product.imageUrl = result.secure_url;
        product.imagePublicId = result.public_id;
        await product.save();

        uploaded++;
        matched++;
        console.log(
          `   ✓ Uploaded & matched: ${result.secure_url.substring(0, 60)}...\n`,
        );
      } catch (err) {
        errors++;
        console.log(`   ✗ Error: ${err.message}\n`);
      }
    }

    console.log(`\n═══ UPLOAD COMPLETE ═══`);
    console.log(`   Images processed: ${files.length}`);
    console.log(`   Uploaded to Cloudinary: ${uploaded} ✅`);
    console.log(`   Matched to products: ${matched} ✅`);
    console.log(`   SKUs not found: ${notFound}`);
    console.log(`   Errors: ${errors}`);

    // Stats
    const withImages = await Product.countDocuments({
      imageUrl: { $exists: true, $ne: null, $ne: "" },
    });
    const total = await Product.countDocuments();

    console.log(`\n📊 Database Status:`);
    console.log(`   Products with images: ${withImages}/${total}`);
    console.log(`   Products need images: ${total - withImages}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Connection closed");
  }
}

uploadFolderImages();
