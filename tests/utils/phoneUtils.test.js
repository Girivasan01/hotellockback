const { normalizeWhatsAppNumber } = require("../../utils/phoneUtils");

describe("phoneUtils", () => {
  it("normalizes 10-digit Indian mobile numbers", () => {
    expect(normalizeWhatsAppNumber("9876543210")).toBe("919876543210");
  });

  it("keeps numbers that already include country code", () => {
    expect(normalizeWhatsAppNumber("+91 9876543210")).toBe("919876543210");
  });

  it("returns null for invalid numbers", () => {
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
  });
});
