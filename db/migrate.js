// db/migrate.js
const db = require("./database");

/**
 * Migrations are run in ORDER.
 * Add new migrations at the BOTTOM of this array only.
 */
const migrations = [
  // ── Bookings: columns added after initial schema ─────────────
  `ALTER TABLE bookings ADD COLUMN advance_paid DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE bookings ADD COLUMN add_ons TEXT DEFAULT '[]'`,
  `ALTER TABLE bookings ADD COLUMN people_count INT DEFAULT 1`,
  `ALTER TABLE bookings ADD COLUMN created_by_id INT`,
  `ALTER TABLE bookings ADD COLUMN created_by_name VARCHAR(255)`,
  `ALTER TABLE bookings ADD COLUMN created_by_role VARCHAR(255)`,

  // ── Staff: columns added after initial schema ──
  `ALTER TABLE staff ADD COLUMN phone VARCHAR(50) NOT NULL DEFAULT ''`,
  `ALTER TABLE staff ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'`,

  // ── Users: staff_id FK column ─────
  `ALTER TABLE users ADD COLUMN staff_id INT`,
  `ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','kitchen') NOT NULL`,

  // ── Billings: is_downloaded flag ──
  `ALTER TABLE billings ADD COLUMN is_downloaded TINYINT(1) DEFAULT 0`,

  // ── Rooms: capacity column ────────
  `ALTER TABLE rooms ADD COLUMN capacity INT DEFAULT 2`,

  // ── Discount support ──────────────
  `ALTER TABLE bookings ADD COLUMN discount DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE billings ADD COLUMN discount DECIMAL(10,2) DEFAULT 0`,

  // ── Multi-tenant org_id (matches studio_admin.enterprises.id) ──
  `ALTER TABLE rooms ADD COLUMN org_id INT`,
  `ALTER TABLE room_categories ADD COLUMN org_id INT`,
  `ALTER TABLE customers ADD COLUMN org_id INT`,
  `ALTER TABLE bookings ADD COLUMN org_id INT`,
  `ALTER TABLE categories ADD COLUMN org_id INT`,
  `ALTER TABLE menu_items ADD COLUMN org_id INT`,
  `ALTER TABLE kitchen_orders ADD COLUMN org_id INT`,
  `ALTER TABLE add_ons ADD COLUMN org_id INT`,
  `ALTER TABLE billings ADD COLUMN org_id INT`,
  `ALTER TABLE invoices ADD COLUMN org_id INT`,
  `ALTER TABLE booking_addons ADD COLUMN org_id INT`,
  `ALTER TABLE expenses ADD COLUMN org_id INT`,
  `ALTER TABLE gst_settings ADD COLUMN org_id INT`,
  `ALTER TABLE staff ADD COLUMN org_id INT`,
  `ALTER TABLE users ADD COLUMN org_id INT`,
  `ALTER TABLE restaurant_orders ADD COLUMN org_id INT`,

  `CREATE INDEX idx_rooms_org ON rooms(org_id)`,
  `CREATE INDEX idx_customers_org ON customers(org_id)`,
  `CREATE INDEX idx_bookings_org ON bookings(org_id)`,
  `CREATE INDEX idx_users_org ON users(org_id)`,
  `CREATE INDEX idx_staff_org ON staff(org_id)`,

  // ── Customers: photo column ───────
  `ALTER TABLE customers ADD COLUMN photo VARCHAR(1024) NULL`,

  // ── Enterprises: synced from Vault Sync (subscription + storage) ──
  `CREATE TABLE IF NOT EXISTS enterprises (
    id INT NOT NULL PRIMARY KEY,
    enterprise VARCHAR(255) NOT NULL,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    start_date DATE DEFAULT NULL,
    expiry_date DATE DEFAULT NULL,
    storage_limit_gb DECIMAL(10,2) DEFAULT 0,
    storage_used_bytes BIGINT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE enterprises ADD COLUMN storage_limit_gb DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE enterprises ADD COLUMN storage_used_bytes BIGINT DEFAULT 0`,
];

async function columnExists(tableName, columnName) {
  const sql = `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`;
  const params = [
    process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "hotel_pos",
    tableName,
    columnName,
  ];

  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const sql = `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`;
  const params = [
    process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "hotel_pos",
    tableName,
    indexName,
  ];
  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

const verboseMigrations = process.env.MIGRATION_VERBOSE === "true";

async function runOne(sql, stats) {
  try {
    const alterMatch = /ALTER TABLE\s+`?(\w+)`?\s+ADD COLUMN\s+`?(\w+)`?/i.exec(
      sql,
    );

    if (alterMatch) {
      const tableName = alterMatch[1];
      const columnName = alterMatch[2];
      const exists = await columnExists(tableName, columnName);
      if (exists) {
        stats.skipped += 1;
        if (verboseMigrations) {
          console.log(
            `  ⏭️  Skipped (column exists): ${tableName}.${columnName}`,
          );
        }
        return;
      }
    }

    const indexMatch = /CREATE INDEX\s+(\w+)\s+ON\s+`?(\w+)`?/i.exec(sql);
    if (indexMatch) {
      const indexName = indexMatch[1];
      const tableName = indexMatch[2];
      const exists = await indexExists(tableName, indexName);
      if (exists) {
        stats.skipped += 1;
        if (verboseMigrations) {
          console.log(
            `  ⏭️  Skipped (index exists): ${tableName}.${indexName}`,
          );
        }
        return;
      }
    }

    await db.query(sql);
    stats.applied += 1;
    console.log(`  ✅ Applied: ${sql.substring(0, 80)}...`);
  } catch (err) {
    const message = (err?.message || "").toLowerCase();
    if (
      message.includes("duplicate column") ||
      message.includes("already exists") ||
      message.includes("duplicate key")
    ) {
      stats.skipped += 1;
      if (verboseMigrations) {
        console.log(
          `  ⏭️  Skipped (already applied/exists): ${sql.substring(0, 80)}...`,
        );
      }
      return;
    }

    console.error(`  ❌ Migration failed: ${err.message}`);
    console.error(`     SQL: ${sql}`);
    throw err;
  }
}

async function runMigrations() {
  const stats = { applied: 0, skipped: 0 };

  for (const sql of migrations) {
    await runOne(sql, stats);
  }

  if (stats.applied > 0) {
    console.log(
      `✅ Migrations: ${stats.applied} applied, ${stats.skipped} already up to date.`,
    );
  } else {
    console.log("✅ Database schema up to date (no new migrations).");
  }
}

module.exports = { runMigrations };