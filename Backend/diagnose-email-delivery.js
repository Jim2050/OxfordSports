#!/usr/bin/env node
/**
 * Production Email Delivery Diagnostic
 * Check if recent orders have email delivery logs and status
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("./models/Order");

async function diagnoseEmailDelivery() {
  console.log("\n📧 PRODUCTION EMAIL DELIVERY DIAGNOSTIC\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get last 5 orders
    console.log("📋 Fetching last 10 recent orders...\n");
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderNumber customerEmail status createdAt emailSent")
      .lean();

    if (recentOrders.length === 0) {
      console.log("❌ No orders found in database");
      process.exit(1);
    }

    console.log("RECENT ORDERS:\n");
    console.log("─".repeat(80));
    console.log(
      "Order Number     | Customer Email              | Status | Email Sent | Age"
    );
    console.log("─".repeat(80));

    for (const order of recentOrders) {
      const age = Math.floor((Date.now() - order.createdAt) / 1000);
      const ageStr =
        age < 60
          ? `${age}s`
          : age < 3600
            ? `${Math.floor(age / 60)}m`
            : `${Math.floor(age / 3600)}h`;
      const emailSent = order.emailSent ? "✅ Yes" : "❌ No";

      console.log(
        `${order.orderNumber.padEnd(16)} | ${(order.customerEmail || "N/A").padEnd(27)} | ${order.status.padEnd(6)} | ${emailSent.padEnd(10)} | ${ageStr}`
      );
    }

    console.log("─".repeat(80));

    // Analyze email delivery success rate
    const emailSentCount = recentOrders.filter((o) => o.emailSent).length;
    const successRate = ((emailSentCount / recentOrders.length) * 100).toFixed(1);

    console.log(`\n📊 Email Delivery Stats (last 10 orders):`);
    console.log(`   Sent: ${emailSentCount}/${recentOrders.length} (${successRate}%)`);

    if (emailSentCount === 0) {
      console.log("\n⚠️  NO EMAILS WERE SENT!");
      console.log("   This indicates SMTP authentication or queue failure.");
      console.log("\n   Next steps:");
      console.log("   1. Check Railway logs for [SMTP DEBUG] error messages");
      console.log("   2. Run: node test-smtp.js (to verify SMTP locally)");
      console.log("   3. Verify SMTP_PASS has backslash before asterisk: Microsoft1971turbs\\*");
    } else if (emailSentCount < recentOrders.length) {
      console.log(
        "\n⚠️  PARTIAL EMAIL DELIVERY - Some emails not sent"
      );
      console.log("   Check Railway logs for intermittent failures");
    } else {
      console.log("\n✅ ALL RECENT EMAILS SENT SUCCESSFULLY!");
    }

    // Show newest order details
    console.log(`\n\n🔍 NEWEST ORDER DETAILS:`);
    const newest = recentOrders[0];
    console.log(`   Order Number: ${newest.orderNumber}`);
    console.log(`   Customer: ${newest.customerEmail}`);
    console.log(`   Status: ${newest.status}`);
    console.log(`   Email Sent: ${newest.emailSent ? "✅ Yes" : "❌ No"}`);
    console.log(`   Created: ${new Date(newest.createdAt).toLocaleString()}`);

    await mongoose.connection.close();
    console.log(`\n✅ Diagnostic complete\n`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

diagnoseEmailDelivery();
