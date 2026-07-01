const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const db = require("../db/database");
const multer = require("multer");

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function sanitizeFolderName(name) {
  if (!name || typeof name !== "string") return "customer";
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return sanitized || "customer";
}

function buildFilePath(folder, filename) {
  return `uploads/${folder}/${filename}`;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = sanitizeFolderName(req.body?.name);
    const dir = path.join(uploadsDir, folder);
    fs.mkdirSync(dir, { recursive: true });
    req.uploadFolder = folder;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname) ||
      (file.fieldname === "photo" ? ".jpg" : "");

    if (file.fieldname === "photo") {
      cb(null, `profile${ext}`);
    } else {
      req._docCount = (req._docCount || 0) + 1;
      cb(null, `document_${req._docCount}_${Date.now()}${ext}`);
    }
  },
});

const MAX_FILE_SIZE = 1 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadFields = upload.fields([
  { name: "document", maxCount: 20 },
  { name: "photo", maxCount: 1 },
]);

function handleUpload(req, res, next) {
  uploadFields(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File must be under 1MB" });
    }
    return res.status(400).json({ message: err.message || "Upload failed" });
  });
}

function buildDocumentPaths(req) {
  const files = req.files?.document || [];
  const folder = req.uploadFolder || sanitizeFolderName(req.body?.name);
  return files.map((f) => buildFilePath(folder, f.filename));
}

function tryParseDocuments(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

// ── GET all customers ───
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE org_id = ? ORDER BY id DESC",
      [req.orgId],
    );
    const parsed = rows.map((r) => ({
      ...r,
      document: tryParseDocuments(r.document),
    }));
    res.json(parsed);
  } catch (err) {
    console.error("GET CUSTOMERS ERROR:", err);
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("unknown column") && msg.includes("org_id")) {
      return res.status(500).json({
        error: "customers.org_id column missing. Restart Hotel POS backend to run migrations.",
      });
    }
    if (msg.includes("unknown column") && msg.includes("photo")) {
      return res.status(500).json({
        error: "customers.photo column missing. Run db/customer-photo.sql in phpMyAdmin or restart backend.",
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET customer booking history ──
router.get("/:id/bookings", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         b.id,
         b.booking_id,
         b.check_in,
         b.check_out,
         b.status,
         b.price,
         b.advance_paid,
         b.discount,
         r.room_number,
         r.category
       FROM bookings b
       LEFT JOIN rooms r ON b.room_id = r.id
       WHERE b.customer_id = ? AND b.org_id = ?
       ORDER BY b.check_in DESC
       LIMIT 20`,
      [req.params.id, req.orgId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET CUSTOMER BOOKINGS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET single customer ──
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId],
    );
    if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
    res.json({
      ...rows[0],
      document: tryParseDocuments(rows[0].document),
    });
  } catch (err) {
    console.error("GET CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST create customer ──
router.post("/", handleUpload, async (req, res) => {
  const { name, contact, email, id_type, id_number, address, vehicle_no, dob } = req.body;

  if (!name || !contact) {
    return res.status(400).json({ message: "Name and mobile number are mandatory" });
  }

  const folder = req.uploadFolder || sanitizeFolderName(name);
  const docPaths = buildDocumentPaths(req);
  const documentValue = docPaths.length === 0
    ? null
    : docPaths.length === 1
    ? docPaths[0]
    : JSON.stringify(docPaths);

  const photo = req.files?.photo?.[0]
    ? buildFilePath(folder, req.files.photo[0].filename)
    : null;

  try {
    const [result] = await db.query(
      `INSERT INTO customers
       (name, contact, email, id_type, id_number, address, vehicle_no, dob, document, photo, org_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, contact, email || null, id_type || null, id_number || null,
        address || null, vehicle_no || null, dob || null,
        documentValue, photo, req.orgId,
      ],
    );

    res.json({
      id: result.insertId,
      name, contact,
      email: email || null,
      id_type: id_type || null,
      id_number: id_number || null,
      address: address || null,
      vehicle_no: vehicle_no || null,
      dob: dob || null,
      document: tryParseDocuments(documentValue),
      photo,
      org_id: req.orgId,
    });
  } catch (err) {
    console.error("CREATE CUSTOMER ERROR:", err);
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("unknown column") && msg.includes("photo")) {
      return res.status(500).json({
        error: "customers.photo column missing. Run db/customer-photo.sql in phpMyAdmin.",
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PUT update customer ──
router.put("/:id", handleUpload, async (req, res) => {
  const { name, contact, email, id_type, id_number, address, vehicle_no, dob, remove_photo } = req.body;

  if (!name || !contact) {
    return res.status(400).json({ message: "Name and mobile number are mandatory" });
  }

  const folder = req.uploadFolder || sanitizeFolderName(name);
  const docPaths = buildDocumentPaths(req);

  let existingDocs = [];
  try {
    const [rows] = await db.query(
      "SELECT document FROM customers WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId]
    );
    if (rows[0]) {
      const parsed = tryParseDocuments(rows[0].document);
      existingDocs = Array.isArray(parsed)
        ? parsed
        : parsed
        ? [parsed]
        : [];
    }
  } catch (_) {}

  const allDocs = [...existingDocs, ...docPaths];
  const documentValue = allDocs.length === 0
    ? null
    : allDocs.length === 1
    ? allDocs[0]
    : JSON.stringify(allDocs);

  const photo = req.files?.photo?.[0]
    ? buildFilePath(folder, req.files.photo[0].filename)
    : null;

  let query = `
    UPDATE customers SET
      name = ?, contact = ?, email = ?, id_type = ?,
      id_number = ?, address = ?, vehicle_no = ?, dob = ?`;

  const params = [
    name, contact, email || null, id_type || null,
    id_number || null, address || null, vehicle_no || null, dob || null,
  ];

  query += ", document = ?";
  params.push(documentValue);

  if (photo) {
    query += ", photo = ?";
    params.push(photo);
  } else if (remove_photo === "true") {
    query += ", photo = NULL";
  }

  query += " WHERE id = ? AND org_id = ?";
  params.push(req.params.id, req.orgId);

  try {
    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId],
    );
    res.json({
      ...rows[0],
      document: tryParseDocuments(rows[0].document),
    });
  } catch (err) {
    console.error("UPDATE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/document", async (req, res) => {
  const { docPath } = req.body;

  if (!docPath) {
    return res.status(400).json({ error: "docPath is required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT document FROM customers WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Customer not found" });

    const current = tryParseDocuments(rows[0].document);
    const updated = Array.isArray(current)
      ? current.filter((d) => d !== docPath)
      : typeof current === "string" && current !== docPath
      ? [current]
      : [];

    const newValue =
      updated.length === 0
        ? null
        : updated.length === 1
        ? updated[0]
        : JSON.stringify(updated);

    await db.query(
      "UPDATE customers SET document = ? WHERE id = ? AND org_id = ?",
      [newValue, req.params.id, req.orgId]
    );

    const absPath = path.join(__dirname, "..", docPath);
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

    res.json({ success: true, document: tryParseDocuments(newValue) });
  } catch (err) {
    console.error("DELETE DOCUMENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE customer  ───────
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM customers WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Customer not found" });
    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("DELETE CUSTOMER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;