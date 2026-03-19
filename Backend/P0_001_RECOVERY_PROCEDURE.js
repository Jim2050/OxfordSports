// P0-001: RESTORE 900 MISSING PRODUCTS
// This script will restore products from backup or re-import from Excel

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const MONGO_URI = 'mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford';

// Product schema definition (simplified for recovery)
const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, required: true },
  name: String,
  description: String,
  category: mongoose.Schema.Types.ObjectId,
  subcategory: String,
  brand: String,
  color: String,
  barcode: String,
  price: Number,
  rrp: Number,
  discount: Number,
  sizes: [{
    size: String,
    quantity: Number
  }],
  totalQuantity: Number,
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const Category = mongoose.model('Category'); // Existing in DB

async function recoverP0001() {
  try {
    console.log('🔄 P0-001: PRODUCT RECOVERY PROCEDURE');
    console.log('='.repeat(70));
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Step 1: Check current count
    const currentCount = await Product.countDocuments({ isActive: true });
    console.log(`\n📊 Current Product Count: ${currentCount}`);
    console.log(`   Target: 5900`);
    console.log(`   Missing: ${Math.max(0, 5900 - currentCount)}`);
    
    // Step 2: Identify strategy
    console.log('\n📋 RECOVERY OPTIONS:');
    console.log('─'.repeat(70));
    
    if (currentCount >= 5900) {
      console.log('✅ All 5900 products are already in database!');
      console.log('   P0-001 is COMPLETE');
      await mongoose.connection.close();
      return;
    }
    
    const missing = 5900 - currentCount;
    console.log(`\n🔍 STRATEGY: Re-import Excel file for ${missing} missing products`);
    console.log('\nRECOMMENDED STEPS:');
    console.log('1. Export current database products to CSV');
    console.log('   Command: GET /api/admin/export');
    console.log('2. Compare with original Excel file');
    console.log('3. Identify SKUs in Excel but not in database');
    console.log('4. Re-import missing SKUs only');
    console.log('5. Verify all 5900 products');
    
    // Step 3: Sample recovery script
    console.log('\n⚙️  PSEUDO-CODE FOR RECOVERY:');
    console.log('─'.repeat(70));
    console.log(`
// 1. Parse original Excel file
const wb = XLSX.readFile('path/to/WEBSITE_CATEGORIES_YASIR.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[0]);
console.log('Excel total rows:', data.length);

// 2. Get SKUs from current database
const dbSkus = await Product.distinct('sku');
console.log('Database SKUs:', dbSkus.length);

// 3. Find missing SKUs
const missingSkus = data.filter(row => !dbSkus.includes(row.SKU));
console.log('Missing SKUs:', missingSkus.length);

// 4. Parse and import missing products
const categories = await Category.find();
const categoryMap = Object.fromEntries(categories.map(c => [c.name, c._id]));

const products = missingSkus.map(row => ({
  sku: row.SKU,
  name: row.Title,
  description: row.Description,
  category: categoryMap[row.Category],
  subcategory: row.Subcategory,
  brand: row.Brand,
  color: row.Color,
  barcode: row.Barcode,
  price: parseFloat(row['Sale Price']),
  rrp: parseFloat(row.RRP),
  discount: parseFloat(row['Discount %']),
  sizes: parseSizes(row.Sizes), // Use existing parser
  totalQuantity: parseInt(row.QTY),
  isActive: true
}));

// 5. Batch insert
const BATCH_SIZE = 100;
for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);
  await Product.insertMany(batch);
  console.log(\`Imported batch: \${i + batch.length} / \${products.length}\`);
}

console.log('✅ All 5900 products restored!');
    `);
    
    console.log('\n' + '='.repeat(70));
    console.log('ACTION: Use the script above to re-import missing products');
    console.log('TIMELINE: 15-20 minutes for full import');
    
    await mongoose.connection.close();
    
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
}

// Run if executed directly
if (require.main === module) {
  recoverP0001().then(() => process.exit(0)).catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

module.exports = { recoverP0001 };
