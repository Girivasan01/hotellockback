const db = require("../db/database");

// Defaults: auto-send ON for both events unless turned off.
const DEFAULTS = {
  auto_booking_confirmation: true,
  auto_bill_payment: true,
};

async function getWhatsappSettings(orgId) {
  const [rows] = await db.query(
    "SELECT auto_booking_confirmation, auto_bill_payment FROM whatsapp_settings WHERE org_id = ?",
    [orgId],
  );

  if (!rows[0]) return { ...DEFAULTS };

  return {
    auto_booking_confirmation: Boolean(rows[0].auto_booking_confirmation),
    auto_bill_payment: Boolean(rows[0].auto_bill_payment),
  };
}

async function upsertWhatsappSettings(orgId, { auto_booking_confirmation, auto_bill_payment }) {
  await db.query(
    `INSERT INTO whatsapp_settings (org_id, auto_booking_confirmation, auto_bill_payment)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       auto_booking_confirmation = VALUES(auto_booking_confirmation),
       auto_bill_payment = VALUES(auto_bill_payment)`,
    [orgId, auto_booking_confirmation ? 1 : 0, auto_bill_payment ? 1 : 0],
  );
  return getWhatsappSettings(orgId);
}

module.exports = { getWhatsappSettings, upsertWhatsappSettings };