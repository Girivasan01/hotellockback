const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { Parser } = require("json2csv");
const billingController = require("../controllers/profitController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const buildBillingStatementFilename = (startDate, endDate) => {
  if (!startDate && !endDate) return "billing-statements";

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startMonth = MONTH_NAMES[start.getMonth()];
    const endMonth = MONTH_NAMES[end.getMonth()];
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear && startMonth === endMonth) {
      return `bill-statement-${startMonth}-${startYear}`;
    }
    if (startYear === endYear) {
      return `bill-statement-${startMonth}-to-${endMonth}-${startYear}`;
    }
    return `bill-statement-${startMonth}-${startYear}-to-${endMonth}-${endYear}`;
  }

  const single = new Date(startDate || endDate);
  const label = `${MONTH_NAMES[single.getMonth()]}-${single.getFullYear()}`;
  return startDate
    ? `bill-statement-from-${label}`
    : `bill-statement-to-${label}`;
};

/* ===============================
   GET TOTAL PROFIT
================================ */
router.get("/profit", billingController.getProfit);

/* ===============================
   GET ALL BILLS
================================ */
const billingService = require("../services/billingService");

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, search, includeDownloaded } = req.query;
    const result = await billingService.getBillings({
      page: parseInt(page),
      limit: parseInt(limit),
      search: search || "",
      includeDownloaded: String(includeDownloaded).toLowerCase() === "true",
      orgId: req.orgId,
    });
    res.json(result);
  } catch (error) {
    console.error("❌ FETCH BILLS FAILED:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   GET BILLING PREVIEW (for checkout)
================================ */
router.get("/preview/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  try {
    const preview = await billingService.getBillingPreview(
      bookingId,
      req.orgId,
    );
    res.json(preview);
  } catch (error) {
    console.error("❌ BILLING PREVIEW FAILED:", error);
    if (error.message === "Booking not found") {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   GET INVOICE PDF
================================ */
router.get("/:id/pdf", async (req, res) => {
  const billId = req.params.id;
  const { gstMode } = req.query;

  try {
    const [[deletedCheck]] = await db.query(
      "SELECT is_deleted FROM billings WHERE id = ? AND org_id = ?",
      [billId, req.orgId],
    );
    if (deletedCheck && Number(deletedCheck.is_deleted) === 1) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const invoiceService = require("../services/invoiceService");
    const {
      generateInvoicePdfBuffer,
    } = require("../services/invoicePdfService");

    if (gstMode === "with" || gstMode === "without") {
      await db.query(
        "UPDATE billings SET gst_included = ? WHERE id = ? AND org_id = ?",
        [gstMode === "with" ? 1 : 0, billId, req.orgId],
      );
    }

    const invoiceData = await invoiceService.getInvoiceData(billId, req.orgId);
    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);
    const filename = `Hotel_Invoice_${billId}_${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ INVOICE PDF FAILED:", error.message);
    console.error(error.stack);
    if (error.message === "Billing not found") {
      return res.status(404).json({ error: "Bill not found" });
    }
    res
      .status(500)
      .json({ error: error.message || "Failed to generate invoice PDF" });
  }
});

/* ===============================
   GET SINGLE BILL + DETAILS
================================ */
router.get("/:id", async (req, res) => {
  const billId = req.params.id;

  try {
    const [[deletedCheck]] = await db.query(
      "SELECT is_deleted FROM billings WHERE id = ? AND org_id = ?",
      [billId, req.orgId],
    );
    if (deletedCheck && Number(deletedCheck.is_deleted) === 1) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const billingService = require("../services/billingService");
    const bill = await billingService.getBillingDetails(billId, req.orgId);
    res.json(bill);
  } catch (error) {
    console.error("❌ GET BILLING DETAILS FAILED:", error);
    if (error.message === "Billing not found") {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   DELETE BILL (soft delete)
   NOTE: This only hides the bill from the billing list/PDF. It must
   NOT reduce finance income or disappear from the downloadable bill
   statement (CSV export) — those keep reading from the same
   `billings` row, so we mark it as deleted instead of removing it.
================================ */
router.delete("/:id", async (req, res) => {
  const billId = req.params.id;

  try {
    const [result] = await db.query(
      "UPDATE billings SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND org_id = ? AND COALESCE(is_deleted, 0) = 0",
      [billId, req.orgId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({ message: "Bill deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE BILL FAILED:", err);
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

/* ===============================
   MARK BILL AS DOWNLOADED
================================ */
router.post("/:id/send-whatsapp", async (req, res) => {
  const billId = req.params.id;

  try {
    const invoiceWhatsAppService = require("../services/invoiceWhatsAppService");
    const result = await invoiceWhatsAppService.sendInvoice(billId, req.orgId);

    if (result.skipped) {
      return res.status(503).json({
        error: result.message || "WhatsApp is not configured",
        skipped: true,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("❌ SEND WHATSAPP FAILED:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to send invoice via WhatsApp" });
  }
});

router.patch("/:id/downloaded", async (req, res) => {
  const billId = req.params.id;
  const { gst_number } = req.body;

  const updates = ["is_downloaded = 1"];
  const params = [];

  if (gst_number !== undefined && gst_number !== null) {
    updates.push("gst_number = ?");
    params.push(gst_number);
  }

  params.push(billId, req.orgId);
  const sql = `UPDATE billings SET ${updates.join(", ")} WHERE id = ? AND org_id = ?`;

  try {
    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({ message: "Bill marked as downloaded" });
  } catch (err) {
    console.error("❌ MARK DOWNLOADED FAILED:", err);
    res.status(500).json({ error: "Failed to update bill" });
  }
});

/* ===============================
   UPDATE BILL DISCOUNT
================================ */
router.patch("/:id/discount", async (req, res) => {
  const billId = req.params.id;
  const { discount } = req.body;
  const discountValue = Number(discount);

  if (Number.isNaN(discountValue) || discountValue < 0) {
    return res.status(400).json({ error: "Invalid discount amount" });
  }

  try {
    const [result] = await db.query(
      "UPDATE billings SET discount = ? WHERE id = ? AND org_id = ?",
      [discountValue, billId, req.orgId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({ message: "Discount updated", discount: discountValue });
  } catch (err) {
    console.error("❌ UPDATE DISCOUNT FAILED:", err);
    res.status(500).json({ error: "Failed to update discount" });
  }
});

/* ===============================
   MARK BILL AS PAID / NOT PAID
================================ */
router.patch("/:id/payment-status", async (req, res) => {
  const billId = req.params.id;
  const { status } = req.body;

  if (status !== "paid" && status !== "unpaid") {
    return res.status(400).json({ error: "status must be 'paid' or 'unpaid'" });
  }

  try {
    const [existingRows] = await db.query(
      "SELECT payment_status FROM billings WHERE id = ? AND org_id = ?",
      [billId, req.orgId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (existingRows[0].payment_status === "paid" && status === "unpaid") {
      return res.status(400).json({
        error: "A bill already marked as paid cannot be reverted to unpaid",
      });
    }

    const [result] = await db.query(
      "UPDATE billings SET payment_status = ? WHERE id = ? AND org_id = ?",
      [status, billId, req.orgId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // Whatsapp Notification (respects org auto-send setting; manual resend always available)
    if (status === "paid") {
      const { getWhatsappSettings } = require("../utils/whatsappSettings");
      const invoiceWhatsAppService = require("../services/invoiceWhatsAppService");
      getWhatsappSettings(req.orgId).then((settings) => {
        if (settings.auto_bill_payment) {
          invoiceWhatsAppService.sendInvoiceAsync(billId, req.orgId);
        }
      });
    }

    res.json({ message: `Bill marked as ${status}`, payment_status: status });
  } catch (err) {
    console.error("❌ UPDATE PAYMENT STATUS FAILED:", err);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

/* ===============================
   EXPORT CSV (ADMIN ONLY)
================================ */
router.get("/export/csv", requireAuth, requireAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const where = ["b.org_id = ?"];
  const params = [req.orgId];

  if (startDate && endDate) {
    where.push("DATE(b.created_at) BETWEEN ? AND ?");
    params.push(startDate, endDate);
  } else if (startDate) {
    where.push("DATE(b.created_at) >= ?");
    params.push(startDate);
  } else if (endDate) {
    where.push("DATE(b.created_at) <= ?");
    params.push(endDate);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      b.id AS id,
      b.created_at AS checkout_date,
      c.name AS customer_name,
      b.gst_number,
      COALESCE(b.gst_included, 1) AS gst_included,
      COALESCE(
        CONCAT(r_live.room_number, ' / ', r_live.category),
        CONCAT(r_stale.room_number, ' / ', r_stale.category)
      ) AS room_description,
      COALESCE(
        r_live.category,
        r_stale.category
      ) AS room_category,
      COALESCE(room_lines.room_tariff, 0) AS raw_tariff,
      COALESCE(b.discount, 0) AS discount,
      COALESCE(room_lines.room_gst_rate, 0.05) AS gst_rate
    FROM billings b
    LEFT JOIN bookings bk ON bk.booking_id = b.booking_id
    LEFT JOIN rooms r_live ON r_live.id = bk.room_id
    LEFT JOIN rooms r_stale ON r_stale.id = b.room_id
    LEFT JOIN customers c ON c.id = b.customer_id
LEFT JOIN (
      SELECT
        billing_id,
        ROUND(SUM(subtotal), 2) AS room_tariff,
        MAX(gst_rate) AS room_gst_rate
      FROM invoices
      WHERE type = 'room'
      GROUP BY billing_id
    ) room_lines ON room_lines.billing_id = b.id
    ${whereClause}
    ORDER BY b.created_at DESC
  `;

  try {
    const [rows] = await db.query(sql, params);

    const csvRows = rows.map((row) => {
      const discountedTariff = Math.max(
        Number(row.raw_tariff || 0) - Number(row.discount || 0),
        0,
      );
      const gstIncluded = Number(row.gst_included) === 1;
      const discountedGst = gstIncluded
        ? Number((discountedTariff * Number(row.gst_rate || 0)).toFixed(2))
        : 0;
      return {
        id: new Date(row.checkout_date).toLocaleDateString("en-GB"),
        invoiceNo: `INV-${String(row.id).padStart(6, "0")}`,
        name: row.customer_name || "",
        guestGstNo: row.gst_number || "",
        hotelGstNo:
          row.room_category &&
          row.room_category.toLowerCase().includes("a frame wooden villa")
            ? "33AMQPK7880E2ZO"
            : "33AMQPK7880E1ZP",
        roomDescription: row.room_description || "",
        hsnCodeHotel: "",
        tariffPrice: discountedTariff.toFixed(2),
        tariffGst: discountedGst.toFixed(2),
      };
    });

    const totals = csvRows.reduce(
      (sum, row) => ({
        tariffPrice: sum.tariffPrice + Number(row.tariffPrice || 0),
        tariffGst: sum.tariffGst + Number(row.tariffGst || 0),
      }),
      { tariffPrice: 0, tariffGst: 0 },
    );

    csvRows.push({
      id: "",
      invoiceNo: "",
      name: "",
      guestGstNo: "",
      hotelGstNo: "",
      roomDescription: "",
      hsnCodeHotel: "Total",
      tariffPrice: totals.tariffPrice.toFixed(2),
      tariffGst: totals.tariffGst.toFixed(2),
    });

    const parser = new Parser({
      fields: [
        { label: "Date", value: "id" },
        { label: "Invoice No.", value: "invoiceNo" },
        { label: "Name", value: "name" },
        { label: "Guest GST No.", value: "guestGstNo" },
        { label: "Hotel GST No.", value: "hotelGstNo" },
        { label: "Room Description", value: "roomDescription" },
        { label: "HSN Code Hotel", value: "hsnCodeHotel" },
        { label: "Tariff Price", value: "tariffPrice" },
        { label: "Tariff GST", value: "tariffGst" },
      ],
    });

    const csv = parser.parse(csvRows);

    const filename = buildBillingStatementFilename(startDate, endDate);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}.csv`,
    );
    res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to generate export" });
  }
});

module.exports = router;
