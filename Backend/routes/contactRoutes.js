const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

/**
 * POST /api/contact
 * Sends contact form email to sales@oxfordsports.net
 */
router.post("/", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // If SMTP is not configured, just log and respond OK (development mode)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("📧 Contact form (SMTP not configured, logged only):");
    console.log(`   From: ${name} <${email}>`);
    console.log(`   Message: ${message}`);
    return res.json({
      success: true,
      message: "Message received (email delivery pending SMTP setup).",
    });
  }

  try {
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
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: process.env.CONTACT_EMAIL_TO || "sales@oxfordsports.net",
      subject: `Website Contact: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    res.json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    console.error("Email send error:", err);
    res
      .status(500)
      .json({ error: "Failed to send email. Please try again later." });
  }
});

module.exports = router;
