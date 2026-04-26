const { v4: uuidv4 } = require("uuid");
const dbService = require("./dbService");
const {
  calculateBillingTotals,
  getGstRateForType,
} = require("../utils/billingCalculator");

/**
 * Return the current local datetime as "YYYY-MM-DD HH:mm:ss".
 */
const getLocalDateTime = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
};

class CheckoutService {
  async processCheckout(bookingId, checkoutData, user) {
    const {
      idempotency_key,
      gst_number,
      add_ons = [],
      discount,
    } = checkoutData;

    const key = idempotency_key || uuidv4();

    if (await dbService.idempotencyExists(key)) {
      return {
        success: false,
        error: "Duplicate checkout attempt blocked",
        idempotency_key: key,
      };
    }

    try {
      const booking = await dbService.getBookingWithDetails(bookingId);

      if (!booking) throw new Error("Booking not found");
      if (booking.status === "Checked-out") {
        throw new Error("Booking already checked out");
      }

      const dbAddons = await dbService.getBookingAddons(booking.booking_id);
      const dbAddonTotal = dbAddons.reduce(
        (sum, addon) => sum + Number(addon.price || 0),
        0
      );

      const existingAddonCounts = dbAddons.reduce((counts, addon) => {
        const keyPart = `${addon.name || ""}::${Number(addon.price || 0)}`;
        counts[keyPart] = (counts[keyPart] || 0) + 1;
        return counts;
      }, {});

      const requestedAddOns = Array.isArray(add_ons) ? add_ons : [];
      const newAddOns = requestedAddOns.filter((addon) => {
        const keyPart = `${addon.name || ""}::${Number(addon.price || 0)}`;
        if (existingAddonCounts[keyPart] > 0) {
          existingAddonCounts[keyPart] -= 1;
          return false;
        }
        return true;
      });

      const newAddonTotal = newAddOns.reduce(
        (sum, addon) => sum + Number(addon.price || 0),
        0
      );

      const finalCheckoutTime = getLocalDateTime();
      const discountToApply =
        discount !== undefined && discount !== null
          ? Number(discount || 0)
          : Number(booking.discount || 0);

      const calculation = calculateBillingTotals({
        checkIn: booking.check_in,
        checkOut: booking.check_out || finalCheckoutTime,
        roomRate: Number(booking.price || 0),
        kitchenTotal: Number(booking.kitchenTotal || 0),
        addonTotal: dbAddonTotal + newAddonTotal,
        discount: discountToApply,
        advancePaid: Number(booking.advance_paid || 0),
      });

      const providedTotal = Number(checkoutData.total_amount || 0);

      if (Math.abs(calculation.totalAmount - providedTotal) > 1) {
        console.warn(
          `Total mismatch (IGNORED): expected ${calculation.totalAmount}, got ${providedTotal}`
        );
      }

      const billingId = await dbService.transaction(async (tx) => {
        for (const addon of newAddOns) {
          await tx.run(
            `INSERT INTO booking_addons (booking_id, name, price) VALUES (?, ?, ?)`,
            [
              booking.booking_id,
              addon.name || "Custom Add-on",
              Number(addon.price || 0),
            ]
          );
        }

        await tx.run(
          `UPDATE bookings SET status = 'Checked-out', check_out = ? WHERE id = ?`,
          [finalCheckoutTime, bookingId]
        );

        await tx.run(`UPDATE rooms SET status = 'Available' WHERE id = ?`, [
          booking.room_id,
        ]);

        const billingResult = await tx.run(
          `INSERT INTO billings (
            booking_id, idempotency_key, customer_id, room_id,
            check_in, check_out, advance_paid, discount, total_amount,
            gst_number, billed_by_id, billed_by_name, billed_by_role
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            booking.booking_id,
            key,
            booking.customer_id,
            booking.room_id,
            booking.check_in,
            finalCheckoutTime,
            calculation.advancePaid,
            calculation.discount,
            calculation.totalAmount,
            gst_number || null,
            user.id,
            user.name,
            user.role,
          ]
        );

        await this._createLineItems(tx, billingResult.lastID, booking, calculation);

        return billingResult.lastID;
      });

      return {
        success: true,
        billing_id: billingId,
        idempotency_key: key,
        summary: {
          booking_id: booking.booking_id,
          stayDays: calculation.stayDays,
          roomTotal: calculation.roomTotal,
          kitchenTotal: calculation.kitchenTotal,
          addonTotal: calculation.addonTotal,
          subtotal: calculation.subtotal,
          gstAmount: calculation.gstAmount,
          total_amount: calculation.totalAmount,
          totalAmount: calculation.totalAmount,
          discount: calculation.discount,
          advancePaid: calculation.advancePaid,
          balance: calculation.finalPayable,
          balanceAmount: calculation.finalPayable,
          finalAmount: calculation.finalAmount,
        },
      };
    } catch (error) {
      console.error("Checkout failed:", error);
      throw error;
    }
  }

  async _createLineItems(tx, billingId, booking, calculation) {
    const lines = [];

    lines.push({
      billing_id: billingId,
      type: "room",
      description: `Room ${booking.room_number} (${booking.category}) x ${calculation.stayDays} night${
        calculation.stayDays > 1 ? "s" : ""
      }`,
      quantity: calculation.stayDays,
      unit_price: calculation.roomRatePerNight,
      subtotal: calculation.roomTotal,
      gst_rate: getGstRateForType("room", {
        roomRatePerNight: calculation.roomRatePerNight,
      }),
      total: calculation.roomTotal,
    });

    const kitchenOrders = await tx.getKitchenOrdersForInvoice(booking.booking_id);

    for (const kitchenOrder of kitchenOrders) {
      const quantity = Number(kitchenOrder.quantity || 1);
      const lineTotal = Number(kitchenOrder.total || 0);
      const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;

      lines.push({
        billing_id: billingId,
        type: "kitchen",
        description: kitchenOrder.item_name,
        quantity,
        unit_price: unitPrice,
        subtotal: lineTotal,
        gst_rate: getGstRateForType("kitchen"),
        total: lineTotal,
      });
    }

    const addons = await tx.getBookingAddons(booking.booking_id);

    for (const addon of addons) {
      const addonPrice = Number(addon.price || 0);

      lines.push({
        billing_id: billingId,
        type: "addon",
        description: addon.name,
        quantity: 1,
        unit_price: addonPrice,
        subtotal: addonPrice,
        gst_rate: getGstRateForType("addon"),
        total: addonPrice,
      });
    }

    if (calculation.discount > 0) {
      lines.push({
        billing_id: billingId,
        type: "discount",
        description: "Discount Applied",
        quantity: 1,
        unit_price: -calculation.discount,
        subtotal: -calculation.discount,
        gst_rate: 0,
        total: -calculation.discount,
      });
    }

    for (const line of lines) {
      await tx.run(
        `INSERT INTO invoices (
          billing_id, type, description, quantity,
          unit_price, subtotal, gst_rate, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.billing_id,
          line.type,
          line.description,
          line.quantity,
          line.unit_price,
          line.subtotal,
          line.gst_rate,
          line.total,
        ]
      );
    }
  }
}

module.exports = new CheckoutService();
