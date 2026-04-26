const dbService = require("./dbService");
const invoiceService = require("./invoiceService");
const { calculateBillingTotals } = require("../utils/billingCalculator");

/**
 * Billing service for list operations and enhancements
 */
class BillingService {
  /**
   * Get billing preview (NOT persisted)
   * Used for checkout modal and bill preview before finalization
   */
  async getBillingPreview(bookingId) {
    const booking = await dbService.get(
      `SELECT b.*, c.name AS customer_name, c.contact, c.address,
              r.room_number, r.category, r.price_per_night
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    const kitchenSummary = await dbService.getKitchenBillingSummary(
      booking.booking_id
    );
    const kitchenTotal = Number(kitchenSummary.kitchenTotal || 0);

    const addonsData = await dbService.getBookingAddons(booking.booking_id);
    const addonsTotal = addonsData.reduce(
      (sum, addon) => sum + Number(addon.price || 0),
      0
    );

    const calculation = calculateBillingTotals({
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      roomRate:
        booking.price !== undefined && booking.price !== null
          ? Number(booking.price || 0)
          : Number(booking.price_per_night || 0),
      kitchenTotal,
      addonTotal: addonsTotal,
      discount: Number(booking.discount || 0),
      advancePaid: Number(booking.advance_paid || 0),
    });

    return {
      booking_id: booking.booking_id,
      customer_id: booking.customer_id,
      customer_name: booking.customer_name,
      customer_contact: booking.contact,
      customer_address: booking.address,
      room_id: booking.room_id,
      room_number: booking.room_number,
      category: booking.category,
      check_in: booking.check_in,
      check_out: booking.check_out,
      stay_days: calculation.stayDays,
      room_price_per_night: calculation.roomRatePerNight,

      room_charges: calculation.roomTotal,
      kitchen_total: calculation.kitchenTotal,
      add_ons_total: calculation.addonTotal,
      roomTotal: calculation.roomTotal,
      kitchenTotal: calculation.kitchenTotal,
      addonTotal: calculation.addonTotal,

      add_ons: addonsData.map((addon) => ({
        id: addon.id,
        name: addon.name,
        price: Number(addon.price || 0),
      })),

      subtotal: calculation.subtotal,
      gst_rate: calculation.gstRates.room,
      gst: calculation.gstAmount,
      total: calculation.totalAmount,
      totalAmount: calculation.totalAmount,
      discount: calculation.discount,
      advance_paid: calculation.advancePaid,
      advancePaid: calculation.advancePaid,
      balance: calculation.finalPayable,
      balanceAmount: calculation.finalPayable,
      gst_breakdown: calculation.gstBreakdown,
      gst_rates: calculation.gstRates,
      finalAmount: calculation.finalAmount,
    };
  }

  /**
   * Get all billings with line item summary
   */
  async getBillings({
    page = 1,
    limit = 50,
    search = "",
    includeDownloaded = false,
  } = {}) {
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (!includeDownloaded) {
      conditions.push("COALESCE(b.is_downloaded, 0) = 0");
    }

    if (search) {
      conditions.push(
        "(b.booking_id LIKE ? OR c.name LIKE ? OR b.gst_number LIKE ?)"
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const listParams = [...params, limit, offset];

    const billings = await dbService.all(
      `
      SELECT 
        b.id,
        b.booking_id AS booking_id,
        b.customer_id,
        b.room_id,
        COALESCE(r_live.room_number, r_stale.room_number) AS room_number,
        b.total_amount,
        b.advance_paid,
        b.created_at,
        b.is_downloaded,
        b.billed_by_name,
        b.billed_by_role,
        c.name as customer_name,
        COUNT(i.id) as line_items_count,
        SUM(i.total) as line_items_total
      FROM billings b 
      LEFT JOIN bookings bk ON b.booking_id = bk.booking_id
      LEFT JOIN rooms r_live ON bk.room_id = r_live.id
      LEFT JOIN rooms r_stale ON b.room_id = r_stale.id
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN invoices i ON b.id = i.billing_id
      ${whereClause}
      GROUP BY 
        b.id,
        b.booking_id,
        b.customer_id,
        b.room_id,
        COALESCE(r_live.room_number, r_stale.room_number),
        b.total_amount,
        b.advance_paid,
        b.created_at,
        b.is_downloaded,
        b.billed_by_name,
        b.billed_by_role,
        c.name
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `,
      listParams
    );

    const countParams = [...params];

    const total = await dbService.get(
      `
      SELECT COUNT(DISTINCT b.id) as count
      FROM billings b
      LEFT JOIN customers c ON b.customer_id = c.id
      ${whereClause}
    `,
      countParams
    );

    return {
      billings,
      pagination: {
        page,
        limit,
        total: total.count,
        pages: Math.ceil(total.count / limit),
      },
    };
  }

  /**
   * Get billing details with full line items
   */
  async getBillingDetails(billingId) {
    return await invoiceService.getInvoiceData(billingId);
  }

  /**
   * Mark billing as downloaded + save GST number
   */
  async markDownloaded(billingId, gstNumber) {
    await dbService.run(
      "UPDATE billings SET is_downloaded = 1, gst_number = ? WHERE id = ?",
      [gstNumber, billingId]
    );
  }

  /**
   * Get profit/loss summary
   */
  async getProfitSummary({ startDate, endDate } = {}) {
    const whereClause = endDate
      ? "WHERE DATE(b.created_at) BETWEEN ? AND ?"
      : "";
    const params = endDate ? [startDate, endDate] : [];

    const profit = await dbService.get(
      `
      SELECT 
        COUNT(*) as total_bills,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_bill,
        SUM(advance_paid) as total_advance
      FROM billings b
      ${whereClause}
    `,
      params
    );

    return (
      profit || { total_bills: 0, revenue: 0, avg_bill: 0, total_advance: 0 }
    );
  }
}

module.exports = new BillingService();
