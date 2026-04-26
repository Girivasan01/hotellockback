const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

// ===============================
// GET GST SETTINGS
// ===============================
router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM gst_settings");
    res.json(rows);
  } catch (err) {
    console.error("GET GST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// UPDATE GST SETTINGS
// ===============================
router.put("/", requireAuth, async (req, res) => {
  const settings = req.body;

  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: "Invalid GST payload format" });
  }

  const query = `
    UPDATE gst_settings
    SET gst_rate = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE category = ?
  `;

  try {
    for (const s of settings) {
      const rate = Number(s.gst_rate) || 0;
      const enabled = s.is_enabled ? 1 : 0;
      const [result] = await db.query(query, [rate, enabled, s.category]);
      console.log(`GST updated: ${s.category} → rows affected: ${result.affectedRows}`);
    }
    res.json({ message: "GST settings updated successfully" });
  } catch (err) {
    console.error("GST update error:", err);
    res.status(500).json({ error: "Failed to save GST settings" });
  }
});

module.exports = router;
