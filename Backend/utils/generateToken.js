const jwt = require("jsonwebtoken");

/**
 * Generate a JWT token for the given user.
 * @param {string} userId - MongoDB _id
 * @param {string} role   - "member" or "admin"
 * @returns {string} signed JWT (7-day expiry)
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = generateToken;
