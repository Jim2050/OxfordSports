/**
 * Email Queue System
 * Isolates email sending to prevent blocking main app
 * Uses setImmediate to defer and limits concurrent sends
 */

class EmailQueue {
  constructor(maxConcurrent = 3) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }

  add(emailFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ emailFn, resolve, reject });
      console.log(`[EMAIL QUEUE] Added task. Queue length: ${this.queue.length}, Running: ${this.running}`);
      this.process();
    });
  }

  process() {
    // Defer to next event loop cycle to avoid blocking
    setImmediate(() => {
      while (this.running < this.maxConcurrent && this.queue.length > 0) {
        this.running++;
        const { emailFn, resolve, reject } = this.queue.shift();
        console.log(`[EMAIL QUEUE] Processing task. Running: ${this.running}, Remaining: ${this.queue.length}`);

        emailFn()
          .then((result) => {
            this.running--;
            console.log(`[EMAIL QUEUE] Task completed successfully. Running: ${this.running}`);
            resolve(result);
            this.process();
          })
          .catch((error) => {
            this.running--;
            console.error(`[EMAIL QUEUE] Task failed: ${error.message}. Running: ${this.running}`);
            reject(error);
            this.process();
          });
      }
    });
  }
}

// Global instance
let emailQueue = null;

function getEmailQueue() {
  if (!emailQueue) {
    emailQueue = new EmailQueue(3); // Max 3 concurrent emails
    console.log(`[EMAIL QUEUE] Initialized with max concurrent: 3`);
  }
  return emailQueue;
}

module.exports = { getEmailQueue, EmailQueue };
