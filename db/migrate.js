// db/migrate.js
const db = require("./database");

/**
 * Migrations are run in ORDER.
 * Add new migrations at the BOTTOM of this array only.
 */
const migrations = [
  // ── Bookings: columns added after initial schema ──────────────────────────
  `ALTER TABLE bookings ADD COLUMN advance_paid DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE bookings ADD COLUMN add_ons TEXT DEFAULT '[]'`,
  `ALTER TABLE bookings ADD COLUMN people_count INT DEFAULT 1`,
  `ALTER TABLE bookings ADD COLUMN created_by_id INT`,
  `ALTER TABLE bookings ADD COLUMN created_by_name VARCHAR(255)`,
  `ALTER TABLE bookings ADD COLUMN created_by_role VARCHAR(255)`,

  // ── Staff: columns added after initial schema ─────────────────────────────
  `ALTER TABLE staff ADD COLUMN phone VARCHAR(50) NOT NULL DEFAULT ''`,
  `ALTER TABLE staff ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'`,

  // ── Users: staff_id FK column ─────────────────────────────────────────────
  `ALTER TABLE users ADD COLUMN staff_id INT`,
  `ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','kitchen') NOT NULL`,

  // ── Billings: is_downloaded flag ──────────────────────────────────────────
  `ALTER TABLE billings ADD COLUMN is_downloaded TINYINT(1) DEFAULT 0`,

  // ── Rooms: capacity column ────────────────────────────────────────────────
  `ALTER TABLE rooms ADD COLUMN capacity INT DEFAULT 2`,

  // ── Discount support ──────────────────────────────────────────────────────
  `ALTER TABLE bookings ADD COLUMN discount DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE billings ADD COLUMN discount DECIMAL(10,2) DEFAULT 0`,
];

async function columnExists(tableName, columnName) {
  const sql = `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`;
  const params = [process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "hotel_pos", tableName, columnName];

  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function runOne(sql) {
  try {
    const alterMatch = /ALTER TABLE\s+`?(\w+)`?\s+ADD COLUMN\s+`?(\w+)`?/i.exec(sql);

    if (alterMatch) {
      const tableName = alterMatch[1];
      const columnName = alterMatch[2];
      const exists = await columnExists(tableName, columnName);
      if (exists) {
        console.log(`  ⏭️  Skipped (column exists): ${tableName}.${columnName}`);
        return;
      }
    }

    await db.query(sql);
    console.log(`  ✅ Applied: ${sql.substring(0, 80)}...`);
  } catch (err) {
    const message = (err?.message || "").toLowerCase();
    if (message.includes("duplicate column") || message.includes("already exists") || message.includes("duplicate key")) {
      console.log(`  ⏭️  Skipped (already applied/exists): ${sql.substring(0, 80)}...`);
      return;
    }

    console.error(`  ❌ Migration failed: ${err.message}`);
    console.error(`     SQL: ${sql}`);
    throw err;
  }
}

async function runMigrations() {
  console.log(`🔄 Running ${migrations.length} migration(s)...`);

  for (const sql of migrations) {
    await runOne(sql);
  }

  console.log("✅ All migrations complete.");
}

module.exports = { runMigrations };
