/**
 * BullMQ Email Queue & Worker
 * ───────────────────────────
 * Production-grade background email processing with:
 *   - 5 automatic retries with exponential backoff (2s, 4s, 8s, 16s, 32s)
 *   - Rate limiting (10 emails/second max)
 *   - Dead letter logging for permanently failed emails
 *   - Graceful degradation when Redis is unavailable
 *
 * This replaces the old in-memory EmailQueue class (utils/emailQueue.js).
 *
 * Usage:
 *   const { enqueueOrderEmail } = require('./lib/emailQueue');
 *   await enqueueOrderEmail(orderId);   // Fire-and-forget
 */

const log = require('./logger');
const { getRedisConnection } = require('./redisClient');

let _queue = null;
let _worker = null;
let _initialized = false;

/** Default job options: 5 retries, exponential backoff */
const DEFAULT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 86400, count: 500 },  // Keep 24h / 500 max
  removeOnFail: { age: 604800 },                   // Keep failures 7 days
};

/**
 * Initialize the BullMQ queue and worker.
 * Safe to call multiple times — only initializes once.
 * If Redis is unavailable, logs a warning and returns false.
 * @returns {boolean} Whether initialization succeeded
 */
function initEmailQueue() {
  if (_initialized) return !!_queue;

  const connection = getRedisConnection();
  if (!connection) {
    log.warn('email-queue', 'Redis unavailable — email queue disabled, using inline fallback');
    _initialized = true;
    return false;
  }

  try {
    const { Queue, Worker } = require('bullmq');

    _queue = new Queue('order-emails', {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTS,
    });

    _worker = new Worker('order-emails', processEmailJob, {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 1000 },
    });

    _worker.on('completed', (job) => {
      log.info('email-queue', 'Email job completed', {
        jobId: job.id,
        orderId: job.data.orderId,
        attempt: job.attemptsMade,
      });
    });

    _worker.on('failed', (job, err) => {
      const isFinal = job.attemptsMade >= (job.opts?.attempts || 5);
      const level = isFinal ? 'error' : 'warn';
      log[level]('email-queue', isFinal ? 'Email job permanently failed' : 'Email job failed, will retry', {
        jobId: job.id,
        orderId: job.data.orderId,
        attempt: job.attemptsMade,
        maxAttempts: job.opts?.attempts || 5,
        error: err.message,
      });

      // On permanent failure, ensure the order is flagged in the database
      if (isFinal) {
        flagEmailFailure(job.data.orderId, err.message).catch(() => {});
      }
    });

    _worker.on('error', (err) => {
      log.error('email-queue', 'Worker error', { error: err.message });
    });

    log.info('email-queue', 'BullMQ email queue initialized');
    _initialized = true;
    return true;

  } catch (err) {
    log.error('email-queue', 'Failed to initialize BullMQ', { error: err.message });
    _initialized = true;
    return false;
  }
}

/**
 * The actual job processor — called by BullMQ for each queued email.
 * @param {import('bullmq').Job} job
 */
async function processEmailJob(job) {
  const { orderId, orderNumber } = job.data;
  const Order = require('../models/Order');

  log.info('email-queue', 'Processing email job', {
    jobId: job.id,
    orderId,
    orderNumber,
    attempt: job.attemptsMade + 1,
  });

  // 1. Fetch the order from DB
  const order = await Order.findById(orderId).lean();
  if (!order) {
    log.error('email-queue', 'Order not found — skipping email', { orderId });
    return; // Don't retry if order doesn't exist
  }

  // 2. Build email content
  const { buildOrderConfirmationEmail } = require('./emailTemplates');
  const { subject, html } = buildOrderConfirmationEmail(order);

  // 3. Send emails via the sender module
  const { sendEmail } = require('./emailSender');
  const adminEmail = process.env.CONTACT_EMAIL_TO || 'uksportswarehouse@googlemail.com';

  // Send to admin
  await sendEmail({ to: adminEmail, subject: `[NEW ORDER] ${subject}`, html });

  // Send to customer
  if (order.customerEmail) {
    await sendEmail({
      to: order.customerEmail,
      subject: `Order Confirmed — ${order.orderNumber}`,
      html,
    });
  }

  // 4. Mark success on the order document
  await Order.findByIdAndUpdate(orderId, {
    emailSent: true,
    emailSentAt: new Date(),
    emailError: '',
  }).catch((err) => {
    log.warn('email-queue', 'Failed to update emailSent flag', {
      orderId,
      error: err.message,
    });
  });

  log.info('email-queue', 'Order emails sent successfully', {
    orderId,
    orderNumber: order.orderNumber,
  });
}

