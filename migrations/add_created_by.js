// Run this script ONCE to add created_by columns

const db = require("../db/database"); // 👈 correct relative path

db.serialize(() => {
  db.run(
    `ALTER TABLE bookings ADD COLUMN created_by_id INTEGER`,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("❌ Error adding created_by_id:", err.message);
      } else {
        console.log("✅ created_by_id column added / already exists");
      }
    }
  );

  db.run(
    `ALTER TABLE bookings ADD COLUMN created_by_name TEXT`,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("❌ Error adding created_by_name:", err.message);
      } else {
        console.log("✅ created_by_name column added / already exists");
      }
    }
  );

  db.run(
    `ALTER TABLE bookings ADD COLUMN created_by_role TEXT`,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("❌ Error adding created_by_role:", err.message);
      } else {
        console.log("✅ created_by_role column added / already exists");
      }
    }
  );

  setTimeout(() => {
    console.log("\n🎉 Database migration completed");
    db.close();
    process.exit(0);
  }, 300);
});
