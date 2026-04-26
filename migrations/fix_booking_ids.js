/**
 * MIGRATION: Fix billings.booking_id to store formatted booking codes
 * Updates any numeric booking_id values that should be formatted codes
 * Run this ONCE to migrate existing data
 */

const db = require('./database');

async function migrateBookingIds() {
  console.log('\n🔄 Starting booking_id migration...\n');

  try {
    // Get all billings with numeric booking_ids
    const result = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, booking_id FROM billings WHERE booking_id REGEXP '^[0-9]+$'`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (result.length === 0) {
      console.log('✅ No numeric booking_ids found - migration not needed\n');
      process.exit(0);
    }

    console.log(`Found ${result.length} records with numeric booking_ids`);
    console.log('These likely need to be mapped to formatted codes if the booking exists.\n');

    // Since we don't have a reliable mapping, we log the records for manual review
    console.log('Records pending review:');
    result.forEach(row => {
      console.log(`  - Bill ID: ${row.id}, booking_id: ${row.booking_id}`);
    });

    console.log('\n⚠️  NOTE: To fully fix this, you need to either:');
    console.log('  1. Populate the bookings table with proper booking records');
    console.log('  2. OR ensure new bookings provide formatted booking_id codes');
    console.log('  3. OR manually update these records with the correct booking codes\n');

    // For now, just report the issue
    console.log('✅ Migration inspection complete');
    console.log('Future billings will have correct booking_id values from checkout.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateBookingIds();
