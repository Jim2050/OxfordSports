/**
 * SMTP Diagnostic Test
 * Run this to verify SMTP credentials and connectivity
 * Command: node test-smtp.js
 */

require("dotenv").config();
const nodemailer = require("nodemailer");

async function testSMTP() {
  console.log("\n🔍 SMTP DIAGNOSTIC TEST\n");

  const smtpHost = process.env.SMTP_HOST || "smtp.office365.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const contactEmail = process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net";

  console.log("📋 Configuration:");
  console.log(`  SMTP_HOST: ${smtpHost}`);
  console.log(`  SMTP_PORT: ${smtpPort}`);
  console.log(`  SMTP_USER: ${smtpUser}`);
  console.log(`  SMTP_PASS: ${smtpPass ? "***SET***" : "❌ NOT SET"}`);
  console.log(`  CONTACT_EMAIL_TO: ${contactEmail}`);

  if (!smtpUser || !smtpPass) {
    console.log("\n❌ ERROR: SMTP credentials not set in environment variables");
    process.exit(1);
  }

  console.log("\n⚙️  Creating transporter...");
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  console.log("🧪 Testing SMTP connection...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified!");
  } catch (err) {
    console.log(`❌ SMTP connection failed: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    console.log(`   Response: ${err.response}`);
    process.exit(1);
  }

  console.log("\n📧 Sending test email...");
  try {
    const info = await transporter.sendMail({
      from: `"Oxford Sports Test" <${smtpUser}>`,
      to: smtpUser, // Send to self
      subject: "SMTP Test — Oxford Sports",
      html: `
        <h2>SMTP Test Successful!</h2>
        <p>This email confirms your SMTP configuration is working correctly.</p>
        <p><strong>From:</strong> ${smtpUser}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
    });
    console.log(`✅ Email sent successfully!`);
    console.log(`   Response: ${info.response}`);
    console.log(`\n✨ Your SMTP is fully operational. Emails should now work!`);
  } catch (err) {
    console.log(`❌ Email failed to send: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    console.log(`   Response: ${err.response}`);
    console.log(`\n📝 Troubleshooting:`);
    console.log(`   1. Verify password is correct (no spaces)`);
    console.log(`   2. If password has special chars, wrap in quotes: "password*"`);
    console.log(`   3. For Outlook, ensure account is not MFA-only`);
    console.log(`   4. Try: https://account.live.com/activity and check "suspicious" logins`);
    process.exit(1);
  }
}

testSMTP();
