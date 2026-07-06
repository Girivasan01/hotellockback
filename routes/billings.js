const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { Parser } = require("json2csv");
const billingController = require("../controllers/profitController");

/* ===============================
   GET TOTAL PROFIT
   URL: /api/billings/profit
================================ */
router.get("/profit", billingController.getProfit);

/* ===============================
   GET ALL BILLS
   URL: /api/billings
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
   URL: /api/billings/preview/:bookingId
   Returns full billing calculation with room + addons + kitchen
   WITHOUT persisting anything
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
   URL: /api/billings/:id/pdf
================================ */
router.get("/:id/pdf", async (req, res) => {
  const billId = req.params.id;

  try {
    const invoiceService = require("../services/invoiceService");
    const {
      generateInvoicePdfBuffer,
    } = require("../services/invoicePdfService");

    const invoiceData = await invoiceService.getInvoiceData(billId, req.orgId);
    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);
    const filename = `Hotel_Invoice_${billId}_${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ INVOICE PDF FAILED:", error);
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
   URL: /api/billings/:id
================================ */
router.get("/:id", async (req, res) => {
  const billId = req.params.id;

  try {
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
   DELETE BILL
   URL: /api/billings/:id
================================ */
router.delete("/:id", async (req, res) => {
  const billId = req.params.id;

  try {
    const [result] = await db.query(
      "DELETE FROM billings WHERE id = ? AND org_id = ?",
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
   URL: PATCH /api/billings/:id/downloaded
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

router.get("/export/csv", async (req, res) => {
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
      COALESCE(
        CONCAT(r_live.room_number, ' / ', r_live.category),
        CONCAT(r_stale.room_number, ' / ', r_stale.category)
      ) AS room_description,
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
      const discountedGst = Number(
        (discountedTariff * Number(row.gst_rate || 0)).toFixed(2),
      );
      return {
        id: new Date(row.checkout_date).toLocaleDateString("en-GB"),
        invoiceNo: `INV-${String(row.id).padStart(6, "0")}`,
        name: row.customer_name || "",
        guestGstNo: row.gst_number || "",
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
        { label: "Room Description", value: "roomDescription" },
        { label: "HSN Code Hotel", value: "hsnCodeHotel" },
        { label: "Tariff Price", value: "tariffPrice" },
        { label: "Tariff GST", value: "tariffGst" },
      ],
    });

    const csv = parser.parse(csvRows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=billing-statements.csv",
    );
    res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to generate export" });
  }
});

module.exports = router;
