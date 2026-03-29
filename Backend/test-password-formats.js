#!/usr/bin/env node
/**
 * SMTP Password Format Test
 * Tests both escaped and unescaped asterisk formats to determine which works
 */

require("dotenv").config();
const nodemailer = require("nodemailer");

async function testPasswordFormats() {
  console.log("\n🔐 SMTP PASSWORD ESCAPING TEST\n");

  const host = "smtp.office365.com";
  const port = 587;
  const user = "sales@oxfordsports.net";

  // Get the password from environment
  const envPass = process.env.SMTP_PASS || "";
  
  console.log(`Environment Password (as-is): "${envPass}"`);
  console.log(`Password length: ${envPass.length} characters`);
  console.log(`Password contains backslash: ${envPass.includes("\\") ? "YES" : "NO"}`);
  console.log(`Password contains asterisk: ${envPass.includes("*") ? "YES" : "NO"}`);

  // Test formats
  const formats = [
    { name: "As-is from env", pass: envPass },
    { name: "Strip leading backslash if present", pass: envPass.replace(/^\\/, "") },
    { name: "Replace backslash-asterisk with just asterisk", pass: envPass.replace(/\\\\?\*/, "*") },
  ];

  console.log("\n" + "─".repeat(80));
  console.log("TESTING PASSWORD FORMATS\n");

  for (const format of formats) {
    console.log(`\n📝 Format: ${format.name}`);
    console.log(`   Password: "${format.pass}"`);
    console.log(`   Testing connection...\n`);

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: {
          user,
          pass: format.pass,
        },
        connectionTimeout: 5000,
        socketTimeout: 5000,
      });

      // Test verify with timeout
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout (5s)")), 5000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
      
      console.log(`   ✅ SUCCESS! This format works!\n`);
      console.log(`   SMTP Connection verified with password: "${format.pass}"`);
      console.log(`\n   → Use this in Railway SMTP_PASS: ${format.pass}`);
      process.exit(0);
    } catch (err) {
      console.log(`   ❌ FAILED: ${err.message}`);
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log("\n❌ NONE of the password formats worked!");
  console.log(`\nPossible issues:`);
  console.log(`  1. Outlook account disabled or locked`);
  console.log(`  2. 2FA enabled - need app-specific password`);
  console.log(`  3. Network issue - can't reach smtp.office365.com:587`);
  console.log(`  4. Firewall blocking port 587`);
  console.log(`\nNext steps:`);
  console.log(`  1. Try creating a new Outlook account with simple password (no special chars)`);
  console.log(`  2. Or use an existing app-specific password`);
  console.log(`  3. Or switch to Gmail SMTP with app password`);

  process.exit(1);
}

testPasswordFormats().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
