const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "82.25.121.140", // force IPv4
  port: 3306,

  user: "u683444186_lock",
  password: "Lockhotel2026",
  database: "u683444186_lock",

  ssl: {
    rejectUnauthorized: false,
  },

  connectTimeout: 30000,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  charset: "utf8mb4",
  dateStrings: true,
  timezone: "+05:30",
});

async function testConnection() {
  try {
    console.time("mysql-connect");

    const connection = await pool.getConnection();

    await connection.ping();

    console.timeEnd("mysql-connect");
    console.log("✅ MySQL connected successfully");

    connection.release();
  } catch (err) {
    console.error("❌ MySQL connection error");
    console.error("Code:", err.code);
    console.error("Message:", err.message);
    console.error(err);
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
      callback(null, rows[0]);
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
