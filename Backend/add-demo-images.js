/**
 * Add Demo Images - Resolves real product images for first 100 products
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Product = require("./models/Product");
const {
  resolveProductImage,
  batchResolveImages,
} = require("./utils/imageResolver");

async function addDemoImages() {
  console.log("═══ ADDING DEMO IMAGES ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get first 100 products without images
    console.log("Finding products without images...");
    const products = await Product.find({
      $or: [{ imageUrl: null }, { imageUrl: "" }],
    })
      .limit(100)
      .lean();

    console.log(`Found ${products.length} products to process\n`);

    if (products.length === 0) {
      console.log("No products need images!");
      return;
    }

    // Try to resolve images
    console.log("Resolving images (this may take a few minutes)...\n");
    let resolved = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        // Create a Google search URL from SKU and name
        const query = `${p.brand || "adidas"} ${p.sku} ${p.name}`.replace(
          /[^\w\s]/g,
          "",
        );
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;

        const imageUrl = await resolveProductImage({
          googleUrl,
          sku: p.sku,
          brand: p.brand || "adidas",
          name: p.name,
        });

        if (imageUrl) {
          await Product.updateOne({ _id: p._id }, { $set: { imageUrl } });
          resolved++;
          console.log(
            `✓ ${i + 1}/${products.length}: ${p.sku} → ${imageUrl.substring(0, 60)}...`,
          );
        } else {
          failed++;
          console.log(
            `✗ ${i + 1}/${products.length}: ${p.sku} (no image found)`,
          );
        }

        // Progress update every 10
        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${resolved} resolved, ${failed} failed\n`);
        }
      } catch (err) {
        failed++;
        console.log(
          `✗ ${i + 1}/${products.length}: ${p.sku} (error: ${err.message})`,
        );
      }
    }

    console.log(`\n✅ DEMO IMAGES COMPLETE!`);
    console.log(`   Resolved: ${resolved}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Remaining without images: ${products.length - resolved}\n`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Connection closed");
  }
}

addDemoImages();
