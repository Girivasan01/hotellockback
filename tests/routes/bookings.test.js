const request = require("supertest");
const express = require("express");

jest.mock("../../db/database", () => ({
  query: jest.fn(),
}));

jest.mock("../../services/checkoutService", () => ({
  processCheckout: jest.fn(),
}));

jest.mock("../../middleware/auth", () => ({
  requireAuth: (req, res, next) => next(),
}));

const db = require("../../db/database");
const checkoutService = require("../../services/checkoutService");
const bookingsRouter = require("../../routes/bookings");

function buildApp(testUser = { id: 1, role: "admin", org_id: 10 }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = testUser;
    req.orgId = testUser.org_id;
    next();
  });
  app.use("/bookings", bookingsRouter);
  return app;
}

describe("routes/bookings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /bookings (create)", () => {
    const validPayload = {
      booking_id: "BK-100",
      customer_id: 5,
      room_id: 3,
      check_in: "2026-08-01T14:00",
      check_out: "2026-08-03T11:00",
      price: 2000,
    };

    it("returns 400 listing all missing required fields", async () => {
      const app = buildApp();
      const res = await request(app).post("/bookings").send({});

      expect(res.status).toBe(400);
      expect(res.body.missing).toEqual(
        expect.arrayContaining(["booking_id", "customer_id", "room_id", "price"]),
      );
    });

    it("rejects when check-out is not after check-in", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/bookings")
        .send({
          ...validPayload,
          check_in: "2026-08-03T14:00",
          check_out: "2026-08-01T11:00",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Check-out must be after check-in");
    });

    it("returns 400 when the room does not exist for this org", async () => {
      db.query.mockResolvedValueOnce([[]]); // admin name lookup
      db.query.mockResolvedValueOnce([[]]); // room lookup -> not found

      const app = buildApp();
      const res = await request(app).post("/bookings").send(validPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid room selected");
    });

    it("returns 409 when the room is already booked for overlapping dates", async () => {
      db.query.mockResolvedValueOnce([[{ name: "Admin" }]]); // admin name
      db.query.mockResolvedValueOnce([[{ id: 3, capacity: 2 }]]); // room exists
      db.query.mockResolvedValueOnce([[{ conflictCount: 1 }]]); // conflict found

      const app = buildApp();
      const res = await request(app).post("/bookings").send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not available/i);
    });

    it("creates the booking, inserts add-ons, and marks the room booked", async () => {
      db.query.mockResolvedValueOnce([[{ name: "Admin" }]]); // admin name
      db.query.mockResolvedValueOnce([[{ id: 3, capacity: 2 }]]); // room exists
      db.query.mockResolvedValueOnce([[{ conflictCount: 0 }]]); // no conflict
      db.query.mockResolvedValueOnce([{ insertId: 42 }]); // insert booking
      db.query.mockResolvedValueOnce([{}]); // insert addon
      db.query.mockResolvedValueOnce([{}]); // update room status

      const app = buildApp();
      const res = await request(app)
        .post("/bookings")
        .send({
          ...validPayload,
          add_ons: [{ name: "Breakfast", price: 150 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(42);
      expect(res.body.booking_id).toBe("BK-100");

      // room status update call should mark room as "Booked" (not checked-in)
      const roomUpdateCall = db.query.mock.calls.find((c) =>
        c[0].includes("UPDATE rooms SET status"),
      );
      expect(roomUpdateCall[1]).toEqual(["Booked", 3, 10]);
    });

    it("marks the room Occupied when booking is created with status Checked-in", async () => {
      db.query.mockResolvedValueOnce([[{ name: "Admin" }]]);
      db.query.mockResolvedValueOnce([[{ id: 3, capacity: 2 }]]);
      db.query.mockResolvedValueOnce([[{ conflictCount: 0 }]]);
      db.query.mockResolvedValueOnce([{ insertId: 43 }]);
      db.query.mockResolvedValueOnce([{}]); // update room status

      const app = buildApp();
      const res = await request(app)
        .post("/bookings")
        .send({ ...validPayload, status: "Checked-in" });

      expect(res.status).toBe(201);
      const roomUpdateCall = db.query.mock.calls.find((c) =>
        c[0].includes("UPDATE rooms SET status"),
      );
      expect(roomUpdateCall[1]).toEqual(["Occupied", 3, 10]);
    });

    it("scopes room and availability lookups to req.orgId (multi-tenant isolation)", async () => {
      db.query.mockResolvedValueOnce([[{ name: "Admin" }]]);
      db.query.mockResolvedValueOnce([[{ id: 3, capacity: 2 }]]);
      db.query.mockResolvedValueOnce([[{ conflictCount: 0 }]]);
      db.query.mockResolvedValueOnce([{ insertId: 44 }]);
      db.query.mockResolvedValueOnce([{}]);

      const app = buildApp({ id: 1, role: "admin", org_id: 77 });
      await request(app).post("/bookings").send(validPayload);

      const roomLookupCall = db.query.mock.calls[1];
      expect(roomLookupCall[1]).toEqual([3, 77]);
    });
  });

  describe("GET /bookings/:id", () => {
    it("returns 404 when booking not found for this org", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app).get("/bookings/999");

      expect(res.status).toBe(404);
    });

    it("returns the booking when found", async () => {
      db.query.mockResolvedValueOnce([[{ id: 5, booking_id: "BK-5" }]]);

      const app = buildApp();
      const res = await request(app).get("/bookings/5");

      expect(res.status).toBe(200);
      expect(res.body.booking_id).toBe("BK-5");
    });
  });

  describe("PUT /bookings/:id (update)", () => {
    it("returns 404 when booking does not exist for this org", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .put("/bookings/5")
        .send({ status: "Checked-in" });

      expect(res.status).toBe(404);
    });

    it("returns a no-op message when no fields are provided", async () => {
      db.query.mockResolvedValueOnce([[{ id: 5, room_id: 3, status: "Confirmed" }]]);

      const app = buildApp();
      const res = await request(app).put("/bookings/5").send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("No changes provided");
    });

    it("returns 409 when changing dates/room creates a conflict", async () => {
      db.query.mockResolvedValueOnce([
        [{ id: 5, room_id: 3, status: "Confirmed", check_in: "2026-08-01 14:00:00" }],
      ]);
      db.query.mockResolvedValueOnce([[{ conflictCount: 1 }]]);

      const app = buildApp();
      const res = await request(app)
        .put("/bookings/5")
        .send({ room_id: 4 });

      expect(res.status).toBe(409);
    });

    it("updates booking fields and room status successfully", async () => {
      db.query.mockResolvedValueOnce([
        [{ id: 5, room_id: 3, booking_id: "BK-5", status: "Confirmed" }],
      ]);
      db.query.mockResolvedValueOnce([{}]); // update bookings
      db.query.mockResolvedValueOnce([{}]); // update room status

      const app = buildApp();
      const res = await request(app)
        .put("/bookings/5")
        .send({ status: "Checked-out" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Booking updated effectively");
    });
  });

  describe("DELETE /bookings/:id", () => {
    it("returns 404 when nothing was deleted", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const app = buildApp();
      const res = await request(app).delete("/bookings/999");

      expect(res.status).toBe(404);
    });

    it("deletes successfully and scopes by org", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).delete("/bookings/5");

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ["5", 10]);
    });
  });

  describe("POST /bookings/:id/checkout", () => {
    it("returns success summary when checkout succeeds", async () => {
      checkoutService.processCheckout.mockResolvedValue({
        success: true,
        billing_id: 9,
        idempotency_key: "abc",
        summary: { total: 5000 },
      });

      const app = buildApp();
      const res = await request(app).post("/bookings/5/checkout").send({});

      expect(res.status).toBe(200);
      expect(res.body.billing_id).toBe(9);
    });

    it("returns 409 on duplicate checkout attempts", async () => {
      checkoutService.processCheckout.mockResolvedValue({
        success: false,
        error: "Duplicate checkout request",
        idempotency_key: "abc",
      });

      const app = buildApp();
      const res = await request(app).post("/bookings/5/checkout").send({});

      expect(res.status).toBe(409);
    });

    it("returns 400 for other checkout failures", async () => {
      checkoutService.processCheckout.mockResolvedValue({
        success: false,
        error: "Invalid billing data",
      });

      const app = buildApp();
      const res = await request(app).post("/bookings/5/checkout").send({});

      expect(res.status).toBe(400);
    });
  });
});