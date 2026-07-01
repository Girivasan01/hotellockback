process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");

jest.mock("../../db/database", () => ({
  query: jest.fn(),
}));

const { requireAuth, requireAdmin } = require("../../middleware/auth");
const db = require("../../db/database");

describe("auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    const makeRes = () => ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    });

    it("returns 401 when no token is provided", async () => {
      const req = { headers: {}, cookies: {} };
      const res = makeRes();
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Not authenticated" });
      expect(next).not.toHaveBeenCalled();
    });

    it("accepts Bearer token and attaches user to request", async () => {
      const token = jwt.sign({ id: 1, org_id: 10 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
      const res = makeRes();
      const next = jest.fn();

      db.query.mockResolvedValueOnce([
        [{ id: 1, name: "Admin User", email: "admin@test.com", role: "admin", staff_id: null, org_id: 10 }],
      ]);

      await requireAuth(req, res, next);

      expect(req.user).toEqual({
        id: 1,
        role: "admin",
        name: "Admin User",
        staffId: null,
        org_id: 10,
        email: "admin@test.com",
      });
      expect(next).toHaveBeenCalled();
    });

    it("accepts token from cookies", async () => {
      const token = jwt.sign({ id: 2 }, process.env.JWT_SECRET);
      const req = { headers: {}, cookies: { token } };
      const res = makeRes();
      const next = jest.fn();

      db.query.mockResolvedValueOnce([
        [{ id: 2, name: "Staff", email: "staff@test.com", role: "staff", staff_id: 5, org_id: 3 }],
      ]);
      db.query.mockResolvedValueOnce([[{ name: "Kitchen Staff" }]]);

      await requireAuth(req, res, next);

      expect(req.user.name).toBe("Kitchen Staff");
      expect(req.user.org_id).toBe(3);
      expect(next).toHaveBeenCalled();
    });

    it("returns 401 for invalid token", async () => {
      const req = { headers: { authorization: "Bearer invalid-token" }, cookies: {} };
      const res = makeRes();
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    });

    it("returns 401 when user no longer exists", async () => {
      const token = jwt.sign({ id: 99 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
      const res = makeRes();
      const next = jest.fn();

      db.query.mockResolvedValueOnce([[]]);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    });
  });

  describe("requireAdmin", () => {
    it("blocks non-admin users", () => {
      const req = { user: { role: "staff" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Admin access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("allows admin users", () => {
      const req = { user: { role: "admin" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
