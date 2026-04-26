const db = require("../db/database");

// Helper to run SQL queries
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getSingle(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || { cnt: 0, sum: 0 });
    });
  });
}

// ====================== CONTROLLER =========================

exports.getSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Room stats
    const totalRooms = await getSingle("SELECT COUNT(*) AS cnt FROM rooms");
    const availableRooms = await getSingle(
      "SELECT COUNT(*) AS cnt FROM rooms WHERE status = 'Available'"
    );
    const occupiedRooms = await getSingle(
      "SELECT COUNT(*) AS cnt FROM rooms WHERE status = 'Occupied'"
    );
    const maintenanceRooms = await getSingle(
      "SELECT COUNT(*) AS cnt FROM rooms WHERE status LIKE '%Maintenance%'"
    );

    // Booking stats
    const todaysCheckins = await getSingle(
      "SELECT COUNT(*) AS cnt FROM bookings WHERE DATE(check_in) = DATE(?)",
      [today]
    );
    const todaysCheckouts = await getSingle(
      "SELECT COUNT(*) AS cnt FROM bookings WHERE DATE(check_out) = DATE(?)",
      [today]
    );
    const activeBookings = await getSingle(
      "SELECT COUNT(*) AS cnt FROM bookings WHERE status IN ('Confirmed','Checked-in')"
    );

    // Revenue
    const todaysRevenue = await getSingle(
      "SELECT IFNULL(SUM(total_amount), 0) AS sum FROM billings WHERE DATE(created_at) = DATE(?)",
      [today]
    );

    // Recent Check-ins (latest 5)
    const recentCheckins = await query(
      `SELECT c.name, r.room_number AS room, b.check_in AS date
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN rooms r ON r.id = b.room_id
       WHERE b.status IN ('Confirmed','Checked-in')
       ORDER BY b.check_in DESC
       LIMIT 5`
    );

    // Occupancy rate
    const occupancyRate = totalRooms.cnt > 0 ? (occupiedRooms.cnt / totalRooms.cnt) * 100 : 0;

    // Kitchen status summary
    const kitchenStatusRows = await query(
      `SELECT status, COUNT(*) AS count FROM kitchen_orders GROUP BY status`
    );
    const kitchenStatus = kitchenStatusRows.reduce((acc, cur) => {
      acc[cur.status] = cur.count;
      return acc;
    }, {});

    res.json({
      totalRooms: totalRooms.cnt,
      availableRooms: availableRooms.cnt,
      occupiedRooms: occupiedRooms.cnt,
      maintenanceRooms: maintenanceRooms.cnt,
      occupancyRate: Number(occupancyRate.toFixed(2)),
      todaysCheckins: todaysCheckins.cnt,
      todaysCheckouts: todaysCheckouts.cnt,
      activeBookings: activeBookings.cnt,
      todaysRevenue: todaysRevenue.sum,
      recentCheckins: recentCheckins.map((row) => ({
        name: row.name,
        room: row.room,
        date: row.date
          ? new Date(row.date).toISOString().slice(0, 10)
          : "",
      })),
      kitchenStatus,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Bookings trend for last N days
exports.getBookingTrend = async (req, res) => {
  try {
    const days = req.query.days || 30;
    const rows = await query(
      `SELECT DATE(check_in) AS day, COUNT(*) AS bookings
       FROM bookings
       WHERE DATE(check_in) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(check_in)
       ORDER BY DATE(check_in)`,
      [`-${days} days`]
    );
    res.json(rows);
  } catch (err) {
    console.error("Booking trend error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Revenue by room category
exports.getRevenueByCategory = async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.category, IFNULL(SUM(b.price), 0) AS revenue
       FROM bookings b
       LEFT JOIN rooms r ON r.id = b.room_id
       GROUP BY r.category`
    );
    res.json(rows);
  } catch (err) {
    console.error("Revenue by category error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Top menu items sold
exports.getTopMenuItems = async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const rows = await query(
      `SELECT mi.name, SUM(ko.quantity) AS sold
       FROM kitchen_orders ko
       JOIN menu_items mi ON mi.id = ko.item_id
       WHERE ko.status != 'Cancelled'
       GROUP BY mi.name
       ORDER BY sold DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("Top menu items error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Kitchen order status breakdown
exports.getKitchenStatus = async (req, res) => {
  try {
    const rows = await query(
      `SELECT status, COUNT(*) AS count FROM kitchen_orders GROUP BY status`
    );
    res.json(rows);
  } catch (err) {
    console.error("Kitchen status error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Occupancy rate endpoint
exports.getOccupancyRate = async (req, res) => {
  try {
    const total = await getSingle("SELECT COUNT(*) AS cnt FROM rooms");
    const occupied = await getSingle("SELECT COUNT(*) AS cnt FROM rooms WHERE status = 'Occupied'");
    const rate = total.cnt > 0 ? (occupied.cnt / total.cnt) * 100 : 0;
    res.json({ totalRooms: total.cnt, occupiedRooms: occupied.cnt, occupancyRate: Number(rate.toFixed(2)) });
  } catch (err) {
    console.error("Occupancy rate error:", err);
    res.status(500).json({ error: err.message });
  }
};
