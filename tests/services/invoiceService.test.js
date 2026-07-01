jest.mock("../../services/dbService", () => ({
  get: jest.fn(),
  all: jest.fn(),
}));

const dbService = require("../../services/dbService");
const invoiceService = require("../../services/invoiceService");

describe("invoiceService", () => {
  const orgId = 10;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getInvoiceData", () => {
    it("throws when billing record is not found", async () => {
      dbService.get.mockResolvedValue(null);

      await expect(invoiceService.getInvoiceData(99, orgId)).rejects.toThrow(
        "Billing not found",
      );
    });

    it("returns grouped line items and computed totals", async () => {
      dbService.get.mockResolvedValue({
        id: 1,
        booking_id: 7,
        customer_name: "Jane Doe",
        check_in: "2026-06-01 14:00:00",
        check_out: "2026-06-02 11:00:00",
        total_amount: 1785,
        discount: 0,
        advance_paid: 500,
        org_id: orgId,
      });
      dbService.all.mockResolvedValue([
        {
          id: 1,
          type: "room",
          description: "Room 101",
          quantity: 1,
          unit_price: 1500,
          subtotal: 1500,
          gst_rate: 0.05,
          total: 1500,
        },
        {
          id: 2,
          type: "kitchen",
          description: "Lunch",
          quantity: 1,
          unit_price: 200,
          subtotal: 200,
          gst_rate: 0.05,
          total: 200,
        },
      ]);

      const invoice = await invoiceService.getInvoiceData(1, orgId);

      expect(dbService.get).toHaveBeenCalledWith(
        expect.stringContaining("WHERE b.id = ? AND b.org_id = ?"),
        [1, orgId],
      );
      expect(invoice.lines.room).toHaveLength(1);
      expect(invoice.lines.kitchen).toHaveLength(1);
      expect(invoice.totals.room_total).toBe(1500);
      expect(invoice.totals.kitchen_total).toBe(200);
      expect(invoice.totals.grand_total).toBe(1785);
      expect(invoice.totals.final_payable).toBe(1285);
      expect(invoice.hotel_gst).toBe("33AMQPK7880E2ZO");
      expect(invoice.balance).toBe(invoice.totals.final_payable);
    });

    it("falls back to billing total when no line items exist", async () => {
      dbService.get.mockResolvedValue({
        id: 2,
        check_in: "2026-06-01",
        check_out: "2026-06-02",
        total_amount: 2000,
        discount: 200,
        advance_paid: 300,
      });
      dbService.all.mockResolvedValue([]);

      const invoice = await invoiceService.getInvoiceData(2, orgId);

      expect(invoice.totals.grand_total).toBe(2000);
      expect(invoice.totals.final_payable).toBe(1500);
      expect(invoice.totals.gst_total).toBe(0);
    });
  });

  describe("getInvoiceSummary", () => {
    it("returns a compact invoice summary for display", async () => {
      dbService.get.mockResolvedValue({
        id: 3,
        booking_id: 12,
        customer_name: "Ravi",
        room_number: "305",
        category: "Suite",
        check_in: "2026-06-01",
        check_out: "2026-06-02",
        total_amount: 1500,
        discount: 0,
        advance_paid: 0,
        gst_number: "33AMQPK7880E2ZO",
      });
      dbService.all.mockResolvedValue([
        {
          id: 1,
          type: "room",
          description: "Room 305",
          quantity: 1,
          unit_price: 1500,
          subtotal: 1500,
          gst_rate: 0.05,
          total: 1500,
        },
      ]);

      const summary = await invoiceService.getInvoiceSummary(3);

      expect(summary.bill_id).toBe(3);
      expect(summary.customer_name).toBe("Ravi");
      expect(summary.room).toBe("305 (Suite)");
      expect(summary.total_amount).toBe(1500);
      expect(summary.gst_number).toBe("33AMQPK7880E2ZO");
      expect(summary.line_items.room).toHaveLength(1);
    });
  });
});
