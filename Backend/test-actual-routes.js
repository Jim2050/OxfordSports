// Test actual API routes on live site
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
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    }).on('error', reject).end();
  });
}

(async () => {
  try {
    console.log('🚀 LIVE SITE API TESTING\n');
    console.log('='.repeat(70));
    
    // Test 1: Health check
    console.log('\n1️⃣  Health Check: GET /api/health/products');
    console.log('─'.repeat(70));
    let res = await request('/api/health/products');
    console.log('Status:', res.status);
    if (res.data) {
      console.log('Response:', res.data.substring(0, 300));
    }
    
    // Test 2: Get products (paginated)
    console.log('\n2️⃣  Get Products: GET /api/products');
    console.log('─'.repeat(70));
    res = await request('/api/products?page=1&limit=1');
    console.log('Status:', res.status);
    if (res.status === 200) {
      try {
        const data = JSON.parse(res.data);
        console.log('Response type:', Array.isArray(data) ? 'Array' : typeof data);
        if (Array.isArray(data)) {
          console.log('Products returned:', data.length);
          if (data.length > 0) {
            console.log('\nFirst product structure:');
            const p = data[0];
            console.log('  - SKU:', p.sku);
            console.log('  - Name:', p.name);
            console.log('  - Sizes:', p.sizes ? p.sizes.length + ' available' : 'N/A');
            console.log('  - Total Qty:', p.totalQuantity);
          }
        } else if (data.products) {
          console.log('Found products count:', data.products.length);
          console.log('Total count:', data.totalCount || data.count);
        } else if (data.count) {
          console.log('Database count:', data.count);
        }
      } catch(e) {
        console.log('Parse error:', e.message);
        console.log('Raw:', res.data.substring(0, 300));
      }
    } else {
      console.log('Response:', res.data.substring(0, 300));
    }
    
    // Test 3: Get by SKU
    console.log('\n3️⃣  Get by SKU: GET /api/products/JN3717');
    console.log('─'.repeat(70));
    res = await request('/api/products/JN3717');
    console.log('Status:', res.status);
    if (res.status === 200) {
      try {
        const data = JSON.parse(res.data);
        console.log('SKU:', data.sku);
        console.log('Name:', data.name);
        console.log('Sizes:', JSON.stringify(data.sizes));
        console.log('Total Qty:', data.totalQuantity);
      } catch(e) {
        console.log('Raw:', res.data.substring(0, 300));
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ API Testing Complete');
    
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
})();
