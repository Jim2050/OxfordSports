/**
 * Redis Client Singleton
 * ──────────────────────
 * Shared Redis connection used by both BullMQ and application caching.
 * Falls back to a local Redis instance if REDIS_URL is not set.
 *
 * Usage:
 *   const { getRedisConnection } = require('./lib/redisClient');
 *   const connection = getRedisConnection();
 */

const log = require('./logger');

let _connection = null;
let _connectionFailed = false;

/**
 * Get or create the shared Redis connection.
 * Lazy-initializes on first call.
 * @returns {import('ioredis').default | null}
 */
function getRedisConnection() {
  if (_connectionFailed) return null;
  if (_connection) return _connection;

  try {
    const Redis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    _connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,   // Required by BullMQ
      enableReadyCheck: false,      // Faster startup
      retryStrategy(times) {
        if (times > 5) {
          log.error('redis', 'Max reconnection attempts reached', { attempts: times });
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        log.warn('redis', `Reconnecting in ${delay}ms`, { attempt: times });
        return delay;
      },
    });

    _connection.on('connect', () => {
      log.info('redis', 'Connected to Redis', { url: redisUrl.replace(/\/\/.*@/, '//<redacted>@') });
    });

    _connection.on('error', (err) => {
      log.error('redis', 'Redis connection error', { error: err.message });
    });

    return _connection;

  } catch (err) {
    log.warn('redis', 'Redis not available — queue features disabled', { error: err.message });
    _connectionFailed = true;
    return null;
  }
}

/**
 * Check if Redis is available and connected.
 * @returns {boolean}
 */
function isRedisAvailable() {
  const conn = getRedisConnection();
  return conn !== null && conn.status === 'ready';
}

module.exports = { getRedisConnection, isRedisAvailable };
