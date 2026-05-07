/**
 * Structured Logger for Railway Console
 * ──────────────────────────────────────
 * Outputs JSON logs that are queryable in Railway's log viewer.
 * Each log entry includes: timestamp, level, domain, message,
 * and optional metadata (orderId, sku, userId, duration, etc.)
 *
 * Usage:
 *   const log = require('./lib/logger');
 *   log.info('order', 'Checkout started', { userId: '123', items: 3 });
 *   log.error('email', 'Resend API failed', { orderId: 'OS-001', attempt: 2, error: err.message });
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

const CURRENT_LEVEL = LOG_LEVELS[
  (process.env.LOG_LEVEL || 'info').toLowerCase()
] ?? LOG_LEVELS.info;

/**
 * Core log emitter — writes structured JSON to stdout/stderr.
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} domain - Service domain (order, email, import, auth, stock, admin)
 * @param {string} message - Human-readable summary
 * @param {Record<string, unknown>} [meta] - Structured metadata for querying
 */
function emit(level, domain, message, meta = {}) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    domain,
    msg: message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === 'error' || level === 'fatal') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

/**
 * Create a scoped timer for measuring operation duration.
 * @param {string} domain
 * @param {string} operation
 * @returns {{ end: (meta?: Record<string, unknown>) => number }}
 */
function timer(domain, operation) {
  const start = Date.now();
  return {
    end(meta = {}) {
      const durationMs = Date.now() - start;
      emit('info', domain, `${operation} completed`, { durationMs, ...meta });
      return durationMs;
    },
  };
}

module.exports = {
  debug: (domain, msg, meta) => emit('debug', domain, msg, meta),
  info:  (domain, msg, meta) => emit('info',  domain, msg, meta),
  warn:  (domain, msg, meta) => emit('warn',  domain, msg, meta),
  error: (domain, msg, meta) => emit('error', domain, msg, meta),
  fatal: (domain, msg, meta) => emit('fatal', domain, msg, meta),
  timer,
};
