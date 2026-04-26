const db = require("../db/database");

const safeParse = (value) => {
  try {
    if (!value) return {};
    if (typeof value === "object") return value;
    if (value === "[object Object]") return {};
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const normalizeCategoryName = (value) => String(value || "").trim();

async function getRoomCategoryByName(name) {
  const [rows] = await db.query(
    "SELECT id, name FROM room_categories WHERE name = ? LIMIT 1",
    [name]
  );
  return rows[0] || null;
}

exports.getRoomCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        rc.id,
        rc.name,
        rc.created_at,
        rc.updated_at,
        COUNT(r.id) AS room_count
      FROM room_categories rc
      LEFT JOIN rooms r ON r.category = rc.name
      GROUP BY rc.id, rc.name, rc.created_at, rc.updated_at
      ORDER BY rc.name
      `
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRoomCategory = async (req, res) => {
  const name = normalizeCategoryName(req.body?.name);

  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  try {
    const existing = await getRoomCategoryByName(name);
    if (existing) {
      return res.status(409).json({ error: "Category already exists" });
    }

    const result = await db.run(
      "INSERT INTO room_categories (name) VALUES (?)",
      [name]
    );

    const [rows] = await db.query(
      "SELECT id, name, created_at, updated_at, 0 AS room_count FROM room_categories WHERE id = ? LIMIT 1",
      [result.lastID]
    );

    res.json(rows[0] || { id: result.lastID, name, room_count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoomCategory = async (req, res) => {
  const { id } = req.params;
  const name = normalizeCategoryName(req.body?.name);

  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  const connection = await db.pool.getConnection();

  try {
    const [currentRows] = await connection.query(
      "SELECT id, name FROM room_categories WHERE id = ? LIMIT 1",
      [id]
    );

    const current = currentRows[0];

    if (!current) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [duplicateRows] = await connection.query(
      "SELECT id FROM room_categories WHERE name = ? AND id <> ? LIMIT 1",
      [name, id]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({ error: "Category already exists" });
    }

    await connection.beginTransaction();

    await connection.query(
      "UPDATE room_categories SET name = ? WHERE id = ?",
      [name, id]
    );

    if (current.name !== name) {
      await connection.query(
        "UPDATE rooms SET category = ? WHERE category = ?",
        [name, current.name]
      );
    }

    await connection.commit();

    const [rows] = await connection.query(
      `
      SELECT
        rc.id,
        rc.name,
        rc.created_at,
        rc.updated_at,
        COUNT(r.id) AS room_count
      FROM room_categories rc
      LEFT JOIN rooms r ON r.category = rc.name
      WHERE rc.id = ?
      GROUP BY rc.id, rc.name, rc.created_at, rc.updated_at
      LIMIT 1
      `,
      [id]
    );

    res.json(rows[0] || { id: Number(id), name });
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

exports.deleteRoomCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [categoryRows] = await db.query(
      "SELECT id, name FROM room_categories WHERE id = ? LIMIT 1",
      [id]
    );

    const category = categoryRows[0];

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [usageRows] = await db.query(
      "SELECT COUNT(*) AS room_count FROM rooms WHERE category = ?",
      [category.name]
    );

    if (Number(usageRows[0]?.room_count || 0) > 0) {
      return res.status(409).json({
        error: "This category is currently assigned to one or more rooms",
      });
    }

    await db.run("DELETE FROM room_categories WHERE id = ?", [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRooms = (req, res) => {
  db.all(
    `
    SELECT 
      r.*,
      IFNULL(SUM(b.people_count), 0) AS current_occupancy
    FROM rooms r
    LEFT JOIN bookings b 
      ON b.room_id = r.id 
      AND b.status IN ('Confirmed','Checked-in')
    GROUP BY r.id
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const rooms = rows.map(r => ({
        ...r,
        amenities: safeParse(r.amenities),
        add_ons: safeParse(r.add_ons),
        capacity: r.capacity,
        current_occupancy: r.current_occupancy
      }));

      res.json(rooms);
    }
  );
};

exports.getRoomById = (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM rooms WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Room not found" });
    res.json({ ...row, amenities: safeParse(row.amenities), add_ons: safeParse(row.add_ons) });
  });
};

exports.createRoom = async (req, res) => {
  const {
    room_number,
    category,
    status,
    price_per_night,
    amenities,
    add_ons,
    capacity,
  } = req.body;

  const normalizedCategory = normalizeCategoryName(category);

  if (!normalizedCategory) {
    return res.status(400).json({ error: "Room category is required" });
  }

  try {
    const categoryRow = await getRoomCategoryByName(normalizedCategory);
    if (!categoryRow) {
      return res.status(400).json({ error: "Invalid room category" });
    }

    const result = await db.run(
      `INSERT INTO rooms (room_number, category, status, price_per_night, amenities, add_ons, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        room_number,
        normalizedCategory,
        status,
        price_per_night,
        JSON.stringify(amenities || {}),
        JSON.stringify(add_ons || {}),
        capacity || 2,
      ]
    );

    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  const { id } = req.params;
  const {
    room_number,
    category,
    status,
    price_per_night,
    amenities,
    add_ons,
    capacity,
  } = req.body;

  const normalizedCategory = normalizeCategoryName(category);

  if (!normalizedCategory) {
    return res.status(400).json({ error: "Room category is required" });
  }

  try {
    const categoryRow = await getRoomCategoryByName(normalizedCategory);
    if (!categoryRow) {
      return res.status(400).json({ error: "Invalid room category" });
    }

    const result = await db.run(
      `UPDATE rooms SET room_number=?, category=?, status=?, price_per_night=?, amenities=?, add_ons=?, capacity=? WHERE id=?`,
      [
        room_number,
        normalizedCategory,
        status,
        price_per_night,
        JSON.stringify(amenities || {}),
        JSON.stringify(add_ons || {}),
        capacity || 2,
        id,
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.getActiveRooms = (req, res) => {
  const query = `
    SELECT 
      r.id AS room_id,
      r.room_number,
      b.booking_id AS booking_code,
      r.capacity,
      b.people_count,
      c.id AS customer_id,
      c.name AS customer_name

    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN customers c ON b.customer_id = c.id

    WHERE b.status IN ('Confirmed', 'Checked-in')
    ORDER BY b.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
exports.deleteRoom = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM rooms WHERE id=?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Room not found" });
    res.json({ deleted: true });
  });
};
