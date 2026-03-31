/**
 * Email Service with Failover
 * Tries Outlook first, falls back to Gmail if auth fails
 * Implements automatic retry with different SMTP provider
 */

const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.outlookConfig = {
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "sales@oxfordsports.online",
        pass: process.env.SMTP_PASS || "Microsoft1971turbs*",
      },
      connectionTimeout: 5000,
      socketTimeout: 5000,
      greetingTimeout: 5000,
    };

    // Gmail fallback config
    this.gmailConfig = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER || "noreply@oxfordsports.online",
        pass: process.env.GMAIL_PASS || "",
      },
      connectionTimeout: 5000,
      socketTimeout: 5000,
      greetingTimeout: 5000,
    };
  }

  createTransporter(config) {
    return nodemailer.createTransport(config);
  }

  async sendEmailWithTimeout(transporter, mailOptions, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Email send timeout after ${timeoutMs}ms - likely SMTP auth failure`
          )
        );
      }, timeoutMs);

      transporter.sendMail(mailOptions, (err, info) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(info);
      });
    });
  }

  async send(mailOptions) {
    // Try primary provider (Outlook)
    console.log(`[EMAIL SERVICE] Attempting to send via ${this.outlookConfig.auth.user}...`);

    try {
      const outlookTransporter = this.createTransporter(this.outlookConfig);
      const result = await this.sendEmailWithTimeout(
        outlookTransporter,
        mailOptions,
        10000
      );
      console.log(
        `[EMAIL SERVICE] ✅ Successfully sent via ${this.outlookConfig.auth.user}`
      );
      return { success: true, provider: "outlook", messageId: result.messageId };
    } catch (outlookErr) {
      console.error(
        `[EMAIL SERVICE] ❌ Outlook failed: ${outlookErr.message}`
      );

      // Check if Gmail fallback is configured
      if (!this.gmailConfig.auth.pass) {
        console.error(
          `[EMAIL SERVICE] Gmail fallback not configured (GMAIL_PASS not set)`
        );
        throw outlookErr; // Rethrow original error
      }

      console.log(
        `[EMAIL SERVICE] Attempting failover to ${this.gmailConfig.auth.user}...`
      );

      try {
        const gmailTransporter = this.createTransporter(this.gmailConfig);
        const result = await this.sendEmailWithTimeout(
          gmailTransporter,
          mailOptions,
          10000
        );
        console.log(
          `[EMAIL SERVICE] ✅ Successfully sent via ${this.gmailConfig.auth.user} (failover)`
        );
        return {
          success: true,
          provider: "gmail-failover",
          messageId: result.messageId,
        };
      } catch (gmailErr) {
        console.error(
          `[EMAIL SERVICE] ❌ Gmail failover also failed: ${gmailErr.message}`
        );
        throw new Error(
          `Both providers failed. Outlook: ${outlookErr.message}, Gmail: ${gmailErr.message}`
        );
      }
    }
  }
}

// Global instance
let emailService = null;

function getEmailService() {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}

module.exports = { getEmailService, EmailService };
