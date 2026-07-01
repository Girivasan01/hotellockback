describe("studioDb", () => {
  const originalStudioDbName = process.env.STUDIO_DB_NAME;

  afterEach(() => {
    if (originalStudioDbName === undefined) {
      delete process.env.STUDIO_DB_NAME;
    } else {
      process.env.STUDIO_DB_NAME = originalStudioDbName;
    }
    jest.resetModules();
  });

  describe("getStudioDbName", () => {
    it("returns STUDIO_DB_NAME from environment", () => {
      process.env.STUDIO_DB_NAME = "custom_studio_db";
      const { getStudioDbName } = require("../../utils/studioDb");
      expect(getStudioDbName()).toBe("custom_studio_db");
    });

    it("defaults to studio_admin when env is not set", () => {
      delete process.env.STUDIO_DB_NAME;
      const { getStudioDbName } = require("../../utils/studioDb");
      expect(getStudioDbName()).toBe("studio_admin");
    });
  });

  describe("loadEnterpriseRecord", () => {
    it("returns local enterprise data when available", async () => {
      const mockDb = {
        query: jest
          .fn()
          .mockResolvedValueOnce([
            [{ isActive: 1, expiry_date: "2027-01-01", storageLimitGb: 5 }],
          ]),
      };

      const { loadEnterpriseRecord } = require("../../utils/studioDb");
      const record = await loadEnterpriseRecord(mockDb, 10);

      expect(record.isActive).toBe(1);
      expect(record.storageLimitGb).toBe(5);
    });

    it("returns null when orgId is missing", async () => {
      const { loadEnterpriseRecord } = require("../../utils/studioDb");
      expect(await loadEnterpriseRecord({}, null)).toBeNull();
    });
  });

  describe("loadStorageUsage", () => {
    it("returns zero usage when orgId is missing", async () => {
      const { loadStorageUsage } = require("../../utils/studioDb");
      const usage = await loadStorageUsage({}, null);

      expect(usage).toEqual({
        usedBytes: 0,
        usedGb: 0,
        limitGb: 0,
        remainingGb: 0,
        source: "none",
      });
    });

    it("calculates usage from local enterprise cache", async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValueOnce([
          [
            {
              storageLimitGb: 10,
              storageUsedBytes: 1073741824,
            },
          ],
        ]),
      };

      const { loadStorageUsage } = require("../../utils/studioDb");
      const usage = await loadStorageUsage(mockDb, 5);

      expect(usage.source).toBe("local");
      expect(usage.limitGb).toBe(10);
      expect(usage.usedGb).toBe(1);
      expect(usage.remainingGb).toBe(9);
    });
  });
});
