const db = require("../db/database");

async function fixBillingRooms() {
  try {
    console.log("🔄 Starting data correction for billings table...");
    
    // Update billings.room_id to match the booking's current room_id
    const query = `
      UPDATE billings bl
      JOIN bookings b ON bl.booking_id = b.booking_id
      SET bl.room_id = b.room_id
    `;
    
    const [result] = await db.query(query);
    console.log(`✅ Data correction complete. Rows affected: ${result.affectedRows}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Data correction failed:", err);
    process.exit(1);
  }
}

fixBillingRooms();
