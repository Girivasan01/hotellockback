const db = require("../db/database");
const whatsappService = require("./whatsappService");

class BookingWhatsAppService {
  async sendBookingConfirmation(bookingId, orgId) {
    if (!whatsappService.isConfigured()) {
      return {
        success: false,
        skipped: true,
        message: "WhatsApp is not configured",
      };
    }

    const [rows] = await db.query(
      `SELECT b.booking_id, b.check_in, b.check_out, b.status,
              c.name AS customer_name, c.contact AS customer_contact,
              r.room_number, r.category
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.booking_id = ? AND b.org_id = ?`,
      [bookingId, orgId],
    );

    const booking = rows[0];
    if (!booking) {
      throw new Error("Booking not found");
    }

    const phone = booking.customer_contact;
    if (!phone) {
      throw new Error("Customer contact number not found for this booking");
    }

    const message = [
      `Dear ${booking.customer_name || "Guest"},`,
      "",
      "Your booking with Hotel Friday Inn is confirmed!",
      `Booking ID: ${booking.booking_id}`,
      `Room: ${booking.room_number || "N/A"}${booking.category ? ` (${booking.category})` : ""}`,
      `Check-in: ${booking.check_in || "N/A"}`,
      `Check-out: ${booking.check_out || "N/A"}`,
      "",
      "We look forward to hosting you!",
    ].join("\n");

    const result = await whatsappService.sendText({ phone, message });

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
      message: "Booking confirmation sent via WhatsApp",
      to: result.to,
    };
  }

  sendBookingConfirmationAsync(bookingId, orgId) {
    this.sendBookingConfirmation(bookingId, orgId)
      .then((result) => {
        if (result.skipped) {
          console.warn(
            `[WhatsApp] Skipped booking confirmation for ${bookingId}: ${result.message}`,
          );
        } else {
          console.log(
            `[WhatsApp] Booking confirmation sent for ${bookingId} to ${result.to}`,
          );
        }
      })
      .catch((error) => {
        console.error(
          `[WhatsApp] Failed to send booking confirmation for ${bookingId}:`,
          error.message,
        );
      });
  }
}

module.exports = new BookingWhatsAppService();