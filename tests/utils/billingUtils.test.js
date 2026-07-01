const {
  HOTEL_GST_NUMBER,
  DEFAULT_GST_RATES,
  computeGST,
} = require("../../utils/billingUtils");

describe("billingUtils", () => {
  it("exposes hotel GST number and default rates", () => {
    expect(HOTEL_GST_NUMBER).toBe("33AMQPK7880E2ZO");
    expect(DEFAULT_GST_RATES).toEqual({
      room: 0.05,
      kitchen: 0.05,
      addon: 0,
    });
  });

  describe("computeGST", () => {
    it("adds 5% GST for room charges", () => {
      const result = computeGST("room", 1000);

      expect(result.gst_rate).toBe(0.05);
      expect(result.gst_amount).toBe(50);
      expect(result.total).toBe(1050);
    });

    it("adds 5% GST for kitchen charges", () => {
      const result = computeGST("kitchen", 200);

      expect(result.gst_rate).toBe(0.05);
      expect(result.gst_amount).toBe(10);
      expect(result.total).toBe(210);
    });

    it("returns zero GST for add-ons", () => {
      const result = computeGST("addon", 500);

      expect(result.gst).toBe(0);
      expect(result.total).toBe(500);
    });

    it("returns zero GST for unknown types", () => {
      const result = computeGST("misc", 300);

      expect(result.gst).toBe(0);
      expect(result.total).toBe(300);
    });
  });
});
