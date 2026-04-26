const path = require("path");
const bcrypt = require("bcryptjs");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = require("../db/database");

const email = (process.env.KITCHEN_EMAIL || "kitchen@hotel.com").trim().toLowerCase();
const password = process.env.KITCHEN_PASSWORD || "kitchen123";
const name = process.env.KITCHEN_NAME || "Kitchen";

async function seedKitchenUser() {
  await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','kitchen') NOT NULL");

  const hashedPassword = await bcrypt.hash(password, 10);
  const [existingUsers] = await db.query("SELECT id FROM users WHERE email = ?", [email]);

  if (existingUsers.length > 0) {
    await db.query(
      "UPDATE users SET name = ?, password = ?, role = ?, staff_id = NULL WHERE email = ?",
      [name, hashedPassword, "kitchen", email]
    );
  } else {
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, "kitchen"]
    );
  }

  const [rows] = await db.query("SELECT id, name, email, role, password FROM users WHERE email = ?", [email]);
  const user = rows[0];

  console.log({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    passwordMatches: bcrypt.compareSync(password, user.password || ""),
  });
}

seedKitchenUser()
  .then(async () => {
    await db.pool.end();
  })
  .catch(async (err) => {
    console.error(err.message || err);
    await db.pool.end();
    process.exit(1);
  });
