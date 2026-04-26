const db = require('../db/database');

/**
 * Migration: Fix billing booking_id values
 * 
 * Problem: billings table has numeric IDs instead of formatted booking codes
 * Solution: Update all numeric booking_ids to use formatted codes from bookings table
 */

async function fixBillingBookingIds() {
  try {
    console.log('🔄 Starting migration: fix_billing_booking_ids...\n');

    // Get all billings with numeric booking_ids that don't match the BK- format
    // Match using room_id + check_in date
    const query = `
      SELECT b.id, b.booking_id, bk.booking_id AS correct_booking_id
      FROM billings b
      LEFT JOIN bookings bk ON b.room_id = bk.room_id AND DATE(b.check_in) = DATE(bk.check_in)
      WHERE b.booking_id NOT LIKE 'BK-%' OR b.booking_id IS NULL
      LIMIT 100
    `;

    const [needsFixing] = await db.query(query);
    console.log(`📊 Found ${needsFixing.length} records that need fixing:\n`);

    if (needsFixing.length === 0) {
      console.log('✅ All records are already correct!');
      return;
    }

    // Display records before fixing
    console.log('BEFORE FIX:');
    console.log('Billing ID | Current booking_id | Correct booking_id');
    console.log('-'.repeat(60));
    needsFixing.forEach(row => {
      console.log(`${row.id.toString().padEnd(10)} | ${(row.booking_id || 'NULL').toString().padEnd(18)} | ${(row.correct_booking_id || 'NULL').padEnd(18)}`);
    });
    console.log('\n');

    // Fix each record
    let fixed = 0;
    let failed = 0;
    let orphaned = 0;

    for (const record of needsFixing) {
      if (!record.correct_booking_id) {
        console.log(`⚠️  Billing ID ${record.id}: No matching booking found (orphaned record)`);
        orphaned++;
        continue;
      }

      try {
        const updateQuery = 'UPDATE billings SET booking_id = ? WHERE id = ?';
        await db.query(updateQuery, [record.correct_booking_id, record.id]);
        console.log(`✅ Billing ID ${record.id}: Updated to ${record.correct_booking_id}`);
        fixed++;
      } catch (err) {
        console.log(`❌ Billing ID ${record.id}: Failed to update - ${err.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migration complete:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⚠️  Orphaned (no booking match): ${orphaned}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
fixBillingBookingIds();
