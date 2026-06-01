const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "srv786.hstgr.io",
  user: "u683444186_lock",
  password: "Lockhotel2026",
  database: "u683444186_lock",
  port: 3306,

  connectTimeout: 10000,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  dateStrings: true,
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
      const ctx = {
        lastID: result.insertId,
        changes: result.affectedRows,
      };
      if (callback) callback.call(ctx, null, ctx);
      return ctx;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },

  pool,
};
