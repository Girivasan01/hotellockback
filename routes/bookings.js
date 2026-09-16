const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");
const { daysBetween } = require("../utils/billingCalculator");

// Recomputes a room's status from its remaining active bookings instead of
// blindly forcing a status, so a room isn't left "Booked/Occupied" with no
// booking behind it, and isn't freed while another booking still needs it.
async function syncRoomStatus(roomId, orgId) {
  if (!roomId) return;

  const [rows] = await db.query(
    `SELECT status FROM bookings
     WHERE room_id = ? AND org_id = ? AND status IN ('Confirmed', 'Checked-in')`,
    [roomId, orgId],
  );

  if (rows.length === 0) {
    await db.query(
      "UPDATE rooms SET status = 'Available' WHERE id = ? AND org_id = ?",
      [roomId, orgId],
    );
    return;
  }

  const hasCheckedIn = rows.some((b) => b.status === "Checked-in");
  await db.query("UPDATE rooms SET status = ? WHERE id = ? AND org_id = ?", [
    hasCheckedIn ? "Occupied" : "Booked",
    roomId,
    orgId,
  ]);
}

// DATETIME HELPERS

const toMySQLDateTime = (value) => {
  if (!value) return null;

  const normalised = value.replace("T", " ").trim();

  if (normalised.length === 16) return normalised + ":00";
  return normalised;
};

const dtLessThan = (a, b) => {
  if (!a || !b) return false;
  return a < b;
};

