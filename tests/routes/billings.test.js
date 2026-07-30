const request = require("supertest");
const express = require("express");

jest.mock("../../db/database", () => ({
  query: jest.fn(),
}));

jest.mock("../../services/billingService", () => ({
  getBillings: jest.fn(),
  getBillingPreview: jest.fn(),
  getBillingDetails: jest.fn(),
}));

jest.mock("../../controllers/profitController", () => ({
  getProfit: (req, res) => res.json({ profit: 0 }),
}));

jest.mock("../../middleware/auth", () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

const db = require("../../db/database");
const billingService = require("../../services/billingService");
const billingsRouter = require("../../routes/billings");

function buildApp(orgId = 10) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.orgId = orgId;
    next();
  });
  app.use("/billings", billingsRouter);
  return app;
}

describe("routes/billings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /billings", () => {
    it("passes pagination and search params through to billingService", async () => {
      billingService.getBillings.mockResolvedValue({ bills: [], total: 0 });

      const app = buildApp();
      const res = await request(app).get(
        "/billings?page=2&limit=25&search=john&includeDownloaded=true",
      );

      expect(res.status).toBe(200);
      expect(billingService.getBillings).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
        search: "john",
        includeDownloaded: true,
        orgId: 10,
      });
    });
  });

  describe("GET /billings/preview/:bookingId", () => {
    it("returns 404 when the booking is not found", async () => {
      billingService.getBillingPreview.mockRejectedValue(
        new Error("Booking not found"),
      );

      const app = buildApp();
      const res = await request(app).get("/billings/preview/BK-999");

      expect(res.status).toBe(404);
    });

    it("returns the preview when found", async () => {
      billingService.getBillingPreview.mockResolvedValue({ total: 5000 });

      const app = buildApp();
      const res = await request(app).get("/billings/preview/BK-1");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5000);
    });
  });

  describe("GET /billings/:id", () => {
    it("returns 404 when the bill is not found", async () => {
      billingService.getBillingDetails.mockRejectedValue(
        new Error("Billing not found"),
      );

      const app = buildApp();
      const res = await request(app).get("/billings/999");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Bill not found");
    });

    it("returns bill details when found", async () => {
      billingService.getBillingDetails.mockResolvedValue({
        id: 1,
        total: 3000,
      });

      const app = buildApp();
      const res = await request(app).get("/billings/1");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3000);
    });
  });

  describe("DELETE /billings/:id", () => {
    it("returns 404 when nothing was deleted", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const app = buildApp();
      const res = await request(app).delete("/billings/999");

      expect(res.status).toBe(404);
    });

    it("deletes successfully, scoped by org", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp(10);
      const res = await request(app).delete("/billings/5");

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(expect.any(String), ["5", 10]);
    });
  });

  describe("PATCH /billings/:id/downloaded", () => {
    it("returns 404 when bill not found", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const app = buildApp();
      const res = await request(app).patch("/billings/999/downloaded").send({});

      expect(res.status).toBe(404);
    });

    it("marks bill downloaded and optionally sets gst_number", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp();
      const res = await request(app)
        .patch("/billings/5/downloaded")
        .send({ gst_number: "29ABCDE1234F1Z5" });

      expect(res.status).toBe(200);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("gst_number = ?");
      expect(params).toEqual(["29ABCDE1234F1Z5", "5", 10]);
    });
  });

  describe("PATCH /billings/:id/payment-status", () => {
    it("rejects an invalid status value", async () => {
      const app = buildApp();
      const res = await request(app)
        .patch("/billings/5/payment-status")
        .send({ status: "pending" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when bill does not exist", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .patch("/billings/999/payment-status")
        .send({ status: "paid" });

      expect(res.status).toBe(404);
    });

    it("REGRESSION-GUARD: refuses to revert an already-paid bill to unpaid", async () => {
      db.query.mockResolvedValueOnce([[{ payment_status: "paid" }]]);

      const app = buildApp();
      const res = await request(app)
        .patch("/billings/5/payment-status")
        .send({ status: "unpaid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot be reverted/i);
    });

    it("allows marking an unpaid bill as paid", async () => {
      db.query.mockResolvedValueOnce([[{ payment_status: "unpaid" }]]);
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp();
      const res = await request(app)
        .patch("/billings/5/payment-status")
        .send({ status: "paid" });

      expect(res.status).toBe(200);
      expect(res.body.payment_status).toBe("paid");
    });
  });
});