const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { requireOrg } = require("../middleware/org");

const router = express.Router();

router.use(requireAuth, requireAdmin, requireOrg);

/* GET ALL STAFF */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.name,
        s.phone,
        s.status,
        s.created_at,
        u.email
      FROM staff s
      LEFT JOIN users u ON u.staff_id = s.id AND u.role = 'staff' AND u.org_id = s.org_id
      WHERE s.org_id = ?
      ORDER BY s.created_at DESC
      `,
      [req.orgId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

/* ADD STAFF (AUTO CREATE USER LOGIN) */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone number and password are required",
      });
    }

    const nameTrimed = name.trim();
    const emailTrimed = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimed)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res
        .status(400)
        .json({ message: "Phone number must be exactly 10 digits" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const [existingRows] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [emailTrimed],
    );
    if (existingRows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const org_id = req.orgId;

    const [staffResult] = await db.query(
      `INSERT INTO staff (name, phone, status, org_id) VALUES (?, ?, 'active', ?)`,
      [nameTrimed, phone, org_id],
    );
    const staffId = staffResult.insertId;

    await db.query(
      `INSERT INTO users (name, email, password, role, staff_id, org_id) VALUES (?, ?, ?, 'staff', ?, ?)`,
      [nameTrimed, emailTrimed, passwordHash, staffId, org_id],
    );

    res.status(201).json({
      id: staffId,
      name: nameTrimed,
      email: emailTrimed,
      phone,
      status: "active",
      message: "Staff added successfully",
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* DELETE STAFF */
router.delete("/:id", async (req, res) => {
  try {
    const staffId = req.params.id;

    await db.query("DELETE FROM users WHERE staff_id = ? AND org_id = ?", [
      staffId,
      req.orgId,
    ]);
    const [staffDelete] = await db.query(
      "DELETE FROM staff WHERE id = ? AND org_id = ?",
      [staffId, req.orgId],
    );

    if (staffDelete.affectedRows === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    console.error("DELETE STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to delete staff" });
  }
});

module.exports = router;
