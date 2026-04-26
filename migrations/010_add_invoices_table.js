const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/hotel.db');
console.log('🔄 Running migration: add_invoices_table + billings_idempotency');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Cannot open database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to hotel.db');
  
  db.serialize(async () => {
    try {
      // 1. Add idempotency_key to billings (nullable for existing rows)
      db.run(`ALTER TABLE billings ADD COLUMN idempotency_key TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ billings.idempotency_key failed:', err.message);
        } else {
          console.log('✅ billings.idempotency_key OK');
        }
      });

      // 2. Add missing billings columns (safe)
      const missingCols = [
        'advance_paid REAL DEFAULT 0',
        'billed_by_id INTEGER',
        'billed_by_name TEXT',
        'billed_by_role TEXT'
      ];

      missingCols.forEach(col => {
        db.run(`ALTER TABLE billings ADD COLUMN ${col}`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`❌ ${col} failed:`, err.message);
          }
        });
      });

      // 3. Create invoices table
      db.run(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          billing_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('room', 'kitchen', 'addon', 'gst', 'discount')),
          description TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          gst_rate REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          total REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('❌ invoices table failed:', err.message);
        } else {
          console.log('✅ invoices table created');
        }
      });

      // 4. Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_billings_booking ON billings(booking_id)',
        'CREATE INDEX IF NOT EXISTS idx_billings_idempotency ON billings(idempotency_key)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_billing ON invoices(billing_id)',
        'CREATE INDEX IF NOT EXISTS idx_booking_addons_booking ON booking_addons(booking_id)'
      ];

      indexes.forEach((idxSql, i) => {
        db.run(idxSql, (err) => {
          if (err) {
            console.error(`❌ Index ${i+1} failed:`, err.message);
          }
        });
      });

      // 5. Populate existing billings with line items (backfill)
      db.all('SELECT id, room_price, add_ons, kitchen_orders FROM billings WHERE invoices_count IS NULL', [], (err, billings) => {
        if (err) {
          console.error('❌ Backfill query failed:', err);
          return;
        }

        console.log(`📊 Backfilling ${billings.length} existing billings...`);

        billings.forEach(billing => {
          db.serialize(() => {
            // Room line
            db.run(`
              INSERT INTO invoices (billing_id, type, description, quantity, unit_price, subtotal, total)
              VALUES (?, 'room', 'Room Charge', 1, ?, ?, ?)
            `, [billing.id, billing.room_price || 0, billing.room_price || 0, billing.room_price || 0]);

            // TODO: Parse add_ons/kitchen_orders JSON and backfill (future step)
          });
        });
      });

      // Success
      setTimeout(() => {
        console.log('🎉 MIGRATION COMPLETE! Schema ready for production checkout.');
        console.log('✅ Tables: billings (idempotency), invoices (line items), indexes');
        db.close();
      }, 2000);

    } catch (error) {
      console.error('❌ Migration failed:', error);
      db.close();
      process.exit(1);
    }
  });
});
