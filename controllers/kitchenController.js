const db = require("../db/database");

// ================= MENU ITEMS =================
exports.getMenuItems = (req, res) => {
  db.all(
    "SELECT * FROM menu_items WHERE org_id = ? ORDER BY category, name",
    [req.orgId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
};

exports.getMenuItemById = (req, res) => {
  db.get(
    "SELECT * FROM menu_items WHERE id = ? AND org_id = ?",
    [req.params.id, req.orgId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    },
  );
};

// Stock is the single source of truth for availability: 0 (or less) always
// means "Out of Stock" and any positive stock always means "Available",
// regardless of what status value was submitted from the form.
function deriveStatus(stock) {
  const qty = Number(stock);
  return qty > 0 ? "Available" : "Out of Stock";
}

exports.createMenuItem = (req, res) => {
  const { name, category, price, stock } = req.body;
  const status = deriveStatus(stock);
  db.run(
    "INSERT INTO menu_items (name, category, price, stock, status, org_id) VALUES (?, ?, ?, ?, ?, ?)",
    [name, category, price, stock, status, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Menu item created" });
    },
  );
};

exports.updateMenuItem = (req, res) => {
  const { name, category, price, stock } = req.body;
  const status = deriveStatus(stock);
  db.run(
    "UPDATE menu_items SET name=?, category=?, price=?, stock=?, status=? WHERE id=? AND org_id=?",
    [name, category, price, stock, status, req.params.id, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Menu item updated" });
    },
  );
};

exports.deleteMenuItem = (req, res) => {
  db.run(
    "DELETE FROM menu_items WHERE id=? AND org_id=?",
    [req.params.id, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Menu item deleted" });
    },
  );
};

// ================= CATEGORIES =================
exports.getCategories = (req, res) => {
  db.all(
    "SELECT * FROM categories WHERE org_id = ? ORDER BY name",
    [req.orgId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
};

exports.createCategory = (req, res) => {
  const { name } = req.body;
  db.run(
    "INSERT INTO categories (name, org_id) VALUES (?, ?)",
    [name, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Category created" });
    },
  );
};

exports.deleteCategory = (req, res) => {
  const id = req.params.id;
  db.run(
    "DELETE FROM categories WHERE id=? AND org_id=?",
    [id, req.orgId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Category deleted" });
    },
  );
};

// ================= KITCHEN ORDERS =================

/**
 * Get all kitchen/hotel orders
 * Returns orders with room, customer, and booking information
 */
exports.getKitchenOrders = (req, res) => {
  const { booking_id } = req.query;

  let query = `
    SELECT 
      ko.id,
      ko.room_id,
      ko.item_id,
      ko.quantity,
      ko.status,
      ko.created_at,

      r.room_number,
      r.category,
      r.price_per_night,

      ko.booking_id,
      COALESCE(ko.customer_id, b.customer_id) AS customer_id,
      b.check_in,
      b.check_out,
      b.status AS booking_status,

      c.name AS customer_name,
      c.photo AS customer_photo,
      c.contact AS customer_contact,
      c.email AS customer_email,

      mi.name AS item_name,
      mi.price,
      mi.category AS item_category,
      (mi.price * ko.quantity) AS total

    FROM kitchen_orders ko
    JOIN rooms r ON ko.room_id = r.id
    LEFT JOIN bookings b ON ko.booking_id = b.booking_id AND b.org_id = ko.org_id
    LEFT JOIN customers c ON c.id = COALESCE(ko.customer_id, b.customer_id) AND c.org_id = ko.org_id
    JOIN menu_items mi ON ko.item_id = mi.id

    WHERE ko.status != 'Settled'
      AND ko.org_id = ?
  `;

  const params = [req.orgId];

  if (booking_id) {
    // ✅ For checkout: only include 'Served' orders
    query += ` AND ko.booking_id = ? AND ko.status = 'Served'`;
    params.push(booking_id);
  }

  query += ` ORDER BY ko.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch kitchen orders" });
    }
    res.json(rows);
  });
};

/**
 * Create a new kitchen/hotel order
 * Can accept either room_id or booking_id
 */
exports.createKitchenOrder = (req, res) => {
  let { room_id, booking_id, customer_id, item_id, quantity } = req.body;

  if (!item_id || !quantity) {
    return res.status(400).json({
      error: "item_id and quantity are required",
    });
  }

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  // Prefer an explicit booking. A kitchen order is tied to the guest's
  // booking/customer at creation time so a later booking for the same room
  // cannot change who gets the food charge.
  if (booking_id) {
    db.get(
      `SELECT room_id, customer_id
       FROM bookings
       WHERE booking_id = ? AND org_id = ?
       LIMIT 1`,
      [booking_id, req.orgId],
      (err, booking) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: err.message });
        }
        if (!booking) {
          return res.status(404).json({ error: "Booking not found" });
        }

        if (
          customer_id &&
          Number(customer_id) !== Number(booking.customer_id)
        ) {
          return res.status(400).json({
            error: "Customer does not belong to the selected booking",
          });
        }

        createOrder(
          booking.room_id,
          booking_id,
          booking.customer_id,
          item_id,
          quantity,
          req.orgId,
          res,
        );
      },
    );
  } else if (room_id) {
    // Fallback for callers that only provide a room: prefer the currently
    // checked-in guest, including a guest whose checkout is today, over a
    // future confirmed booking for the same room.
    db.get(
      `SELECT booking_id, customer_id
       FROM bookings
       WHERE room_id = ?
         AND org_id = ?
         AND status IN ('Confirmed','Checked-in')
         AND (
           status = 'Checked-in'
           OR DATE(check_out) = CURDATE()
           OR (check_in <= NOW() AND (check_out IS NULL OR check_out > NOW()))
         )
       ORDER BY
         CASE WHEN status = 'Checked-in' THEN 0 ELSE 1 END,
         CASE WHEN DATE(check_out) = CURDATE() THEN 0 ELSE 1 END,
         check_out ASC,
         id DESC
       LIMIT 1`,
      [room_id, req.orgId],
      (err, booking) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: err.message });
        }
        if (!booking) {
          return res
            .status(400)
            .json({ error: "Active booking not found for room" });
        }

        createOrder(
          room_id,
          booking.booking_id,
          booking.customer_id,
          item_id,
          quantity,
          req.orgId,
          res,
        );
      },
    );
  } else {
    return res.status(400).json({
      error: "booking_id or room_id is required",
    });
  }
};

// Store the customer who placed the order together with the booking.
// Stock is validated and decremented atomically at submission time (not
// just in the UI) so it can't go negative under concurrent orders.
function createOrder(
  room_id,
  booking_id,
  customer_id,
  item_id,
  quantity,
  orgId,
  res,
) {
  db.run(
    `UPDATE menu_items
     SET stock = stock - ?,
         status = CASE WHEN (stock - ?) > 0 THEN 'Available' ELSE 'Out of Stock' END
     WHERE id = ? AND org_id = ? AND stock >= ? AND status = 'Available'`,
    [quantity, quantity, item_id, orgId, quantity],
    function (stockErr) {
      if (stockErr) {
        console.error(stockErr);
        return res.status(500).json({ error: stockErr.message });
      }

      if (this.changes === 0) {
        // Either the item doesn't exist, isn't marked Available, or there
        // isn't enough stock left.
        db.get(
          "SELECT stock, status FROM menu_items WHERE id = ? AND org_id = ?",
          [item_id, orgId],
          (lookupErr, item) => {
            if (lookupErr) {
              console.error(lookupErr);
              return res.status(500).json({ error: lookupErr.message });
            }
            if (!item) {
              return res.status(404).json({ error: "Menu item not found" });
            }
            if (item.status !== "Available") {
              return res.status(400).json({
                error: "This item is currently unavailable",
              });
            }
            return res.status(400).json({
              error: `Only ${item.stock} in stock for this item`,
            });
          },
        );
        return;
      }

      db.run(
        `INSERT INTO kitchen_orders
         (room_id, booking_id, customer_id, item_id, quantity, status, org_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [room_id, booking_id, customer_id, item_id, quantity, "Pending", orgId],
        function (err) {
          if (err) {
            console.error(err);
            // Roll back the stock deduction since the order wasn't created.
            db.run(
              `UPDATE menu_items
               SET stock = stock + ?,
                   status = CASE WHEN (stock + ?) > 0 THEN 'Available' ELSE 'Out of Stock' END
               WHERE id = ? AND org_id = ?`,
              [quantity, quantity, item_id, orgId],
              () => {},
            );
            return res.status(500).json({ error: err.message });
          }
          res.json({
            id: this.lastID,
            message: "Kitchen order created successfully",
            booking_id,
            customer_id,
          });
        },
      );
    },
  );
}

/**
 * Update kitchen order status
 */
// Only these forward moves are allowed; Served/Cancelled/Settled are locked
// and cannot be changed through this endpoint.
const KITCHEN_ORDER_TRANSITIONS = {
  Pending: ["Preparing", "Cancelled"],
  Preparing: ["Served", "Cancelled"],
  Served: [],
  Cancelled: [],
  Settled: [],
};

exports.updateKitchenOrderStatus = (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const validStatuses = Object.keys(KITCHEN_ORDER_TRANSITIONS);

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  db.get(
    "SELECT status FROM kitchen_orders WHERE id = ? AND org_id = ?",
    [orderId, req.orgId],
    (err, order) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (status !== order.status) {
        const allowedNext = KITCHEN_ORDER_TRANSITIONS[order.status] || [];
        if (!allowedNext.includes(status)) {
          return res.status(400).json({
            error: `Cannot change order status from "${order.status}" to "${status}"`,
          });
        }
      }

      db.run(
        "UPDATE kitchen_orders SET status = ? WHERE id = ? AND org_id = ?",
        [status, orderId, req.orgId],
        function (updateErr) {
          if (updateErr) {
            console.error(updateErr);
            return res.status(500).json({ error: updateErr.message });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Order not found" });
          }

          res.json({ message: "Kitchen order status updated successfully" });
        },
      );
    },
  );
};

/**
 * Generate bill for a booking (marks all served orders as settled)
 */
exports.generateKitchenBill = (req, res) => {
  const { booking_id } = req.body;

  // ✅ Strict validation
  if (!booking_id) {
    return res.status(400).json({
      error: "booking_id is required",
    });
  }

  // ✅ Settle ONLY orders of this booking
  db.run(
    `
    UPDATE kitchen_orders
    SET status = 'Settled'
    WHERE booking_id = ?
      AND org_id = ?
      AND status = 'Served'
    `,
    [booking_id, req.orgId],
    function (err) {
      if (err) {
        console.error("Generate bill DB error:", err);
        return res.status(500).json({
          error: "Failed to generate bill",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "No served orders found for this booking",
        });
      }

      res.json({
        message: `Bill generated successfully for booking ${booking_id}`,
        orders_settled: this.changes,
      });
    },
  );
};

/**
 * Delete a kitchen order (only if not served/settled)
 */
exports.deleteKitchenOrder = (req, res) => {
  const orderId = req.params.id;

  db.run(
    `DELETE FROM kitchen_orders 
     WHERE id = ? AND org_id = ? AND status NOT IN ('Served', 'Settled')`,
    [orderId, req.orgId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error:
            "Order not found or cannot be deleted (already served/settled)",
        });
      }

      res.json({ message: "Kitchen order deleted successfully" });
    },
  );
};

