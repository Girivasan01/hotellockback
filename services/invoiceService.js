const dbService = require("./dbService");
const { HOTEL_GST_NUMBER } = require("../utils/billingUtils");
const { calculateBillingTotals } = require("../utils/billingCalculator");

/**
 * Invoice service for line items and PDF data preparation
 */
class InvoiceService {
  /**
   * Get complete invoice data for billing (line items + totals)
   */
  async getInvoiceData(billingId) {
    const billing = await dbService.get(
      `SELECT b.*, c.name as customer_name, c.address as customer_address, c.contact as customer_contact,
              COALESCE(r_live.room_number, r_stale.room_number) as room_number,
              COALESCE(r_live.category, r_stale.category) as category,
              COALESCE(bk.people_count, 1) as pax,
              u.name as billed_by_name, u.role as billed_by_role
       FROM billings b
       LEFT JOIN bookings bk ON b.booking_id = bk.booking_id
       LEFT JOIN rooms r_live ON bk.room_id = r_live.id
       LEFT JOIN rooms r_stale ON b.room_id = r_stale.id
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN users u ON b.billed_by_id = u.id
       WHERE b.id = ?`,
      [billingId]
    );

    if (!billing) {
      throw new Error("Billing not found");
    }

    const lines = await dbService.all(
      `SELECT * FROM invoices WHERE billing_id = ? ORDER BY type, id`,
      [billingId]
    );

    const groupedLines = this._groupLines(lines);
    const totals = this._computeTotals(groupedLines, billing);

    return {
      ...billing,
      lines: groupedLines,
      totals,
      nights: totals.stay_days,
      balance: totals.final_payable,
      hotel_gst: HOTEL_GST_NUMBER,
    };
  }

  /**
   * Get summary for PDF generation
   */
  async getInvoiceSummary(billingId) {
    const data = await this.getInvoiceData(billingId);

    return {
      bill_id: data.id,
      customer_name: data.customer_name,
      room: data.room_number ? `${data.room_number} (${data.category})` : "N/A",
      check_in: data.check_in,
      check_out: data.check_out,
      total_amount: data.total_amount,
      line_items: data.lines,
      totals: data.totals,
      gst_number: data.gst_number || "N/A",
    };
  }

  _groupLines(lines) {
    const groups = {};
    for (const line of lines) {
      const type = line.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(line);
    }
    return groups;
  }

  _sumLineSubtotal(lines = []) {
    return lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0);
  }

  _computeTotals(lines, billing) {
    const roomLines = lines.room || [];
    const kitchenLines = lines.kitchen || [];
    const addonLines = lines.addon || [];
    const discountLines = lines.discount || [];
    const hasChargeLines =
      roomLines.length > 0 || kitchenLines.length > 0 || addonLines.length > 0;

    if (!hasChargeLines) {
      const grossTotal = Number(billing.total_amount || 0);
      const discount = Number(billing.discount || 0);
      const advancePaid = Number(billing.advance_paid || 0);

      return {
        stay_days: 1,
        room_total: grossTotal,
        kitchen_total: 0,
        addon_total: 0,
        subtotal: grossTotal,
        gst_total: 0,
        grand_total: grossTotal,
        discount,
        advance_paid: advancePaid,
        final_payable: Number((grossTotal - discount - advancePaid).toFixed(2)),
        gst_rate_avg: 0,
        gst_breakdown: {
          room: 0,
          kitchen: 0,
          addon: 0,
        },
        gst_rates: {
          room: 0,
          kitchen: 0,
          addon: 0,
        },
      };
    }

    const roomTotal = this._sumLineSubtotal(roomLines);
    const kitchenTotal = this._sumLineSubtotal(kitchenLines);
    const addonTotal = this._sumLineSubtotal(addonLines);
    const lineDiscountTotal = Math.abs(this._sumLineSubtotal(discountLines));
    const stayDays = roomLines[0]?.quantity
      ? Number(roomLines[0].quantity || 1)
      : undefined;
    const roomRatePerNight =
      roomLines[0]?.unit_price !== undefined && roomLines[0]?.unit_price !== null
        ? Number(roomLines[0].unit_price || 0)
        : undefined;
    const discount =
      billing.discount !== undefined && billing.discount !== null
        ? Number(billing.discount || 0)
        : lineDiscountTotal;

    const calculation = calculateBillingTotals({
      checkIn: billing.check_in,
      checkOut: billing.check_out,
      stayDays,
      roomRatePerNight,
      roomTotal,
      kitchenTotal,
      addonTotal,
      discount,
      advancePaid: Number(billing.advance_paid || 0),
    });

    return {
      stay_days: calculation.stayDays,
      room_total: calculation.roomTotal,
      kitchen_total: calculation.kitchenTotal,
      addon_total: calculation.addonTotal,
      subtotal: calculation.subtotal,
      gst_total: calculation.gstAmount,
      grand_total:
        billing.total_amount !== undefined && billing.total_amount !== null
          ? Number(billing.total_amount || 0)
          : calculation.totalAmount,
      discount: calculation.discount,
      advance_paid: calculation.advancePaid,
      final_payable: calculation.finalPayable,
      gst_rate_avg:
        calculation.subtotal > 0
          ? Number(
              ((calculation.gstAmount / calculation.subtotal) * 100).toFixed(1)
            )
          : 0,
      gst_breakdown: calculation.gstBreakdown,
      gst_rates: calculation.gstRates,
    };
  }
}

module.exports = new InvoiceService();
