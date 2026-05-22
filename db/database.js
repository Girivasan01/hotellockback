const mysql = require("mysql2/promise");
onst pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  charset: "utf8mb4_unicode_ci",

  // Prevent mysql2 timezone conversion
  dateStrings: true,

  // Force IST for NOW()
  timezone: "+05:30",

  // IMPORTANT FOR RENDER + HOSTINGER
  connectTimeout: 60000,

  ssl: {
    rejectUnauthorized: false,
  },
});
