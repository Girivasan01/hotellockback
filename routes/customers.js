const express = require("express");
const router = express.Router();
const db = require("../db/database");
const multer = require("multer");

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// ================= GET ALL CUSTOMERS =================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("GET CUSTOMERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET CUSTOMER BY ID =================
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("GET CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CREATE CUSTOMER =================
router.post("/", upload.single("document"), async (req, res) => {
  const {
    name,
    contact,
    email,
    id_type,
    id_number,
    address,
    vehicle_no,
    dob,
  } = req.body;

  if (!name || !contact) {
    return res.status(400).json({ message: "Name and mobile number are mandatory" });
  }

  const document = req.file ? `uploads/${req.file.filename}` : null;

  try {
    const [result] = await db.query(
      `INSERT INTO customers
       (name, contact, email, id_type, id_number, address, vehicle_no, dob, document)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        contact,
        email || null,
        id_type || null,
        id_number || null,
        address || null,
        vehicle_no || null,
        dob || null,
        document,
      ]
    );

    res.json({
      id: result.insertId,
      name,
      contact,
      email: email || null,
      id_type: id_type || null,
      id_number: id_number || null,
      address: address || null,
      vehicle_no: vehicle_no || null,
      dob: dob || null,
      document,
      message: "Customer added",
    });
  } catch (err) {
    console.error("CREATE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE CUSTOMER =================
router.put("/:id", upload.single("document"), async (req, res) => {
  const {
    name,
    contact,
    email,
    id_type,
    id_number,
    address,
    vehicle_no,
    dob,
  } = req.body;

  if (!name || !contact) {
    return res.status(400).json({ message: "Name and mobile number are mandatory" });
  }

  const document = req.file ? `uploads/${req.file.filename}` : null;

  let query = `
    UPDATE customers SET
      name = ?,
      contact = ?,
      email = ?,
      id_type = ?,
      id_number = ?,
      address = ?,
      vehicle_no = ?,
      dob = ?`;

  const params = [
    name,
    contact,
    email || null,
    id_type || null,
    id_number || null,
    address || null,
    vehicle_no || null,
    dob || null,
  ];

  if (document) {
    query += ", document = ?";
    params.push(document);
  }

  query += " WHERE id = ?";
  params.push(req.params.id);

  try {
    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json({ message: "Customer updated" });
  } catch (err) {
    console.error("UPDATE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE CUSTOMER =================
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM customers WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Customer not found" });
    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("DELETE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
