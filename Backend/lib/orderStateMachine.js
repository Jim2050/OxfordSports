/**
 * Order State Machine
 * ───────────────────
 * Enforces valid order lifecycle transitions.
 * No order can skip a stage or move to an invalid state.
 *
 * Valid transitions:
 *   pending → confirmed → processing → shipped → delivered
 *   (any state) → cancelled  (admin override)
 *   (any state) → aborted    (system failure)
 *
 * Usage:
 *   const { canTransition, getNextStates, transitionOrder } = require('./lib/orderStateMachine');
 *   if (canTransition('pending', 'confirmed')) { ... }
 */

const log = require('./logger');

/**
 * All valid order statuses.
 */
const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'aborted',
];

/**
 * Transition map: { currentStatus: [allowedNextStatuses] }
 * "cancelled" and "aborted" are terminal — no transitions out.
 */
const TRANSITIONS = {
  pending:    ['confirmed', 'cancelled', 'aborted'],
  confirmed:  ['processing', 'cancelled', 'aborted'],
  processing: ['shipped', 'cancelled', 'aborted'],
  shipped:    ['delivered', 'cancelled', 'aborted'],
  delivered:  [],             // Terminal state
  cancelled:  [],             // Terminal state
  aborted:    [],             // Terminal state — system failure
};

/**
 * Check if transitioning from `from` to `to` is valid.
 * @param {string} from - Current status
 * @param {string} to   - Target status
 * @returns {boolean}
 */
function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Get all valid next states from a given status.
 * @param {string} current
 * @returns {string[]}
 */
function getNextStates(current) {
  return TRANSITIONS[current] || [];
}

/**
 * Validate and apply a status transition on a Mongoose order document.
 * Throws a descriptive error if the transition is illegal.
 *
 * @param {import('mongoose').Document} order - Mongoose order document
 * @param {string} targetStatus - The desired new status
 * @param {{ reason?: string, actor?: string }} [opts] - Audit metadata
 * @returns {Promise<import('mongoose').Document>} The saved order
 */
async function transitionOrder(order, targetStatus, opts = {}) {
  const currentStatus = order.status;

  if (!canTransition(currentStatus, targetStatus)) {
    const err = new Error(
      `Invalid order transition: ${currentStatus} → ${targetStatus}. ` +
      `Allowed: [${getNextStates(currentStatus).join(', ')}]`
    );
    err.statusCode = 400;
    log.warn('order', 'Illegal status transition attempted', {
      orderId: order._id?.toString(),
      orderNumber: order.orderNumber,
      from: currentStatus,
      to: targetStatus,
      actor: opts.actor || 'system',
    });
    throw err;
  }

  order.status = targetStatus;
  await order.save();

  log.info('order', 'Order status transitioned', {
    orderId: order._id?.toString(),
    orderNumber: order.orderNumber,
    from: currentStatus,
    to: targetStatus,
    reason: opts.reason || '',
    actor: opts.actor || 'system',
  });

  return order;
}

module.exports = {
  ORDER_STATUSES,
  TRANSITIONS,
  canTransition,
  getNextStates,
  transitionOrder,
};
