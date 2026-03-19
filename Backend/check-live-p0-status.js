// Query live OxfordSports API to check P0-001 and P0-002 status
const https = require('https');

function queryLiveAPI(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://www.oxfordsports.online${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('📊 LIVE DATABASE STATUS CHECK\n');
    console.log('='.repeat(60));
    
    // Check 1: Total product count
    console.log('\n✓ Fetch P0-001: Total Product Count');
    console.log('─'.repeat(60));
    
    const productsRes = await queryLiveAPI('/api/products?limit=1');
    console.log('API Response structure:', Object.keys(productsRes || {}));
    
    if (productsRes && productsRes.totalCount !== undefined) {
      console.log(`✅ Total Products in Database: ${productsRes.totalCount}`);
      const missing = Math.max(0, 5900 - productsRes.totalCount);
      console.log(`   Missing Products: ${missing} (Target: 5900)`);
      console.log(`   Status: ${missing > 0 ? '❌ INCOMPLETE' : '✅ COMPLETE'}`);
    } else {
      console.log('⚠️  Could not retrieve product count from API');
      console.log('   Response keys:', Object.keys(productsRes || {}));
    }
    
    // Check 2: Single-size products
    console.log('\n✓ Fetch P0-002: Single-Size Product Examples');
    console.log('─'.repeat(60));
    
    const singleSizeRes = await queryLiveAPI('/api/products?limit=100');
    if (Array.isArray(singleSizeRes)) {
      const singleSize = singleSizeRes.filter(p => p.sizes && p.sizes.length === 1);
      console.log(`Found ${singleSize.length} single-size products in first 100`);
      
      if (singleSize.length > 0) {
        console.log('\n   Example single-size products:');
        singleSize.slice(0, 3).forEach(p => {
          console.log(`   - SKU: ${p.sku}`);
          console.log(`     Name: ${p.name}`);
          console.log(`     Sizes: ${JSON.stringify(p.sizes)}`);
          console.log(`     Display Issue: Verify if size shows on product card`);
          console.log('');
        });
      }
    }
    
    // Check 3: Database connectivity
    console.log('\n✓ Check P0 CRITICAL PATH STATUS');
    console.log('─'.repeat(60));
    console.log('P0-001 Status: ' + (missing > 0 ? '🔴 CRITICAL - Missing ' + missing + ' products' : '✅ COMPLETE'));
    console.log('P0-002 Status: ' + (singleSize?.length > 0 ? '⚠️  NEEDS VERIFICATION - ' + singleSize.length + ' affected' : '❓ UNKNOWN'));
    
    console.log('\n' + '='.repeat(60));
    console.log('Next Steps:');
    console.log('1. Check if 900 products exist but in different collection');
    console.log('2. Verify single-size display in UI at:');
    console.log('   https://www.oxfordsports.online/products');
    
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
})();
