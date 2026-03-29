#!/usr/bin/env node
/**
 * Test Order Placement Script
 * Use this to place test orders and verify email delivery
 * Usage: node test-order-placement.js [baseUrl] [email] [password]
 */

const http = require("http");
const https = require("https");

// Configuration
const baseUrl =
  process.argv[2] || "https://oxfordsports-production.up.railway.app";
const testEmail = process.argv[3] || "testuser@example.com";
const testPassword = process.argv[4] || "TestPassword123!";

// Color output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  step: (num, msg) =>
    console.log(
      `${colors.cyan}Step ${num}:${colors.reset} ${msg}`
    ),
};

// Helper to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Main test flow
async function runTest() {
  console.log(
    `\n🧪 OXFORD SPORTS EMAIL VERIFICATION TEST\n`
  );
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Test User: ${testEmail}\n`);

  try {
    // Step 1: Health check
    log.step(1, "Checking API health...");
    const healthRes = await makeRequest("GET", "/api/test/health/database");
    if (healthRes.status !== 200) {
      log.error("API not responding! Status: " + healthRes.status);
      process.exit(1);
    }
    log.success("API is healthy ✓");

    // Step 2: Register/Login
    log.step(2, "Authenticating test user...");

    // Try to register
    const registerRes = await makeRequest(
      "POST",
      "/api/auth/register",
      {
        firstName: "Test",
        lastName: "Verify",
        email: testEmail,
        password: testPassword,
      }
    );

    let token;
    if (registerRes.status === 201 || registerRes.status === 200) {
      token = registerRes.data.token;
      log.success("User registered successfully ✓");
    } else if (registerRes.status === 409) {
      // User already exists, try login
      log.info("User already exists, logging in...");
      const loginRes = await makeRequest(
        "POST",
        "/api/auth/login",
        {
          email: testEmail,
          password: testPassword,
        }
      );
      if (loginRes.status !== 200) {
        log.error("Login failed: " + JSON.stringify(loginRes.data));
        process.exit(1);
      }
      token = loginRes.data.token;
      log.success("User logged in successfully ✓");
    } else {
      log.error("Authentication failed: " + JSON.stringify(registerRes.data));
      process.exit(1);
    }

    // Step 3: Get available products
    log.step(3, "Fetching available products...");
    const productsRes = await makeRequest("GET", "/api/products?limit=5");
    if (productsRes.status !== 200 || !productsRes.data.products) {
      log.error("Could not fetch products");
      process.exit(1);
    }

    const products = productsRes.data.products;
    log.info(`Found ${products.length} products`);

    // Find a product with stock
    let selectedProduct = null;
    for (const prod of products) {
      if (prod.totalQuantity > 0) {
        selectedProduct = prod;
        break;
      }
    }

    if (!selectedProduct) {
      log.error("No products with stock available");
      process.exit(1);
    }

    log.success(
      `Selected product: ${selectedProduct.name} (${selectedProduct.sku}) ✓`
    );

    // Step 4: Place order
    log.step(4, "Placing test order...");
    const orderStartTime = Date.now();

    let size = "UK10";
    if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
      size = selectedProduct.sizes[0].size;
    }

    const orderRes = await makeRequest(
      "POST",
      "/api/orders",
      {
        items: [
          {
            sku: selectedProduct.sku,
            size: size,
            quantity: 1,
          },
        ],
        notes: "Test order for SMTP verification",
      },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    const orderTime = Date.now() - orderStartTime;

    if (orderRes.status !== 201) {
      log.error("Order placement failed: " + JSON.stringify(orderRes.data));
      process.exit(1);
    }

    const orderData = orderRes.data;
    log.success(
      `Order placed successfully in ${orderTime}ms ✓`
    );
    log.info(`Order Number: ${orderData.order.orderNumber}`);
    log.info(`Order Total: £${orderData.order.totalPrice}`);

    // Step 5: Check email status
    log.step(5, "Checking email status...");
    if (orderData.emailStatus) {
      if (orderData.emailStatus.sent) {
        log.success(`Email sent to: ${orderData.emailStatus.recipientEmail} ✓`);
        log.info(
          `Sent at: ${new Date(orderData.emailStatus.timestamp).toISOString()}`
        );
      } else if (orderData.emailStatus.error) {
        log.warn(`Email failed to send: ${orderData.emailStatus.error}`);
      } else {
        log.warn("Email status unclear");
      }
    } else {
      log.warn("No email status in response");
    }

    // Step 6: Summary and next steps
    console.log(`\n${"─".repeat(60)}`);
    log.step(6, "Verification Summary");
    console.log(`${"─".repeat(60)}`);
    console.log(`
Order Details:
  • Number: ${orderData.order.orderNumber}
  • Time to complete: ${orderTime}ms
  • Status: ${orderData.order.status}
  • User: ${testEmail}

Email Status:
  • Queued/Sent: ${orderData.emailStatus?.sent ? "✅ Yes" : "⏳ Queued"}
  • Email address: ${orderData.emailStatus?.recipientEmail || testEmail}
  • Timestamp: ${
    orderData.emailStatus?.timestamp
      ? new Date(orderData.emailStatus.timestamp).toLocaleString()
      : "N/A"
  }

Next Steps:
  1. Check your email inbox (${testEmail}) for order confirmation
     from sales@oxfordsports.net
  2. Email should arrive within 1-2 minutes
  3. Check Railway logs for [ORDER EMAIL SUCCESS] or [SMTP DEBUG] messages
  4. If email doesn't arrive, review VERIFY_SMTP_FIX.md troubleshooting section

Server URL: ${baseUrl}
Order API: POST /api/orders
Test Routes: ${baseUrl}/api/test/health/database
    `);

    log.success("Test completed!");
  } catch (err) {
    log.error("Test failed with error: " + err.message);
    console.error(err);
    process.exit(1);
  }
}

runTest();
