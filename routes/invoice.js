const express = require("express");
const { generateInvoicePDF } = require("../controllers/invoiceController");

const router = express.Router();

/**
 * POST /api/invoice/generate
 * Generate and download invoice PDF
 */
router.post("/generate", generateInvoicePDF);

module.exports = router;
