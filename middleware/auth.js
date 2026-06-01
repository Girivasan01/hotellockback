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

    const [userRows] = await db.query(
      "SELECT id, name, email, role, staff_id, org_id FROM users WHERE id = ? LIMIT 1",
      [decoded.id],
    );
    const userRow = userRows[0];

    if (!userRow) {
      return res.status(401).json({ message: "Invalid token" });
    }

    let name = userRow.name;

    if (userRow.role === "staff" && userRow.staff_id) {
      const [rows] = await db.query(
        `SELECT s.name 
         FROM staff s 
         WHERE s.id = ?`,
        [userRow.staff_id],
      );
      name = rows[0]?.name || name || "Staff";
    }

    req.user = {
      id: userRow.id,
      role: userRow.role,
      name,
      staffId: userRow.staff_id,
      org_id: userRow.org_id ?? decoded.org_id ?? null,
      email: userRow.email,
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
