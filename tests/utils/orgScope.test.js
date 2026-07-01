const { getOrgId, requireOrgId, withOrgFilter } = require("../../utils/orgScope");

describe("orgScope", () => {
  describe("getOrgId", () => {
    it("returns org_id from authenticated user", () => {
      const req = { user: { org_id: 42 } };
      expect(getOrgId(req)).toBe(42);
    });

    it("returns null when user or org_id is missing", () => {
      expect(getOrgId({})).toBeNull();
      expect(getOrgId({ user: {} })).toBeNull();
      expect(getOrgId({ user: { org_id: null } })).toBeNull();
    });
  });

  describe("requireOrgId", () => {
    it("returns org_id when present", () => {
      const req = { user: { org_id: 7 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      expect(requireOrgId(req, res)).toBe(7);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("responds with 403 when org_id is missing", () => {
      const req = { user: { id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      expect(requireOrgId(req, res)).toBeNull();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "No organization is linked to this account. Contact your administrator.",
      });
    });
  });

  describe("withOrgFilter", () => {
    it("appends WHERE org_id when query has no WHERE clause", () => {
      const { sql, params } = withOrgFilter("SELECT * FROM bookings", 5);

      expect(sql).toBe("SELECT * FROM bookings WHERE org_id = ?");
      expect(params).toEqual([5]);
    });

    it("appends AND org_id when query already has WHERE", () => {
      const { sql, params } = withOrgFilter(
        "SELECT * FROM bookings WHERE status = ?",
        5,
      );

      expect(sql).toBe("SELECT * FROM bookings WHERE status = ? AND org_id = ?");
      expect(params).toEqual([5]);
    });

    it("supports table alias for org_id column", () => {
      const { sql, params } = withOrgFilter(
        "SELECT * FROM bookings b WHERE b.status = ?",
        9,
        "b",
      );

      expect(sql).toBe(
        "SELECT * FROM bookings b WHERE b.status = ? AND b.org_id = ?",
      );
      expect(params).toEqual([9]);
    });
  });
});
