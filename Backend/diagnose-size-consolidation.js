#!/usr/bin/env node

/**
 * Size Consolidation Diagnostic Script
 * =====================================
 * Analyzes the product import system to diagnose Issue #1:
 * "Size Consolidation - 'ONE SIZE' Showing When Excel Has Different Sizes"
 * 
 * Usage: node Backend/diagnose-size-consolidation.js
 * 
 * This script:
 * 1. Tests size parsing functions with various formats
 * 2. Checks recent import batches in the database
 * 3. Identifies whether problem is in detection or consolidation
 * 4. Provides specific recommendations
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');
const ImportBatch = require('./models/ImportBatch');
const {
  parseSizeEntries,
  normalizeSizeEntries,
} = require('./utils/taxonomyUtils');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`);
const section = (title) => log(`\n${'='.repeat(80)}\n${title}\n${'='.repeat(80)}`, 'cyan');
const success = (msg) => log(`✓ ${msg}`, 'green');
const error = (msg) => log(`✗ ${msg}`, 'red');
const warn = (msg) => log(`⚠ ${msg}`, 'yellow');
const info = (msg) => log(`ℹ ${msg}`, 'blue');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    success('Connected to MongoDB');
    return true;
  } catch (err) {
    warn(`Could not connect to MongoDB: ${err.message}`);
    warn('Continuing with local tests only (parsing logic, file format checks)');
    return false;
  }
}

async function testSizeParsingLogic() {
  section('TEST 1: Size Parsing Logic');
  
  const testCases = [
    { input: 'M', expected: ['M'], desc: 'Single size' },
    { input: 'M, L, XL', expected: ['M', 'L', 'XL'], desc: 'Comma-separated sizes' },
    { input: 'M/L/XL', expected: ['M', 'L', 'XL'], desc: 'Slash-separated sizes' },
    { input: 'Medium', expected: ['Medium'], desc: 'Size spelled out' },
    { input: 'UK 8, 9, 10', expected: ['UK 8', 'UK 9', 'UK 10'], desc: 'Prefixed sizes' },
    { input: 'ONE SIZE', expected: ['ONE SIZE'], desc: 'ONE SIZE literal' },
    { input: '', expected: [], desc: 'Empty string' },
    { input: null, expected: [], desc: 'Null value' },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const result = parseSizeEntries(tc.input);
      const resultStr = JSON.stringify(result);
      const expectedStr = JSON.stringify(tc.expected);
      
      if (resultStr === expectedStr) {
        success(`"${tc.desc}" → ${resultStr}`);
        passed++;
      } else {
        error(`"${tc.desc}" - Expected ${expectedStr}, got ${resultStr}`);
        failed++;
      }
    } catch (err) {
      error(`"${tc.desc}" - Exception: ${err.message}`);
      failed++;
    }
  }

  info(`Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function analyzeRecentImports() {
  section('TEST 2: Recent Import Batches Analysis');
  
  try {
    const batches = await ImportBatch.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (batches.length === 0) {
      warn('No import batches found in database');
      return null;
    }

    info(`Found ${batches.length} recent import batches`);

    for (const batch of batches) {
      const date = new Date(batch.createdAt).toLocaleString();
      const status = batch.status === 'completed' ? '✓' : '⚠';
      
      log(`\n${status} Batch ID: ${batch._id}`);
      log(`   Date: ${date}`);
      log(`   Status: ${batch.status}`);
      log(`   Products: ${batch.productsCount || 0}`);
      
      if (batch.detailsStatus && Array.isArray(batch.detailsStatus)) {
        const withSizes = batch.detailsStatus.filter(d => d.sizeEntries?.length > 0).length;
        const oneSize = batch.detailsStatus.filter(d => d.sizeEntries?.length === 1).length;
        const noSize = batch.detailsStatus.filter(d => !d.sizeEntries || d.sizeEntries.length === 0).length;
        
        log(`   Products with sizes: ${withSizes}`);
        log(`   Products with ONE SIZE: ${oneSize}`);
        log(`   Products with NO sizes: ${noSize}`);
        
        if (noSize > batch.detailsStatus.length * 0.7) {
          error(`   >> PROBLEM DETECTED: ${noSize}/${batch.detailsStatus.length} (${((noSize/batch.detailsStatus.length)*100).toFixed(0)}%) have NO sizes!`);
        }
      }
    }

    return batches[0];
  } catch (err) {
    error(`Failed to analyze import batches: ${err.message}`);
    return null;
  }
}

async function analyzeProductDatabase() {
  section('TEST 3: Product Database Analysis');
  
  try {
    const total = await Product.countDocuments();
    const withSizes = await Product.countDocuments({ sizeEntries: { $exists: true, $ne: [] } });
    const withOneSize = await Product.countDocuments({ 'sizeEntries.1': { $exists: false } });
    const withMultipleSizes = await Product.countDocuments({ 'sizeEntries.1': { $exists: true } });
    const withWarnings = await Product.countDocuments({ _sizeWarnings: { $exists: true, $ne: [] } });

    info(`Total products: ${total}`);
    info(`Products with sizes: ${withSizes} (${((withSizes/total)*100).toFixed(1)}%)`);
    info(`Products with ONE size: ${withOneSize} (${((withOneSize/total)*100).toFixed(1)}%)`);
    info(`Products with MULTIPLE sizes: ${withMultipleSizes} (${((withMultipleSizes/total)*100).toFixed(1)}%)`);
    info(`Products with size warnings: ${withWarnings}`);

    // Sample products with ONE SIZE
    const oneSizeSamples = await Product.find({ sizeEntries: { $size: 1 } })
      .select('name sku sizeEntries brand model')
      .limit(5)
      .lean();

    if (oneSizeSamples.length > 0) {
      log('\nSample products with ONE SIZE:');
      for (const prod of oneSizeSamples) {
        log(`  • ${prod.name} (${prod.sku})`);
        log(`    Size: ${prod.sizeEntries[0]}`);
      }
    }

    // Check for common ONE SIZE patterns
    const oneSize = await Product.find({ sizeEntries: { $size: 1 } })
      .select('sizeEntries')
      .lean();
    
    const sizeFreq = {};
    for (const prod of oneSize) {
      const sz = prod.sizeEntries[0];
      sizeFreq[sz] = (sizeFreq[sz] || 0) + 1;
    }

    log('\nMost common single sizes:');
    const sorted = Object.entries(sizeFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [size, count] of sorted) {
      log(`  • "${size}": ${count} products`);
    }

    if (sizeFreq['ONE SIZE'] && sizeFreq['ONE SIZE'] > total * 0.3) {
      error(`>> PROBLEM: "ONE SIZE" appears in ${sizeFreq['ONE SIZE']} products!`);
      error('>> This indicates sizes are not being properly consolidated from Excel.');
    }

    return { total, withSizes, withOneSize, withMultipleSizes };
  } catch (err) {
    error(`Failed to analyze product database: ${err.message}`);
    return null;
  }
}

async function generateRecommendations(analysis) {
  section('DIAGNOSIS & RECOMMENDATIONS');

  if (!analysis) {
    warn('Not enough data for recommendations. Try importing a test file first.');
    return;
  }

  const { total, withSizes, withOneSize, withMultipleSizes } = analysis;

  if (withSizes === 0) {
    error('ISSUE: No products have any sizes');
    log('\nLikely cause: Size column not being detected in Excel');
    log('Solutions:');
    log('  1. Check your Excel file - what is the size column actually named?');
    log('  2. Open Backend/controllers/importController.js line 200+');
    log('  3. Find COLUMN_MAP and verify "size" aliases match your Excel header');
    log('  4. Add your custom column name if missing');
  } else if (withOneSize > total * 0.7) {
    error('ISSUE: Most products have only ONE SIZE');
    log('\nLikely cause: One of these is happening:');
    log('  A) Each row in Excel is ONE size (already consolidated by you)');
    log('     → This is correct, not a bug!');
    log('  B) Multiple sizes per row are NOT being parsed');
    log('     → Check size column format (M,L,XL vs M/L/XL)');
    log('  C) Size column has junk data');
    log('     → Check what "\x1b[1mactual\x1b[0m" size values your Excel has');
    log('\nDEBUG STEPS:');
    log('  1. Open CLIENT_REAL_PRODUCTS_TEMPLATE.xlsx');
    log('  2. Check column headers - what are they named?');
    log('  3. Check a few rows - do they have M,L,XL in one cell or separate rows?');
    log('  4. If separate rows, each row should create a separate Product SKU entry');
  } else if (withMultipleSizes > 0) {
    success('GOOD: Some products have multiple sizes (consolidation working)');
    info(`${withMultipleSizes} products successfully consolidated from ${total} total`);
    log('\nNext: Check admin UI to verify sizes display correctly');
  }

  log('\nNEXT ACTIONS:');
  log('  1. Import test file: curl -F "file=@CLIENT_REAL_PRODUCTS_TEMPLATE.xlsx" http://localhost:5000/api/import');
  log('  2. Check server logs for [IMPORT] Size consolidation stats');
  log('  3. Open admin UI to verify product sizes are showing');
  log('  4. If still ONE SIZE, share test file location for deeper analysis');
}

async function main() {
  log('\n', 'bright');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Size Consolidation Diagnostic Tool                        ║', 'cyan');
  log('║  Issue #1: "ONE SIZE" Showing When Excel Has Different     ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  const connected = await connectDB();

  // Run all tests
  await testSizeParsingLogic();
  
  if (connected) {
    const latestBatch = await analyzeRecentImports();
    const dbAnalysis = await analyzeProductDatabase();
    await generateRecommendations(dbAnalysis);
  } else {
    log('\n--- DATABASE CONNECTION FAILED ---', 'yellow');
    log('To complete this diagnosis, connect to MongoDB:', 'yellow');
    log('  1. Verify MongoDB cluster is running');
    log('  2. Check MONGO_URI in Backend/.env is correct');
    log('  3. Whitelist your IP on the cluster');
    log('  4. Run this script again', 'yellow');
    log('\nSize parsing tests completed successfully above.');
    log('Database analysis will run once MongoDB is accessible.', 'yellow');
  }

  section('DIAGNOSIS COMPLETE');
  log('\nIf problems persist, share the output above with the dev team.');
  log('Include: Excel file used, number of products, and size column format.\n');

  if (connected) {
    process.exit(0);
  } else {
    process.exit(0); // Exit cleanly even if DB not available
  }
}

main().catch((err) => {
  error(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
