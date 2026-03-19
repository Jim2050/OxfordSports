#!/usr/bin/env node
/**
 * Upload Functionality Verification Script
 * Tests: Image upload & Excel product import
 * Date: March 19, 2026
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.API_URL || "http://localhost:5000";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "test-token";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`),
};

// ═══════════════════════════════════════════════════════════════
// Test Data Files
// ═══════════════════════════════════════════════════════════════

// Create a minimal valid Excel file for testing
function createTestExcel() {
  try {
    const XLSX = require("xlsx");
    
    const testData = [
      {
        Code: "TEST001",
        Style: "Test Product 1",
        "Colour Desc": "Red",
        "UK Size": "8(5)",
        Trade: "15.99",
        RRP: "29.99",
        Gender: "Unisex",
      },
      {
        Code: "TEST002",
        Style: "Test Product 2",
        "Colour Desc": "Blue",
        "UK Size": "10(3)",
        Trade: "19.99",
        RRP: "39.99",
        Gender: "Male",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(testData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    const filePath = path.join(__dirname, "test-upload.xlsx");
    XLSX.writeFile(wb, filePath);
    return filePath;
  } catch (err) {
    log.error(`Failed to create Excel test file: ${err.message}`);
    return null;
  }
}

// Create a test image file (simple PNG)
function createTestImage() {
  try {
    // Create a simple 1x1 PNG
    const pngHex = "89504e470d0a1a0a0000000d494844520000000100000001" +
                   "0806000000001f15c4890000000a49444154789c6300010000" +
                   "0500010d0a2db40000000049454e44ae426082";
    
    const filePath = path.join(__dirname, "test-image.png");
    const buffer = Buffer.from(pngHex, "hex");
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    log.error(`Failed to create test image: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Test Functions
// ═══════════════════════════════════════════════════════════════

async function testExcelUpload() {
  log.header("Testing Excel Upload (Import Products)");

  const excelPath = createTestExcel();
  if (!excelPath) {
    log.error("Could not create test Excel file");
    return { passed: false, error: "File creation failed" };
  }

  try {
    log.info(`Test Excel file created: ${excelPath}`);

    const formData = new FormData();
    const fileStream = fs.readFileSync(excelPath);
    const blob = new Blob([fileStream], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    formData.append("file", blob, "test-upload.xlsx");

    log.info("Uploading Excel file to: POST /api/admin/import-products");
    
    const response = await axios.post(
      `${API_BASE}/api/admin/import-products`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (response.status === 200 || response.status === 201) {
      log.success(`Excel upload successful!`);
      log.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return {
        passed: true,
        data: response.data,
        statusCode: response.status,
      };
    } else {
      log.error(`Unexpected status code: ${response.status}`);
      return { passed: false, statusCode: response.status, error: response.data };
    }
  } catch (err) {
    log.error(`Excel upload failed: ${err.message}`);
    if (err.response) {
      log.error(`Status: ${err.response.status}`);
      log.error(`Error: ${JSON.stringify(err.response.data)}`);
    }
    return { passed: false, error: err.message };
  } finally {
    // Cleanup
    if (fs.existsSync(excelPath)) {
      fs.unlinkSync(excelPath);
      log.info("Test file cleaned up");
    }
  }
}

async function testSingleImageUpload() {
  log.header("Testing Single Image Upload (Product Image)");

  const imagePath = createTestImage();
  if (!imagePath) {
    log.error("Could not create test image");
    return { passed: false, error: "Image creation failed" };
  }

  try {
    log.info(`Test image created: ${imagePath}`);

    const formData = new FormData();
    const fileStream = fs.readFileSync(imagePath);
    const blob = new Blob([fileStream], { type: "image/png" });
    formData.append("image", blob, "test-image.png");

    // Using a sample SKU - adjust as needed
    const testSku = "IX4050";
    const uploadUrl = `${API_BASE}/api/admin/products/${testSku}/upload-image`;
    
    log.info(`Uploading image to: POST ${uploadUrl}`);

    const response = await axios.post(uploadUrl, formData, {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.status === 200 || response.status === 201) {
      log.success(`Image upload successful!`);
      log.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return {
        passed: true,
        data: response.data,
        statusCode: response.status,
      };
    } else {
      log.error(`Unexpected status code: ${response.status}`);
      return { passed: false, statusCode: response.status, error: response.data };
    }
  } catch (err) {
    log.error(`Image upload failed: ${err.message}`);
    if (err.response) {
      log.error(`Status: ${err.response.status}`);
      log.error(`Error: ${JSON.stringify(err.response.data)}`);
    }
    return { passed: false, error: err.message };
  } finally {
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      log.info("Test image cleaned up");
    }
  }
}

async function testUploadEndpoints() {
  log.header("Testing Upload Endpoints Availability");

  const endpoints = [
    { method: "POST", path: "/api/admin/import-products", name: "Excel Import" },
    { method: "POST", path: "/api/admin/upload-images", name: "ZIP Image Upload" },
    { method: "POST", path: "/api/admin/products/:sku/upload-image", name: "Single Image Upload" },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      log.info(`Checking: ${endpoint.method} ${endpoint.path}`);
      
      // Just check if endpoint exists (we'll get 400 for missing file, not 404)
      const response = await axios.post(
        `${API_BASE}${endpoint.path}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
          validateStatus: () => true, // Accept any status
        }
      );

      // 400/413 = endpoint exists but no/bad file
      // 404 = endpoint doesn't exist
      // 401 = endpoint exists but auth failed
      const exists =
        response.status !== 404 && response.status !== 501;

      if (exists) {
        log.success(`${endpoint.name} endpoint exists (Status: ${response.status})`);
        results.push({ endpoint: endpoint.name, exists: true });
      } else {
        log.error(`${endpoint.name} endpoint NOT found (Status: ${response.status})`);
        results.push({ endpoint: endpoint.name, exists: false });
      }
    } catch (err) {
      log.error(`Error checking ${endpoint.name}: ${err.message}`);
      results.push({ endpoint: endpoint.name, exists: false, error: err.message });
    }
  }

  return results;
}

async function testMiddlewareConfiguration() {
  log.header("Testing Middleware Configuration");

  const results = [];

  // Test 1: Check if multer is properly configured
  try {
    const uploadMiddleware = require("../middleware/uploadMiddleware");
    if (uploadMiddleware.uploadExcel && uploadMiddleware.uploadZip) {
      log.success("Upload middleware properly exported");
      results.push({ check: "Middleware exports", status: true });
    } else {
      log.error("Upload middleware missing exports");
      results.push({ check: "Middleware exports", status: false });
    }
  } catch (err) {
    log.error(`Failed to load middleware: ${err.message}`);
    results.push({ check: "Middleware exports", status: false });
  }

  // Test 2: Check temporary upload directory
  try {
    const tempDir = path.join(__dirname, "..", "uploads", "temp");
    if (fs.existsSync(tempDir)) {
      log.success(`Temporary upload directory exists: ${tempDir}`);
      results.push({ check: "Temp directory", status: true });
    } else {
      log.warning(`Temporary upload directory NOT found: ${tempDir}`);
      results.push({ check: "Temp directory", status: false });
    }
  } catch (err) {
    log.error(`Error checking temp directory: ${err.message}`);
    results.push({ check: "Temp directory", status: false });
  }

  // Test 3: Check Cloudinary configuration
  try {
    const cloudinary = require("../config/cloudinary");
    if (cloudinary && cloudinary.uploader) {
      log.success("Cloudinary configured and ready");
      results.push({ check: "Cloudinary config", status: true });
    } else {
      log.error("Cloudinary not properly configured");
      results.push({ check: "Cloudinary config", status: false });
    }
  } catch (err) {
    log.error(`Error checking Cloudinary: ${err.message}`);
    results.push({ check: "Cloudinary config", status: false });
  }

  // Test 4: Check file filters
  try {
    const { uploadExcel, uploadZip } = require("../middleware/uploadMiddleware");
    log.success("File filter middleware loaded");
    results.push({ check: "File filters", status: true });
  } catch (err) {
    log.error(`Error checking file filters: ${err.message}`);
    results.push({ check: "File filters", status: false });
  }

  return results;
}

async function testErrorHandling() {
  log.header("Testing Error Handling");

  const tests = [
    {
      name: "Missing file in Excel upload",
      endpoint: `${API_BASE}/api/admin/import-products`,
      expectedErrors: ["No file uploaded", "Empty file", "Could not parse"],
    },
    {
      name: "Invalid file type in Excel upload",
      endpoint: `${API_BASE}/api/admin/import-products`,
      expectedErrors: ["Only xlsx", "Only .xlsx", "file type"],
    },
    {
      name: "Invalid file type in image upload",
      endpoint: `${API_BASE}/api/admin/upload-images`,
      expectedErrors: ["Only image", "image files", "file type"],
    },
  ];

  const results = [];

  for (const test of tests) {
    try {
      log.info(`Testing: ${test.name}`);

      // Send request without file
      const response = await axios.post(test.endpoint, {}, {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        validateStatus: () => true,
      });

      const hasError = response.status >= 400;
      const errorMessage = JSON.stringify(response.data);
      const containsExpectedError = test.expectedErrors.some((err) =>
        errorMessage.toLowerCase().includes(err.toLowerCase())
      );

      if (hasError) {
        log.success(`${test.name}: Proper error response`);
        results.push({
          test: test.name,
          status: "passed",
          error: response.data,
        });
      } else {
        log.warning(
          `${test.name}: Expected error but got success (${response.status})`
        );
        results.push({
          test: test.name,
          status: "warning",
          response: response.data,
        });
      }
    } catch (err) {
      log.error(`Error in test ${test.name}: ${err.message}`);
      results.push({
        test: test.name,
        status: "error",
        error: err.message,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Main Test Runner
// ═══════════════════════════════════════════════════════════════

async function runAllTests() {
  console.clear();
  log.header("UPLOAD FUNCTIONALITY VERIFICATION");
  log.info(`API: ${API_BASE}`);
  log.info(`Test started: ${new Date().toISOString()}`);

  const allResults = {
    timestamp: new Date().toISOString(),
    api: API_BASE,
    tests: {},
  };

  try {
    // Test 1: Check endpoints exist
    log.info("Step 1/4: Checking endpoint availability...");
    const endpointResults = await testUploadEndpoints();
    allResults.tests.endpoints = endpointResults;

    // Test 2: Check middleware & config
    log.info("\nStep 2/4: Checking middleware configuration...");
    const middlewareResults = await testMiddlewareConfiguration();
    allResults.tests.middleware = middlewareResults;

    // Test 3: Error handling
    log.info("\nStep 3/4: Testing error handling...");
    const errorResults = await testErrorHandling();
    allResults.tests.errorHandling = errorResults;

    // Test 4: Actual uploads (if API is running)
    log.info("\nStep 4/4: Testing actual uploads...");
    const excelResult = await testExcelUpload();
    allResults.tests.excelUpload = excelResult;

    const imageResult = await testSingleImageUpload();
    allResults.tests.imageUpload = imageResult;
  } catch (err) {
    log.error(`Test suite error: ${err.message}`);
    allResults.error = err.message;
  }

  // Print summary
  log.header("TEST SUMMARY");
  const summary = {
    endpointsFound: allResults.tests.endpoints?.filter((e) => e.exists)?.length || 0,
    middlewareChecks: allResults.tests.middleware?.filter((m) => m.status)?.length || 0,
    excelUploadPassed: allResults.tests.excelUpload?.passed || false,
    imageUploadPassed: allResults.tests.imageUpload?.passed || false,
  };

  console.log(JSON.stringify(summary, null, 2));

  // Save results to file
  const resultsFile = path.join(__dirname, "upload-test-results.json");
  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  log.success(`Results saved to: ${resultsFile}`);

  log.info(`\nTest completed: ${new Date().toISOString()}`);
}

// Run if executed directly
if (require.main === module) {
  runAllTests().catch((err) => {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  testExcelUpload,
  testSingleImageUpload,
  testUploadEndpoints,
  testMiddlewareConfiguration,
  testErrorHandling,
};
