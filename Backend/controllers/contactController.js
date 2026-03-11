const nodemailer = require("nodemailer");

// Sanitize string for use in email headers (prevent header injection)
function sanitizeHeader(str) {
  return String(str).replace(/[\r\n\t]/g, " ").trim().slice(0, 200);
}

// Escape HTML special chars to prevent XSS in email body
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * POST /api/contact
 * Process contact form submission. Sends email via SMTP if configured,
 * otherwise logs to console (development mode).
 */
exports.sendContactForm = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address." });
    }

    // Enforce message length limit
    if (message.length > 5000) {
      return res.status(400).json({ error: "Message too long (max 5000 characters)." });
    }

    const safeName = sanitizeHeader(name);
    const safeEmail = sanitizeHeader(email);

    // If SMTP is not configured, just log (development)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      if (process.env.NODE_ENV !== "production") {
        console.log("📧 Contact form (SMTP not configured — logged only):");
        console.log(`   From: ${safeName} <${safeEmail}>`);
        console.log(`   Message: ${message.slice(0, 200)}`);
      }
      return res.json({
        success: true,
        message: "Message received (email delivery pending SMTP setup).",
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${safeName}" <${process.env.SMTP_USER}>`,
      replyTo: safeEmail,
      to: process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net",
      subject: `Website Contact: ${safeName}`,
      text: `Name: ${safeName}\nEmail: ${safeEmail}\n\n${message}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
        <hr />
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    res.json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    console.error("Contact form error:", err);
    res
      .status(500)
      .json({ error: "Failed to send message. Please try again." });
  }
};
