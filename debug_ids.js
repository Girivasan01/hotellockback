const db = require("./db/database");

async function debugIds() {
  try {
    console.log("--- BILLINGS ---");
    const [bills] = await db.query("SELECT id, booking_id FROM billings LIMIT 5");
    console.log(bills);

    console.log("--- BOOKINGS ---");
    const [bookings] = await db.query("SELECT id, booking_id FROM bookings LIMIT 5");
    console.log(bookings);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugIds();