/**
 * Flag an order's email as permanently failed.
 * @param {string} orderId
 * @param {string} errorMsg
 */
async function flagEmailFailure(orderId, errorMsg) {
  try {
    const Order = require('../models/Order');
    await Order.findByIdAndUpdate(orderId, {
      emailSent: false,
      emailError: `Permanent failure after max retries: ${errorMsg}`,
    });
    log.error('email-queue', 'Order email permanently failed — flagged in DB', {
      orderId,
      error: errorMsg,
    });
  } catch (err) {
    log.error('email-queue', 'Could not flag email failure on order', {
      orderId,
      error: err.message,
    });
  }
}

/**
 * Log order details to console as a backup when email fails.
 * Ensures Jim can always find order info in Railway logs.
 * @param {object} order
 */
function logOrderToConsole(order) {
  const itemLines = (order.items || [])
    .map((i) => {
      const lotMeta = i.lotItem
        ? ` | LOT: ${i.lotSizeBreakdown || `Unspecified(${i.maxStock || i.quantity || 0})`}`
        : '';
      return `  • ${i.name} (${i.sku}) | Size: ${i.size || 'N/A'} | Qty: ${i.quantity} | £${(i.lineTotal || 0).toFixed(2)}${lotMeta}`;
    })
    .join('\n');

  log.error('email-queue', 'ORDER DETAILS — EMAIL FAILED, CHECK HERE', {
    orderNumber: order.orderNumber,
    date: new Date(order.createdAt).toLocaleString('en-GB'),
    customer: order.customerName,
    email: order.customerEmail,
    company: order.customerCompany || 'N/A',
    phone: order.customerPhone || 'N/A',
    address: order.deliveryAddress || 'N/A',
    total: `£${(order.totalAmount || 0).toFixed(2)}`,
    notes: order.notes || '',
    items: itemLines,
  });
}

// ── Public API ──────────────────────────────────────────────

/**
 * Enqueue an order confirmation email.
 * Falls back to inline sending if Redis/BullMQ is unavailable.
 * @param {string} orderId - MongoDB _id of the order
 * @param {string} [orderNumber] - For logging
 */
async function enqueueOrderEmail(orderId, orderNumber) {
  initEmailQueue();

  if (_queue) {
    await _queue.add('send-order-confirmation', {
      orderId: orderId.toString(),
      orderNumber: orderNumber || '',
    });
    log.info('email-queue', 'Email job enqueued', { orderId: orderId.toString(), orderNumber });
    return;
  }

  // ── Fallback: Inline sending (legacy path) ──
  log.warn('email-queue', 'Queue unavailable — sending email inline', { orderId: orderId.toString() });
  try {
    await processEmailJob({ data: { orderId: orderId.toString(), orderNumber }, attemptsMade: 0, id: 'inline' });
  } catch (err) {
    log.error('email-queue', 'Inline email send failed', { orderId: orderId.toString(), error: err.message });
    const Order = require('../models/Order');
    const order = await Order.findById(orderId).lean().catch(() => null);
    if (order) logOrderToConsole(order);
  }
}

/**
 * Graceful shutdown — close the worker and queue.
 */
async function shutdownEmailQueue() {
  if (_worker) await _worker.close().catch(() => {});
  if (_queue) await _queue.close().catch(() => {});
  log.info('email-queue', 'Email queue shut down');
}

module.exports = {
  initEmailQueue,
  enqueueOrderEmail,
  shutdownEmailQueue,
  logOrderToConsole,
};
