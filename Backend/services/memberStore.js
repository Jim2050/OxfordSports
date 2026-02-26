/**
 * Member Store — flat-file JSON storage for registered trade buyers.
 * Members stored in /data/members.json
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const FILE = path.join(__dirname, "..", "data", "members.json");

function readAll() {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(members) {
  fs.writeFileSync(FILE, JSON.stringify(members, null, 2));
}

/**
 * Register a new member.
 * Returns the member object (without password) or throws if email exists.
 */
async function register({ name, email, password, company }) {
  const members = readAll();

  // Check for duplicate email
  const exists = members.find(
    (m) => m.email.toLowerCase() === email.toLowerCase(),
  );
  if (exists) {
    throw new Error("An account with this email already exists.");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const member = {
    id: `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    company: company ? company.trim() : "",
    role: "member",
    isApproved: true,
    createdAt: new Date().toISOString(),
  };

  members.push(member);
  writeAll(members);

  // Return without password
  const { password: _, ...safe } = member;
  return safe;
}

/**
 * Authenticate a member by email and password.
 * Returns the member object (without password) or null if invalid.
 */
async function authenticate(email, password) {
  const members = readAll();
  const member = members.find(
    (m) => m.email.toLowerCase() === email.toLowerCase(),
  );
  if (!member) return null;

  const valid = await bcrypt.compare(password, member.password);
  if (!valid) return null;

  const { password: _, ...safe } = member;
  return safe;
}

/**
 * Find a member by ID.
 */
function findById(id) {
  const members = readAll();
  const member = members.find((m) => m.id === id);
  if (!member) return null;
  const { password: _, ...safe } = member;
  return safe;
}

/**
 * Get total member count.
 */
function count() {
  return readAll().length;
}

module.exports = { register, authenticate, findById, count };
