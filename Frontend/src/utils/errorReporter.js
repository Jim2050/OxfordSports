/**
 * Global Error Reporter
 * ─────────────────────
 * Captures unhandled errors and rejected promises on the client side.
 * Reports them to the backend /client-errors endpoint via sendBeacon.
 *
 * Also exports utility functions for structured error handling
 * from API responses (especially Zod validation errors).
 *
 * Usage:
 *   // In main.jsx (once, at startup):
 *   import { initGlobalErrorReporting } from './utils/errorReporter';
 *   initGlobalErrorReporting();
 *
 *   // In components:
 *   import { parseApiError } from './utils/errorReporter';
 *   const { message, fieldErrors } = parseApiError(err);
 */

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "/api";

/**
 * Send an error report to the backend (fire-and-forget).
 */
function reportError(report) {
  try {
    console.error("[ErrorReporter]", report);
    navigator.sendBeacon?.(
      `${API_BASE}/client-errors`,
      new Blob([JSON.stringify(report)], { type: "application/json" })
    );
  } catch {
    // Error reporting must never throw
  }
}

/**
 * Initialize global error handlers.
 * Call once in main.jsx.
 */
export function initGlobalErrorReporting() {
  // Unhandled JS errors
  window.addEventListener("error", (event) => {
    reportError({
      type: "unhandled_error",
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError({
      type: "unhandled_rejection",
      message: reason?.message || String(reason),
      stack: reason?.stack?.split("\n").slice(0, 5).join("\n"),
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Parse an API error response into a user-friendly format.
 * Handles:
 *   - Zod validation errors (from backend validators.js)
 *   - Generic error messages
 *   - Network errors
 *
 * @param {Error|any} err - Axios error or generic error
 * @returns {{ message: string, fieldErrors: Array<{ field: string, message: string }>, statusCode: number | null }}
 */
export function parseApiError(err) {
  // Network error (no response)
  if (!err?.response) {
    return {
      message: err?.message || "Network error. Please check your connection.",
      fieldErrors: [],
      statusCode: null,
    };
  }

  const data = err.response.data;
  const statusCode = err.response.status;

  // Zod validation errors (backend returns { error, details: [{ field, message }] })
  if (data?.details && Array.isArray(data.details)) {
    const fieldErrors = data.details.map((d) => ({
      field: d.field || "unknown",
      message: d.message || "Invalid value",
    }));

    return {
      message: data.error || "Validation failed. Please check the highlighted fields.",
      fieldErrors,
      statusCode,
    };
  }

  // Standard error response
  return {
    message: data?.error || data?.message || `Request failed (${statusCode})`,
    fieldErrors: [],
    statusCode,
  };
}

/**
 * Format field errors into a displayable string.
 * @param {Array<{ field: string, message: string }>} fieldErrors
 * @returns {string}
 */
export function formatFieldErrors(fieldErrors) {
  if (!fieldErrors || fieldErrors.length === 0) return "";
  return fieldErrors
    .map((e) => `• ${e.field}: ${e.message}`)
    .join("\n");
}
