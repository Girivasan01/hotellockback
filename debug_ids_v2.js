const db = require("./db/database");

async function debugIds() {
  try {
    console.log("--- LATEST 5 BILLINGS ---");
    const [bills] = await db.query("SELECT id, booking_id, room_id FROM billings ORDER BY id DESC LIMIT 5");
    console.log(bills);

    if (bills.length > 0) {
      const firstId = bills[0].booking_id;
      console.log(`\n--- SEARCHING FOR BOOKING ID: ${firstId} ---`);
      const [byStr] = await db.query("SELECT id, booking_id, room_id FROM bookings WHERE booking_id = ?", [firstId]);
      console.log("Match by booking_id string:", byStr);

      const [byInt] = await db.query("SELECT id, booking_id, room_id FROM bookings WHERE id = ?", [firstId]);
      console.log("Match by internal id:", byInt);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugIds();
