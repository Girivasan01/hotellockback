const { normalizeWhatsAppNumber } = require("../utils/phoneUtils");
const { WHATSAPP_ENABLED } = require("../config/features");

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

class WhatsAppService {
  isConfigured() {
    if (!WHATSAPP_ENABLED) return false;
    if (process.env.WHATSAPP_ENABLED === "false") return false;
    return Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    );
  }

  getApiBase() {
    return `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    };
  }

  async uploadDocument(pdfBuffer, filename) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    form.append("file", blob, filename);
    const response = await fetch(`${this.getApiBase()}/media`, {
      method: "POST",
      headers: this.getHeaders(),
      body: form,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message || "Failed to upload invoice to WhatsApp",
      );
    }

    return payload.id;
  }

  async sendDocument({ to, mediaId, filename, caption }) {
    const response = await fetch(`${this.getApiBase()}/messages`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "document",
        document: {
          id: mediaId,
          filename,
          caption,
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message || "Failed to send invoice via WhatsApp",
      );
    }

    return payload;
  }

  async sendText({ phone, message }) {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "WhatsApp is not configured" };
    }

    const to = normalizeWhatsAppNumber(phone);
    if (!to) {
      throw new Error("Customer phone number is missing or invalid");
    }

    const response = await fetch(`${this.getApiBase()}/messages`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message || "Failed to send WhatsApp message",
      );
    }

    return { skipped: false, to, result: payload };
  }

  async sendInvoicePdf({ phone, pdfBuffer, filename, caption }) {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "WhatsApp is not configured" };
    }

    const to = normalizeWhatsAppNumber(phone);
    if (!to) {
      throw new Error("Customer phone number is missing or invalid");
    }

    const mediaId = await this.uploadDocument(pdfBuffer, filename);
    const result = await this.sendDocument({
      to,
      mediaId,
      filename,
      caption,
    });

    return { skipped: false, to, result };
  }
}

module.exports = new WhatsAppService();