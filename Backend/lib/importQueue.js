/**
 * Import Queue (BullMQ-backed)
 * ────────────────────────────
 * Moves heavy Excel/Zip processing off the main Node event loop.
 *
 * For small imports (< 500 rows): processed synchronously inline
 * For large imports (>= 500 rows): enqueued to BullMQ background worker
 *
 * The queue worker calls back into the existing importProducts logic
 * so all business rules, column mapping, and diagnostics are preserved.
 *
 * Usage:
 *   const { enqueueImport, getImportJobStatus } = require('./lib/importQueue');
 *   const jobId = await enqueueImport(filePath, { syncMode: 'full', userId: '...' });
 *   const status = await getImportJobStatus(jobId);
 */

const log = require('./logger');
const { getRedisConnection } = require('./redisClient');
const { invalidateProducts } = require('./catalogCache');

let _queue = null;
let _worker = null;
let _initialized = false;

/** In-memory job status tracker for inline (non-queued) imports */
const _inlineJobs = new Map();

/** Default job options */
const JOB_OPTS = {
  attempts: 1,              // Imports should not auto-retry (data side effects)
  removeOnComplete: { age: 86400, count: 100 },
  removeOnFail: { age: 604800 },
};

/**
 * Initialize the BullMQ import queue.
 * @returns {boolean}
 */
function initImportQueue() {
  if (_initialized) return !!_queue;

  const connection = getRedisConnection();
  if (!connection) {
    log.warn('import-queue', 'Redis unavailable — large imports will process inline');
    _initialized = true;
    return false;
  }

  try {
    const { Queue, Worker } = require('bullmq');

    _queue = new Queue('product-imports', {
      connection,
      defaultJobOptions: JOB_OPTS,
    });

    _worker = new Worker('product-imports', processImportJob, {
      connection,
      concurrency: 1,  // Only one import at a time to avoid DB contention
    });

    _worker.on('completed', (job) => {
      log.info('import-queue', 'Import job completed', {
        jobId: job.id,
        filename: job.data.filename,
      });
      // Invalidate product cache after successful import
      invalidateProducts().catch(() => {});
    });

    _worker.on('failed', (job, err) => {
      log.error('import-queue', 'Import job failed', {
        jobId: job.id,
        filename: job.data.filename,
        error: err.message,
      });
    });

    log.info('import-queue', 'BullMQ import queue initialized');
    _initialized = true;
    return true;

  } catch (err) {
    log.error('import-queue', 'Failed to initialize import queue', { error: err.message });
    _initialized = true;
    return false;
  }
}

/**
 * The import job processor.
 * Calls the existing parseExcelFile + consolidateBySku + bulkWrite pipeline.
 * @param {import('bullmq').Job} job
 */
async function processImportJob(job) {
  const { filePath, filename, syncMode, userId } = job.data;

  log.info('import-queue', 'Processing import job', {
    jobId: job.id,
    filename,
    syncMode,
  });

  // Re-use the existing import logic
  // This creates a fake req/res to capture the result
  const importController = require('../controllers/importController');
  const result = await new Promise((resolve, reject) => {
    const fakeReq = {
      file: { path: filePath, originalname: filename, size: 0 },
      query: { syncMode },
      body: { syncMode },
      user: { _id: userId },
    };
    const fakeRes = {
      _statusCode: 200,
      _data: null,
      status(code) { this._statusCode = code; return this; },
      json(data) { this._data = data; resolve({ statusCode: this._statusCode, data }); },
    };
    importController.importProducts(fakeReq, fakeRes).catch(reject);
  });

  if (result.statusCode >= 400) {
    throw new Error(result.data?.error || 'Import failed');
  }

  return result.data;
}

/**
 * Enqueue a product import job.
 * Returns a jobId for status polling.
 *
 * @param {string} filePath - Path to the uploaded Excel file
 * @param {{ filename: string, syncMode: string, userId: string }} opts
 * @returns {Promise<string>} jobId
 */
async function enqueueImport(filePath, opts) {
  initImportQueue();

  const jobId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (_queue) {
    const job = await _queue.add('process-excel', {
      filePath,
      filename: opts.filename,
      syncMode: opts.syncMode || 'full',
      userId: opts.userId,
    }, { jobId });

    log.info('import-queue', 'Import job enqueued', {
      jobId: job.id,
      filename: opts.filename,
    });

    return job.id;
  }

  // Fallback: track inline job status
  _inlineJobs.set(jobId, {
    id: jobId,
    status: 'processing',
    filename: opts.filename,
    startedAt: new Date(),
    result: null,
    error: null,
  });

  log.warn('import-queue', 'Queue unavailable — processing import inline', { jobId });

  // Process inline (non-blocking via setImmediate)
  setImmediate(async () => {
    try {
      const result = await processImportJob({
        id: jobId,
        data: {
          filePath,
          filename: opts.filename,
          syncMode: opts.syncMode || 'full',
          userId: opts.userId,
        },
      });
      const job = _inlineJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
      }
      invalidateProducts().catch(() => {});
    } catch (err) {
      const job = _inlineJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message;
        job.completedAt = new Date();
      }
    }
  });

  return jobId;
}

/**
 * Get the status of an import job.
 * @param {string} jobId
 * @returns {Promise<{ status: string, progress?: number, result?: object, error?: string } | null>}
 */
async function getImportJobStatus(jobId) {
  // Check inline jobs first
  const inline = _inlineJobs.get(jobId);
  if (inline) return inline;

  // Check BullMQ
  if (!_queue) return null;

  try {
    const job = await _queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: jobId,
      status: state,
      progress: job.progress,
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
      filename: job.data?.filename,
    };
  } catch {
    return null;
  }
}

/**
 * Graceful shutdown.
 */
async function shutdownImportQueue() {
  if (_worker) await _worker.close().catch(() => {});
  if (_queue) await _queue.close().catch(() => {});
  log.info('import-queue', 'Import queue shut down');
}

module.exports = {
  initImportQueue,
  enqueueImport,
  getImportJobStatus,
  shutdownImportQueue,
};
