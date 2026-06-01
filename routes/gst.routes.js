const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM gst_settings WHERE org_id = ?",
      [req.orgId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET GST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/", async (req, res) => {
  const settings = req.body;

  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: "Invalid GST payload format" });
  }

  const query = `
    UPDATE gst_settings
    SET gst_rate = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE category = ? AND org_id = ?
  `;

  try {
    for (const s of settings) {
      const rate = Number(s.gst_rate) || 0;
      const enabled = s.is_enabled ? 1 : 0;
      await db.query(query, [rate, enabled, s.category, req.orgId]);
    }
    res.json({ message: "GST settings updated successfully" });
  } catch (err) {
    console.error("GST update error:", err);
    res.status(500).json({ error: "Failed to save GST settings" });
  }
});

module.exports = router;
