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
    JOIN menu_items mi ON ro.item_id = mi.id
    
    WHERE ro.status != 'Settled'
  `;

  const params = [];

  if (table_number) {
    query += ` AND ro.table_number = ?`;
    params.push(table_number);
  }

  query += ` ORDER BY ro.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch restaurant orders" });
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
      error: "Missing required fields: table_number, item_id, quantity" 
    });
  }

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  db.run(
    `INSERT INTO restaurant_orders 
     (table_number, item_id, quantity, status, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [table_number, item_id, quantity, "Pending"],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        id: this.lastID, 
        message: "Restaurant order created successfully" 
      });
    }
  );
};

/**
 * Update restaurant order status
 * Status can be: Pending, Preparing, Served, Settled
 */
exports.updateRestaurantOrderStatus = (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const validStatuses = ["Pending", "Preparing", "Served", "Settled"];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
    });
  }

  db.run(
    "UPDATE restaurant_orders SET status = ? WHERE id = ?",
    [status, orderId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      res.json({ message: "Restaurant order status updated successfully" });
    }
  );
};

/**
 * Generate bill for a specific table
 * Marks all served orders for that table as "Settled"
 */
exports.generateRestaurantBill = (req, res) => {
  console.log("Generate bill payload:", req.body);

  const { table_number } = req.body;

  if (!table_number) {
    return res.status(400).json({ error: "table_number is required" });
  }

  db.run(
    `UPDATE restaurant_orders
     SET status = 'Settled'
     WHERE table_number = ? AND status = 'Served'`,
    [table_number],
    function (err) {
      if (err) {
        console.error("Generate bill DB error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: `Bill generated for table ${table_number}`,
        updated: this.changes,
      });
    }
  );
};


/**
 * Delete a restaurant order (only if not served/settled)
 */
exports.deleteRestaurantOrder = (req, res) => {
  const orderId = req.params.id;

  db.run(
    `DELETE FROM restaurant_orders 
     WHERE id = ? AND status != 'Settled'`,
    [orderId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Order not found or cannot be deleted (already settled)"
        });
      }

      res.json({ message: "Restaurant order deleted successfully" });
    }
  );
};
exports.deleteRestaurantOrdersByTable = (req, res) => {
  const { table_number } = req.params;

  db.run(
    `DELETE FROM restaurant_orders 
     WHERE table_number = ? AND status != 'Settled'`,
    [table_number],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "No deletable orders found for this table"
        });
      }

      res.json({
        message: "Restaurant orders deleted successfully",
        deleted: this.changes
      });
    }
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
      GROUP_CONCAT(mi.name || ' x' || ro.quantity) as items
      
    FROM restaurant_orders ro
    JOIN menu_items mi ON ro.item_id = mi.id
    
    WHERE ro.status = 'Served'
    
    GROUP BY ro.table_number
    ORDER BY ro.table_number
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch orders by table" });
    }
    res.json(rows);
  });
};