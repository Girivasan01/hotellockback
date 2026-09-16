const db = require("../db/database");

// ================= RESTAURANT ORDERS =================

/**
 * Get all restaurant orders (orders with table_number)
 * Excludes orders that are already settled/billed
 */
exports.getRestaurantOrders = (req, res) => {
  const { table_number } = req.query;

  let query = `
    SELECT 
      ro.id,
      ro.table_number,
      
      mi.id AS item_id,
      mi.name AS item_name,
      mi.price,
      
      ro.quantity,
      (mi.price * ro.quantity) AS total,
      ro.status,
      ro.created_at
      
    FROM restaurant_orders ro
    JOIN menu_items mi ON ro.item_id = mi.id AND mi.org_id = ro.org_id
    
    WHERE ro.status != 'Settled'
      AND ro.org_id = ?
  `;

  const params = [req.orgId];

  if (table_number) {
    query += ` AND ro.table_number = ?`;
    params.push(table_number);
  }

  query += ` ORDER BY ro.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "Failed to fetch restaurant orders" });
    }
    res.json(rows);
  });
};

/**
 * Create a new restaurant order
 * Requires: table_number, item_id, quantity
 */
exports.createRestaurantOrder = (req, res) => {
  const { table_number, item_id, quantity } = req.body;

  // Validation
  if (!table_number || !item_id || !quantity) {
    return res.status(400).json({
      error: "Missing required fields: table_number, item_id, quantity",
    });
  }

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  // Stock is validated and decremented atomically at submission time (not
  // just in the UI) so it can't go negative under concurrent orders.
  db.run(
    `UPDATE menu_items
     SET stock = stock - ?,
         status = CASE WHEN (stock - ?) > 0 THEN 'Available' ELSE 'Out of Stock' END
     WHERE id = ? AND org_id = ? AND stock >= ? AND status = 'Available'`,
    [quantity, quantity, item_id, req.orgId, quantity],
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
          [item_id, req.orgId],
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
        `INSERT INTO restaurant_orders 
         (table_number, item_id, quantity, status, org_id, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [table_number, item_id, quantity, "Pending", req.orgId],
        function (err) {
          if (err) {
            console.error(err);
            // Roll back the stock deduction since the order wasn't created.
            db.run(
              `UPDATE menu_items
               SET stock = stock + ?,
                   status = CASE WHEN (stock + ?) > 0 THEN 'Available' ELSE 'Out of Stock' END
               WHERE id = ? AND org_id = ?`,
              [quantity, quantity, item_id, req.orgId],
              () => {},
            );
            return res.status(500).json({ error: err.message });
          }
          res.json({
            id: this.lastID,
            message: "Restaurant order created successfully",
          });
        },
      );
    },
  );
};

/**
 * Update restaurant order status
 * Status can be: Pending, Preparing, Served, Settled
 */
// Only these forward moves are allowed; Served/Cancelled/Settled are locked
// and cannot be changed through this endpoint.
const RESTAURANT_ORDER_TRANSITIONS = {
  Pending: ["Preparing", "Cancelled"],
  Preparing: ["Served", "Cancelled"],
  Served: [],
  Cancelled: [],
  Settled: [],
};

exports.updateRestaurantOrderStatus = (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const validStatuses = Object.keys(RESTAURANT_ORDER_TRANSITIONS);

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  db.get(
    "SELECT status FROM restaurant_orders WHERE id = ? AND org_id = ?",
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
        const allowedNext = RESTAURANT_ORDER_TRANSITIONS[order.status] || [];
        if (!allowedNext.includes(status)) {
          return res.status(400).json({
            error: `Cannot change order status from "${order.status}" to "${status}"`,
          });
        }
      }

      db.run(
        "UPDATE restaurant_orders SET status = ? WHERE id = ? AND org_id = ?",
        [status, orderId, req.orgId],
        function (updateErr) {
          if (updateErr) {
            console.error(updateErr);
            return res.status(500).json({ error: updateErr.message });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Order not found" });
          }

          res.json({ message: "Restaurant order status updated successfully" });
        },
      );
    },
  );
};

/**
 * Generate bill for a specific table
 * Marks all served orders for that table as "Settled"
 */
exports.generateRestaurantBill = (req, res) => {
  const { table_number } = req.body;

  if (!table_number) {
    return res.status(400).json({ error: "table_number is required" });
  }

  db.run(
    `UPDATE restaurant_orders
     SET status = 'Settled'
     WHERE table_number = ? AND org_id = ? AND status = 'Served'`,
    [table_number, req.orgId],
    function (err) {
      if (err) {
        console.error("Generate bill DB error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "No served orders found for this table",
        });
      }

      res.json({
        message: `Bill generated for table ${table_number}`,
        updated: this.changes,
      });
    },
  );
};

/**
 * Delete a restaurant order (only if not served/settled)
 */
exports.deleteRestaurantOrder = (req, res) => {
  const orderId = req.params.id;

  db.run(
    `DELETE FROM restaurant_orders 
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

      res.json({ message: "Restaurant order deleted successfully" });
    },
  );
};
exports.deleteRestaurantOrdersByTable = (req, res) => {
  const { table_number } = req.params;

  db.run(
    `DELETE FROM restaurant_orders 
     WHERE table_number = ? AND org_id = ? AND status != 'Settled'`,
    [table_number, req.orgId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "No deletable orders found for this table",
        });
      }

      res.json({
        message: "Restaurant orders deleted successfully",
        deleted: this.changes,
      });
    },
  );
};

/**
 * Get orders grouped by table (useful for billing view)
 */
exports.getOrdersByTable = (req, res) => {
  const query = `
    SELECT 
      ro.table_number,
      COUNT(*) as order_count,
      SUM(mi.price * ro.quantity) as total_amount,
      GROUP_CONCAT(CONCAT(mi.name, ' x', ro.quantity) SEPARATOR ', ') as items
      
    FROM restaurant_orders ro
    JOIN menu_items mi ON ro.item_id = mi.id AND mi.org_id = ro.org_id AND mi.org_id = ro.org_id
    
    WHERE ro.status = 'Served'
      AND ro.org_id = ?
    
    GROUP BY ro.table_number
    ORDER BY ro.table_number
  `;

  db.all(query, [req.orgId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch orders by table" });
    }
    res.json(rows);
  });
};
