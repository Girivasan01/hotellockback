const express = require("express");
const router = express.Router();
const mysqldump = require("mysqldump");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.get("/export", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await mysqldump({
      connection: {
        host: process.env.MYSQL_HOST || process.env.DB_HOST || "localhost",
        port: process.env.MYSQL_PORT
          ? Number(process.env.MYSQL_PORT)
          : process.env.DB_PORT
            ? Number(process.env.DB_PORT)
            : 3306,
        user: process.env.MYSQL_USER || process.env.DB_USER || "root",
        password:
          process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "root",
        database:
          process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "hotel_pos",
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `hotel-backup-${timestamp}.sql`;

    const fullDump =
      "SET FOREIGN_KEY_CHECKS=0;\n" +
      "SET UNIQUE_CHECKS=0;\n" +
      "SET AUTOCOMMIT=0;\n\n" +
      result.dump.schema +
      "\n" +
      result.dump.data +
      "\n\nSET FOREIGN_KEY_CHECKS=1;\n" +
      "SET UNIQUE_CHECKS=1;\n" +
      "COMMIT;\n";

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(fullDump);
  } catch (err) {
    console.error("SQL export failed:", err);
    res.status(500).json({ error: "Failed to export database" });
  }
});

module.exports = router;