exports.deleteKitchenOrdersByBooking = (req, res) => {
  const { booking_id } = req.params;

  db.run(
    `DELETE FROM kitchen_orders 
     WHERE booking_id = ? AND org_id = ? AND status NOT IN ('Served', 'Settled')`,
    [booking_id, req.orgId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "No deletable orders found for this booking",
        });
      }

      res.json({
        message: "Kitchen orders deleted successfully",
        deleted: this.changes,
      });
    },
  );
};

/**
 * Get orders grouped by booking (useful for billing view)
 */
exports.getOrdersByBooking = (req, res) => {
  const query = `
    SELECT 
      ko.booking_id,
      r.room_number,
      c.name AS customer_name,
      COUNT(ko.id) as order_count,
      SUM(mi.price * ko.quantity) as total_amount,
      GROUP_CONCAT(CONCAT(mi.name, ' x', ko.quantity) SEPARATOR ', ') as items
      
    FROM kitchen_orders ko
    JOIN rooms r ON ko.room_id = r.id AND r.org_id = ko.org_id
    LEFT JOIN bookings b ON ko.booking_id = b.booking_id AND b.org_id = ko.org_id
    LEFT JOIN customers c ON c.id = COALESCE(ko.customer_id, b.customer_id) AND c.org_id = ko.org_id
    JOIN menu_items mi ON ko.item_id = mi.id AND mi.org_id = ko.org_id
    
    WHERE ko.status = 'Served'
      AND ko.org_id = ?
    
    GROUP BY ko.booking_id
    ORDER BY ko.booking_id
  `;

  db.all(query, [req.orgId], (err, rows) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "Failed to fetch orders by booking" });
    }
    res.json(rows);
  });
};
