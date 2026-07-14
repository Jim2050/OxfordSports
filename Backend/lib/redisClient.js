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
      connectTimeout: 10000,        // 10s timeout for initial connection
      lazyConnect: true,
      retryStrategy(times) {
        // BullMQ/ioredis reconnection strategy for Railway/Cloud environments
        // We want to keep retrying for a long time during heavy imports
        const delay = Math.min(times * 500, 5000); // Max 5s between retries
        if (times % 10 === 0) {
          log.warn('redis', `Still attempting to reconnect to Redis...`, { attempt: times });
        }
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect if the error is READONLY (happens during some Redis failovers)
          return true;
        }
        return false;
      },
      // Keep-alive settings to prevent connection drops during long-running tasks
      keepAlive: 10000, // 10s
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
