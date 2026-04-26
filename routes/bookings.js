const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────
// DATETIME HELPERS  (pure string — zero Date() construction)
// ─────────────────────────────────────────────────────────────

/**
 * Safely convert any incoming datetime string to MySQL DATETIME format.
 *
 * Accepts:
 *   "YYYY-MM-DDThh:mm"        → "YYYY-MM-DD hh:mm:00"   (from datetime-local input)
 *   "YYYY-MM-DD HH:mm:ss"     → unchanged                (already DB format)
 *   "YYYY-MM-DD HH:mm"        → "YYYY-MM-DD HH:mm:00"   (DB format, no seconds)
 *
 * Returns null for falsy input.
 * Pure string manipulation — no new Date(), no timezone interpretation.
 */
const toMySQLDateTime = (value) => {
  if (!value) return null;
  // Normalise the T separator → space
  const normalised = value.replace("T", " ").trim();
  // Ensure seconds are present ("HH:mm" → "HH:mm:00")
  // A full datetime is at least 16 chars: "YYYY-MM-DD HH:mm"
  if (normalised.length === 16) return normalised + ":00";
  return normalised; // already has seconds
};

/**
 * Compare two MySQL DATETIME strings as strings.
 * Safe because the format "YYYY-MM-DD HH:mm:ss" is lexicographically sortable.
 * Returns true when a < b.
 */
const dtLessThan = (a, b) => {
  if (!a || !b) return false;
  return a < b;
};

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────

