/**
 * Generate bcrypt hash for seeding staff.password_hash in the database.
 * Run: node scripts/hash-password.js [password]
 * Default password: demo123
 */
const { hashSync } = require("bcryptjs");
const password = process.argv[2] || "demo123";
const hashed = hashSync(password, 10);
console.log(hashed);
