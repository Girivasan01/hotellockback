const mysql = require("mysql2/promise");

const host     = process.env.MYSQL_HOST     || process.env.DB_HOST     || "localhost";
const user     = process.env.MYSQL_USER     || process.env.DB_USER     || "root";
const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "root";
const database = process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "hotel_pos";
const port     = process.env.MYSQL_PORT
  ? Number(process.env.MYSQL_PORT)
  : process.env.DB_PORT
  ? Number(process.env.DB_PORT)
  : 3306;

// ─────────────────────────────────────────────────────────────
// TWO TIMEZONE FIXES REQUIRED
// ─────────────────────────────────────────────────────────────
//
// PROBLEM 1 — READ path shift (the 6:30 PM bug):
//   mysql2 converts DATETIME columns → JS Date objects by default.
//   res.json() then calls Date.toISOString() → UTC string.
//   Production MySQL is UTC, so "13:00:00 IST" serialises as "07:30:00Z"
//   and the frontend displays 6:30 PM instead of 1:00 PM.
//
//   FIX: dateStrings: true
//   mysql2 returns raw "YYYY-MM-DD HH:mm:ss" strings instead of Date objects.
//   res.json() serialises strings as-is → no conversion possible.
//
// PROBLEM 2 — NOW() in SQL queries:
//   checkoutService.js uses NOW() for checkout timestamps.
//   NOW() returns the MySQL SERVER's current time.
//   Production MySQL server = UTC → NOW() returns UTC time → stored & displayed wrong.
//
//   FIX: timezone: '+05:30'
//   mysql2 runs "SET time_zone = '+05:30'" on each new connection.
//   NOW() inside that session returns IST time → stored correctly.
// ─────────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",

  // ✅ FIX 1: Return DATETIME/DATE/TIMESTAMP columns as plain strings.
  // Prevents mysql2 from constructing JS Date objects that get UTC-serialised.
  dateStrings: true,

  // ✅ FIX 2: Set the MySQL session timezone to IST on every connection.
  // This ensures NOW() inside SQL queries returns IST time, not UTC.
  // Affects: checkoutService checkout timestamp, billing check_out, any future NOW() usage.
  timezone: "+05:30",
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log("✅ MySQL connected");
    connection.release();
  } catch (err) {
    console.error("❌ MySQL connection error:", err);
  }
}

testConnection();

pool.on("error", (err) => {
  console.error("💥 MySQL Pool Error:", err);
});

module.exports = {
  query: (...args) => pool.query(...args),

  get: async (sql, params, callback) => {
    try {
      const [rows] = await pool.query(sql, params || []);
      callback(null, rows[0] || undefined);
    } catch (err) {
      callback(err);
    }
  },

  all: async (sql, params, callback) => {
    try {
      const [rows] = await pool.query(sql, params || []);
      callback(null, rows);
    } catch (err) {
      callback(err);
    }
  },

  run: async (sql, params, callback) => {
    try {
      const [result] = await pool.query(sql, params || []);
      const info = {
        lastID:  result.insertId,
        changes: result.affectedRows,
      };
      if (callback) callback(null, info);
      return info;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },

  pool,
};