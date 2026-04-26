const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const buildLoginHandler = ({ requiredRole = null, roleMessage = "Access denied" } = {}) => {
  return async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const { password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Missing fields" });
      }

      if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET missing");
        return res.status(500).json({ message: "Server config error" });
      }

      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
      const user = users[0];

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.password) {
        return res.status(500).json({ message: "Corrupted user data" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ message: roleMessage });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      const { password: _password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      res.status(500).json({ message: "Internal server error", error: err.message });
    }
  };
};

/* ======================
   LOGIN (PUBLIC)
====================== */
router.post("/login", buildLoginHandler());

/* ======================
   KITCHEN LOGIN (PUBLIC)
====================== */
router.post(
  "/kitchen-login",
  buildLoginHandler({
    requiredRole: "kitchen",
    roleMessage: "Kitchen login accepts kitchen accounts only",
  })
);

/* ======================
   KITCHEN REGISTRATION
   (ADMIN ONLY)
====================== */
router.post("/register-kitchen", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'kitchen')",
      [name, email, hash]
    );

    res.status(201).json({
      message: "Kitchen user registered successfully",
      user: { id: result.insertId, name, email, role: "kitchen" },
    });
  } catch (err) {
    console.error("INSERT ERROR:", err);
    res.status(500).json({ message: "Kitchen registration failed", error: err.message });
  }
});

/* ======================
   LOGOUT
====================== */
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

/* ======================
   PROFILE (PROTECTED)
====================== */
router.get("/profile", requireAuth, async (req, res) => {
  try {
    if (req.user.role === "staff" && req.user.staffId) {
      const [rows] = await db.query("SELECT id, name, phone, status FROM staff WHERE id = ?", [req.user.staffId]);
      const staff = rows[0];

      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      return res.json({
        id: req.user.id,
        role: "staff",
        staffId: staff.id,
        name: staff.name,
        phone: staff.phone,
        status: staff.status,
      });
    }

    res.json(req.user);
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

/* ======================
   STAFF LIST (PUBLIC)
====================== */
router.get("/staff-list", async (req, res) => {
  try {
    const [staffList] = await db.query("SELECT id, name FROM staff WHERE status = 'active' ORDER BY name");
    res.json(staffList);
  } catch (err) {
    console.error("STAFF LIST ERROR:", err);
    res.status(500).json({ message: "Error fetching staff list" });
  }
});

/* ======================
   CHANGE PASSWORD
====================== */
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const [users] = await db.query("SELECT password FROM users WHERE id = ?", [req.user.id]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const [result] = await db.query("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ message: "Password update failed" });
    }

    res.json({ message: "Password changed successfully. Please login again." });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Error changing password" });
  }
});

module.exports = router;
