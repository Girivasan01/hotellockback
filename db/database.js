const mysql = require("mysql2/promise");

// Environment variables
const host =
  process.env.MYSQL_HOST ||
  process.env.DB_HOST ||
  "localhost";

const user =
  process.env.MYSQL_USER ||
  process.env.DB_USER ||
  "root";

const password =
  process.env.MYSQL_PASSWORD ||
  process.env.DB_PASSWORD ||
  "";

const database =
  process.env.MYSQL_DATABASE ||
  process.env.DB_DATABASE ||
  "hotel_pos";

const port = process.env.MYSQL_PORT
  ? Number(process.env.MYSQL_PORT)
  : process.env.DB_PORT
  ? Number(process.env.DB_PORT)
  : 3306;

// MySQL Pool
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

  // Prevent timezone conversion issues
  dateStrings: true,

  // Force IST timezone
  timezone: "+05:30",

  // Prevent Render timeout issues
  connectTimeout: 60000,

  // SSL for remote MySQL
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test DB connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();

    await connection.ping();

    console.log("✅ MySQL connected");

    connection.release();
  } catch (err) {
    console.error("❌ MySQL connection error:", err);

    // Stop server if DB fails
    process.exit(1);
  }
}

testConnection();

// Pool error listener
pool.on("error", (err) => {
  console.error("💥 MySQL Pool Error:", err);
});

// Export helper methods
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
        lastID: result.insertId,
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
