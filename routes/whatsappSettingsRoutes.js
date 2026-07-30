const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  getWhatsappSettings,
  upsertWhatsappSettings,
} = require("../utils/whatsappSettings");

router.get("/", requireAuth, async (req, res) => {
  try {
    const settings = await getWhatsappSettings(req.user.org_id);
    res.json(settings);
  } catch (err) {
    console.error("GET WHATSAPP SETTINGS ERROR:", err);
    res.status(500).json({ error: "Failed to load WhatsApp settings" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const { auto_booking_confirmation, auto_bill_payment } = req.body;
    const settings = await upsertWhatsappSettings(req.user.org_id, {
      auto_booking_confirmation: Boolean(auto_booking_confirmation),
      auto_bill_payment: Boolean(auto_bill_payment),
    });
    res.json(settings);
  } catch (err) {
    console.error("UPDATE WHATSAPP SETTINGS ERROR:", err);
    res.status(500).json({ error: "Failed to update WhatsApp settings" });
  }
});

module.exports = router;
