const invoiceService = require("./invoiceService");
const { generateInvoicePdfBuffer } = require("./invoicePdfService");
const whatsappService = require("./whatsappService");

class InvoiceWhatsAppService {
  async sendInvoice(billingId, orgId) {
    if (!whatsappService.isConfigured()) {
      return {
        success: false,
        skipped: true,
        message: "WhatsApp is not configured",
      };
    }

    const invoiceData = await invoiceService.getInvoiceData(billingId, orgId);
    const phone = invoiceData.customer_contact;

    if (!phone) {
      throw new Error("Customer contact number not found for this bill");
    }

    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);
    const filename = `Invoice_${invoiceData.booking_id}_${(invoiceData.customer_name || "Guest").replace(/\s+/g, "_")}.pdf`;
    const caption = [
      `Dear ${invoiceData.customer_name || "Guest"},`,
      "",
      "Thank you for staying with Hotel Friday Inn.",
      `Your invoice for booking ${invoiceData.booking_id} is attached.`,
      `Total: Rs ${Number(invoiceData.totals?.grand_total || invoiceData.total_amount || 0).toFixed(2)}`,
    ].join("\n");

    const result = await whatsappService.sendInvoicePdf({
      phone,
      pdfBuffer,
      filename,
      caption,
    });

    if (result.skipped) {
      return {
        success: false,
        skipped: true,
        message: result.reason,
      };
    }

    return {
      success: true,
      skipped: false,
      message: "Invoice sent via WhatsApp",
      to: result.to,
    };
  }

  sendInvoiceAsync(billingId, orgId) {
    this.sendInvoice(billingId, orgId).catch((error) => {
      console.error(
        `[WhatsApp] Failed to send invoice for billing ${billingId}:`,
        error.message,
      );
    });
  }
}

module.exports = new InvoiceWhatsAppService();
