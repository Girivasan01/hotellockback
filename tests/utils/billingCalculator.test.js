const {
  roundMoney,
  extractDatePart,
  daysBetween,
  getGstRateForType,
  calculateBillingTotals,
} = require("../../utils/billingCalculator");

describe("billingCalculator", () => {
  describe("roundMoney", () => {
    it("rounds to two decimal places", () => {
      expect(roundMoney(10.556)).toBe(10.56);
      expect(roundMoney(10.554)).toBe(10.55);
    });

    it("handles nullish and zero values", () => {
      expect(roundMoney(null)).toBe(0);
      expect(roundMoney(undefined)).toBe(0);
      expect(roundMoney(0)).toBe(0);
    });
  });

  describe("extractDatePart", () => {
    it("extracts YYYY-MM-DD from datetime strings", () => {
      expect(extractDatePart("2026-06-01 14:30:00")).toBe("2026-06-01");
      expect(extractDatePart("2026-06-01T14:30:00")).toBe("2026-06-01");
    });

    it("returns null for empty input", () => {
      expect(extractDatePart(null)).toBeNull();
      expect(extractDatePart("")).toBeNull();
    });
  });

  describe("daysBetween", () => {
    it("returns 1 for same-day stay", () => {
      expect(daysBetween("2026-06-01 10:00:00", "2026-06-01 18:00:00")).toBe(1);
    });

    it("counts nights across multiple days", () => {
      expect(daysBetween("2026-06-01", "2026-06-03")).toBe(2);
      expect(daysBetween("2026-06-01", "2026-06-04")).toBe(3);
    });

    it("defaults to 1 when dates are missing", () => {
      expect(daysBetween(null, "2026-06-03")).toBe(1);
      expect(daysBetween("2026-06-01", null)).toBe(1);
    });
  });

  describe("getGstRateForType", () => {
    it("returns configured GST rates", () => {
      expect(getGstRateForType("room")).toBe(0.05);
      expect(getGstRateForType("kitchen")).toBe(0.05);
      expect(getGstRateForType("addon")).toBe(0);
    });

    it("returns 0 for unknown types", () => {
      expect(getGstRateForType("unknown")).toBe(0);
    });
  });

  describe("calculateBillingTotals", () => {
    it("calculates room-only billing with GST", () => {
      const result = calculateBillingTotals({
        stayDays: 2,
        roomRatePerNight: 1000,
        kitchenTotal: 0,
        addonTotal: 0,
        discount: 0,
        advancePaid: 0,
      });

      expect(result.stayDays).toBe(2);
      expect(result.roomTotal).toBe(2000);
      expect(result.subtotal).toBe(2000);
      expect(result.gstAmount).toBe(100);
      expect(result.totalAmount).toBe(2100);
      expect(result.finalPayable).toBe(2100);
      expect(result.gstBreakdown.room).toBe(100);
      expect(result.gstBreakdown.kitchen).toBe(0);
      expect(result.gstBreakdown.addon).toBe(0);
    });

    it("includes kitchen and addon totals with correct GST split", () => {
      const result = calculateBillingTotals({
        stayDays: 1,
        roomRatePerNight: 2000,
        kitchenTotal: 500,
        addonTotal: 200,
        discount: 0,
        advancePaid: 0,
      });

      expect(result.subtotal).toBe(2700);
      expect(result.gstBreakdown.room).toBe(100);
      expect(result.gstBreakdown.kitchen).toBe(25);
      expect(result.gstBreakdown.addon).toBe(0);
      expect(result.gstAmount).toBe(125);
      expect(result.totalAmount).toBe(2825);
    });

    it("applies discount and advance payment to final payable", () => {
      const result = calculateBillingTotals({
        stayDays: 1,
        roomRatePerNight: 1000,
        kitchenTotal: 0,
        addonTotal: 0,
        discount: 100,
        advancePaid: 500,
      });

      expect(result.discount).toBe(100);
      expect(result.advancePaid).toBe(500);
      expect(result.totalAmount).toBe(1045);
      expect(result.finalPayable).toBe(445);
      expect(result.balanceAmount).toBe(445);
    });

    it("derives stay days from check-in and check-out when stayDays omitted", () => {
      const result = calculateBillingTotals({
        checkIn: "2026-06-01 12:00:00",
        checkOut: "2026-06-03 11:00:00",
        roomRatePerNight: 500,
      });

      expect(result.stayDays).toBe(2);
      expect(result.roomTotal).toBe(1000);
    });

    it("derives room rate per night from room total and stay days", () => {
      const result = calculateBillingTotals({
        stayDays: 4,
        roomTotal: 4000,
      });

      expect(result.roomRatePerNight).toBe(1000);
      expect(result.roomTotal).toBe(4000);
    });

    it("enforces minimum of 1 stay day", () => {
      const result = calculateBillingTotals({
        stayDays: 0,
        roomRatePerNight: 800,
      });

      expect(result.stayDays).toBe(1);
      expect(result.roomTotal).toBe(800);
    });
  });
});
