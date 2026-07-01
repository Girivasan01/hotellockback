jest.mock("../../services/dbService", () => ({
  get: jest.fn(),
  getKitchenBillingSummary: jest.fn(),
  getBookingAddons: jest.fn(),
  run: jest.fn(),
}));

const dbService = require("../../services/dbService");
const billingService = require("../../services/billingService");

describe("billingService", () => {
  const orgId = 10;

  const bookingRow = {
    booking_id: 42,
    customer_id: 5,
    customer_name: "John Doe",
    contact: "9876543210",
    address: "Chennai",
    room_id: 3,
    room_number: "201",
    category: "Standard",
    check_in: "2026-06-01 14:00:00",
    check_out: "2026-06-03 11:00:00",
    price: 1200,
    discount: 100,
    advance_paid: 500,
    org_id: orgId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBillingPreview", () => {
    it("throws when booking is not found for the organization", async () => {
      dbService.get.mockResolvedValue(null);

      await expect(
        billingService.getBillingPreview("BK-999", orgId),
      ).rejects.toThrow("Booking not found");
    });

    it("returns a full billing preview with totals for checkout modal", async () => {
      dbService.get.mockResolvedValue(bookingRow);
      dbService.getKitchenBillingSummary.mockResolvedValue({ kitchenTotal: 350 });
      dbService.getBookingAddons.mockResolvedValue([
        { id: 1, name: "Breakfast", price: 150 },
      ]);

      const preview = await billingService.getBillingPreview("BK-42", orgId);

      expect(dbService.get).toHaveBeenCalledWith(
        expect.stringContaining("WHERE b.booking_id = ? AND b.org_id = ?"),
        ["BK-42", orgId],
      );
      expect(preview.booking_id).toBe(42);
      expect(preview.customer_name).toBe("John Doe");
      expect(preview.stay_days).toBe(2);
      expect(preview.room_charges).toBe(2400);
      expect(preview.kitchen_total).toBe(350);
      expect(preview.add_ons_total).toBe(150);
      expect(preview.discount).toBe(100);
      expect(preview.advance_paid).toBe(500);
      expect(preview.add_ons).toHaveLength(1);
      expect(preview.totalAmount).toBeGreaterThan(0);
      expect(preview.balanceAmount).toBe(
        preview.totalAmount - preview.discount - preview.advance_paid,
      );
    });

    it("uses price_per_night when booking price is not set", async () => {
      dbService.get.mockResolvedValue({
        ...bookingRow,
        price: null,
        price_per_night: 800,
        check_out: "2026-06-02 11:00:00",
      });
      dbService.getKitchenBillingSummary.mockResolvedValue({ kitchenTotal: 0 });
      dbService.getBookingAddons.mockResolvedValue([]);

      const preview = await billingService.getBillingPreview("BK-42", orgId);

      expect(preview.room_charges).toBe(800);
      expect(preview.stay_days).toBe(1);
    });
  });

  describe("markDownloaded", () => {
    it("updates billing download status scoped to organization", async () => {
      dbService.run.mockResolvedValue({ changes: 1 });

      await billingService.markDownloaded(15, "33AMQPK7880E2ZO", orgId);

      expect(dbService.run).toHaveBeenCalledWith(
        "UPDATE billings SET is_downloaded = 1, gst_number = ? WHERE id = ? AND org_id = ?",
        ["33AMQPK7880E2ZO", 15, orgId],
      );
    });
  });
});
