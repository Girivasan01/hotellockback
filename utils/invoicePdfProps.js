const fs = require("fs");
const path = require("path");

const PUBLIC_PATH = path.join(__dirname, "../assets");

function toDataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".png"
        ? "image/png"
        : "image/png";

  const data = fs.readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${data}`;
}

function resolvePublicAsset(filename, fallbackFilename) {
  const primary = path.join(PUBLIC_PATH, filename);
  if (fs.existsSync(primary)) return toDataUri(primary);

  if (fallbackFilename) {
    const fallback = path.join(PUBLIC_PATH, fallbackFilename);
    if (fs.existsSync(fallback)) return toDataUri(fallback);
  }

  return null;
}

/**
 * Build react-pdf props for HotelInvoiceDocument from invoice service data.
 * Mirrors the billing modal download logic so WhatsApp PDF matches the UI invoice.
 */
function buildInvoicePdfProps(invoiceData) {
  const totals = invoiceData.totals || {};
  const gstRates = totals.gst_rates || { room: 0.05, kitchen: 0.05, addon: 0 };
  const gstBreakdown = totals.gst_breakdown || {};

  const roomCharges = Number(totals.room_total || 0);
  const kitchenCharges = Number(totals.kitchen_total || 0);
  const addOnsTotal = Number(totals.addon_total || 0);
  const subtotal = Number(totals.subtotal || 0);
  const discount = Number(totals.discount || 0);
  const advancePaid = Number(
    totals.advance_paid || invoiceData.advance_paid || 0,
  );
  const totalAmount = Number(
    totals.grand_total || invoiceData.total_amount || 0,
  );
  const balanceAmount = Number(totals.final_payable || 0);

  const roomGst = Number(gstBreakdown.room || 0);
  const kitchenGst = Number(gstBreakdown.kitchen || 0);
  const totalGst = roomGst + kitchenGst;
  const subtotalWithGst = subtotal + totalGst;
  const gstIncluded = totalGst > 0;

  return {
    selectedBill: invoiceData,
    form: {
      room_price: roomCharges,
      add_ons: [],
    },
    gstIncluded,
    gstNumber: invoiceData.gst_number || "",
    gstRates: {
      room: Number(gstRates.room || 0.05),
      kitchen: Number(gstRates.kitchen || 0.05),
      addon: 0,
    },
    gstAmounts: {
      room: roomGst,
      kitchen: kitchenGst,
      addon: 0,
    },
    subtotal,
    subtotalWithGst,
    totalAmount,
    advancePaid,
    balanceAmount,
    guestDiscount: discount,
    logoPath: resolvePublicAsset("FridayInnLogo.png"),
    instagramQrPath: resolvePublicAsset("insta_qr.jpeg"),
    websiteQrPath: resolvePublicAsset("hotel_qr.jpeg"),
  };
}

module.exports = { buildInvoicePdfProps, PUBLIC_PATH };
