jest.mock("../../services/dbService", () => ({
  get: jest.fn(),
  all: jest.fn(),
  getKitchenBillingSummary: jest.fn(),
  getBookingAddons: jest.fn(),
  run: jest.fn(),
}));

jest.mock("../../services/invoiceService", () => ({
  getInvoiceData: jest.fn(),
}));

const dbService = require("../../services/dbService");
const invoiceService = require("../../services/invoiceService");
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
      dbService.getKitchenBillingSummary.mockResolvedValue({
        kitchenTotal: 350,
      });
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

  describe("getBillings", () => {
    it("filters out downloaded billings by default and scopes by org", async () => {
      dbService.all.mockResolvedValue([]);
      dbService.get.mockResolvedValue({ count: 0 });

      await billingService.getBillings({ orgId });

      expect(dbService.all).toHaveBeenCalledWith(
        expect.stringContaining("COALESCE(b.is_downloaded, 0) = 0"),
        [orgId, 50, 0],
      );
      expect(dbService.get).toHaveBeenCalledWith(
        expect.stringContaining("WHERE b.org_id = ?"),
        [orgId],
      );
    });

    it("includes downloaded billings when includeDownloaded is true", async () => {
      dbService.all.mockResolvedValue([]);
      dbService.get.mockResolvedValue({ count: 0 });

      await billingService.getBillings({ orgId, includeDownloaded: true });

      expect(dbService.all).toHaveBeenCalledWith(
        expect.not.stringContaining("COALESCE(b.is_downloaded, 0) = 0"),
        [orgId, 50, 0],
      );
    });

    it("applies search filter across booking id, customer name and gst number", async () => {
      dbService.all.mockResolvedValue([]);
      dbService.get.mockResolvedValue({ count: 0 });

      await billingService.getBillings({ orgId, search: "BK-1" });

      expect(dbService.all).toHaveBeenCalledWith(
        expect.stringContaining(
          "(b.booking_id LIKE ? OR c.name LIKE ? OR b.gst_number LIKE ?)",
        ),
        [orgId, "%BK-1%", "%BK-1%", "%BK-1%", 50, 0],
      );
    });

    it("paginates results and returns page metadata", async () => {
      dbService.all.mockResolvedValue([{ id: 1 }]);
      dbService.get.mockResolvedValue({ count: 12 });

      const result = await billingService.getBillings({
        orgId,
        page: 2,
        limit: 5,
      });

      expect(dbService.all).toHaveBeenCalledWith(expect.any(String), [
        orgId,
        5,
        5,
      ]);
      expect(result.billings).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        pages: 3,
      });
    });
  });

  describe("getBillingDetails", () => {
    it("delegates to invoiceService.getInvoiceData with billingId and orgId", async () => {
      invoiceService.getInvoiceData.mockResolvedValue({ id: 7 });

      const result = await billingService.getBillingDetails(7, orgId);

      expect(invoiceService.getInvoiceData).toHaveBeenCalledWith(7, orgId);
      expect(result).toEqual({ id: 7 });
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

  describe("getProfitSummary", () => {
    it("returns totals scoped to org without a date range", async () => {
      dbService.get.mockResolvedValue({
        total_bills: 4,
        revenue: 8000,
        avg_bill: 2000,
        total_advance: 1200,
      });

      const result = await billingService.getProfitSummary({ orgId });

      expect(dbService.get).toHaveBeenCalledWith(
        expect.not.stringContaining("BETWEEN"),
        [orgId],
      );
      expect(result).toEqual({
        total_bills: 4,
        revenue: 8000,
        avg_bill: 2000,
        total_advance: 1200,
      });
    });

    it("applies a date range filter when startDate and endDate are provided", async () => {
      dbService.get.mockResolvedValue({
        total_bills: 2,
        revenue: 4000,
        avg_bill: 2000,
        total_advance: 500,
      });

      await billingService.getProfitSummary({
        orgId,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      });

      expect(dbService.get).toHaveBeenCalledWith(
        expect.stringContaining("DATE(b.created_at) BETWEEN ? AND ?"),
        [orgId, "2026-06-01", "2026-06-30"],
      );
    });

    it("falls back to zeroed summary when no rows are returned", async () => {
      dbService.get.mockResolvedValue(null);

      const result = await billingService.getProfitSummary({ orgId });

      expect(result).toEqual({
        total_bills: 0,
        revenue: 0,
        avg_bill: 0,
        total_advance: 0,
      });
    });
  });
});