// DEBUG - CHECK ROOM BY ID
router.get("/debug/room/:roomId", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, room_number, category, status, price_per_night, capacity FROM rooms WHERE id = ?",
      [req.params.roomId]
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
        r.room_number
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.status IN ('Confirmed', 'Checked-in')
      ORDER BY b.check_in ASC
    `;
    const [rows] = await db.query(query);
    // Return raw DB strings — no Date() construction, no serialisation shift
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
        c.contact AS customer_contact,
        r.room_number,
        r.category
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.id DESC
    `;
    const [rows] = await db.query(query);
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

    const price        = Number(req.body.price)        || 0;
    const advance_paid = Number(req.body.advance_paid) || 0;
    const people_count = Number(req.body.people_count) || 1;

    // ── Validation ──────────────────────────────────────────
    const missing = [];
    if (!booking_id)  missing.push("booking_id");
    if (!customer_id) missing.push("customer_id");
    if (!room_id)     missing.push("room_id");
    if (!price)       missing.push("price");

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
        missing,
      });
    }

    // ── Convert incoming datetime strings safely ─────────────
    const checkInStr  = toMySQLDateTime(check_in);
    const checkOutStr = toMySQLDateTime(check_out);

    // ── check_out must be after check_in ────────────────────
    if (checkInStr && checkOutStr && !dtLessThan(checkInStr, checkOutStr)) {
      return res.status(400).json({ error: "Check-out must be after check-in" });
    }

    // ── Resolve creator name ─────────────────────────────────
    const created_by_id   = req.user.id;
    const created_by_role = req.user.role;
    let   created_by_name = null;

    if (created_by_role === "admin") {
      const [adminRows] = await db.query("SELECT name FROM users WHERE id = ?", [created_by_id]);
      created_by_name = adminRows[0]?.name || "Admin";
    }

    if (created_by_role === "staff") {
      const [staffRows] = await db.query(
        "SELECT s.name FROM users u JOIN staff s ON u.staff_id = s.id WHERE u.id = ?",
        [created_by_id]
      );
      created_by_name = staffRows[0]?.name || "Staff";
    }

    // ── Validate room exists ─────────────────────────────────
    const [roomRows] = await db.query(
      "SELECT id, capacity FROM rooms WHERE id = ?",
      [room_id]
    );
    if (!roomRows[0]) {
      return res.status(400).json({ error: "Invalid room selected" });
    }

    // ── Availability check ───────────────────────────────────
    const [availabilityRows] = await db.query(
      `SELECT COUNT(*) AS conflictCount
       FROM bookings
       WHERE room_id = ?
         AND status IN ('Confirmed', 'Checked-in')
         AND check_in  < ?
         AND (check_out IS NULL OR check_out > ?)`,
      [room_id, checkOutStr || checkInStr, checkInStr]
    );

    const conflictCount = availabilityRows[0]?.conflictCount || 0;
    if (conflictCount > 0) {
      return res.status(409).json({
        error: `Room is not available between ${checkInStr} and ${checkOutStr}`,
      });
    }

    const bookingStatus = status || "Confirmed";

    // ── Insert ───────────────────────────────────────────────
    // FIX: was missing `const [insertResult] = await db.query(` opener
    const [insertResult] = await db.query(
      `INSERT INTO bookings
         (booking_id, customer_id, room_id, check_in, check_out, status,
          price, add_ons, people_count, advance_paid, discount,
          created_by_id, created_by_name, created_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    // ── Insert into booking_addons table ─────────────────────
    if (Array.isArray(add_ons) && add_ons.length > 0) {
      for (const addon of add_ons) {
        await db.query(
          "INSERT INTO booking_addons (booking_id, name, price) VALUES (?, ?, ?)",
          [booking_id, addon.description || addon.label || addon.name, Number(addon.amount || addon.price || 0)]
        );
      }
    }

    const roomStatus = bookingStatus === "Checked-in" ? "Occupied" : "Booked";
    await db.query("UPDATE rooms SET status = ? WHERE id = ?", [roomStatus, room_id]);

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

// POST - CHECKOUT
router.post("/:id/checkout", requireAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const checkoutService = require("../services/checkoutService");

    const result = await checkoutService.processCheckout(bookingId, req.body, req.user);

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
        c.contact AS customer_contact,
        r.room_number,
        r.category
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `;
    const [rows] = await db.query(query, [req.params.id]);
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
    const [currentRows] = await db.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: "Booking not found" });

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
    addField("customer_id", customer_id !== undefined ? Number(customer_id) : undefined);
    addField("room_id", room_id !== undefined ? Number(room_id) : undefined);
    addField("price", price !== undefined ? Number(price) : undefined);
    addField("advance_paid", advance_paid !== undefined ? Number(advance_paid) : undefined);
    addField("people_count", people_count !== undefined ? Number(people_count) : undefined);

    if (check_in !== undefined)  addField("check_in",  toMySQLDateTime(check_in));
    if (check_out !== undefined) addField("check_out", toMySQLDateTime(check_out));

    if (add_ons !== undefined) {
      updateFields.push("add_ons = ?");
      params.push(JSON.stringify(add_ons));
    }

    if (updateFields.length === 0) {
      return res.json({ message: "No changes provided" });
    }

    // 3. Conflict Check if room or dates changed
    const effectiveRoomId  = room_id !== undefined ? Number(room_id) : current.room_id;
    const effectiveCheckIn = check_in !== undefined ? toMySQLDateTime(check_in) : current.check_in;
    const effectiveCheckOut = check_out !== undefined ? toMySQLDateTime(check_out) : current.check_out;

    if (room_id !== undefined || check_in !== undefined || check_out !== undefined) {
      console.log(`🔍 Checking availability for Room ${effectiveRoomId} between ${effectiveCheckIn} and ${effectiveCheckOut}`);
      const [conflictRows] = await db.query(
        `SELECT COUNT(*) AS conflictCount
         FROM bookings
         WHERE room_id = ?
           AND id != ?
           AND status IN ('Confirmed', 'Checked-in')
           AND check_in  < ?
           AND (check_out IS NULL OR check_out > ?)`,
        [effectiveRoomId, bookingId, effectiveCheckOut || effectiveCheckIn, effectiveCheckIn]
      );
      if (conflictRows[0]?.conflictCount > 0) {
        console.log("⚠️ Conflict detected!");
        return res.status(409).json({ error: "Room is not available for the selected dates" });
      }
    }

    // 4. Update Bookings Table
    params.push(bookingId);
    console.log("📝 Executing Update with Fields:", updateFields.join(", "), "Params:", params);
    await db.query(`UPDATE bookings SET ${updateFields.join(", ")} WHERE id = ?`, params);

    // 5. Sync booking_addons if changed
    if (add_ons) {
      const bIdStr = current.booking_id;
      await db.query("DELETE FROM booking_addons WHERE booking_id = ?", [bIdStr]);
      if (Array.isArray(add_ons)) {
        for (const addon of add_ons) {
          await db.query(
            "INSERT INTO booking_addons (booking_id, name, price) VALUES (?, ?, ?)",
            [bIdStr, addon.description || addon.label || addon.name, Number(addon.amount || addon.price || 0)]
          );
        }
      }
    }

    // 6. Update room status if status or room_id changed
    const finalStatus = status || current.status;
    const roomStatus =
      finalStatus === "Checked-in"  ? "Occupied"  :
      finalStatus === "Checked-out" ? "Available" :
      finalStatus === "Cancelled"   ? "Available" :
      "Booked";

    // If room changed, make old room available
    if (room_id && Number(room_id) !== current.room_id) {
      await db.query("UPDATE rooms SET status = 'Available' WHERE id = ?", [current.room_id]);
    }
    // Update current/new room status
    await db.query("UPDATE rooms SET status = ? WHERE id = ?", [roomStatus, effectiveRoomId]);

    res.json({ message: "Booking updated effectively" });
  } catch (err) {
    console.error("Update booking error:", err);
    res.status(500).json({ error: "Update failed: " + err.message });
  }
});

// DELETE - BOOKING
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM bookings WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.json({ message: "Booking deleted" });
  } catch (err) {
    console.error("Delete booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;