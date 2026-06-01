const mysql = require("mysql2/promise");

const host =
  process.env.MYSQL_HOST ||
  process.env.DB_HOST ||
  "srv786.hstgr.io";

const user =
  process.env.MYSQL_USER ||
  process.env.DB_USER ||
  "u683444186_lock";

const password =
  process.env.MYSQL_PASSWORD ||
  process.env.DB_PASSWORD ||
  "Lockhotel2026";

const database =
  process.env.MYSQL_DATABASE ||
  process.env.DB_DATABASE ||
  "u683444186_lock";

const port = process.env.MYSQL_PORT
  ? Number(process.env.MYSQL_PORT)
  : process.env.DB_PORT
  ? Number(process.env.DB_PORT)
  : 3306;

console.log("📡 MySQL Config:");
console.log({
  host,
  user,
  database,
  port,
});

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 60000,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  charset: "utf8mb4_unicode_ci",

  // Prevent mysql2 from converting dates to JS Date objects
  dateStrings: true,

  // Use IST session timezone
  timezone: "+05:30",
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();

    await connection.ping();

    console.log("✅ MySQL connected");

    connection.release();
  } catch (err) {
    console.error("❌ MySQL connection error:");
    console.error(err);
  }
}

testConnection();

async function queryWithRetry(sql, params = [], retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      lastError = err;

      console.error(
        `❌ DB Query Failed (Attempt ${attempt}/${retries})`
      );
      console.error("Code:", err.code);
      console.error("Message:", err.message);

      if (
        err.code !== "ETIMEDOUT" &&
        err.code !== "PROTOCOL_CONNECTION_LOST" &&
        err.code !== "ECONNRESET"
      ) {
        throw err;
      }

      if (attempt < retries) {
        console.log("🔄 Retrying database query...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError;
}

pool.on?.("error", (err) => {
  console.error("💥 MySQL Pool Error:", err);
});

module.exports = {
  query: queryWithRetry,

  get: async (sql, params, callback) => {
    try {
      const [rows] = await queryWithRetry(sql, params || []);
      callback(null, rows[0] || undefined);
    } catch (err) {
      callback(err);
    }
  },

  all: async (sql, params, callback) => {
    try {
      const [rows] = await queryWithRetry(sql, params || []);
      callback(null, rows);
    } catch (err) {
      callback(err);
    }
  },

  run: async (sql, params, callback) => {
    try {
      const [result] = await queryWithRetry(sql, params || []);

      const info = {
        lastID: result.insertId,
        changes: result.affectedRows,
      };

      if (callback) callback(null, info);

      return info;
    } catch (err) {
      if (callback) {
        callback(err);
      } else {
        throw err;
      }
    }
  },

  pool,

  testConnection,
};