// ROUTES
// DEBUG - CHECK ROOM BY ID
router.get("/debug/room/:roomId", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, room_number, category, status, price_per_night, capacity FROM rooms WHERE id = ? AND org_id = ?",
      [req.params.roomId, req.orgId],
    );
    const room = rows[0];
    res.json({
      requested_room_id: req.params.roomId,
      found: Boolean(room),
      room: room || null,
    });
  } catch (err) {
    console.error("Debug room lookup error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - BOOKINGS FOR CALENDAR VIEW
router.get("/calendar", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT
        b.id,
        b.booking_id,
        b.room_id,
        b.check_in,
        b.check_out,
        b.status,
        r.room_number,
        c.name AS customer_name,
        c.photo AS customer_photo
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.status IN ('Confirmed', 'Checked-in', 'Checked-out')
        AND b.org_id = ?
      ORDER BY b.check_in ASC
    `;
    const [rows] = await db.query(query, [req.orgId]);
    res.json(rows);
  } catch (err) {
    console.error("Calendar fetch error:", err);
    res.status(500).json({ error: "Failed to load calendar bookings" });
  }
});

// GET - ALL BOOKINGS
router.get("/", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT
        b.*,
        c.name    AS customer_name,
        c.photo   AS customer_photo,
        c.contact AS customer_contact,
        r.room_number,
        r.category
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.org_id = ?
      ORDER BY b.id DESC
    `;
    const [rows] = await db.query(query, [req.orgId]);
    res.json(rows);
  } catch (err) {
    console.error("Get bookings error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST - CREATE BOOKING
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      booking_id,
      customer_id,
      room_id,
      check_in,
      check_out,
      status,
      add_ons,
      discount,
    } = req.body;

    const price = Number(req.body.price) || 0;
    const advance_paid = Number(req.body.advance_paid) || 0;
    const people_count = Number(req.body.people_count) || 1;

    // ── Validation ──
    const missing = [];
    if (!booking_id) missing.push("booking_id");
    if (!customer_id) missing.push("customer_id");
    if (!room_id) missing.push("room_id");
    if (!price) missing.push("price");

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
        missing,
      });
    }

    // ── Convert incoming datetime strings safely ─────────────
    const checkInStr = toMySQLDateTime(check_in);
    const checkOutStr = toMySQLDateTime(check_out);

    // ── check_out must be after check_in ───────
    if (checkInStr && checkOutStr && !dtLessThan(checkInStr, checkOutStr)) {
      return res
        .status(400)
        .json({ error: "Check-out must be after check-in" });
    }

    // ── Discount / advance validation ──────────
    const discountValue = Number(discount) || 0;
    const stayDaysEstimate = daysBetween(checkInStr, checkOutStr);
    const roomTotalEstimate = price * stayDaysEstimate;

    if (discountValue < 0) {
      return res.status(400).json({ error: "Discount cannot be negative" });
    }
    if (advance_paid < 0) {
      return res.status(400).json({ error: "Advance paid cannot be negative" });
    }
    if (discountValue > roomTotalEstimate) {
      return res.status(400).json({
        error: `Discount (₹${discountValue}) cannot exceed the room total (₹${roomTotalEstimate})`,
      });
    }
    if (advance_paid > roomTotalEstimate) {
      return res.status(400).json({
        error: `Advance paid (₹${advance_paid}) cannot exceed the room total (₹${roomTotalEstimate})`,
      });
    }

    const created_by_id = req.user.id;
    const created_by_role = req.user.role;
    let created_by_name = null;

    if (created_by_role === "admin") {
      const [adminRows] = await db.query(
        "SELECT name FROM users WHERE id = ?",
        [created_by_id],
      );
      created_by_name = adminRows[0]?.name || "Admin";
    }

    if (created_by_role === "staff") {
      const [staffRows] = await db.query(
        "SELECT s.name FROM users u JOIN staff s ON u.staff_id = s.id WHERE u.id = ?",
        [created_by_id],
      );
      created_by_name = staffRows[0]?.name || "Staff";
    }

    // ── Validate room exists ──────
    const [roomRows] = await db.query(
      "SELECT id, capacity FROM rooms WHERE id = ? AND org_id = ?",
      [room_id, req.orgId],
    );
    if (!roomRows[0]) {
      return res.status(400).json({ error: "Invalid room selected" });
    }

    // ── Capacity check ────────
    if (
      roomRows[0].capacity != null &&
      people_count > Number(roomRows[0].capacity)
    ) {
      return res.status(400).json({
        error: `Room capacity (${roomRows[0].capacity}) is less than the number of guests (${people_count})`,
      });
    }

    // ── Availability check ────────
    const [availabilityRows] = await db.query(
      `SELECT COUNT(*) AS conflictCount
       FROM bookings
       WHERE room_id = ?
         AND org_id = ?
         AND status IN ('Confirmed', 'Checked-in')
         AND DATE(check_in) < DATE(?)
         AND (check_out IS NULL OR DATE(check_out) > DATE(?))`,
      [room_id, req.orgId, checkOutStr || checkInStr, checkInStr],
    );

    const conflictCount = availabilityRows[0]?.conflictCount || 0;
    if (conflictCount > 0) {
      return res.status(409).json({
        error: `Room is not available between ${checkInStr} and ${checkOutStr}`,
      });
    }

    const bookingStatus = status || "Confirmed";

    const [insertResult] = await db.query(
      `INSERT INTO bookings
         (booking_id, customer_id, room_id, check_in, check_out, status,
          price, add_ons, people_count, advance_paid, discount,
          created_by_id, created_by_name, created_by_role, org_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking_id,
        Number(customer_id),
        Number(room_id),
        checkInStr,
        checkOutStr,
        bookingStatus,
        price,
        JSON.stringify(add_ons || []),
        people_count,
        advance_paid,
        discount,
        created_by_id,
        created_by_name,
        created_by_role,
        req.orgId,
      ],
    );

    // ── Insert into booking_addons table ────────
    if (Array.isArray(add_ons) && add_ons.length > 0) {
      for (const addon of add_ons) {
        await db.query(
          "INSERT INTO booking_addons (booking_id, name, price, org_id) VALUES (?, ?, ?, ?)",
          [
            booking_id,
            addon.description || addon.label || addon.name,
            Number(addon.amount || addon.price || 0),
            req.orgId,
          ],
        );
      }
    }

    const roomStatus = bookingStatus === "Checked-in" ? "Occupied" : "Booked";
    await db.query("UPDATE rooms SET status = ? WHERE id = ? AND org_id = ?", [
      roomStatus,
      room_id,
      req.orgId,
    ]);

    // Whatsapp Notification
    const { getWhatsappSettings } = require("../utils/whatsappSettings");
    const bookingWhatsAppService = require("../services/bookingWhatsAppService");
    getWhatsappSettings(req.orgId).then((settings) => {
      if (settings.auto_booking_confirmation) {
        bookingWhatsAppService.sendBookingConfirmationAsync(
          booking_id,
          req.orgId,
        );
      }
    });

    res.status(201).json({
      id: insertResult.insertId,
      booking_id,
      created_by_name,
      created_by_role,
      message: "Booking created and room status updated",
    });
  } catch (err) {
    console.error("Create booking error:", err);
    res.status(500).json({ error: "Create booking failed: " + err.message });
  }
});

// POST - SEND / RESEND WHATSAPP BOOKING CONFIRMATION
router.post("/:id/send-whatsapp", requireAuth, async (req, res) => {
  const id = req.params.id;

  try {
    const [rows] = await db.query(
      "SELECT booking_id FROM bookings WHERE id = ? AND org_id = ?",
      [id, req.orgId],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingWhatsAppService = require("../services/bookingWhatsAppService");
    const result = await bookingWhatsAppService.sendBookingConfirmation(
      rows[0].booking_id,
      req.orgId,
    );

    if (result.skipped) {
      return res.status(503).json({
        error: result.message || "WhatsApp is not configured",
        skipped: true,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("❌ SEND BOOKING WHATSAPP FAILED:", error);
    res.status(400).json({
      error:
        error.message || "Failed to send booking confirmation via WhatsApp",
    });
  }
});

// POST - CHECKOUT
router.post("/:id/checkout", requireAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const checkoutService = require("../services/checkoutService");

    const result = await checkoutService.processCheckout(
      bookingId,
      req.body,
      req.user,
      req.orgId,
    );

    if (!result.success) {
      return res.status(result.error.includes("Duplicate") ? 409 : 400).json({
        error: result.error,
        idempotency_key: result.idempotency_key,
      });
    }

    res.json({
      success: true,
      message: "Checkout completed successfully",
      billing_id: result.billing_id,
      idempotency_key: result.idempotency_key,
      summary: result.summary,
    });
  } catch (error) {
    console.error("Checkout processing failed:", error);
    res.status(500).json({
      error: "Checkout failed: " + error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// GET - BOOKING BY ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT
        b.*,
        c.name    AS customer_name,
        c.photo   AS customer_photo,
        c.contact AS customer_contact,
        r.room_number,
        r.category
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ? AND b.org_id = ?
    `;
    const [rows] = await db.query(query, [req.params.id, req.orgId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Booking not found" });
    res.json(row);
  } catch (err) {
    console.error("Get booking by ID error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT - UPDATE BOOKING STATUS
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const {
      status,
      discount,
      add_ons,
      customer_id,
      room_id,
      check_in,
      check_out,
      price,
      advance_paid,
      people_count,
    } = req.body;

    // 1. Fetch current booking to see what changed
    const [currentRows] = await db.query(
      "SELECT * FROM bookings WHERE id = ? AND org_id = ?",
      [bookingId, req.orgId],
    );
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: "Booking not found" });

    // ── Status transition validation ──────────
    // "Checked-out" is only ever set through the dedicated /checkout flow,
    // never through this generic update endpoint.
    const ALLOWED_STATUS_TRANSITIONS = {
      Confirmed: ["Checked-in", "Cancelled"],
      Cancelled: ["Confirmed"],
      "Checked-in": ["Cancelled"],
      "Checked-out": [],
    };

    if (status !== undefined && status !== current.status) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[current.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          error: `Cannot change booking status from "${current.status}" to "${status}"`,
        });
      }
    }

    // ── Block check-in while the room still has another guest checked in ──
    if (status === "Checked-in" && current.status !== "Checked-in") {
      const targetRoomIdForOccupancy =
        room_id !== undefined ? Number(room_id) : current.room_id;
      const [occupiedRows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM bookings
         WHERE room_id = ? AND org_id = ? AND status = 'Checked-in' AND id != ?`,
        [targetRoomIdForOccupancy, req.orgId, bookingId],
      );
      if ((occupiedRows[0]?.cnt || 0) > 0) {
        return res.status(409).json({
          error:
            "This room still has a guest checked in. Please check them out before checking in a new customer.",
        });
      }
    }

    // ── Discount / advance validation ──────────
    const effectivePrice =
      price !== undefined ? Number(price) : Number(current.price || 0);
    const effectiveCheckInForValidation =
      check_in !== undefined ? toMySQLDateTime(check_in) : current.check_in;
    const effectiveCheckOutForValidation =
      check_out !== undefined ? toMySQLDateTime(check_out) : current.check_out;
    const effectiveDiscount =
      discount !== undefined ? Number(discount) : Number(current.discount || 0);
    const effectiveAdvancePaid =
      advance_paid !== undefined
        ? Number(advance_paid)
        : Number(current.advance_paid || 0);

    const stayDaysEstimate = daysBetween(
      effectiveCheckInForValidation,
      effectiveCheckOutForValidation,
    );
    const roomTotalEstimate = effectivePrice * stayDaysEstimate;

    if (effectiveDiscount < 0) {
      return res.status(400).json({ error: "Discount cannot be negative" });
    }
    if (effectiveAdvancePaid < 0) {
      return res.status(400).json({ error: "Advance paid cannot be negative" });
    }
    if (effectiveDiscount > roomTotalEstimate) {
      return res.status(400).json({
        error: `Discount (₹${effectiveDiscount}) cannot exceed the room total (₹${roomTotalEstimate})`,
      });
    }
    if (effectiveAdvancePaid > roomTotalEstimate) {
      return res.status(400).json({
        error: `Advance paid (₹${effectiveAdvancePaid}) cannot exceed the room total (₹${roomTotalEstimate})`,
      });
    }

    // 2. Prepare update fields
    let updateFields = [];
    let params = [];

    const addField = (name, val) => {
      if (val !== undefined) {
        updateFields.push(`${name} = ?`);
        params.push(val);
        return true;
      }
      return false;
    };

    addField("status", status);
    addField("discount", discount !== undefined ? Number(discount) : undefined);
    addField(
      "customer_id",
      customer_id !== undefined ? Number(customer_id) : undefined,
    );
    addField("room_id", room_id !== undefined ? Number(room_id) : undefined);
    addField("price", price !== undefined ? Number(price) : undefined);
    addField(
      "advance_paid",
      advance_paid !== undefined ? Number(advance_paid) : undefined,
    );
    addField(
      "people_count",
      people_count !== undefined ? Number(people_count) : undefined,
    );

    if (check_in !== undefined) addField("check_in", toMySQLDateTime(check_in));
    if (check_out !== undefined)
      addField("check_out", toMySQLDateTime(check_out));

    if (add_ons !== undefined) {
      updateFields.push("add_ons = ?");
      params.push(JSON.stringify(add_ons));
    }

    if (updateFields.length === 0) {
      return res.json({ message: "No changes provided" });
    }

    // 3. Conflict Check if room or dates changed
    const effectiveRoomId =
      room_id !== undefined ? Number(room_id) : current.room_id;
    const effectiveCheckIn =
      check_in !== undefined ? toMySQLDateTime(check_in) : current.check_in;
    const effectiveCheckOut =
      check_out !== undefined ? toMySQLDateTime(check_out) : current.check_out;

    // ── Capacity check when the room or the guest count changes ──────
    if (room_id !== undefined || people_count !== undefined) {
      const effectivePeopleCount =
        people_count !== undefined
          ? Number(people_count)
          : Number(current.people_count || 1);

      const [roomForCapacityRows] = await db.query(
        "SELECT capacity FROM rooms WHERE id = ? AND org_id = ?",
        [effectiveRoomId, req.orgId],
      );
      const roomCapacity = roomForCapacityRows[0]?.capacity;

      if (roomCapacity != null && effectivePeopleCount > Number(roomCapacity)) {
        return res.status(400).json({
          error: `Room capacity (${roomCapacity}) is less than the number of guests (${effectivePeopleCount})`,
        });
      }
    }

    if (
      room_id !== undefined ||
      check_in !== undefined ||
      check_out !== undefined
    ) {
      const [conflictRows] = await db.query(
        `SELECT COUNT(*) AS conflictCount
         FROM bookings
         WHERE room_id = ?
           AND org_id = ?
           AND id != ?
           AND status IN ('Confirmed', 'Checked-in')
           AND DATE(check_in) < DATE(?)
           AND (check_out IS NULL OR DATE(check_out) > DATE(?))`,
        [
          effectiveRoomId,
          req.orgId,
          bookingId,
          effectiveCheckOut || effectiveCheckIn,
          effectiveCheckIn,
        ],
      );
      if (conflictRows[0]?.conflictCount > 0) {
        return res
          .status(409)
          .json({ error: "Room is not available for the selected dates" });
      }
    }

    // 4. Update Bookings Table
    params.push(bookingId, req.orgId);
    await db.query(
      `UPDATE bookings SET ${updateFields.join(", ")} WHERE id = ? AND org_id = ?`,
      params,
    );

    // 5. Sync booking_addons if changed
    if (add_ons) {
      const bIdStr = current.booking_id;
      await db.query(
        "DELETE FROM booking_addons WHERE booking_id = ? AND org_id = ?",
        [bIdStr, req.orgId],
      );
      if (Array.isArray(add_ons)) {
        for (const addon of add_ons) {
          await db.query(
            "INSERT INTO booking_addons (booking_id, name, price, org_id) VALUES (?, ?, ?, ?)",
            [
              bIdStr,
              addon.description || addon.label || addon.name,
              Number(addon.amount || addon.price || 0),
              req.orgId,
            ],
          );
        }
      }
    }

    // 6. Update room status if status or room_id changed
    const finalStatus = status || current.status;

    // If room changed, correctly resolve the old room's status instead of
    // always freeing it (another booking may still need it).
    if (room_id && Number(room_id) !== current.room_id) {
      await syncRoomStatus(current.room_id, req.orgId);
    }

    if (finalStatus === "Cancelled") {
      // Don't blindly free the room - another booking may still need it.
      await syncRoomStatus(effectiveRoomId, req.orgId);
    } else {
      const roomStatus =
        finalStatus === "Checked-in"
          ? "Occupied"
          : finalStatus === "Checked-out"
            ? "Cleaning"
            : "Booked";
      await db.query(
        "UPDATE rooms SET status = ? WHERE id = ? AND org_id = ?",
        [roomStatus, effectiveRoomId, req.orgId],
      );
    }

    res.json({ message: "Booking updated effectively" });
  } catch (err) {
    console.error("Update booking error:", err);
    res.status(500).json({ error: "Update failed: " + err.message });
  }
});

// DELETE - BOOKING
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [existingRows] = await db.query(
      "SELECT room_id FROM bookings WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId],
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const [result] = await db.query(
      "DELETE FROM bookings WHERE id = ? AND org_id = ?",
      [req.params.id, req.orgId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await syncRoomStatus(existing.room_id, req.orgId);

    res.json({ message: "Booking deleted" });
  } catch (err) {
    console.error("Delete booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
