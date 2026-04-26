const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const db = require("./db/database");
const { runMigrations } = require("./db/migrate"); // ✅ Import migrations

// ================= GLOBAL CRASH HANDLER =================
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err);
});

// ================= ROUTES =================
const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff.routes");
const billingRoutes = require("./routes/billings");
const dashboardRoutes = require("./routes/dashboard.routes");
const customerRoutes = require("./routes/customers");
const bookingsRoutes = require("./routes/bookings");
const roomsRoutes = require("./routes/roomsRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const addonsRoutes = require("./routes/addons");
const expenseRoutes = require("./routes/expense");
const gstRoutes = require("./routes/gst.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const invoiceRoutes = require("./routes/invoice");

// ================= APP =================
const app = express();
const PORT = process.env.PORT || 5000;

// ================= DB READY FLAG =================
let isDbReady = false;

// ================= CORS CONFIG =================
const normalizeOrigin = (value) => value?.trim().replace(/\/+$/, "");

const configuredClientUrls = [
  normalizeOrigin(process.env.CLIENT_URL),
  process.env.NETLIFY_URL
    ? normalizeOrigin(`https://${process.env.NETLIFY_URL}`)
    : null,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (configuredClientUrls.includes(normalizedOrigin)) {
    return true;
  }

  return (
    normalizedOrigin.includes(".netlify.app") ||
    normalizedOrigin.includes("localhost") ||
    normalizedOrigin.includes("127.0.0.1") ||
    normalizedOrigin.includes(".railway.app")
  );
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked:", origin, "allowed:", configuredClientUrls);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

console.log("🌐 Allowed CORS origins:", configuredClientUrls);

// ✅ Apply CORS — must be before everything else
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= DATABASE PATH =================
const schemaPath = path.join(__dirname, "db/schema.sql");

// ================= SEED ADMIN USER =================
async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL || "admin@hotel.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@2025#";
  const name = process.env.ADMIN_NAME || "Admin";

  try {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (Array.isArray(rows) && rows.length > 0) {
      console.log("✅ Admin user already exists");
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, "admin"]
    );
    console.log("✅ Admin user seeded:", email);
  } catch (err) {
    console.error("❌ Seed admin error:", err.message || err);
  }
}

async function seedKitchenUser() {
  const email = process.env.KITCHEN_EMAIL || "kitchen@hotel.com";
  const password = process.env.KITCHEN_PASSWORD || "kitchen123";
  const name = process.env.KITCHEN_NAME || "Kitchen";

  try {
    const hashed = await bcrypt.hash(password, 10);
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);

    if (Array.isArray(rows) && rows.length > 0) {
      await db.query(
        "UPDATE users SET name = ?, password = ?, role = ?, staff_id = NULL WHERE email = ?",
        [name, hashed, "kitchen", email]
      );
      console.log("Kitchen user credentials updated:", email);
      return;
    }

    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, "kitchen"]
    );
    console.log("Kitchen user seeded:", email);
  } catch (err) {
    console.error("Seed kitchen error:", err.message || err);
  }
}

// ================= INIT DATABASE =================
async function initDatabase() {
  try {
    if (!fs.existsSync(schemaPath)) {
      throw new Error("schema.sql not found at: " + schemaPath);
    }

    console.log("📁 Initializing database...");

    // ── Step 1: Apply base schema ──────────────────────────────────────────
    const schema = fs.readFileSync(schemaPath, "utf-8");

    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.query(stmt);
      } catch (err) {
        const errMsg = (err?.message || "").toLowerCase();
        const errCode = err?.code || "";
        
        // Skip benign errors (table/column/index already exists)
        if (
          errMsg.includes("already exists") ||
          errMsg.includes("duplicate column") ||
          errMsg.includes("check constraint") ||
          errCode === "ER_DUP_KEYNAME" // duplicate index name
        ) {
          continue;
        }
        
        console.error("❌ Schema error:", err.message || err);
        console.error("   SQL:", stmt.substring(0, 120));
        throw err;
      }
    }

    console.log("✅ Base schema applied");

    // ── Step 2: Run migrations (adds missing columns to existing tables) ──
    await runMigrations();

    // ── Step 3: Seed default admin user ───────────────────────────────────
    await seedAdminUser();
    await seedKitchenUser();

    console.log("✅ Database initialized successfully");
    isDbReady = true;
  } catch (err) {
    console.error("❌ DB Init Error:", err.message || err);
    // isDbReady stays false → 503 middleware handles requests gracefully
  }
}

// ================= DB READY MIDDLEWARE =================
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!isDbReady) {
    return res.status(503).json({
      success: false,
      message: "Server initializing, please try again in a moment...",
    });
  }
  next();
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    db: isDbReady ? "ready" : "initializing",
  });
});

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/addons", addonsRoutes);
app.use("/api/billings", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/gst", gstRoutes);
app.use("/api/restaurant", restaurantRoutes);
app.use("/api/invoice", invoiceRoutes);

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack || err.message);
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================= START SERVER =================
initDatabase().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
});
