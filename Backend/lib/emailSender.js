/**
 * Email Sender — Resend API with SMTP Failover
 * ──────────────────────────────────────────────
 * Pure function: accepts mail options, sends the email, returns result.
 * Decoupled from any queue or order logic.
 *
 * Strategy:
 *   1. Try Resend HTTP API (bypasses Railway SMTP port blocks)
 *   2. Fall back to Nodemailer SMTP (Outlook → Gmail)
 *
 * Usage:
 *   const { sendEmail } = require('./lib/emailSender');
 *   await sendEmail({ to: 'x@y.com', subject: '...', html: '...' });
 */

const log = require('./logger');
const nodemailer = require('nodemailer');

/**
 * Send an email via Resend HTTP API.
 * @param {{ to: string, subject: string, html: string, from?: string }} opts
 * @returns {Promise<{ provider: string, messageId?: string }>}
 */
async function sendViaResend({ to, subject, html, from }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'sales@oxfordsports.online';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Oxford Sports <${fromEmail}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { provider: 'resend', messageId: data.id };
}

/**
 * Send an email via Nodemailer SMTP (Outlook primary, Gmail fallback).
 * @param {{ to: string, subject: string, html: string, from?: string }} opts
 * @returns {Promise<{ provider: string, messageId?: string }>}
 */
async function sendViaSMTP({ to, subject, html, from }) {
  const fromEmail = from || process.env.SMTP_USER || 'sales@oxfordsports.online';

  const configs = [
    {
      name: 'outlook',
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    },
    {
      name: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    },
  ];

  const errors = [];

  for (const cfg of configs) {
    if (!cfg.auth.user || !cfg.auth.pass) continue;

    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth,
        connectionTimeout: 8000,
        socketTimeout: 8000,
      });

      const result = await transporter.sendMail({ from: fromEmail, to, subject, html });
      return { provider: cfg.name, messageId: result.messageId };
    } catch (err) {
      errors.push(`${cfg.name}: ${err.message}`);
    }
  }

  throw new Error(`All SMTP providers failed: ${errors.join(' | ')}`);
}

/**
 * Send an email — tries Resend first, falls back to SMTP.
 * @param {{ to: string, subject: string, html: string, from?: string }} opts
 * @returns {Promise<{ provider: string, messageId?: string }>}
 */
async function sendEmail(opts) {
  const t = log.timer('email', `Send to ${opts.to}`);

  try {
    const result = await sendViaResend(opts);
    t.end({ provider: result.provider, to: opts.to });
    return result;
  } catch (resendErr) {
    log.warn('email', 'Resend failed, trying SMTP fallback', {
      to: opts.to,
      error: resendErr.message,
    });
  }

  try {
    const result = await sendViaSMTP(opts);
    t.end({ provider: result.provider, to: opts.to, fallback: true });
    return result;
  } catch (smtpErr) {
    log.error('email', 'All email providers failed', {
      to: opts.to,
      error: smtpErr.message,
    });
    throw smtpErr;
  }
}

module.exports = { sendEmail, sendViaResend, sendViaSMTP };
