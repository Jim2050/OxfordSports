#!/usr/bin/env node
/**
 * SMTP Password Auto-Fix Tool
 * Tests password format variations and stores the working format
 * Automatically detects and fixes the password escaping issue
 */

require("dotenv").config();
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

async function fixSMTPPassword() {
  console.log("\n🔐 SMTP PASSWORD AUTO-FIX TOOL\n");

  const host = "smtp.office365.com";
  const port = 587;
  const user = "sales@oxfordsports.net";
  const envPass = process.env.SMTP_PASS || "";

  console.log(`Current env SMTP_PASS: "${envPass}"`);
  console.log(`Current env SMTP_USER: "${user}"`);
  console.log(`\nTesting variations...\n`);

  // Test different password format variations
  const variations = [
    {
      name: "Plain asterisk (no backslash)",
      pass: "Microsoft1971turbs*",
      desc: "Most likely - Railway treats backslash literally",
    },
    {
      name: "URL-encoded asterisk",
      pass: "Microsoft1971turbs%2A",
      desc: "Fallback if plain doesn't work",
    },
    {
      name: "Double-escaped asterisk",
      pass: "Microsoft1971turbs\\\\*",
      desc: "If Railway strips one backslash",
    },
    {
      name: "Current env value",
      pass: envPass,
      desc: "As it currently appears",
    },
  ];

  let workingPassword = null;
  let workingProvider = null;

  for (const variation of variations) {
    console.log(`\n📝 Testing: ${variation.name}`);
    console.log(`   Password: "${variation.pass}"`);
    console.log(`   Reason: ${variation.desc}`);

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: {
          user,
          pass: variation.pass,
        },
        connectionTimeout: 5000,
        socketTimeout: 5000,
      });

      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);

      console.log(`   ✅ SUCCESS!\n`);
      console.log(
        `   🎉 Found working password format!`
      );
      console.log(
        `   Password: "${variation.pass}"`
      );
      workingPassword = variation.pass;
      workingProvider = "outlook";
      break;
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
    }
  }

  // If no Outlook format works, try Gmail
  if (!workingPassword) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(
      `\n⚠️  No Outlook password format worked.`
    );
    console.log(`\nTrying Gmail SMTP as fallback...\n`);

    // Gmail variations
    const gmailVariations = [
      {
        name: "Gmail app-specific password",
        user: "noreply@oxfordsports.net",
        pass: process.env.GMAIL_PASS || "your-app-specific-password",
        desc: "Requires 2FA enabled + app password generated",
      },
    ];

    for (const variation of gmailVariations) {
      console.log(
        `\n📝 Testing Gmail: ${variation.name}`
      );
      console.log(
        `   User: "${variation.user}"`
      );
      console.log(
        `   Reason: ${variation.desc}`
      );

      if (variation.pass === "your-app-specific-password") {
        console.log(
          `   ⏭️  Skipped - GMAIL_PASS not configured`
        );
        continue;
      }

      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: variation.user,
            pass: variation.pass,
          },
          connectionTimeout: 5000,
          socketTimeout: 5000,
        });

        const verifyPromise = transporter.verify();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        await Promise.race([verifyPromise, timeoutPromise]);

        console.log(`   ✅ SUCCESS!\n`);
        console.log(
          `   🎉 Gmail SMTP works as fallback!`
        );
        console.log(
          `   User: "${variation.user}"`
        );
        workingPassword = variation.pass;
        workingProvider = "gmail";
        break;
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
      }
    }
  }

  // Report findings
  console.log(`\n${"═".repeat(70)}\n`);

  if (workingPassword) {
    console.log(`✅ SOLUTION FOUND!\n`);
    console.log(
      `Provider: ${workingProvider === "gmail" ? "Gmail SMTP" : "Outlook SMTP"}`
    );
    console.log(`Working password: "${workingPassword}"\n`);

    if (workingProvider === "outlook") {
      console.log(`📌 NEXT STEP - Update Railway Variables:`);
      console.log(`\n   1. Go to: https://railway.app/dashboard`);
      console.log(`   2. Select: OxfordSports → Variables`);
      console.log(
        `   3. Change SMTP_PASS from: "${envPass}"`
      );
      console.log(`   4. Change SMTP_PASS to: "${workingPassword}"`);
      console.log(`   5. Click Save (auto-redeploys)`);
      console.log(`   6. Test with new order\n`);
    } else {
      console.log(`📌 NEXT STEP - Update Railway Variables:`);
      console.log(`\n   1. Go to: https://railway.app/dashboard`);
      console.log(`   2. Select: OxfordSports → Variables`);
      console.log(`   3. Add/Update GMAIL_PASS: "${workingPassword}"`);
      console.log(`   4. Verify SMTP_HOST: smtp.gmail.com`);
      console.log(`   5. Verify SMTP_USER: noreply@oxfordsports.net`);
      console.log(`   6. Click Save (auto-redeploys)`);
      console.log(`   7. Test with new order\n`);
    }
  } else {
    console.log(
      `❌ Could not find working password format or Gmail credentials.\n`
    );
    console.log(`Options:`);
    console.log(`   1. Generate Gmail app-specific password (if 2FA enabled)`);
    console.log(`   2. Create new Outlook account with simple password`);
    console.log(`   3. Verify Outlook account is not locked/disabled`);
    console.log(`   4. Check that firewall allows port 587 to smtp.office365.com\n`);
  }

  process.exit(workingPassword ? 0 : 1);
}

fixSMTPPassword().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
