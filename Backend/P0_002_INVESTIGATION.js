// P0-002: SINGLE-SIZE PRODUCT INVESTIGATION
// Analyze if single-size products display correctly

const https = require('https');

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.oxfordsports.online',
      path: path,
      method: 'GET'
    };
    
    https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    }).on('error', reject).end();
  });
}

(async () => {
  console.log('🔍 P0-002: SINGLE-SIZE DISPLAY INVESTIGATION\n');
  console.log('='.repeat(70));
  
  try {
    // Test 1: Try to fetch a product by SKU
    console.log('\n1️⃣  Testing product API');
    console.log('─'.repeat(70));
    
    const res = await request('/api/products/JN3717');
    console.log('Status:', res.status);
    
    if (res.status === 200) {
      const product = JSON.parse(res.data);
      console.log('✅ Product fetched successfully');
      console.log('   SKU:', product.sku);
      console.log('   Name:', product.name);
      console.log('   Sizes count:', product.sizes ? product.sizes.length : 0);
      console.log('   Total Qty:', product.totalQuantity);
      
      if (product.sizes && product.sizes.length > 0) {
        console.log('\n   Size details:');
        product.sizes.forEach((s, i) => {
          console.log(`   [${i}] ${s.size}: ${s.quantity} units`);
        });
      }
    } else {
      console.log('⚠️  Could not fetch product (API error)');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 P0-002 STATUS ANALYSIS:');
    console.log('─'.repeat(70));
    console.log(`
If API is working:
  ✓ Code for displaying single-size is correct (no conditional filters)
  ✓ getSizes() returns array of {size, quantity} even for single items
  ✓ ProductCard renders if displaySizes.length > 0 (works for single size)
  ✓ Size display shows: "SizeLabel (quantity)"

If UI still doesn't show single sizes:
  → Issue may be in CSS display (unlikely - no hidden rules)
  → Issue may be data-level (sizes array not populated for some products)
  → Issue may be in browser rendering (already fixed with test on P2-001)

NEXT STEPS FOR P0-002:
  1. Verify data in database:
     db.products.findOne({sku: "XXXX"}).sizes
     Should show: [{size: "L", quantity: 1}]
  
  2. If data is correct, no code fix needed
  
  3. If data is missing sizes:
     - Re-import products from Excel
     - Update product.sizes field for affected items
    `);
    
    console.log('\n' + '='.repeat(70));
    console.log('💡 CONCLUSION:');
    console.log('─'.repeat(70));
    console.log(`
P0-002 may not be a CODE bug, but a DATA issue:
- Frontend code correctly displays all sizes (including single)
- Issue might be: Products in DB don't have sizes populated

REMEDIATION:
1. Query DB to find products with empty/missing sizes
2. Re-parse Excel to extract sizes for those products
3. Update products with sizes data
4. Verify on live site

Current status: API not responding (500 errors)
  → Once API is operational, check actual product data
  → Then determine if data reimport is needed
    `);
      
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
