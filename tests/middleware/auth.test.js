process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const express = require("express");
const bcrypt = require("bcryptjs");

jest.mock("../../db/database", () => ({
  query: jest.fn(),
}));

jest.mock("../../middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = req.__testUser || { id: 1, role: "admin", org_id: 10 };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  },
}));

jest.mock("../../utils/studioDb", () => ({
  loadEnterpriseRecord: jest.fn(),
  loadStorageUsage: jest.fn(),
}));

const db = require("../../db/database");
const {
  loadEnterpriseRecord,
  loadStorageUsage,
} = require("../../utils/studioDb");
const authRouter = require("../../routes/auth");

function buildApp(testUser) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (testUser) req.__testUser = testUser;
    next();
  });
  app.use("/auth", authRouter);
  return app;
}

describe("routes/auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /auth/login", () => {
    it("returns 400 when email or password missing", async () => {
      const app = buildApp();
      const res = await request(app).post("/auth/login").send({ email: "" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Missing fields" });
    });

    it("returns 500 when JWT_SECRET is not configured", async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@test.com", password: "secret" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Server config error" });

      process.env.JWT_SECRET = originalSecret;
    });

    it("returns 401 when user does not exist", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "missing@test.com", password: "secret" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid credentials" });
    });

    it("returns 500 when user has no password on record", async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, email: "a@test.com" }]]);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@test.com", password: "secret" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Corrupted user data" });
    });

    it("returns 401 when password does not match", async () => {
      const hash = await bcrypt.hash("correct-password", 10);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: "a@test.com",
            password: hash,
            role: "admin",
            org_id: 10,
          },
        ],
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@test.com", password: "wrong-password" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid credentials" });
    });

    it("returns 403 when subscription is expired", async () => {
      const hash = await bcrypt.hash("secret", 10);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: "a@test.com",
            password: hash,
            role: "admin",
            org_id: 10,
          },
        ],
      ]);
      loadEnterpriseRecord.mockResolvedValue({
        isActive: 1,
        expiry_date: "2020-01-01",
      });

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@test.com", password: "secret" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message:
          "Subscription expired or inactive. Please contact Webaac Solutions to renew.",
        code: "SUBSCRIPTION_EXPIRED",
      });
    });

    it("returns a token and safe user on successful login", async () => {
      const hash = await bcrypt.hash("secret", 10);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: "a@test.com",
            password: hash,
            role: "admin",
            org_id: 10,
            name: "Admin",
          },
        ],
      ]);
      loadEnterpriseRecord.mockResolvedValue(null);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@test.com", password: "secret" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.email).toBe("a@test.com");
    });
  });

  describe("POST /auth/kitchen-login", () => {
    it("rejects non-kitchen accounts", async () => {
      const hash = await bcrypt.hash("secret", 10);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: "a@test.com",
            password: hash,
            role: "admin",
            org_id: 10,
          },
        ],
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/kitchen-login")
        .send({ email: "a@test.com", password: "secret" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: "Kitchen login accepts kitchen accounts only",
      });
    });
  });

  describe("POST /auth/register-kitchen", () => {
    it("returns 400 when required fields are missing", async () => {
      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app)
        .post("/auth/register-kitchen")
        .send({ name: "Chef" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when password is too short", async () => {
      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).post("/auth/register-kitchen").send({
        name: "Chef",
        email: "chef@test.com",
        password: "123",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Password must be at least 6 characters",
      });
    });

    it("returns 409 when email already registered", async () => {
      db.query.mockResolvedValueOnce([[{ id: 5 }]]);

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).post("/auth/register-kitchen").send({
        name: "Chef",
        email: "chef@test.com",
        password: "secret123",
      });

      expect(res.status).toBe(409);
    });

    it("returns 403 when admin account has no org_id", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp({ id: 1, role: "admin", org_id: null });
      const res = await request(app).post("/auth/register-kitchen").send({
        name: "Chef",
        email: "chef@test.com",
        password: "secret123",
      });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: "Your account is not linked to an organization",
      });
    });

    it("registers a kitchen user successfully", async () => {
      db.query.mockResolvedValueOnce([[]]);
      db.query.mockResolvedValueOnce([{ insertId: 22 }]);

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).post("/auth/register-kitchen").send({
        name: "Chef",
        email: "chef@test.com",
        password: "secret123",
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        id: 22,
        name: "Chef",
        email: "chef@test.com",
        role: "kitchen",
      });
    });
  });

  describe("GET /auth/profile", () => {
    it("returns staff profile details when user is staff", async () => {
      db.query.mockResolvedValueOnce([
        [{ id: 3, name: "Housekeeping", phone: "999", status: "active" }],
      ]);

      const app = buildApp({ id: 1, role: "staff", staffId: 3 });
      const res = await request(app).get("/auth/profile");

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Housekeeping");
      expect(res.body.role).toBe("staff");
    });

    it("returns 404 when staff record no longer exists", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp({ id: 1, role: "staff", staffId: 99 });
      const res = await request(app).get("/auth/profile");

      expect(res.status).toBe(404);
    });

    it("returns req.user directly for non-staff roles", async () => {
      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).get("/auth/profile");

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("admin");
    });
  });

  describe("GET /auth/staff-list", () => {
    it("returns 403 when user has no org_id", async () => {
      const app = buildApp({ id: 1, role: "admin", org_id: null });
      const res = await request(app).get("/auth/staff-list");

      expect(res.status).toBe(403);
    });

    it("returns active staff scoped to the organization", async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: "Ravi" }]]);

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).get("/auth/staff-list");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, name: "Ravi" }]);
      expect(db.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });
  });

  describe("PUT /auth/change-password", () => {
    it("returns 400 when fields are missing", async () => {
      const app = buildApp({ id: 1, role: "admin" });
      const res = await request(app)
        .put("/auth/change-password")
        .send({ currentPassword: "old" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when new password is too short", async () => {
      const app = buildApp({ id: 1, role: "admin" });
      const res = await request(app).put("/auth/change-password").send({
        currentPassword: "old-password",
        newPassword: "123",
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when user is not found", async () => {
      db.query.mockResolvedValueOnce([[]]);

      const app = buildApp({ id: 1, role: "admin" });
      const res = await request(app).put("/auth/change-password").send({
        currentPassword: "old-password",
        newPassword: "new-password",
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when current password is incorrect", async () => {
      const hash = await bcrypt.hash("actual-password", 10);
      db.query.mockResolvedValueOnce([[{ password: hash }]]);

      const app = buildApp({ id: 1, role: "admin" });
      const res = await request(app).put("/auth/change-password").send({
        currentPassword: "wrong-password",
        newPassword: "new-password",
      });

      expect(res.status).toBe(401);
    });

    it("updates the password successfully", async () => {
      const hash = await bcrypt.hash("old-password", 10);
      db.query.mockResolvedValueOnce([[{ password: hash }]]);
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp({ id: 1, role: "admin" });
      const res = await request(app).put("/auth/change-password").send({
        currentPassword: "old-password",
        newPassword: "new-password",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        "Password changed successfully. Please login again.",
      );
    });
  });

  describe("GET /auth/subscription-status", () => {
    it("reports active subscription when no enterprise record exists", async () => {
      loadEnterpriseRecord.mockResolvedValue(null);

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).get("/auth/subscription-status");

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
      expect(res.body.warningLevel).toBeNull();
    });

    it("reports expired warning level when past expiry", async () => {
      loadEnterpriseRecord.mockResolvedValue({
        isActive: 1,
        expiry_date: "2020-01-01",
      });

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).get("/auth/subscription-status");

      expect(res.status).toBe(200);
      expect(res.body.warningLevel).toBe("expired");
    });
  });

  describe("GET /auth/storage-usage", () => {
    it("returns 403 for non-admin users", async () => {
      const app = buildApp({ id: 1, role: "staff", org_id: 10 });
      const res = await request(app).get("/auth/storage-usage");

      expect(res.status).toBe(403);
    });

    it("returns storage usage for admin users", async () => {
      loadStorageUsage.mockResolvedValue({
        usedBytes: 100,
        usedGb: 0.1,
        limitGb: 5,
        remainingGb: 4.9,
        source: "local",
      });

      const app = buildApp({ id: 1, role: "admin", org_id: 10 });
      const res = await request(app).get("/auth/storage-usage");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("local");
      expect(loadStorageUsage).toHaveBeenCalledWith(db, 10);
    });
  });
});
