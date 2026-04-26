const jwt = require("jsonwebtoken");
const db = require("../db/database");

const JWT_SECRET = process.env.JWT_SECRET;

const requireAuth = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    let name = null;

    // 🔥 FETCH NAME BASED ON ROLE
    if (decoded.role === "admin" || decoded.role === "kitchen") {
      const [rows] = await db.query(
        "SELECT name FROM users WHERE id = ?",
        [decoded.id]
      );
      name = rows[0]?.name || (decoded.role === "kitchen" ? "Kitchen" : "Admin User");
    }

    if (decoded.role === "staff") {
      const [rows] = await db.query(
        `SELECT s.name 
         FROM users u 
         JOIN staff s ON u.staff_id = s.id 
         WHERE u.id = ?`,
        [decoded.id]
      );
      name = rows[0]?.name || "Staff";
    }

    // ✅ FINAL USER OBJECT
    req.user = {
      id: decoded.id,
      role: decoded.role,
      name: name,
    };

    next();
  } catch (err) {
    console.error("JWT error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
