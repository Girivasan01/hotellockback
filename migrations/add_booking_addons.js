const sqlite3 = require('sqlite3').verbose();
const dbPath = './db/hotel.db';

console.log('Running migration: create_booking_addons_table');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB connection error:', err);
    return;
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS booking_addons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER,
        name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Migration failed:', err);
      } else {
        console.log('✅ booking_addons table created successfully');
      }
      db.close();
    });
  });
});

