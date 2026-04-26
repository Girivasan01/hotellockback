const db = require("../db/database");

/**
 * Production-ready DB service (MySQL compatible)
 */
class DbService {
  constructor() {
    this.db = db;
  }

  _getExecutor(executor = this.db) {
    if (!executor || typeof executor.query !== "function") {
      throw new Error("A query-capable database executor is required");
    }
    return executor;
  }

  async _query(executor, sql, params = []) {
    const target = this._getExecutor(executor);
    return target.query(sql, params);
  }

  /**
   * Execute INSERT/UPDATE/DELETE
   */
  async run(sql, params = [], executor = this.db) {
    try {
      const [result] = await this._query(executor, sql, params);
      return {
        lastID: result?.insertId,
        changes: result?.affectedRows || 0,
      };
    } catch (err) {
      console.error("DB RUN Error:", err);
      throw err;
    }
  }

  /**
   * Get single row
   */
  async get(sql, params = [], executor = this.db) {
    try {
      const [rows] = await this._query(executor, sql, params);
      return Array.isArray(rows) ? rows[0] : undefined;
    } catch (err) {
      console.error("DB GET Error:", err);
      throw err;
    }
  }

  /**
   * Get multiple rows
   */
  async all(sql, params = [], executor = this.db) {
    try {
      const [rows] = await this._query(executor, sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error("DB ALL Error:", err);
      throw err;
    }
  }

  /**
   * Execute transaction on a single MySQL connection.
   */
  async transaction(fn) {
    const connection = await this.db.pool.getConnection();
    const tx = {
      run: (sql, params = []) => this.run(sql, params, connection),
      get: (sql, params = []) => this.get(sql, params, connection),
      all: (sql, params = []) => this.all(sql, params, connection),
      idempotencyExists: (key) => this.idempotencyExists(key, connection),
      getBookingWithDetails: (bookingId) =>
        this.getBookingWithDetails(bookingId, connection),
      getKitchenOrdersForBilling: (bookingId) =>
        this.getKitchenOrdersForBilling(bookingId, connection),
      getBookingAddons: (bookingId) =>
        this.getBookingAddons(bookingId, connection),
      getKitchenBillingSummary: (bookingId) =>
        this.getKitchenBillingSummary(bookingId, connection),
      getKitchenOrdersForInvoice: (bookingId) =>
        this.getKitchenOrdersForInvoice(bookingId, connection),
    };

    try {
      await connection.beginTransaction();
      const result = await fn(tx);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      console.error("Transaction rolled back:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check idempotency key
   */
  async idempotencyExists(key, executor = this.db) {
    const row = await this.get(
      "SELECT id FROM billings WHERE idempotency_key = ?",
      [key],
      executor
    );
    return !!row;
  }

  /**
   * Get booking with full details
   */
  async getBookingWithDetails(bookingId, executor = this.db) {
    const booking = await this.get(
      `SELECT b.*, c.name AS customer_name, r.room_number, r.category
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [bookingId],
      executor
    );

    if (!booking) return null;

    const addons = await this.getBookingAddons(booking.booking_id, executor);
    const addonsTotal = addons.reduce((sum, a) => sum + Number(a.price || 0), 0);

    const kitchenSummary = await this.getKitchenBillingSummary(
      booking.booking_id,
      executor
    );
    const kitchenTotal = Number(kitchenSummary.kitchenTotal || 0);

    return {
      ...booking,
      addons,
      addonsTotal,
      kitchenTotal,
      grandTotal:
        Number(booking.price || 0) * (booking.stayDays || 1) +
        addonsTotal +
        kitchenTotal -
        Number(booking.discount || 0),
    };
  }

  /**
   * Get kitchen orders for a booking (only 'served' status)
   */
  async getKitchenOrdersForBilling(bookingId, executor = this.db) {
    return await this.all(
      `SELECT 
        ko.id,
        ko.quantity,
        mi.name as item_name,
        mi.price as item_price,
        (mi.price * ko.quantity) AS total
       FROM kitchen_orders ko
       JOIN menu_items mi ON ko.item_id = mi.id
       WHERE ko.booking_id = ?
       AND ko.status = 'Served'
       ORDER BY ko.created_at ASC`,
      [bookingId],
      executor
    );
  }

  async getBookingAddons(bookingId, executor = this.db) {
    return await this.all(
      `SELECT id, name, price FROM booking_addons WHERE booking_id = ?`,
      [bookingId],
      executor
    );
  }

  async getKitchenBillingSummary(bookingId, executor = this.db) {
    const row = await this.get(
      `SELECT
         COALESCE(SUM(mi.price * ko.quantity), 0) AS kitchenTotal
       FROM kitchen_orders ko
       LEFT JOIN menu_items mi ON ko.item_id = mi.id
       WHERE ko.booking_id = ?
         AND UPPER(COALESCE(ko.status, '')) IN ('SERVED', 'READY', 'READY FOR BILLING')`,
      [bookingId],
      executor
    );

    return {
      kitchenTotal: Number(row?.kitchenTotal || 0),
    };
  }

  async getKitchenOrdersForInvoice(bookingId, executor = this.db) {
    return await this.all(
      `SELECT
         ko.id,
         ko.quantity,
         COALESCE(mi.name, CONCAT('Kitchen Item #', ko.item_id)) AS item_name,
         COALESCE(mi.price * ko.quantity, 0) AS total,
         COALESCE(mi.price, 0) AS item_price,
         ko.status
       FROM kitchen_orders ko
       LEFT JOIN menu_items mi ON ko.item_id = mi.id
       WHERE ko.booking_id = ?
         AND UPPER(COALESCE(ko.status, '')) IN ('SERVED', 'READY', 'READY FOR BILLING')
       ORDER BY ko.created_at ASC, ko.id ASC`,
      [bookingId],
      executor
    );
  }
}

module.exports = new DbService();
