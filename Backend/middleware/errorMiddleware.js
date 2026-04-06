/**
 * Global error-handling middleware.
 * Place LAST in the middleware chain.
 */

// 404 — route not found
const notFound = (req, res, next) => {
  const error = new Error(`Not Found — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const SAFE_404_PATHS = new Set([
  "/robots.txt",
  "/favicon.ico",
  "/sitemap.xml",
  "/.well-known/security.txt",
]);

// Catch-all error handler
const errorHandler = (err, req, res, _next) => {
  // If status is still 200 despite an error, default to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const requestPath = req?.originalUrl || req?.path || "";
  const isSafe404 = statusCode === 404 && SAFE_404_PATHS.has(requestPath);

  if (!isSafe404) {
    console.error(`❌ [${statusCode}] ${err.message}`);
  }
  if (!isSafe404 && process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(", ") });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(", ");
    return res.status(409).json({ error: `Duplicate value for: ${field}` });
  }

  // Multer file size
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ error: "File too large. Maximum allowed is 50 MB." });
  }

  res.status(statusCode).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
