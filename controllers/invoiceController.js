const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const { HOTEL_GST_NUMBER } = require("../utils/billingUtils");

/**
 * Format date as DD-MMM-YYYY
 */
function formatDate(d) {
  try {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (err) {
    return "-";
  }
}

/**
 * Format time as HH:MM:SS
 */
function formatTime(d) {
  try {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch (err) {
    return "-";
  }
}

/**
 * Format amount with rupee symbol
 */
function amount(v) {
  return `₹${Number(v).toFixed(2)}`;
}

/**
 * Color palette for invoice PDF
 */
const COLORS = {
  primary: "#333333",
  secondary: "#d97706",
  accent: "#f5f5f5",
  headerBg: "#f5f5f5",
  text: "#000000",
  muted: "#666666",
  border: "#cccccc",
  accentGold: "#d97706",
  accentRed: "#dc2626",
  success: "#059669",
};

/**
 * Generate Professional Invoice PDF using pdfkit
 */
exports.generateInvoicePDF = async (req, res) => {
  try {
    const { billing_id } = req.body;
    
    if (!billing_id) {
      return res.status(400).json({ error: 'billing_id required' });
    }

    const invoiceService = require('../services/invoiceService');
    const invoiceData = await invoiceService.getInvoiceData(billing_id);
    const selectedBill = invoiceData;

    // PDF generation (keeping original formatting)
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    // Set response headers
    const billId = billing_id;
    const filename = `Hotel_Invoice_${billId}_${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // ========== HEADER SECTION ==========
    // Add Logo
    const logoPath = path.join(
      __dirname,
      "../../HotelFrontend/frontend/public/FridayInnLogo.png",
    );
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 25, { width: 80, height: 80 });
      } catch (logoErr) {
        console.warn("Logo image could not be loaded:", logoErr.message);
      }
    }

    // Logo/Company Name (Left)
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("HOTEL FRIDAY INN", 130, 40);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Premium Hotel & Resort", 130, 65);

    // Invoice Label (Right)
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("INVOICE", pageWidth - 120, 40, { align: "right" });

    // Horizontal Line
    doc
      .strokeColor("#cccccc")
      .lineWidth(1)
      .moveTo(40, 120)
      .lineTo(pageWidth - 40, 120)
      .stroke();

    // ========== TOP INFO SECTION ==========
    let currentY = 135;

    // Bill Date (Left)
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("DATE", 40, currentY);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#000000")
      .text(formatDate(new Date()), 40, currentY + 15);

    // Invoice Number (Right)
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("INVOICE NO.", pageWidth - 200, currentY, { align: "right" });

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#000000")
      .text(`#${billId}`, pageWidth - 200, currentY + 15, { align: "right" });

    // ========== GUEST & ROOM DETAILS ==========
    currentY = 185;

    // Guest Details
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("GUEST DETAILS", 40, currentY);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(selectedBill.customer_name || "N/A", 40, currentY + 18);

    if (selectedBill.customer_address) {
      doc.text(selectedBill.customer_address, 40, currentY + 33);
      currentY += 15;
    }

    doc.text(
      `Country: ${selectedBill.nationality || "Indian"}`,
      40,
      currentY + 48,
    );

    // Room Details (Right column)
    const roomY = currentY;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("ROOM DETAILS", pageWidth - 200, roomY);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(
        `Room No: ${selectedBill.room_number || "N/A"}`,
        pageWidth - 200,
        roomY + 18,
      );

    doc.text(
      `Category: ${selectedBill.category || "N/A"}`,
      pageWidth - 200,
      roomY + 33,
    );

    doc.text(`Guests: ${selectedBill.pax || "1"}`, pageWidth - 200, roomY + 48);

    // ========== STAY DETAILS BOX ==========
    currentY = 305;

    const boxY = currentY;
    doc
      .rect(40, boxY, pageWidth - 80, 45)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    const colWidth = (pageWidth - 100) / 4;

    // Check-In
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#666666")
      .text("CHECK-IN", 50, boxY + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(formatDate(checkIn), 50, boxY + 20);

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text(formatTime(checkIn), 50, boxY + 30);

    // Check-Out
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#666666")
      .text("CHECK-OUT", 50 + colWidth, boxY + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(formatDate(checkOut), 50 + colWidth, boxY + 20);

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text(formatTime(checkOut), 50 + colWidth, boxY + 30);

    // Duration
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#666666")
      .text("DURATION", 50 + colWidth * 2, boxY + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(
        `${nights} Night${nights > 1 ? "s" : ""}`,
        50 + colWidth * 2,
        boxY + 20,
      );

    // Issued Date
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#666666")
      .text("ISSUED DATE", 50 + colWidth * 3, boxY + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(formatDate(new Date()), 50 + colWidth * 3, boxY + 20);

    // ========== ITEMIZED TABLE ==========
    currentY = 365;

    // Table Header
    const tableTop = currentY;
    const col1 = 40;
    const col3 = 380;
    const col4 = 470;

    doc
      .rect(col1, tableTop, pageWidth - 80, 25)
      .fillColor("#f5f5f5")
      .fill();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("DESCRIPTION", col1 + 10, tableTop + 7)
      .text("QTY", col3 + 10, tableTop + 7)
      .text("RATE", col4 + 10, tableTop + 7);

    // Table content
    let tableY = tableTop + 30;

    // Room Accommodation
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text("Room Accommodation", col1 + 10, tableY)
      .text("1", col3 + 10, tableY);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(amount(roomPrice), col4 + 10, tableY, { align: "right" });

    tableY += 20;

    // Add-ons (from booking_addons or JSON)
    // Line items from new invoices table (grouped)
    // const allLines = invoiceData.lines;
    // const roomLines = allLines.room || [];
    // const kitchenLines = allLines.kitchen || [];
    // const addonLines = allLines.addon || [];
    // const gstLines = allLines.gst || []; 
    //     `, [selectedBill.booking_db_id], (err, rows) => {
    //       if (!err && rows.length > 0) {
    //         allAddons = rows.map(row => ({ name: row.name, price: row.price, qty: 1 }));
    //       }
    //     });
    //   }
    // }

    const allLines = invoiceData.lines || {};
    const roomLines = allLines.room || [];
    const kitchenLines = allLines.kitchen || [];
    const addonLines = allLines.addon || [];
    const gstLines = allLines.gst || [];

    let allAddons = addonLines; // use from service directly

    if (Array.isArray(allAddons) && allAddons.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#333").text("ADD-ONS", col1 + 10, tableY);
      tableY += 15;

      allAddons.forEach((addon) => {
        const qty = addon.qty || 1;
        const lineAmount = Number(addon.price) * qty;

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#000000")
          .text(addon.name, col1 + 10, tableY)
          .text(qty.toString(), col3 + 10, tableY);

        doc
          .font("Helvetica-Bold")
          .text(amount(lineAmount), col4 + 10, tableY, { align: "right" });

        tableY += 20;
      });
    }

    // Bottom line
    doc
      .strokeColor("#cccccc")
      .lineWidth(1)
      .moveTo(40, tableY)
      .lineTo(pageWidth - 40, tableY)
      .stroke();


    tableY += 15;

    // ========== TOTALS SECTION ==========
    const totalCol = 380;
    const totalValueCol = 510;

    // Subtotal
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("SUBTOTAL", totalCol, tableY);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(amount(subtotal), totalValueCol, tableY, { align: "right" });

    tableY += 15;

    // Discount
    if (guestDiscount > 0) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666666")
        .text("DISCOUNT", totalCol, tableY);

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#dc2626")
        .text(`(${amount(guestDiscount)})`, totalValueCol, tableY, {
          align: "right",
        });

      tableY += 15;
    }

    // GST/Tax
    if (gstIncluded && gstTotal > 0) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666666")
        .text(`TAX (${gstPercent}%)`, totalCol, tableY);

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(amount(gstTotal), totalValueCol, tableY, { align: "right" });

      tableY += 15;
    }

    // Total Divider
    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .moveTo(totalCol, tableY - 5)
      .lineTo(pageWidth - 40, tableY - 5)
      .stroke();

    tableY += 10;

    // Total Amount (Highlighted)
    doc
      .rect(totalCol - 10, tableY - 5, 150, 25)
      .fillColor("#f5f5f5")
      .fill();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("TOTAL", totalCol, tableY);

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#d97706")
      .text(amount(totalAmount), totalValueCol, tableY, { align: "right" });

    tableY += 30;

    // Advance & Balance
    if (advancePaid > 0) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666666")
        .text("Advance Paid", totalCol, tableY);

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#059669")
        .text(`(${amount(advancePaid)})`, totalValueCol, tableY, {
          align: "right",
        });

      tableY += 15;
    }

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(balanceAmount > 0 ? "#dc2626" : "#059669")
      .text("BALANCE DUE", totalCol, tableY);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(balanceAmount > 0 ? "#dc2626" : "#059669")
      .text(amount(Math.abs(balanceAmount)), totalValueCol, tableY, {
        align: "right",
      });

    // ========== FOOTER ==========
    const footerY = pageHeight - 80;

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text("Thank you for choosing Hotel Friday Inn!", 40, footerY);

    // Hotel Info
    doc
      .fontSize(8)
      .fillColor("#666666")
      .text(
        "Address: D.NO 307, Asambur Road, Yercaud - 636602",
        40,
        footerY + 15,
      );

    doc
      .fontSize(8)
      .text(
        "Phone: +91 9489690022 | Email: reservation@fridayinnyercaud.com",
        40,
        footerY + 25,
      );

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor("#999999")
      .text(`GST No: ${gstNumber}`, 40, footerY + 35);

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#cccccc")
      .text(
        `Generated on ${formatDate(new Date())} | Invoice ID: ${billId}`,
        40,
        footerY + 45,
      );

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Error generating PDF: " + error.message });
  }
};
